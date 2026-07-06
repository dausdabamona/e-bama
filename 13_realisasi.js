/**
 * 13_realisasi.gs — Realisasi penyediaan makan harian (SOP no. 8–9)
 *
 * ACTION: realisasi.list (semua login),
 *         realisasi.create (Pembina, Senat),
 *         realisasi.ttd (Pembina, Senat — konfirmasi PIN)
 *
 * Pesanan wajib TERKIRIM. Foto → LAMPIRAN ref_type=REALISASI jenis=FOTO.
 * Kedua ttd terisi → otomatis rekapUpdate(tanggal).
 * Setiap aksi tulis → withLock + auditLog.
 */

/** Ambil realisasi by id atau error. */
function _realisasi_(id) {
  var r = sheetRead(SHEETS.REALISASI, function (x) { return String(x.real_id) === String(id); })[0];
  if (!r) throw _fail_('Realisasi tidak ditemukan: ' + id);
  return r;
}

/** Daftar realisasi, filter {bulan?}. */
function realisasiList(payload, session) {
  var bulan = payload && payload.bulan;
  var rows = sheetRead(SHEETS.REALISASI, function (r) {
    return !bulan || _bulanStr_(r.tanggal) === bulan;
  });
  rows.forEach(function (r) { r.tanggal = _tglStr_(r.tanggal); });
  return { realisasi: rows };
}

/**
 * Catat realisasi harian. Payload:
 * {pesanan_id, porsi_diterima, jml_taruna_makan, ketidaksesuaian?, tindak_lanjut?,
 *  geotag_lat, geotag_lng, berkas?}  — berkas = foto dokumentasi (jenis FOTO).
 */
function realisasiCreate(payload, session) {
  var p = _pesanan_(payload && payload.pesanan_id);
  if (p.status !== 'TERKIRIM') {
    throw _fail_('Realisasi hanya untuk pesanan TERKIRIM (status sekarang: ' + p.status + ').');
  }
  var dobel = sheetRead(SHEETS.REALISASI, function (r) {
    return String(r.pesanan_id) === String(p.pesanan_id);
  })[0];
  if (dobel) throw _fail_('Realisasi untuk pesanan ini sudah ada: ' + dobel.real_id);

  var lat = Number(payload.geotag_lat);
  var lng = Number(payload.geotag_lng);
  if (!isFinite(lat) || !isFinite(lng)) throw _fail_('geotag_lat dan geotag_lng wajib berupa angka.');

  var obj = {
    real_id: nextId('REL'),
    pesanan_id: p.pesanan_id,
    tanggal: _tglStr_(p.tgl_makan),
    porsi_diterima: _int_(payload.porsi_diterima, 'porsi_diterima'),
    jml_taruna_makan: _int_(payload.jml_taruna_makan, 'jml_taruna_makan'),
    ketidaksesuaian: String((payload && payload.ketidaksesuaian) || ''),
    tindak_lanjut: String((payload && payload.tindak_lanjut) || ''),
    geotag_lat: lat,
    geotag_lng: lng,
    ttd_pembina_at: '', ttd_senat_at: ''
  };
  sheetAppend(SHEETS.REALISASI, obj);

  if (payload.berkas && payload.berkas.base64) {
    lampiranSave(session, 'REALISASI', obj.real_id, 'FOTO',
      payload.berkas.base64, payload.berkas.nama_file || (obj.real_id + '.jpg'));
  }
  auditLog(session, 'realisasi.create', 'REALISASI', obj.real_id, null, {
    pesanan_id: p.pesanan_id, tanggal: obj.tanggal,
    porsi_diterima: obj.porsi_diterima, jml_taruna_makan: obj.jml_taruna_makan
  });
  return { realisasi: obj };
}

/**
 * Tanda tangan digital (konfirmasi kata sandi ulang). Payload {real_id, pin} —
 * kunci `pin` dipertahankan demi kompatibilitas kontrak, nilainya kata sandi
 * pemilik sesi (kredensial yang sama dengan login).
 * PEMBINA mengisi ttd_pembina_at, SENAT mengisi ttd_senat_at.
 * Kedua ttd terisi → rekapUpdate(tanggal) otomatis.
 */
function realisasiTtd(payload, session) {
  var r = _realisasi_(payload && payload.real_id);

  // Konfirmasi kata sandi pemilik sesi
  var pin = (payload && payload.pin != null) ? String(payload.pin) : '';
  var u = sheetRead(SHEETS.PENGGUNA, function (x) { return String(x.user_id) === String(session.user_id); })[0];
  if (!u || String(u.pin_hash) !== _sha256Hex_(pin + _getSalt_())) {
    throw _fail_('Kata sandi salah — tanda tangan dibatalkan.');
  }

  var kolom;
  if (session.role === 'PEMBINA') kolom = 'ttd_pembina_at';
  else if (session.role === 'SENAT') kolom = 'ttd_senat_at';
  else throw _fail_('Hanya Pembina atau Senat yang menandatangani realisasi.');

  if (r[kolom]) throw _fail_('Anda (' + session.role + ') sudah menandatangani realisasi ini.');

  var patch = {};
  patch[kolom] = new Date();
  sheetUpdate(SHEETS.REALISASI, 'real_id', r.real_id, patch);
  auditLog(session, 'realisasi.ttd', 'REALISASI', r.real_id, null,
    { kolom: kolom, tanggal: _tglStr_(r.tanggal) });

  // Cek kelengkapan ttd → picu rekap incremental
  var baru = _realisasi_(r.real_id);
  var lengkap = Boolean(baru.ttd_pembina_at) && Boolean(baru.ttd_senat_at);
  if (lengkap) rekapUpdate(_tglStr_(baru.tanggal));

  return { real_id: r.real_id, ttd: kolom, lengkap: lengkap };
}
