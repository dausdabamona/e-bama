/**
 * 05_master.gs — Master data penyedia & kontrak + util domain bersama
 *
 * ACTION: penyedia.list, penyedia.upsert (Admin, PPK),
 *         kontrak.list, kontrak.upsert (PPK), kontrak.approve (PPK)
 *
 * Lampiran kontrak (menu & nilai gizi, BA penunjukan, notulen) → LAMPIRAN ref_type=KONTRAK.
 * Setiap aksi tulis → withLock + auditLog.
 */

// ── Util domain bersama (dipakai modul 10–16) ───────────────────────────────

/** Normalisasi nilai sel tanggal → string 'yyyy-MM-dd'. */
function _tglStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var s = String(v || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return s; // biarkan apa adanya bila bukan pola tanggal
  return s.slice(0, 10);
}

/** Bulan 'yyyy-MM' dari tanggal (Date/string). */
function _bulanStr_(v) { return _tglStr_(v).slice(0, 7); }

/** Tanggal hari ini 'yyyy-MM-dd' (zona waktu skrip = Asia/Jayapura). */
function _todayStr_() { return _tglStr_(new Date()); }

/** Validasi & konversi integer ≥0 (uang/jumlah). Tolak pecahan — aturan uang integer. */
function _int_(v, nama) {
  var n = Number(v);
  if (!isFinite(n) || Math.floor(n) !== n || n < 0) throw _fail_(nama + ' harus bilangan bulat ≥ 0.');
  return n;
}

/** Validasi pola tanggal 'yyyy-MM-dd'. */
function _wajibTgl_(v, nama) {
  var s = String(v || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw _fail_(nama + ' wajib format YYYY-MM-DD.');
  return s;
}

/** Validasi pola bulan 'yyyy-MM'. */
function _wajibBulan_(v, nama) {
  var s = String(v || '').trim();
  if (!/^\d{4}-\d{2}$/.test(s)) throw _fail_(nama + ' wajib format YYYY-MM.');
  return s;
}

/**
 * Normalisasi mask 4 digit terakhir (rek_mask / npwp_mask).
 * Terima '1234', '••••1234', '****1234' → simpan '••••1234'.
 * TOLAK bila memuat >4 digit angka (indikasi nomor lengkap — dilarang masuk sistem).
 */
function _mask4_(v, nama) {
  var s = String(v || '').trim();
  if (!s) throw _fail_(nama + ' wajib diisi.');
  var digit = s.replace(/\D/g, '');
  if (digit.length > 4) throw _fail_(nama + ' hanya boleh 4 digit terakhir — nomor lengkap DILARANG masuk sistem.');
  if (digit.length < 4) throw _fail_(nama + ' harus tepat 4 digit terakhir.');
  return '••••' + digit;
}

/** Kontrak aktif (DISETUJUI_PPK, tgl_mulai ≤ tanggal ≤ tgl_akhir) atau error. */
function _kontrakAktifPada_(tanggal) {
  var t = _tglStr_(tanggal);
  var rows = sheetRead(SHEETS.KONTRAK, function (r) {
    return r.status === 'DISETUJUI_PPK' && _tglStr_(r.tgl_mulai) <= t && t <= _tglStr_(r.tgl_akhir);
  });
  if (!rows.length) throw _fail_('Tidak ada kontrak aktif (DISETUJUI_PPK) pada tanggal ' + t + '.');
  return rows[0];
}

// ── Penyedia ────────────────────────────────────────────────────────────────

/** Daftar penyedia. */
function penyediaList(payload, session) {
  return { penyedia: sheetRead(SHEETS.PENYEDIA) };
}

/** Tambah/ubah penyedia. Baru → penyedia_id PNY-000001. */
function penyediaUpsert(payload, session) {
  var nama = String((payload && payload.nama) || '').trim();
  if (!nama) throw _fail_('nama penyedia wajib diisi.');
  var status = (payload && payload.status) ? String(payload.status) : 'AKTIF';
  if (ENUM.AKTIF_STATUS.indexOf(status) < 0) throw _fail_('status tidak valid.');
  var npwp = _mask4_(payload.npwp_mask, 'npwp_mask');
  var obj = {
    nama: nama,
    kontak: String((payload && payload.kontak) || ''),
    alamat: String((payload && payload.alamat) || ''),
    npwp_mask: npwp,
    status: status
  };

  var id = payload && payload.penyedia_id;
  if (id) {
    var lama = sheetRead(SHEETS.PENYEDIA, function (r) { return String(r.penyedia_id) === String(id); })[0];
    if (!lama) throw _fail_('Penyedia tidak ditemukan: ' + id);
    sheetUpdate(SHEETS.PENYEDIA, 'penyedia_id', id, obj);
    auditLog(session, 'penyedia.upsert', 'PENYEDIA', id, lama, obj);
    obj.penyedia_id = id;
    return { penyedia: obj };
  }
  obj.penyedia_id = nextId('PNY');
  sheetAppend(SHEETS.PENYEDIA, obj);
  auditLog(session, 'penyedia.upsert', 'PENYEDIA', obj.penyedia_id, null, obj);
  return { penyedia: obj };
}

// ── Kontrak ─────────────────────────────────────────────────────────────────

/** Daftar kontrak. */
function kontrakList(payload, session) {
  return { kontrak: sheetRead(SHEETS.KONTRAK) };
}

/** Detail kontrak + lampiran (menu & nilai gizi, BA penunjukan, notulen). */
function kontrakGet(payload, session) {
  var id = String((payload && payload.kontrak_id) || '').trim();
  var k = sheetRead(SHEETS.KONTRAK, function (r) { return String(r.kontrak_id) === id; })[0];
  if (!k) throw _fail_('Kontrak tidak ditemukan: ' + id);
  return { kontrak: k, lampiran: lampiranList('KONTRAK', id) };
}

/** Tambah/ubah kontrak (hanya selama DRAFT). Baru → KTR-000001, status DRAFT. */
function kontrakUpsert(payload, session) {
  var pid = String((payload && payload.penyedia_id) || '').trim();
  if (!pid) throw _fail_('penyedia_id wajib diisi.');
  var penyedia = sheetRead(SHEETS.PENYEDIA, function (r) { return String(r.penyedia_id) === pid; })[0];
  if (!penyedia) throw _fail_('Penyedia tidak ditemukan: ' + pid);

  var obj = {
    penyedia_id: pid,
    harga_per_porsi: _int_(payload.harga_per_porsi, 'harga_per_porsi'),
    porsi_per_hari: _int_(payload.porsi_per_hari, 'porsi_per_hari'),
    tgl_mulai: _wajibTgl_(payload.tgl_mulai, 'tgl_mulai'),
    tgl_akhir: _wajibTgl_(payload.tgl_akhir, 'tgl_akhir')
  };
  if (obj.tgl_mulai > obj.tgl_akhir) throw _fail_('tgl_mulai tidak boleh setelah tgl_akhir.');

  var id = payload && payload.kontrak_id;
  if (id) {
    var lama = sheetRead(SHEETS.KONTRAK, function (r) { return String(r.kontrak_id) === String(id); })[0];
    if (!lama) throw _fail_('Kontrak tidak ditemukan: ' + id);
    if (lama.status !== 'DRAFT') throw _fail_('Kontrak berstatus ' + lama.status + ' — hanya DRAFT yang boleh diubah.');
    sheetUpdate(SHEETS.KONTRAK, 'kontrak_id', id, obj);
    auditLog(session, 'kontrak.upsert', 'KONTRAK', id, lama, obj);
    obj.kontrak_id = id;
    return { kontrak: obj };
  }
  obj.kontrak_id = nextId('KTR');
  obj.status = 'DRAFT';
  obj.approved_by = '';
  obj.approved_at = '';
  sheetAppend(SHEETS.KONTRAK, obj);
  auditLog(session, 'kontrak.upsert', 'KONTRAK', obj.kontrak_id, null, obj);
  return { kontrak: obj };
}

/** Setujui kontrak: DRAFT → DISETUJUI_PPK (SOP no. 4). */
function kontrakApprove(payload, session) {
  var id = String((payload && payload.kontrak_id) || '').trim();
  if (!id) throw _fail_('kontrak_id wajib diisi.');
  var lama = sheetRead(SHEETS.KONTRAK, function (r) { return String(r.kontrak_id) === id; })[0];
  if (!lama) throw _fail_('Kontrak tidak ditemukan: ' + id);
  if (lama.status !== 'DRAFT') throw _fail_('Kontrak berstatus ' + lama.status + ', tidak bisa disetujui.');
  var patch = { status: 'DISETUJUI_PPK', approved_by: session.user_id, approved_at: new Date() };
  sheetUpdate(SHEETS.KONTRAK, 'kontrak_id', id, patch);
  auditLog(session, 'kontrak.approve', 'KONTRAK', id, { status: lama.status }, { status: 'DISETUJUI_PPK' });
  return { kontrak_id: id, status: 'DISETUJUI_PPK' };
}

/**
 * Unggah lampiran kontrak (menu & nilai gizi, BA penunjukan, notulen rapat).
 * Payload {kontrak_id, berkas:{base64, nama_file, jenis}}. Boleh kapan saja
 * (DRAFT maupun DISETUJUI_PPK) — dokumen pendukung bisa menyusul.
 */
function kontrakLampiranUpload(payload, session) {
  var id = String((payload && payload.kontrak_id) || '').trim();
  var k = sheetRead(SHEETS.KONTRAK, function (r) { return String(r.kontrak_id) === id; })[0];
  if (!k) throw _fail_('Kontrak tidak ditemukan: ' + id);
  var berkas = payload && payload.berkas;
  if (!berkas || !berkas.base64) throw _fail_('Berkas wajib diisi.');
  var jenis = berkas.jenis || 'LAINNYA';
  if (ENUM.LAMPIRAN_JENIS.indexOf(jenis) < 0) throw _fail_('jenis lampiran tidak valid.');
  var hasil = lampiranSave(session, 'KONTRAK', id, jenis, berkas.base64, berkas.nama_file);
  auditLog(session, 'kontrak.lampiran_upload', 'KONTRAK', id, null, { jenis: jenis, lamp_id: hasil.lamp_id });
  return hasil;
}
