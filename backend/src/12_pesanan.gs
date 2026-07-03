/**
 * 12_pesanan.gs — Pesanan makan Pre-Order H-1 (SOP no. 5–8, Form-01)
 * Mesin status: DRAFT → DIAJUKAN → (DIKEMBALIKAN | DISETUJUI_PEMBINA)
 *               → (DIKEMBALIKAN | DISETUJUI_PPK) → TERKIRIM
 * Rantai Form-01: Senat merencanakan → Pembina memverifikasi → PPK menyetujui
 *               → Senat menyampaikan ke penyedia paling lambat H-1.
 *
 * ACTION: pesanan.list, pesanan.get (semua login),
 *         pesanan.create/submit/kirim/revisi (Senat),
 *         pesanan.verify (Pembina), pesanan.approve (PPK),
 *         pesanan.return (Pembina, PPK)
 *
 * jml_taruna = SNAPSHOT (taruna AKTIF − STATUS_HARIAN tgl tsb); koreksi manual
 * wajib catatan. Transisi ilegal → error eksplisit.
 * Setiap aksi tulis → withLock + auditLog.
 */

/** Ambil pesanan by id atau error. */
function _pesanan_(id) {
  var p = sheetRead(SHEETS.PESANAN, function (r) { return String(r.pesanan_id) === String(id); })[0];
  if (!p) throw _fail_('Pesanan tidak ditemukan: ' + id);
  return p;
}

/** Hitung otomatis jml_taruna utk tanggal: taruna AKTIF − yang berstatus harian. */
function _hitungJmlTaruna_(tanggal) {
  var aktif = {};
  sheetRead(SHEETS.TARUNA, function (r) { return r.status === 'AKTIF'; })
    .forEach(function (r) { aktif[String(r.nit)] = true; });
  var tidakMakan = {};
  sheetRead(SHEETS.STATUS_HARIAN, function (r) { return _tglStr_(r.tanggal) === tanggal; })
    .forEach(function (r) { if (aktif[String(r.nit)]) tidakMakan[String(r.nit)] = true; });
  return Object.keys(aktif).length - Object.keys(tidakMakan).length;
}

/** Daftar pesanan, filter {bulan?}. */
function pesananList(payload, session) {
  var bulan = payload && payload.bulan;
  var rows = sheetRead(SHEETS.PESANAN, function (r) {
    return !bulan || _bulanStr_(r.tgl_makan) === bulan;
  });
  rows.forEach(function (r) { r.tgl_makan = _tglStr_(r.tgl_makan); });
  return { pesanan: rows };
}

/** Detail pesanan + lampiran. */
function pesananGet(payload, session) {
  var p = _pesanan_(payload && payload.pesanan_id);
  p.tgl_makan = _tglStr_(p.tgl_makan);
  return { pesanan: p, lampiran: lampiranList('PESANAN', p.pesanan_id) };
}

/** Buat pesanan DRAFT. Payload {tgl_makan, menu, jml_taruna?, catatan?}. */
function pesananCreate(payload, session) {
  var tgl = _wajibTgl_(payload && payload.tgl_makan, 'tgl_makan');
  var menu = String((payload && payload.menu) || '').trim();
  if (!menu) throw _fail_('menu wajib diisi.');

  // Satu pesanan per hari (DIKEMBALIKAN tidak menghalangi buat ulang)
  var dobel = sheetRead(SHEETS.PESANAN, function (r) {
    return _tglStr_(r.tgl_makan) === tgl && r.status !== 'DIKEMBALIKAN';
  })[0];
  if (dobel) throw _fail_('Sudah ada pesanan untuk ' + tgl + ' (' + dobel.pesanan_id + ', status ' + dobel.status + ').');

  var kontrak = _kontrakAktifPada_(tgl);
  var jmlAuto = _hitungJmlTaruna_(tgl);
  var jml = jmlAuto;
  var catatan = String((payload && payload.catatan) || '').trim();
  if (payload.jml_taruna !== undefined && payload.jml_taruna !== null && payload.jml_taruna !== '') {
    jml = _int_(payload.jml_taruna, 'jml_taruna');
    if (jml !== jmlAuto && !catatan) {
      throw _fail_('jml_taruna (' + jml + ') berbeda dari hitungan otomatis (' + jmlAuto + ') — catatan wajib diisi.');
    }
  }

  var obj = {
    pesanan_id: nextId('PSN'),
    tgl_makan: tgl,
    kontrak_id: kontrak.kontrak_id,
    jml_taruna: jml,             // SNAPSHOT — momen penulisan tercatat di AUDIT_LOG
    menu: menu,
    catatan: catatan,
    status: 'DRAFT',
    created_by: session.user_id,
    verif_by: '', verif_at: '', revisi_dari: '',
    appr_by: '', appr_at: ''
  };
  sheetAppend(SHEETS.PESANAN, obj);
  auditLog(session, 'pesanan.create', 'PESANAN', obj.pesanan_id, null,
    { tgl_makan: tgl, jml_taruna: jml, jml_otomatis: jmlAuto, kontrak_id: kontrak.kontrak_id });
  return { pesanan: obj, jml_otomatis: jmlAuto };
}

/** Transisi status generik dengan validasi. */
function _pesananTransisi_(session, id, dariStatus, keStatus, aksi, patchTambahan) {
  var p = _pesanan_(id);
  if (p.status !== dariStatus) {
    throw _fail_('Pesanan berstatus ' + p.status + ', tidak bisa ' + aksi + ' (butuh ' + dariStatus + ').');
  }
  var patch = { status: keStatus };
  if (patchTambahan) for (var k in patchTambahan) patch[k] = patchTambahan[k];
  sheetUpdate(SHEETS.PESANAN, 'pesanan_id', id, patch);
  auditLog(session, 'pesanan.' + aksi, 'PESANAN', id, { status: p.status }, patch);
  return p;
}

/** DRAFT → DIAJUKAN (hanya pembuat). */
function pesananSubmit(payload, session) {
  var p = _pesanan_(payload && payload.pesanan_id);
  if (String(p.created_by) !== String(session.user_id)) {
    throw _fail_('Hanya pembuat pesanan yang boleh mengajukan.');
  }
  _pesananTransisi_(session, p.pesanan_id, 'DRAFT', 'DIAJUKAN', 'submit', null);
  return { pesanan_id: p.pesanan_id, status: 'DIAJUKAN' };
}

/** DIAJUKAN → DISETUJUI_PEMBINA (Pembina, SOP no. 6). */
function pesananVerify(payload, session) {
  var id = payload && payload.pesanan_id;
  _pesananTransisi_(session, id, 'DIAJUKAN', 'DISETUJUI_PEMBINA', 'verify',
    { verif_by: session.user_id, verif_at: new Date() });
  return { pesanan_id: id, status: 'DISETUJUI_PEMBINA' };
}

/** DISETUJUI_PEMBINA → DISETUJUI_PPK (PPK, SOP no. 7 / Form-01). */
function pesananApprove(payload, session) {
  var id = payload && payload.pesanan_id;
  _pesananTransisi_(session, id, 'DISETUJUI_PEMBINA', 'DISETUJUI_PPK', 'approve',
    { appr_by: session.user_id, appr_at: new Date() });
  return { pesanan_id: id, status: 'DISETUJUI_PPK' };
}

/**
 * Pengembalian (alasan wajib):
 * Pembina: DIAJUKAN → DIKEMBALIKAN; PPK: DISETUJUI_PEMBINA → DIKEMBALIKAN.
 */
function pesananReturn(payload, session) {
  var id = payload && payload.pesanan_id;
  var alasan = String((payload && payload.alasan) || '').trim();
  if (!alasan) throw _fail_('alasan pengembalian wajib diisi.');
  var dariStatus = (session.role === 'PPK') ? 'DISETUJUI_PEMBINA' : 'DIAJUKAN';
  var p = _pesanan_(id);
  // Skema tidak punya kolom alasan tersendiri → catat di catatan + AUDIT_LOG
  var catatan = (p.catatan ? p.catatan + ' | ' : '') + 'DIKEMBALIKAN (' + session.role + '): ' + alasan;
  _pesananTransisi_(session, id, dariStatus, 'DIKEMBALIKAN', 'return', { catatan: catatan });
  return { pesanan_id: id, status: 'DIKEMBALIKAN' };
}

/** DISETUJUI_PPK → TERKIRIM (Senat), hanya ≤ H-1 dari tgl_makan. */
function pesananKirim(payload, session) {
  var id = payload && payload.pesanan_id;
  var p = _pesanan_(id);
  if (_todayStr_() >= _tglStr_(p.tgl_makan)) {
    throw _fail_('Pengiriman hanya boleh H-1 atau lebih awal dari tgl_makan. ' +
      'Untuk perubahan setelah terkirim gunakan pesanan.revisi dengan BA perubahan.');
  }
  _pesananTransisi_(session, id, 'DISETUJUI_PPK', 'TERKIRIM', 'kirim', null);
  return { pesanan_id: id, status: 'TERKIRIM' };
}

/**
 * Revisi setelah TERKIRIM (SOP 7b): buat pesanan BARU ber-revisi_dari.
 * Payload {pesanan_id, menu?, jml_taruna?, catatan, berkas} — berkas BA WAJIB.
 */
function pesananRevisi(payload, session) {
  var asal = _pesanan_(payload && payload.pesanan_id);
  if (asal.status !== 'TERKIRIM') {
    throw _fail_('Revisi hanya untuk pesanan TERKIRIM (status sekarang: ' + asal.status + ').');
  }
  var catatan = String((payload && payload.catatan) || '').trim();
  if (!catatan) throw _fail_('catatan alasan revisi wajib diisi.');
  if (!payload.berkas || !payload.berkas.base64) {
    throw _fail_('Lampiran BA perubahan wajib disertakan (berkas.base64).');
  }

  var jml = (payload.jml_taruna !== undefined && payload.jml_taruna !== null && payload.jml_taruna !== '')
    ? _int_(payload.jml_taruna, 'jml_taruna') : asal.jml_taruna;

  var obj = {
    pesanan_id: nextId('PSN'),
    tgl_makan: _tglStr_(asal.tgl_makan),
    kontrak_id: asal.kontrak_id,
    jml_taruna: jml,
    menu: String((payload && payload.menu) || asal.menu),
    catatan: catatan,
    status: 'TERKIRIM', // revisi menggantikan pesanan terkirim, disahkan BA perubahan
    created_by: session.user_id,
    verif_by: '', verif_at: '',
    revisi_dari: asal.pesanan_id
  };
  sheetAppend(SHEETS.PESANAN, obj);
  lampiranSave(session, 'PESANAN', obj.pesanan_id, 'BA', payload.berkas.base64,
    payload.berkas.nama_file || ('BA-perubahan-' + obj.pesanan_id + '.pdf'));
  auditLog(session, 'pesanan.revisi', 'PESANAN', obj.pesanan_id,
    { revisi_dari: asal.pesanan_id, jml_lama: asal.jml_taruna },
    { jml_taruna: jml, menu: obj.menu });
  return { pesanan: obj };
}
