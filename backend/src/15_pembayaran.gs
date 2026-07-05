/**
 * 15_pembayaran.gs — Pembayaran LS via KPPN (SOP no. 11–17)
 * Mesin status: DIAJUKAN → SP2D_TERBIT → DITRANSFER → DIKONFIRMASI → SELESAI
 *
 * ACTION: bayar.list, bayar.get (PPK, KPA, Senat),
 *         bayar.create, bayar.update, bayar.close (PPK),
 *         bayar.confirm (Senat)
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
  var rows = sheetRead(SHEETS.PEMBAYARAN, function (r) {
    return !bulan || String(r.bulan) === bulan;
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

  var dobel = sheetRead(SHEETS.PEMBAYARAN, function (r) { return String(r.bulan) === bulan; })[0];
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
 * Isi SPM/SP2D bertahap — status naik sesuai urutan:
 * DIAJUKAN + no_sp2d terisi → SP2D_TERBIT; SP2D_TERBIT + ditransfer:true → DITRANSFER.
 * Payload {bayar_id, no_spm?, tgl_spm?, no_sp2d?, tgl_sp2d?, ditransfer?, berkas?}.
 */
function bayarUpdate(payload, session) {
  var b = _bayar_(payload && payload.bayar_id);
  if (b.status === 'DIKONFIRMASI' || b.status === 'SELESAI') {
    throw _fail_('Pembayaran berstatus ' + b.status + ' — tidak bisa diubah lagi.');
  }

  var patch = {};
  if (payload.no_spm !== undefined) patch.no_spm = String(payload.no_spm);
  if (payload.tgl_spm) patch.tgl_spm = _wajibTgl_(payload.tgl_spm, 'tgl_spm');
  if (payload.no_sp2d !== undefined) patch.no_sp2d = String(payload.no_sp2d);
  if (payload.tgl_sp2d) patch.tgl_sp2d = _wajibTgl_(payload.tgl_sp2d, 'tgl_sp2d');

  // Kenaikan status berurutan
  var statusBaru = b.status;
  if (b.status === 'DIAJUKAN' && (patch.no_sp2d || b.no_sp2d)) statusBaru = 'SP2D_TERBIT';
  if ((statusBaru === 'SP2D_TERBIT') && payload.ditransfer === true) statusBaru = 'DITRANSFER';
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

/** Senat: DITRANSFER → DIKONFIRMASI (invoice diterima penyedia, SOP 15–16). */
function bayarConfirm(payload, session) {
  var b = _bayar_(payload && payload.bayar_id);
  if (b.status !== 'DITRANSFER') {
    throw _fail_('Pembayaran berstatus ' + b.status + ', tidak bisa dikonfirmasi (butuh DITRANSFER).');
  }
  sheetUpdate(SHEETS.PEMBAYARAN, 'bayar_id', b.bayar_id,
    { status: 'DIKONFIRMASI', konfirmasi_senat_at: new Date() });
  auditLog(session, 'bayar.confirm', 'PEMBAYARAN', b.bayar_id,
    { status: b.status }, { status: 'DIKONFIRMASI' });
  return { bayar_id: b.bayar_id, status: 'DIKONFIRMASI' };
}

/** PPK: DIKONFIRMASI → SELESAI (SOP 17). */
function bayarClose(payload, session) {
  var b = _bayar_(payload && payload.bayar_id);
  if (b.status !== 'DIKONFIRMASI') {
    throw _fail_('Pembayaran berstatus ' + b.status + ', tidak bisa ditutup (butuh DIKONFIRMASI).');
  }
  sheetUpdate(SHEETS.PEMBAYARAN, 'bayar_id', b.bayar_id, { status: 'SELESAI' });
  auditLog(session, 'bayar.close', 'PEMBAYARAN', b.bayar_id, { status: b.status }, { status: 'SELESAI' });
  return { bayar_id: b.bayar_id, status: 'SELESAI' };
}
