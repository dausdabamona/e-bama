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
 * ACTION: bayar.list, bayar.get (PPK, KPA, Senat), bayar.create, bayar.update (PPK).
 * bayar.close tersisa sebagai fallback manual (mis. baris historis yang masih
 * berstatus lama SP2D_TERBIT/DITRANSFER/DIKONFIRMASI dari sebelum
 * penyederhanaan ini) — bukan bagian alur normal lagi.
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

/** Daftar pembayaran, filter {bulan?}. */
function bayarList(payload, session) {
  var bulan = payload && payload.bulan;
  // _bulanStr_ (BUKAN String() polos) — kolom bulan bisa auto-tertafsir Date
  // oleh Google Sheets; String(Date) tidak pernah sama dengan 'YYYY-MM' (lihat
  // catatan sama di 23_sp2d.gs) — bikin pembayaran yang BARU DIBUAT langsung
  // "hilang" dari daftar (tampak seperti bayar.create tidak berefek).
  var rows = sheetRead(SHEETS.PEMBAYARAN, function (r) {
    return !bulan || _bulanStr_(r.bulan) === bulan;
  });
  return { pembayaran: rows };
}

/** Detail pembayaran + lampiran. */
function bayarGet(payload, session) {
  var b = _bayar_(payload && payload.bayar_id);
  return { pembayaran: b, lampiran: lampiranList('PEMBAYARAN', b.bayar_id) };
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
