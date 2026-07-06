/**
 * 22_rekening.gs — TARUNA_REKENING: nomor rekening LENGKAP taruna (docs/skema-sheet.md §16)
 *
 * ACTION: rekening.lihat_lengkap (ADMIN, PPK), rekening.simpan (ADMIN),
 *         rekening.simpan_batch (ADMIN)
 *
 * PENGECUALIAN KEAMANAN TERBATAS — satu-satunya tempat di e-BAMA yang boleh
 * menyimpan nomor rekening PENUH (di luar sheet ini, semua tempat lain HANYA
 * boleh menyimpan/menampilkan rek_mask 4 digit, lihat CLAUDE.md §4/§7). Setiap
 * pemanggilan rekening.lihat_lengkap yang berhasil WAJIB tercatat di AUDIT_LOG
 * (siapa melihat rekening siapa, kapan) — TANPA nomor rekeningnya sendiri.
 */

/** Peta penyedia_id → baris PENYEDIA (validasi + join nama). */
function _penyediaById_() {
  var m = {};
  sheetRead(SHEETS.PENYEDIA).forEach(function (p) { m[String(p.penyedia_id)] = p; });
  return m;
}

/** Normalisasi payload {nit} atau {nit_list} → array string NIT non-kosong. */
function _normalisasiNitList_(payload) {
  var list = [];
  if (payload && payload.nit_list) list = payload.nit_list;
  else if (payload && payload.nit) list = [payload.nit];
  return list.map(function (n) { return String(n).trim(); }).filter(function (n) { return !!n; });
}

/**
 * rekening.lihat_lengkap {nit} atau {nit_list} → daftar rekening lengkap.
 * Role ADMIN/PPK diperiksa DUA kali: di ACTION_MAP.roles (01_router.gs) DAN
 * di sini via _hanyaAdminPPK_ — supaya handler tidak pernah bergantung
 * satu-satunya pada konfigurasi router.
 */
function rekeningLihatLengkap(payload, session) {
  _hanyaAdminPPK_(session);
  var nitList = _normalisasiNitList_(payload);
  if (!nitList.length) throw _fail_('nit atau nit_list wajib diisi.');

  return withLock(function () {
    var rows = sheetRead(SHEETS.TARUNA_REKENING, function (r) { return nitList.indexOf(String(r.nit)) >= 0; });
    var byNit = {};
    rows.forEach(function (r) { byNit[String(r.nit)] = r; });

    var penyediaMap = _penyediaById_();
    var hasil = nitList.map(function (nit) {
      var r = byNit[nit];
      if (!r) return { nit: nit, no_rekening_lengkap: '', bank: '', nama_pemilik: '', penyedia_id: '', penyedia_nama: '', belum_ada: true };
      var pid = String(r.penyedia_id || '');
      var p = penyediaMap[pid];
      return {
        nit: nit, no_rekening_lengkap: r.no_rekening_lengkap, bank: r.bank, nama_pemilik: r.nama_pemilik,
        penyedia_id: pid, penyedia_nama: p ? p.nama : ''
      };
    });

    // AUDIT: catat SIAPA (session.user_id, via auditLog) melihat rekening SIAPA
    // (daftar NIT) dan KAPAN (timestamp) — JANGAN pernah simpan nomor rekening
    // itu sendiri di AUDIT_LOG, sekalipun di data_baru.
    auditLog(session, 'rekening.lihat_lengkap', 'TARUNA_REKENING', nitList.join(','), null, { nit_list: nitList });

    return { rekening: hasil };
  });
}

/**
 * rekening.cocokkan {no_rekening_list, bulan?, bank?} — arah SEBALIKNYA dari
 * rekening.lihat_lengkap (rekening→NIT, bukan NIT→rekening). Dipakai importer
 * gagal-debet (/tagihan/impor-debet): nomor rekening PENUH dari laporan bank
 * dicocokkan EXACT ke TARUNA_REKENING.no_rekening_lengkap → NIT pemiliknya,
 * bukan tebak nama (nama di laporan bank sering terpotong). Role ADMIN/PPK,
 * diperiksa dua kali (ACTION_MAP.roles + _hanyaAdminPPK_ di sini). WAJIB 1 baris
 * AUDIT_LOG per pemanggilan berhasil — TANPA nomor rekening di AUDIT_LOG.
 */
function rekeningCocokkan(payload, session) {
  _hanyaAdminPPK_(session);
  var daftar = ((payload && payload.no_rekening_list) || [])
    .map(function (n) { return String(n).trim(); })
    .filter(function (n) { return !!n; });
  if (!daftar.length) throw _fail_('no_rekening_list wajib diisi.');

  return withLock(function () {
    var byRekening = {};
    sheetRead(SHEETS.TARUNA_REKENING).forEach(function (r) { byRekening[String(r.no_rekening_lengkap)] = r; });

    var hasil = daftar.map(function (noRek) {
      var r = byRekening[noRek];
      if (!r) return { no_rekening: noRek, ditemukan: false };
      return { no_rekening: noRek, ditemukan: true, nit: r.nit, nama_pemilik: r.nama_pemilik, bank: r.bank };
    });

    // AUDIT: jumlah dicocokkan/ditemukan + konteks (bulan/bank) bila dikirim —
    // JANGAN pernah simpan nomor rekening itu sendiri di AUDIT_LOG.
    var konteks = (payload && payload.bulan ? payload.bulan : '?') + ':' + (payload && payload.bank ? payload.bank : '?');
    auditLog(session, 'rekening.cocokkan', 'TARUNA_REKENING', konteks, null,
      { jumlah_dicocokkan: daftar.length, jumlah_ditemukan: hasil.filter(function (h) { return h.ditemukan; }).length });

    return { hasil: hasil };
  });
}

/**
 * rekening.simpan {nit, no_rekening_lengkap, bank, nama_pemilik, penyedia_id?}
 * — isi/perbarui satu baris. Role ADMIN SAJA (bukan PPK juga) supaya input data
 * sensitif ini tetap satu pintu. `penyedia_id` (opsional) = suplier yang
 * dipasangkan ke rekening taruna ini (FK PENYEDIA) — dipakai memecah pengajuan
 * SPM per suplier (Form-10). Bila key `penyedia_id` tidak dikirim, nilai lama
 * dipertahankan; bila dikirim '' → dikosongkan.
 */
function rekeningSimpan(payload, session) {
  var nit = (payload && payload.nit != null) ? String(payload.nit).trim() : '';
  var noRek = (payload && payload.no_rekening_lengkap != null) ? String(payload.no_rekening_lengkap).trim() : '';
  var bank = payload && payload.bank;
  var namaPemilik = (payload && payload.nama_pemilik != null) ? String(payload.nama_pemilik).trim() : '';
  var kirimPenyedia = payload && payload.penyedia_id !== undefined;
  var penyediaId = kirimPenyedia ? String(payload.penyedia_id || '').trim() : '';

  if (!nit) throw _fail_('nit wajib diisi.');
  if (!sheetRead(SHEETS.TARUNA, function (r) { return String(r.nit) === nit; })[0]) {
    throw _fail_('Taruna tidak ditemukan: ' + nit);
  }
  if (!noRek) throw _fail_('no_rekening_lengkap wajib diisi.');
  if (ENUM.BANK.indexOf(bank) < 0) throw _fail_('bank tidak valid.');
  if (!namaPemilik) throw _fail_('nama_pemilik wajib diisi.');
  if (penyediaId && !_penyediaById_()[penyediaId]) throw _fail_('Penyedia tidak ditemukan: ' + penyediaId);

  return withLock(function () {
    var ada = sheetRead(SHEETS.TARUNA_REKENING, function (r) { return String(r.nit) === nit; })[0];
    var penyediaFinal = kirimPenyedia ? penyediaId : (ada ? String(ada.penyedia_id || '') : '');
    var nilai = {
      nit: nit, no_rekening_lengkap: noRek, bank: bank, nama_pemilik: namaPemilik,
      updated_by: session.user_id, updated_at: new Date(), penyedia_id: penyediaFinal
    };
    if (ada) {
      sheetUpdate(SHEETS.TARUNA_REKENING, 'nit', nit, nilai);
    } else {
      sheetAppend(SHEETS.TARUNA_REKENING, nilai);
    }

    // AUDIT: field yang berubah dicatat, nomor rekeningnya sendiri TIDAK.
    auditLog(session, 'rekening.simpan', 'TARUNA_REKENING', nit,
      ada ? { bank: ada.bank, nama_pemilik: ada.nama_pemilik, penyedia_id: ada.penyedia_id || '' } : null,
      { bank: bank, nama_pemilik: namaPemilik, penyedia_id: penyediaFinal, rekening_diubah: true });

    return { nit: nit, bank: bank, nama_pemilik: namaPemilik, penyedia_id: penyediaFinal };
  });
}

/**
 * rekening.simpan_batch {baris:[{nit, no_rekening_lengkap, bank, nama_pemilik}]}
 * — versi batch rekening.simpan, dipakai utk isi massal dari sumber terpercaya
 * (mis. laporan Autotran bank yang sudah dicocokkan manual ke NIT oleh Admin di
 * frontend — lihat halaman Impor Rekening). Role ADMIN SAJA, sama seperti
 * rekening.simpan. Tiap baris tetap diaudit SATU-SATU (granularitas sama
 * dengan rekening.simpan tunggal), bukan satu baris audit gabungan.
 */
function rekeningSimpanBatch(payload, session) {
  var baris = (payload && payload.baris) || [];
  if (!baris.length) throw _fail_('baris tidak boleh kosong.');

  var tarunaValid = {};
  sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaValid[String(t.nit)] = true; });

  // Validasi semua baris DULU sebelum menulis apa pun (all-or-nothing).
  baris.forEach(function (b) {
    var nit = (b && b.nit != null) ? String(b.nit).trim() : '';
    if (!nit) throw _fail_('nit wajib diisi pada setiap baris.');
    if (!tarunaValid[nit]) throw _fail_('Taruna tidak ditemukan: ' + nit);
    if (!(b.no_rekening_lengkap && String(b.no_rekening_lengkap).trim())) throw _fail_('no_rekening_lengkap wajib diisi untuk NIT ' + nit + '.');
    if (ENUM.BANK.indexOf(b.bank) < 0) throw _fail_('bank tidak valid untuk NIT ' + nit + '.');
    if (!(b.nama_pemilik && String(b.nama_pemilik).trim())) throw _fail_('nama_pemilik wajib diisi untuk NIT ' + nit + '.');
    // penyedia_id di impor batch BOLEH kode suplier eksternal (mis. 7 digit SPAN)
    // yang belum ada di master PENYEDIA — disimpan apa adanya; Form-10 tetap
    // mengelompokkan per ID (nama tampil setelah master diisi). Tidak divalidasi
    // ketat di sini (beda dari rekening.simpan modal yang pakai dropdown terkontrol).
  });

  return withLock(function () {
    var existingByNit = {};
    sheetRead(SHEETS.TARUNA_REKENING).forEach(function (r) { existingByNit[String(r.nit)] = r; });

    var n = 0;
    baris.forEach(function (b) {
      var nit = String(b.nit).trim();
      var noRek = String(b.no_rekening_lengkap).trim();
      var bank = b.bank;
      var namaPemilik = String(b.nama_pemilik).trim();
      var ada = existingByNit[nit];
      // penyedia_id: bila key dikirim (walau '') dipakai; kalau tidak, pertahankan lama.
      var kirimPenyedia = b.penyedia_id !== undefined;
      var penyediaFinal = kirimPenyedia ? String(b.penyedia_id || '').trim() : (ada ? String(ada.penyedia_id || '') : '');
      var nilai = {
        nit: nit, no_rekening_lengkap: noRek, bank: bank, nama_pemilik: namaPemilik,
        updated_by: session.user_id, updated_at: new Date(), penyedia_id: penyediaFinal
      };
      if (ada) {
        sheetUpdate(SHEETS.TARUNA_REKENING, 'nit', nit, nilai);
      } else {
        sheetAppend(SHEETS.TARUNA_REKENING, nilai);
      }
      auditLog(session, 'rekening.simpan', 'TARUNA_REKENING', nit,
        ada ? { bank: ada.bank, nama_pemilik: ada.nama_pemilik, penyedia_id: ada.penyedia_id || '' } : null,
        { bank: bank, nama_pemilik: namaPemilik, penyedia_id: penyediaFinal, rekening_diubah: true, sumber: 'rekening.simpan_batch' });
      n++;
    });

    return { disimpan: n };
  });
}
