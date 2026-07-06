/**
 * 05_master.gs — Master data penyedia & kontrak + util domain bersama
 *
 * ACTION: penyedia.list, penyedia.upsert (Admin, PPK),
 *         kontrak.list, kontrak.upsert (PPK), kontrak.approve (PPK),
 *         menu.list, menu.upsert (PPK) — menu mingguan terjadwal per kontrak
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

// Nama hari (indeks getDay(): 0=Minggu..6=Sabtu) — SAMA PERSIS dengan
// NAMA_HARI di frontend (pesanan-buat.tsx) supaya komposisi pengantaran
// (Malam hari-D + Pagi/Siang hari D+1) konsisten di kedua sisi.
var _NAMA_HARI_ = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];

/**
 * Nama hari (SENIN..MINGGU) dari 'YYYY-MM-DD' — parse komponen y/m/d LOKAL
 * (bukan `new Date(string)`, yang ditafsir UTC dan bisa tergeser sehari
 * tergantung timezone eksekusi) lalu `new Date(y, m-1, d)` murni kalender,
 * tidak terpengaruh timezone. Kembalikan '' bila format tidak valid.
 */
function _hariDalamMinggu_(tgl) {
  var p = String(tgl || '').split('-').map(function (s) { return parseInt(s, 10); });
  if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return '';
  return _NAMA_HARI_[new Date(p[0], p[1] - 1, p[2]).getDay()];
}

/** Tanggal 'YYYY-MM-DD' digeser n hari — komponen lokal, lihat _hariDalamMinggu_. */
function _tambahHari_(tgl, n) {
  var p = String(tgl || '').split('-').map(function (s) { return parseInt(s, 10); });
  if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return tgl;
  var d = new Date(p[0], p[1] - 1, p[2] + n);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

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

/** Daftar tanggal 'yyyy-MM-dd' dari `dari` s.d. `sampai` inklusif. Maks 186 hari (±6 bulan). */
function _daftarTanggal_(dari, sampai) {
  if (sampai < dari) throw _fail_('tgl_akhir tidak boleh sebelum tanggal.');
  var out = [];
  var d = new Date(dari + 'T00:00:00');
  var akhir = new Date(sampai + 'T00:00:00');
  while (d <= akhir) {
    out.push(_tglStr_(d));
    d.setDate(d.getDate() + 1);
    if (out.length > 186) throw _fail_('Rentang tanggal maksimal 186 hari.');
  }
  return out;
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

/**
 * Tarif harian per taruna dari kontrak — utamakan `harga_per_hari` (model
 * baru sejak migrasi harga per-porsi → per-hari, dikonfirmasi Firdaus);
 * fallback ke `harga_per_porsi × porsi_per_hari` untuk kontrak lama yang
 * belum diisi ulang. Satu sumber kebenaran — semua konsumer (rekap, cetak
 * Form-01/04, portal Penyedia, Laporan Resmi) pakai helper ini/field
 * `harga_per_hari_efektif` turunannya, tidak menghitung ulang sendiri.
 */
function _hargaPerHariKontrak_(kontrak) {
  var hariRp = _int_(kontrak.harga_per_hari || 0, 'harga_per_hari');
  if (hariRp > 0) return hariRp;
  var harga = _int_(kontrak.harga_per_porsi || 0, 'harga_per_porsi');
  var porsi = _int_(kontrak.porsi_per_hari || 0, 'porsi_per_hari');
  return harga * porsi;
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

/** Sisipkan harga_per_hari_efektif (lihat _hargaPerHariKontrak_) ke baris kontrak. */
function _kontrakDenganTarifEfektif_(k) {
  return Object.assign({}, k, { harga_per_hari_efektif: _hargaPerHariKontrak_(k) });
}

/** Daftar kontrak. */
function kontrakList(payload, session) {
  return { kontrak: sheetRead(SHEETS.KONTRAK).map(_kontrakDenganTarifEfektif_) };
}

/** Detail kontrak + lampiran (menu & nilai gizi, BA penunjukan, notulen). */
function kontrakGet(payload, session) {
  var id = String((payload && payload.kontrak_id) || '').trim();
  var k = sheetRead(SHEETS.KONTRAK, function (r) { return String(r.kontrak_id) === id; })[0];
  if (!k) throw _fail_('Kontrak tidak ditemukan: ' + id);
  return { kontrak: _kontrakDenganTarifEfektif_(k), lampiran: lampiranList('KONTRAK', id) };
}

/** Tambah/ubah kontrak (hanya selama DRAFT). Baru → KTR-000001, status DRAFT. */
function kontrakUpsert(payload, session) {
  var pid = String((payload && payload.penyedia_id) || '').trim();
  if (!pid) throw _fail_('penyedia_id wajib diisi.');
  var penyedia = sheetRead(SHEETS.PENYEDIA, function (r) { return String(r.penyedia_id) === pid; })[0];
  if (!penyedia) throw _fail_('Penyedia tidak ditemukan: ' + pid);

  var obj = {
    penyedia_id: pid,
    // harga_per_hari = tarif utama (rupiah/taruna/hari) sejak migrasi harga per-porsi
    // → per-hari. harga_per_porsi sudah OPSIONAL (legacy/fallback, lihat
    // _hargaPerHariKontrak_) — form Tambah/Ubah Kontrak tidak lagi memintanya, tapi
    // TETAP dikirim (pass-through nilai lama) supaya kontrak lama yang masih
    // mengandalkan fallback tidak tertimpa jadi 0 (sheetUpdate = patch per-kolom).
    harga_per_hari: _int_(payload.harga_per_hari, 'harga_per_hari'),
    harga_per_porsi: _int_(payload.harga_per_porsi || 0, 'harga_per_porsi'),
    porsi_per_hari: _int_(payload.porsi_per_hari, 'porsi_per_hari'),
    tgl_mulai: _wajibTgl_(payload.tgl_mulai, 'tgl_mulai'),
    tgl_akhir: _wajibTgl_(payload.tgl_akhir, 'tgl_akhir'),
    // Data dokumen kontrak riil (semua opsional). Rekening penyedia = nomor PENUH
    // (payee bisnis, bukan rekening pribadi taruna) → dipakai Form-07/09.
    no_kontrak: String((payload && payload.no_kontrak) || '').trim(),
    tgl_kontrak: (payload && payload.tgl_kontrak) ? _wajibTgl_(payload.tgl_kontrak, 'tgl_kontrak') : '',
    adendum: String((payload && payload.adendum) || '').trim(),
    rek_penyedia_bni: String((payload && payload.rek_penyedia_bni) || '').replace(/\D/g, ''),
    rek_penyedia_bsi: String((payload && payload.rek_penyedia_bsi) || '').replace(/\D/g, '')
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

// ── Menu Kontrak ──────────────────────────────────────────────────────────────
// Menu mingguan terjadwal (referensi hari-dalam-minggu, BUKAN snapshot per
// tanggal). Terpisah dari kolom bebas PESANAN.menu yang diisi Senat per hari.

/** Menu mingguan 1 kontrak, urut Senin→Minggu. */
function menuList(payload, session) {
  var kid = String((payload && payload.kontrak_id) || '').trim();
  if (!kid) throw _fail_('kontrak_id wajib diisi.');
  var rows = sheetRead(SHEETS.MENU_KONTRAK, function (r) { return String(r.kontrak_id) === kid; });
  rows.sort(function (a, b) { return ENUM.HARI.indexOf(a.hari) - ENUM.HARI.indexOf(b.hari); });
  return { menu: rows };
}

/**
 * "Menu Hari Ini" (Ownership Taruna Fitur 2a) — Pagi/Siang/Malam tanggal
 * tertentu (default hari ini) dari MENU_KONTRAK kontrak aktif, standar gizi
 * (getKebijakanGizi), dan status verifikasi piket REALISASI tanggal itu bila
 * sudah ada. READ-ONLY murni, NOL data sensitif (tanpa rupiah/rekening/
 * daftar per-taruna) — cocok ditayangkan di papan ruang makan bersama.
 *
 * Komposisi antaran SAMA PERSIS dengan pesananCreate/pesananSuratPenyedia:
 * satu PESANAN.tgl_makan=D mengantar Malam(D) + Pagi/Siang(D+1). Jadi utk
 * TANGGAL T: Malam(T) dari baris MENU_KONTRAK hari=dayOfWeek(T); Pagi/Siang(T)
 * dari baris MENU_KONTRAK hari=dayOfWeek(T-1) (antaran "kemarin", D+1-nya
 * adalah T). Tanpa kontrak aktif → menu kosong (`ada_kontrak:false`), TIDAK error
 * (papan tetap tampil, cuma menu belum ada).
 */
function menuHariIni(payload, session) {
  var tanggal = (payload && payload.tanggal) ? _wajibTgl_(payload.tanggal, 'tanggal') : _todayStr_();

  var kontrak = null;
  try { kontrak = _kontrakAktifPada_(tanggal); } catch (e) { kontrak = null; }

  var menu = { pagi: '', siang: '', malam: '' };
  if (kontrak) {
    var menuRows = sheetRead(SHEETS.MENU_KONTRAK, function (r) { return String(r.kontrak_id) === String(kontrak.kontrak_id); });
    var hariIni = _hariDalamMinggu_(tanggal);
    var hariKemarin = _hariDalamMinggu_(_tambahHari_(tanggal, -1));
    var rowMalam = menuRows.filter(function (r) { return r.hari === hariIni; })[0];
    var rowPagiSiang = menuRows.filter(function (r) { return r.hari === hariKemarin; })[0];
    menu.malam = rowMalam ? String(rowMalam.menu_malam || '') : '';
    menu.pagi = rowPagiSiang ? String(rowPagiSiang.menu_pagi || '') : '';
    menu.siang = rowPagiSiang ? String(rowPagiSiang.menu_siang || '') : '';
  }

  // Status piket tanggal ini bila SUDAH ADA (ambil realisasi ber-piket_at
  // terbaru — satu tanggal bisa >1 realisasi kalau >1 pesanan hari itu).
  var terverifikasi = sheetRead(SHEETS.REALISASI, function (r) {
    return _tglStr_(r.tanggal) === tanggal && r.piket_nit;
  }).sort(function (a, b) { return new Date(b.piket_at) - new Date(a.piket_at); })[0];

  var piket = terverifikasi ? {
    menu_sesuai: Boolean(terverifikasi.piket_menu_sesuai),
    porsi_cukup: Boolean(terverifikasi.piket_porsi_cukup),
    kualitas: String(terverifikasi.piket_kualitas || ''),
    gizi: String(terverifikasi.piket_gizi || '').split(',').filter(function (g) { return g; })
  } : null;

  return {
    tanggal: tanggal, ada_kontrak: Boolean(kontrak),
    menu: menu, standar_gizi: getKebijakanGizi().komponen, piket: piket
  };
}

/** Tambah/ubah menu 1 hari untuk kontrak (PPK). Kunci gabungan: kontrak_id + hari. */
function menuUpsert(payload, session) {
  var kid = String((payload && payload.kontrak_id) || '').trim();
  if (!kid) throw _fail_('kontrak_id wajib diisi.');
  var k = sheetRead(SHEETS.KONTRAK, function (r) { return String(r.kontrak_id) === kid; })[0];
  if (!k) throw _fail_('Kontrak tidak ditemukan: ' + kid);

  var hari = String((payload && payload.hari) || '').trim().toUpperCase();
  if (ENUM.HARI.indexOf(hari) < 0) throw _fail_('hari tidak valid: ' + hari);

  var obj = {
    kontrak_id: kid,
    hari: hari,
    menu_pagi: String((payload && payload.menu_pagi) || '').trim(),
    menu_siang: String((payload && payload.menu_siang) || '').trim(),
    menu_malam: String((payload && payload.menu_malam) || '').trim()
  };

  var lama = sheetRead(SHEETS.MENU_KONTRAK, function (r) {
    return String(r.kontrak_id) === kid && String(r.hari) === hari;
  })[0];

  if (lama) {
    sheetUpdate(SHEETS.MENU_KONTRAK, 'menu_id', lama.menu_id, obj);
    auditLog(session, 'menu.upsert', 'MENU_KONTRAK', lama.menu_id, lama, obj);
    obj.menu_id = lama.menu_id;
    return { menu: obj };
  }
  obj.menu_id = nextId('MNU');
  sheetAppend(SHEETS.MENU_KONTRAK, obj);
  auditLog(session, 'menu.upsert', 'MENU_KONTRAK', obj.menu_id, null, obj);
  return { menu: obj };
}
