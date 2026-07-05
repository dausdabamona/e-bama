/**
 * 15_pembayaran.gs — Pembayaran LS via KPPN (SOP no. 11–17)
 *
 * Mesin status DISEDERHANAKAN (dikonfirmasi Firdaus): DIAJUKAN → SELESAI.
 * No. SP2D terisi = dana SUDAH cair ke rekening taruna (SP2D dari KPPN,
 * mekanisme LS) → pembayaran OTOMATIS SELESAI saat itu juga, TANPA langkah
 * konfirmasi Senat atau tutup manual terpisah. Pendebetan 2 tahap
 * (taruna→Senat→Penyedia) TETAP berjalan — tapi lewat DOKUMEN CETAK terpisah
 * (Form-07 lalu Form-09, lihat 21_cetak.gs), yang TIDAK mengunci/menunggu
 * status PEMBAYARAN ini. Begitu No. SP2D diketahui, mencetak & mengirim
 * Form-07 ke bank jadi MENDESAK (uang sudah cair, jendela blokir singkat).
 *
 * ACTION: bayar.list, bayar.get (PPK, KPA, Senat), bayar.create, bayar.update,
 * bayar.sync (PPK). bayar.close tersisa sebagai fallback manual (mis. baris
 * historis yang masih berstatus lama SP2D_TERBIT/DITRANSFER/DIKONFIRMASI dari
 * sebelum penyederhanaan ini) — bukan bagian alur normal lagi.
 *
 * RELASI 1:N dengan SP2D_MONITORING — satu baris PEMBAYARAN (per bulan) mewakili
 * BANYAK SP2D nyata: KPPN menerbitkan satu SP2D per kelompok Prodi+Tingkat (mis.
 * Januari 2026 = 10 SP2D). Field no_spm/no_sp2d di sheet ini cuma "wakil" untuk
 * input manual/fallback — rincian SP2D sebenarnya TIDAK disalin ke sini, tapi
 * diturunkan LIVE dari SP2D_MONITORING lewat _rincianSp2dDalamKampus_ (23_sp2d.gs)
 * dan ditempel di bayar.list/bayar.get sebagai sp2d_rincian + sp2d_lengkap.
 * Begitu SEMUA kelompok Prodi+Tingkat (yang REKAP-nya >0) punya SP2D yang SUM-nya
 * cocok, pembayaran OTOMATIS SELESAI — dijalankan otomatis dari sp2d.import
 * (_sinkronkanPembayaranDariSp2d_) atau manual lewat bayar.sync (untuk kasus SP2D
 * kadung diunggah SEBELUM bayar.create dibuat).
 *
 * nilai_total = SNAPSHOT SUM(nominal) REKAP_BULANAN FINAL — beku setelah ditulis.
 * Lampiran (surat blokir, bukti debet, invoice) → LAMPIRAN ref_type=PEMBAYARAN.
 * Setiap aksi tulis → withLock + auditLog. Uang integer rupiah.
 */

/** Ambil pembayaran by id atau error. */
function _bayar_(id) {
  var b = sheetRead(SHEETS.PEMBAYARAN, function (r) { return String(r.bayar_id) === String(id); })[0];
  if (!b) throw _fail_('Pembayaran tidak ditemukan: ' + id);
  return b;
}

/** Kontrak DISETUJUI_PPK yang periodenya beririsan dengan bulan. */
function _kontrakBulan_(bulan) {
  var awal = bulan + '-01', akhir = bulan + '-31';
  var rows = sheetRead(SHEETS.KONTRAK, function (r) {
    return r.status === 'DISETUJUI_PPK' &&
      _tglStr_(r.tgl_mulai) <= akhir && _tglStr_(r.tgl_akhir) >= awal;
  });
  if (!rows.length) throw _fail_('Tidak ada kontrak DISETUJUI_PPK untuk bulan ' + bulan + '.');
  return rows[0];
}

/**
 * Tempel rincian SP2D LIVE ke satu baris pembayaran (tanpa mengubah data
 * tersimpan). sp2d_rincian = daftar kelompok Prodi+Tingkat (masing-masing
 * dengan sub-daftar No. SP2D), sp2d_lengkap = true bila semua kelompok
 * bersistem >0 sudah cocok. Diturunkan dari SP2D_MONITORING via
 * _rincianSp2dDalamKampus_ (23_sp2d.gs) — 1 PEMBAYARAN : N SP2D.
 */
function _bayarDenganSp2d_(b) {
  var r = _rincianSp2dDalamKampus_(_bulanStr_(b.bulan));
  var salin = {};
  Object.keys(b).forEach(function (k) { salin[k] = b[k]; });
  salin.sp2d_rincian = r.kelompok;
  salin.sp2d_lengkap = r.lengkap;
  salin.sp2d_perlu_cek_manual = r.perlu_cek_manual;
  return salin;
}

/** Daftar pembayaran, filter {bulan?} — diperkaya rincian SP2D live. */
function bayarList(payload, session) {
  var bulan = payload && payload.bulan;
  // _bulanStr_ (BUKAN String() polos) — kolom bulan bisa auto-tertafsir Date
  // oleh Google Sheets; String(Date) tidak pernah sama dengan 'YYYY-MM' (lihat
  // catatan sama di 23_sp2d.gs) — bikin pembayaran yang BARU DIBUAT langsung
  // "hilang" dari daftar (tampak seperti bayar.create tidak berefek).
  var rows = sheetRead(SHEETS.PEMBAYARAN, function (r) {
    return !bulan || _bulanStr_(r.bulan) === bulan;
  });
  return { pembayaran: rows.map(_bayarDenganSp2d_) };
}

/** Detail pembayaran + lampiran + rincian SP2D live. */
function bayarGet(payload, session) {
  var b = _bayar_(payload && payload.bayar_id);
  return { pembayaran: _bayarDenganSp2d_(b), lampiran: lampiranList('PEMBAYARAN', b.bayar_id) };
}

/** Buat pembayaran: syarat rekap bulan FINAL (PPK finalkan = siap bayar); nilai_total = SUM(nominal) snapshot. */
function bayarCreate(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');

  var rekap = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  if (!rekap.length) throw _fail_('Belum ada rekap untuk bulan ' + bulan + '.');
  rekap.forEach(function (r) {
    if (String(r.status) !== 'FINAL') {
      throw _fail_('Rekap bulan ' + bulan + ' belum FINAL (status sekarang ' + r.status +
        ') — alur: Wadir 3 setujui → PPK verifikasi → PPK finalkan, baru pembayaran bisa dibuat.');
    }
  });

  // _bulanStr_ (bukan String() polos) — lihat catatan di bayarList di atas.
  var dobel = sheetRead(SHEETS.PEMBAYARAN, function (r) { return _bulanStr_(r.bulan) === bulan; })[0];
  if (dobel) throw _fail_('Pembayaran bulan ' + bulan + ' sudah ada: ' + dobel.bayar_id);

  var total = 0;
  rekap.forEach(function (r) { total += _int_(r.nominal || 0, 'nominal'); });
  var kontrak = _kontrakBulan_(bulan);

  var obj = {
    bayar_id: nextId('BYR'),
    bulan: bulan,
    kontrak_id: kontrak.kontrak_id,
    nilai_total: total,          // SNAPSHOT — beku, momen penulisan di AUDIT_LOG
    no_spm: '', tgl_spm: '', no_sp2d: '', tgl_sp2d: '',
    konfirmasi_senat_at: '',
    status: 'DIAJUKAN'
  };
  sheetAppend(SHEETS.PEMBAYARAN, obj);
  auditLog(session, 'bayar.create', 'PEMBAYARAN', obj.bayar_id, null,
    { bulan: bulan, nilai_total: total, kontrak_id: kontrak.kontrak_id });
  return { pembayaran: obj };
}

/**
 * Isi SPM/SP2D — begitu No. SP2D terisi (dana SUDAH cair ke rekening taruna),
 * status LANGSUNG SELESAI (dikonfirmasi Firdaus — lihat catatan modul).
 * Payload {bayar_id, no_spm?, tgl_spm?, no_sp2d?, tgl_sp2d?, berkas?}.
 */
function bayarUpdate(payload, session) {
  var b = _bayar_(payload && payload.bayar_id);
  if (b.status === 'SELESAI') {
    throw _fail_('Pembayaran berstatus SELESAI — tidak bisa diubah lagi.');
  }

  var patch = {};
  if (payload.no_spm !== undefined) patch.no_spm = String(payload.no_spm);
  if (payload.tgl_spm) patch.tgl_spm = _wajibTgl_(payload.tgl_spm, 'tgl_spm');
  if (payload.no_sp2d !== undefined) patch.no_sp2d = String(payload.no_sp2d);
  if (payload.tgl_sp2d) patch.tgl_sp2d = _wajibTgl_(payload.tgl_sp2d, 'tgl_sp2d');

  // No. SP2D terisi = dana SUDAH cair ke rekening taruna → langsung SELESAI.
  var statusBaru = b.status;
  if (b.status === 'DIAJUKAN' && (patch.no_sp2d || b.no_sp2d)) statusBaru = 'SELESAI';
  if (statusBaru !== b.status) patch.status = statusBaru;

  if (Object.keys(patch).length) {
    sheetUpdate(SHEETS.PEMBAYARAN, 'bayar_id', b.bayar_id, patch);
    auditLog(session, 'bayar.update', 'PEMBAYARAN', b.bayar_id, { status: b.status }, patch);
  }
  if (payload.berkas && payload.berkas.base64) {
    var jenis = payload.berkas.jenis || 'SURAT';
    if (ENUM.LAMPIRAN_JENIS.indexOf(jenis) < 0) throw _fail_('jenis lampiran tidak valid.');
    lampiranSave(session, 'PEMBAYARAN', b.bayar_id, jenis, payload.berkas.base64, payload.berkas.nama_file);
  }
  return { bayar_id: b.bayar_id, status: statusBaru };
}

/**
 * PPK: tutup manual → SELESAI. BUKAN bagian alur normal lagi (alur normal
 * sudah otomatis lewat bayarUpdate saat No. SP2D diisi) — fallback untuk
 * baris historis yang kadung berstatus lama (SP2D_TERBIT/DITRANSFER/
 * DIKONFIRMASI) dari sebelum penyederhanaan mesin status ini.
 */
function bayarClose(payload, session) {
  var b = _bayar_(payload && payload.bayar_id);
  if (b.status === 'SELESAI') throw _fail_('Pembayaran sudah SELESAI.');
  sheetUpdate(SHEETS.PEMBAYARAN, 'bayar_id', b.bayar_id, { status: 'SELESAI' });
  auditLog(session, 'bayar.close', 'PEMBAYARAN', b.bayar_id, { status: b.status }, { status: 'SELESAI' });
  return { bayar_id: b.bayar_id, status: 'SELESAI' };
}

/**
 * Sinkronkan status PEMBAYARAN dari kelengkapan SP2D_MONITORING. Kalau ada
 * pembayaran bulan `bulan` yang masih DIAJUKAN DAN semua SP2D-nya sudah lengkap
 * (_rincianSp2dDalamKampus_(bulan).lengkap), tandai SELESAI + audit.
 *
 * SENGAJA TIDAK melempar error (return {ok, alasan}) supaya aman dipanggil
 * silent dari sp2dImport (23_sp2d.gs) — kegagalan sinkron (mis. SP2D belum
 * lengkap) BUKAN kegagalan impor. `sumber` ('AUTO_IMPOR'/'MANUAL') dicatat di
 * audit untuk jejak asal transisi. Dibungkus withLock sendiri (reentrant-safe,
 * 03_helpers.gs) supaya aman baik dipanggil dari dalam lock sp2dImport maupun
 * langsung dari action bayarSync.
 */
function _sinkronkanPembayaranDariSp2d_(bulan, session, sumber) {
  var bln = _bulanStr_(bulan);
  return withLock(function () {
    var b = sheetRead(SHEETS.PEMBAYARAN, function (r) { return _bulanStr_(r.bulan) === bln; })[0];
    if (!b) return { ok: false, alasan: 'Belum ada pembayaran untuk bulan ' + bln + '.' };
    if (b.status !== 'DIAJUKAN') return { ok: false, alasan: 'Pembayaran ' + b.bayar_id + ' berstatus ' + b.status + ', tidak disinkronkan.' };

    var rincian = _rincianSp2dDalamKampus_(bln);
    if (!rincian.lengkap) {
      var belum = rincian.kelompok.filter(function (k) { return k.sistem > 0 && !k.cocok; }).length;
      return { ok: false, alasan: 'SP2D belum lengkap: ' + belum + ' kelompok Prodi+Tingkat belum cocok.' };
    }

    sheetUpdate(SHEETS.PEMBAYARAN, 'bayar_id', b.bayar_id, { status: 'SELESAI' });
    auditLog(session, 'bayar.sync', 'PEMBAYARAN', b.bayar_id,
      { status: b.status }, { status: 'SELESAI', sumber: sumber || 'AUTO_IMPOR' });
    return { ok: true, bayar_id: b.bayar_id, status: 'SELESAI' };
  });
}

/**
 * PPK: sinkronkan manual status pembayaran dari SP2D_MONITORING. Untuk kasus
 * SP2D kadung diunggah SEBELUM bayar.create dibuat (auto-sync di sp2dImport tak
 * sempat menemukan barisnya). Payload {bulan}. Kalau belum lengkap → error
 * dengan alasan (bukan silent).
 */
function bayarSync(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var hasil = _sinkronkanPembayaranDariSp2d_(bulan, session, 'MANUAL');
  if (!hasil.ok) throw _fail_(hasil.alasan);
  return { bayar_id: hasil.bayar_id, status: hasil.status };
}
