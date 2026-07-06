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
 * Tempel rincian SP2D LIVE + anak SPM ke satu baris pembayaran (tanpa mengubah
 * data tersimpan). sp2d_rincian/sp2d_lengkap = jalur LEGACY (live-derive dari
 * SP2D_MONITORING via _rincianSp2dDalamKampus_, 23_sp2d.gs) — dipertahankan
 * HANYA untuk bulan sebelum SPM aktif (Jan-Mar 2026, lihat docs/skema-sheet.md
 * §9). `spm` = baris SPM (§18) anak bayar_id ini — KOSONG untuk bulan legacy
 * (tidak digenerate retroaktif), TERISI untuk bulan baru. Frontend membedakan
 * tampilan lama vs baru dari ada/tidaknya array `spm`.
 */
function _bayarDenganSp2d_(b) {
  var bln = _bulanStr_(b.bulan);
  var r = _rincianSp2dDalamKampus_(bln);
  var salin = {};
  Object.keys(b).forEach(function (k) { salin[k] = b[k]; });
  // Normalisasi bulan sebelum dikirim ke klien — sheet bisa auto-tertafsir
  // Date, membuat frontend (yang mencocokkan string 'YYYY-MM' persis) gagal
  // menemukan pembayaran yang BARU DIBUAT (tampak seperti tidak berefek).
  salin.bulan = bln;
  salin.sp2d_rincian = r.kelompok;
  salin.sp2d_lengkap = r.lengkap;
  salin.sp2d_perlu_cek_manual = r.perlu_cek_manual;
  salin.spm = sheetRead(SHEETS.SPM, function (s) { return String(s.bayar_id) === String(b.bayar_id); });
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

/**
 * Buat pembayaran: syarat rekap bulan FINAL (PPK finalkan = siap bayar);
 * nilai_total = SUM(nominal) snapshot. Kolom no_spm/tgl_spm/no_sp2d/tgl_sp2d/
 * konfirmasi_senat_at TIDAK diisi lagi (legacy, lihat docs/skema-sheet.md §9)
 * — begitu baris PEMBAYARAN dibuat, LANGSUNG generate baris SPM (§18) anaknya
 * lewat _generateSpmDalamKampus_ (satu per kelompok Prodi+Tingkat+Suplier).
 * Dibungkus withLock utuh (bukan cuma tiap sheetAppend) — cek dobel + generate
 * SPM harus atomik, reentrant jadi aman bersarang dgn lock sheetAppend sendiri.
 */
function bayarCreate(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');

  return withLock(function () {
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
      status: 'DIAJUKAN'
    };
    sheetAppend(SHEETS.PEMBAYARAN, obj);
    auditLog(session, 'bayar.create', 'PEMBAYARAN', obj.bayar_id, null,
      { bulan: bulan, nilai_total: total, kontrak_id: kontrak.kontrak_id });

    var spm = _generateSpmDalamKampus_(bulan, obj.bayar_id, session);
    return { pembayaran: obj, spm: spm };
  });
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

/* ═══════════════════════════════════════════════════════════════════════
 * SPM (§18 skema-sheet.md) — header kelompok AUTHORED, kategori DALAM_KAMPUS.
 * Beda provenance dari SP2D_MONITORING (23_sp2d.gs, imported): SPM ditulis
 * satker (PPK) SEBELUM SP2D terbit, lalu diisi hasilnya begitu SP2D terbit
 * (1 SPM = 1 SP2D, dikonfirmasi Firdaus). SPM kategori LUAR_KAMPUS digenerate
 * dari action terpisah spm.generate_luar_kampus (lihat 19_bantuan_luar_kampus.gs).
 * ═══════════════════════════════════════════════════════════════════════ */

/** Ambil satu baris SPM by id atau error. */
function _spm_(id) {
  var s = sheetRead(SHEETS.SPM, function (r) { return String(r.spm_id) === String(id); })[0];
  if (!s) throw _fail_('SPM tidak ditemukan: ' + id);
  return s;
}

/**
 * Generate baris SPM kategori DALAM_KAMPUS untuk satu bulan/bayar_id, satu
 * baris per kelompok (prodi, tingkat, penyedia_id) dari REKAP_BULANAN bulan
 * itu (nominal > 0 saja — taruna yang tidak makan bulan ini tidak masuk grup
 * mana pun, sama seperti Form-10). Satu suplier SELALU melayani satu kelompok
 * prodi+tingkat utuh (dikonfirmasi Firdaus), jadi kelompok ini otomatis = satu
 * SP2D KPPN (1:1, lihat §18). MENOLAK bila ada taruna ber-REKAP nominal>0 yang
 * TARUNA_REKENING.penyedia_id-nya kosong/tak terdaftar — split per suplier
 * tidak boleh menghasilkan grup "suplier kosong" (pesan menyebut NIT/nama).
 */
function _generateSpmDalamKampus_(bulan, bayarId, session) {
  var rekapRows = sheetRead(SHEETS.REKAP_BULANAN, function (r) {
    return _bulanStr_(r.bulan) === bulan && _int_(r.nominal || 0, 'nominal') > 0;
  });

  var tarunaByNit = {};
  sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });
  var nitList = rekapRows.map(function (r) { return String(r.nit); });
  var rekeningByNit = {};
  sheetRead(SHEETS.TARUNA_REKENING, function (r) { return nitList.indexOf(String(r.nit)) >= 0; })
    .forEach(function (r) { rekeningByNit[String(r.nit)] = r; });

  var tanpaSuplier = [];
  rekapRows.forEach(function (r) {
    var rek = rekeningByNit[String(r.nit)];
    if (!rek || !rek.penyedia_id) {
      var t = tarunaByNit[String(r.nit)] || {};
      tanpaSuplier.push(String(r.nit) + (t.nama ? (' (' + t.nama + ')') : ''));
    }
  });
  if (tanpaSuplier.length) {
    throw _fail_('Tidak bisa membuat SPM — taruna berikut belum punya suplier ' +
      '(penyedia_id di TARUNA_REKENING) padahal ber-REKAP bulan ' + bulan + ': ' +
      tanpaSuplier.join(', ') + '. Lengkapi dulu lewat rekening.simpan.');
  }

  var kelompok = {};
  rekapRows.forEach(function (r) {
    var t = tarunaByNit[String(r.nit)] || {};
    var rek = rekeningByNit[String(r.nit)];
    var kunci = (t.prodi || '') + '|' + (t.tingkat || '') + '|' + rek.penyedia_id;
    if (!kelompok[kunci]) {
      kelompok[kunci] = { prodi: t.prodi || '', tingkat: t.tingkat || '', penyedia_id: rek.penyedia_id, nominal: 0 };
    }
    kelompok[kunci].nominal += _int_(r.nominal || 0, 'nominal');
  });

  var dibuat = [];
  Object.keys(kelompok).sort().forEach(function (k) {
    var g = kelompok[k];
    var obj = {
      spm_id: nextId('SPM'), kategori: 'DALAM_KAMPUS', bayar_id: bayarId, bulan: bulan,
      prodi: g.prodi, tingkat: g.tingkat, penyedia_id: g.penyedia_id,
      kegiatan: '', pembayaran_ke: '', periode: '',
      nominal: g.nominal, no_spm: '', tgl_spm: '', no_sp2d: '', tgl_sp2d: '',
      status: 'DRAFT'
    };
    sheetAppend(SHEETS.SPM, obj);
    dibuat.push(obj);
  });

  auditLog(session, 'spm.generate', 'SPM', bayarId, null,
    { kategori: 'DALAM_KAMPUS', bulan: bulan, jumlah: dibuat.length });
  return dibuat;
}

/**
 * Bila SEMUA SPM anak bayarId (kategori DALAM_KAMPUS) sudah SP2D_TERBIT,
 * tandai PEMBAYARAN SELESAI (+ audit). Dipanggil dari spmSetSp2d. Silent
 * (tidak melempar error) bila belum lengkap atau PEMBAYARAN sudah SELESAI.
 */
function _cekSelesaikanPembayaranDariSpm_(bayarId, session) {
  var anak = sheetRead(SHEETS.SPM, function (r) {
    return String(r.bayar_id) === String(bayarId) && r.kategori === 'DALAM_KAMPUS';
  });
  if (!anak.length || !anak.every(function (r) { return r.status === 'SP2D_TERBIT'; })) return;
  var b = sheetRead(SHEETS.PEMBAYARAN, function (r) { return String(r.bayar_id) === String(bayarId); })[0];
  if (!b || b.status !== 'DIAJUKAN') return;
  sheetUpdate(SHEETS.PEMBAYARAN, 'bayar_id', bayarId, { status: 'SELESAI' });
  auditLog(session, 'bayar.sync', 'PEMBAYARAN', bayarId,
    { status: b.status }, { status: 'SELESAI', sumber: 'SPM_LENGKAP' });
}

/** spm.list {bulan?, bayar_id?, kategori?} — daftar SPM (kedua kategori). */
function spmList(payload, session) {
  var f = payload || {};
  var rows = sheetRead(SHEETS.SPM, function (r) {
    if (f.bulan && _bulanStr_(r.bulan) !== f.bulan) return false;
    if (f.bayar_id && String(r.bayar_id) !== String(f.bayar_id)) return false;
    if (f.kategori && String(r.kategori) !== f.kategori) return false;
    return true;
  });
  return { spm: rows };
}

/**
 * spm.update {spm_id, no_spm?, tgl_spm?, status?} — isi nomor SPM & ajukan
 * (DRAFT→DIAJUKAN, nominal & kunci kelompok beku begitu DIAJUKAN — lihat
 * _generateSpmDalamKampus_/spm.generate_luar_kampus, tidak ada mekanisme
 * ubah nominal di sini). SELAMA status ≠ SP2D_TERBIT, no_spm/tgl_spm boleh
 * diedit ulang berkali-kali (menangani SPM ditolak/dikembalikan KPPN — tidak
 * ada status DITOLAK terpisah, dikonfirmasi Firdaus).
 */
function spmUpdate(payload, session) {
  var s = _spm_(payload && payload.spm_id);
  if (s.status === 'SP2D_TERBIT') {
    throw _fail_('SPM ' + s.spm_id + ' sudah SP2D_TERBIT — tidak bisa diubah lagi.');
  }

  var patch = {};
  if (payload.no_spm !== undefined) patch.no_spm = String(payload.no_spm);
  if (payload.tgl_spm) patch.tgl_spm = _wajibTgl_(payload.tgl_spm, 'tgl_spm');
  if (payload.status !== undefined && payload.status !== s.status) {
    if (payload.status === 'DIAJUKAN' && s.status === 'DRAFT') {
      patch.status = 'DIAJUKAN';
    } else {
      throw _fail_('Transisi status SPM tidak valid: ' + s.status + ' → ' + payload.status + '.');
    }
  }

  if (Object.keys(patch).length) {
    sheetUpdate(SHEETS.SPM, 'spm_id', s.spm_id, patch);
    auditLog(session, 'spm.update', 'SPM', s.spm_id,
      { no_spm: s.no_spm, tgl_spm: s.tgl_spm, status: s.status }, patch);
  }
  return { spm_id: s.spm_id, status: patch.status || s.status };
}

/**
 * spm.set_sp2d {spm_id, no_sp2d, tgl_sp2d} — isi hasil SP2D (1:1 dgn SPM) →
 * status SP2D_TERBIT. Syarat: SPM harus sudah DIAJUKAN (KPPN tidak menerbitkan
 * SP2D untuk SPM yang belum diajukan). Untuk kategori DALAM_KAMPUS, begitu
 * SEMUA SPM bulan itu SP2D_TERBIT, PEMBAYARAN induknya otomatis SELESAI.
 */
function spmSetSp2d(payload, session) {
  var s = _spm_(payload && payload.spm_id);
  if (s.status !== 'DIAJUKAN') {
    throw _fail_('SPM ' + s.spm_id + ' harus berstatus DIAJUKAN dulu (status sekarang ' + s.status + ').');
  }
  var noSp2d = String((payload && payload.no_sp2d) || '').trim();
  if (!noSp2d) throw _fail_('no_sp2d wajib diisi.');
  var tglSp2d = _wajibTgl_(payload && payload.tgl_sp2d, 'tgl_sp2d');

  var patch = { no_sp2d: noSp2d, tgl_sp2d: tglSp2d, status: 'SP2D_TERBIT' };
  sheetUpdate(SHEETS.SPM, 'spm_id', s.spm_id, patch);
  auditLog(session, 'spm.set_sp2d', 'SPM', s.spm_id, { status: s.status }, patch);

  if (s.kategori === 'DALAM_KAMPUS' && s.bayar_id) {
    _cekSelesaikanPembayaranDariSpm_(s.bayar_id, session);
  }
  return { spm_id: s.spm_id, status: 'SP2D_TERBIT' };
}

/**
 * spm.regenerate {bayar_id} — re-derive SPM DALAM_KAMPUS dari REKAP_BULANAN
 * terbaru (mis. rekap dikoreksi setelah SPM dibuat, sebelum diajukan). HANYA
 * boleh selama SEMUA SPM grup itu masih DRAFT — kalau ada yang sudah
 * DIAJUKAN/SP2D_TERBIT, nominal & kunci kelompoknya sudah beku, regenerate
 * ditolak supaya tidak menghapus SPM yang sudah diajukan ke KPPN.
 */
function spmRegenerate(payload, session) {
  var bayarId = payload && payload.bayar_id;
  if (!bayarId) throw _fail_('bayar_id wajib diisi.');
  var b = _bayar_(bayarId);

  return withLock(function () {
    var lama = sheetRead(SHEETS.SPM, function (r) {
      return String(r.bayar_id) === String(bayarId) && r.kategori === 'DALAM_KAMPUS';
    });
    var belumDraft = lama.filter(function (r) { return r.status !== 'DRAFT'; });
    if (belumDraft.length) {
      throw _fail_('Tidak bisa regenerate — ' + belumDraft.length + ' SPM sudah diajukan/cair: ' +
        belumDraft.map(function (r) { return r.spm_id; }).join(', '));
    }

    var idLama = lama.map(function (r) { return r.spm_id; });
    if (idLama.length) {
      sheetDeleteRows(SHEETS.SPM, 'spm_id', idLama);
      lama.forEach(function (r) { auditLog(session, 'spm.regenerate', 'SPM', r.spm_id, r, null); });
    }
    var baru = _generateSpmDalamKampus_(b.bulan, bayarId, session);
    return { dihapus: idLama.length, dibuat: baru.length, spm: baru };
  });
}
