/**
 * 11_status_harian.gs — Status harian taruna yang TIDAK berhak makan di kampus
 * (SOP: Peringatan no. 2). Enum: PESIAR / CUTI / SAKIT_RUMAH / PENUNDAAN_STUDI /
 * TANPA_KETERANGAN / KEGIATAN_LUAR_KAMPUS / PKL_1 / PKL_2 / PKL_3 / KPA /
 * MAGANG / PTB. Yang tergolong kegiatan luar kampus (dapat bantuan makan luar
 * kampus) ada di STATUS_LUAR_KAMPUS (00_config.gs) — dipakai Form-08.
 * TANPA_KETERANGAN (absen tanpa alasan resmi) TIDAK termasuk STATUS_LUAR_KAMPUS
 * — tidak berhak bantuan apa pun, sama seperti Pesiar/Cuti/Sakit/Penundaan
 * Studi. Tanpa mekanisme peringatan/eskalasi otomatis (dikonfirmasi Firdaus,
 * berbeda dari SURAT_PERINGATAN §7 yang murni soal tagihan) — begitu taruna
 * masuk kembali, cukup berhenti input status ini, tanpa aksi tambahan.
 *
 * ACTION: status.set (Admin, Pembina), status.batch (Admin, Pembina),
 *         status.list (semua login)
 *
 * Unik per (tanggal, nit) — upsert. Surat pendukung → LAMPIRAN ref_type=STATUS_HARIAN.
 * Setiap aksi tulis → withLock + auditLog.
 *
 * `tgl_akhir` (opsional, status.set/status.batch) → isi rentang tanggal
 * sekaligus (satu baris STATUS_HARIAN per hari, lihat _daftarTanggal_ di
 * 05_master.gs) — mis. cuti 2 minggu tidak perlu diinput per hari.
 */

/** Upsert internal satu (tanggal, nit). Kembalikan {status_id, aksi:'BARU'|'UBAH'}. */
function _statusUpsert_(session, tanggal, nit, status) {
  if (ENUM.STATUS_HARIAN.indexOf(status) < 0) {
    throw _fail_('status harus salah satu: ' + ENUM.STATUS_HARIAN.join(' / '));
  }
  var taruna = sheetRead(SHEETS.TARUNA, function (r) { return String(r.nit) === String(nit); })[0];
  if (!taruna) throw _fail_('Taruna tidak ditemukan: ' + nit);

  var ada = sheetRead(SHEETS.STATUS_HARIAN, function (r) {
    return _tglStr_(r.tanggal) === tanggal && String(r.nit) === String(nit);
  })[0];

  if (ada) {
    sheetUpdate(SHEETS.STATUS_HARIAN, 'status_id', ada.status_id,
      { status: status, input_by: session.user_id, timestamp: new Date() });
    auditLog(session, 'status.set', 'STATUS_HARIAN', ada.status_id,
      { status: ada.status }, { status: status, tanggal: tanggal, nit: nit });
    return { status_id: ada.status_id, aksi: 'UBAH' };
  }
  var id = nextId('STH');
  sheetAppend(SHEETS.STATUS_HARIAN, {
    status_id: id, tanggal: tanggal, nit: nit, status: status,
    input_by: session.user_id, timestamp: new Date()
  });
  auditLog(session, 'status.set', 'STATUS_HARIAN', id, null,
    { status: status, tanggal: tanggal, nit: nit });
  return { status_id: id, aksi: 'BARU' };
}

/**
 * Set status satu taruna. Payload {tanggal, nit, status, berkas?, tgl_akhir?}.
 * `tgl_akhir` opsional → isi rentang tanggal, satu baris STATUS_HARIAN per hari
 * (mis. cuti 2 minggu sekali input, bukan per hari).
 */
function statusSet(payload, session) {
  var tanggal = _wajibTgl_(payload && payload.tanggal, 'tanggal');
  var nit = String((payload && payload.nit) || '').trim();
  if (!nit) throw _fail_('nit wajib diisi.');
  var status = String((payload && payload.status) || '');
  var daftarTgl = (payload && payload.tgl_akhir)
    ? _daftarTanggal_(tanggal, _wajibTgl_(payload.tgl_akhir, 'tgl_akhir'))
    : [tanggal];

  var hasil = daftarTgl.map(function (t) { return _statusUpsert_(session, t, nit, status); });

  // Surat pendukung opsional: berkas {base64, nama_file, jenis?} → tautkan ke entri pertama
  if (payload.berkas && payload.berkas.base64) {
    lampiranSave(session, 'STATUS_HARIAN', hasil[0].status_id,
      payload.berkas.jenis || 'SURAT', payload.berkas.base64, payload.berkas.nama_file);
  }
  return hasil.length === 1 ? hasil[0] : { jml: hasil.length };
}

/** Input massal: {tanggal, status, nit: [], berkas?, tgl_akhir?}. Mis. satu kelas pesiar (atau rentang tanggal). */
function statusBatch(payload, session) {
  var tanggal = _wajibTgl_(payload && payload.tanggal, 'tanggal');
  var daftar = (payload && payload.nit) || [];
  if (!daftar.length) throw _fail_('nit harus berupa daftar minimal 1 taruna.');
  var status = String((payload && payload.status) || '');
  var daftarTgl = (payload && payload.tgl_akhir)
    ? _daftarTanggal_(tanggal, _wajibTgl_(payload.tgl_akhir, 'tgl_akhir'))
    : [tanggal];

  var hasil = [];
  daftar.forEach(function (nit) {
    daftarTgl.forEach(function (t) {
      hasil.push(_statusUpsert_(session, t, String(nit).trim(), status));
    });
  });
  if (payload.berkas && payload.berkas.base64 && hasil.length) {
    // Satu surat pendukung untuk batch → tautkan ke entri pertama
    lampiranSave(session, 'STATUS_HARIAN', hasil[0].status_id,
      payload.berkas.jenis || 'SURAT', payload.berkas.base64, payload.berkas.nama_file);
  }
  return { jml: hasil.length };
}

/** Daftar status per rentang tanggal: {dari, sampai, nit?}. */
function statusList(payload, session) {
  var dari = _wajibTgl_(payload && payload.dari, 'dari');
  var sampai = _wajibTgl_(payload && payload.sampai, 'sampai');
  var nit = payload && payload.nit;
  var rows = sheetRead(SHEETS.STATUS_HARIAN, function (r) {
    var t = _tglStr_(r.tanggal);
    if (t < dari || t > sampai) return false;
    if (nit && String(r.nit) !== String(nit)) return false;
    return true;
  });
  rows.forEach(function (r) { r.tanggal = _tglStr_(r.tanggal); });
  return { status: rows };
}

/**
 * Batalkan sisa hari status taruna sejak tanggal tertentu (default hari ini)
 * — dipakai saat taruna KEMBALI LEBIH CEPAT dari `tgl_akhir` yang sudah
 * diinput. `status.set`/`status.batch` menulis satu baris STATUS_HARIAN per
 * hari di muka; tanpa aksi ini, sisa hari ke depan tetap tercatat "di luar"
 * di rekap/dashboard walau taruna sudah kembali. Hanya menghapus baris ke
 * DEPAN (>= tanggal_kembali) — riwayat yang sudah lewat TIDAK diubah.
 * Payload {nit, tanggal_kembali?}.
 */
function statusTandaiKembali(payload, session) {
  var nit = String((payload && payload.nit) || '').trim();
  if (!nit) throw _fail_('nit wajib diisi.');
  var tanggalKembali = (payload && payload.tanggal_kembali)
    ? _wajibTgl_(payload.tanggal_kembali, 'tanggal_kembali') : _todayStr_();
  if (tanggalKembali < _todayStr_()) {
    throw _fail_('tanggal_kembali tidak boleh sebelum hari ini (riwayat tidak diubah).');
  }

  var target = sheetRead(SHEETS.STATUS_HARIAN, function (r) {
    return String(r.nit) === nit && _tglStr_(r.tanggal) >= tanggalKembali;
  });
  if (!target.length) return { jml_dibatalkan: 0 };

  var dihapus = sheetDeleteRows(SHEETS.STATUS_HARIAN, 'status_id', target.map(function (r) { return r.status_id; }));
  auditLog(session, 'status.tandai_kembali', 'STATUS_HARIAN', nit,
    { baris: dihapus.map(function (r) { return { tanggal: _tglStr_(r.tanggal), status: r.status }; }) },
    { tanggal_kembali: tanggalKembali });
  return { jml_dibatalkan: dihapus.length };
}
