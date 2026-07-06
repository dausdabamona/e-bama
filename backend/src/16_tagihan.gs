/**
 * 16_tagihan.gs — Piutang gagal debet rekening taruna
 * Status: TERTAGIH → LUNAS | DIHAPUSKAN | ESKALASI_MANUAL
 *
 * ACTION: tagihan.create (Senat, PPK), tagihan.list (semua login),
 *         tagihan.summary (PPK, KPA), tagihan.setor (Senat),
 *         tagihan.verify (PPK), tagihan.waive (PPK)
 *
 * nominal = SNAPSHOT dari REKAP_BULANAN FINAL. tagihan_id = TGH-{yyyymm}-{nit}.
 * Level SP aktif TIDAK disimpan — dibaca MAX(level) dari SURAT_PERINGATAN.
 * tagihan.create LANGSUNG menerbitkan SP-1.
 * Setiap aksi tulis → withLock + auditLog + invalidasi cache.
 */

var _CACHE_TAGIHAN_ = 'tagihan_join_v1';

/** Hapus cache daftar tagihan (dipanggil setiap aksi tulis tagihan/SP). */
function _tagihanCacheClear_() {
  CacheService.getScriptCache().remove(_CACHE_TAGIHAN_);
}

/** Ambil tagihan by id atau error. */
function _tagihan_(id) {
  var t = sheetRead(SHEETS.TAGIHAN, function (r) { return String(r.tagihan_id) === String(id); })[0];
  if (!t) throw _fail_('Tagihan tidak ditemukan: ' + id);
  return t;
}

/** Join tagihan + level_aktif/tenggat_aktif dari SURAT_PERINGATAN (cache 60 detik). */
function _tagihanJoin_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(_CACHE_TAGIHAN_);
  if (hit) return JSON.parse(hit);

  var spPerTagihan = {};
  sheetRead(SHEETS.SURAT_PERINGATAN).forEach(function (s) {
    var key = String(s.tagihan_id);
    var lv = Number(s.level) || 0;
    if (!spPerTagihan[key] || lv > spPerTagihan[key].level) {
      spPerTagihan[key] = { level: lv, tenggat: _tglStr_(s.tenggat) };
    }
  });

  var rows = sheetRead(SHEETS.TAGIHAN).map(function (t) {
    var sp = spPerTagihan[String(t.tagihan_id)];
    return {
      tagihan_id: t.tagihan_id, bulan: String(t.bulan), nit: t.nit,
      nominal: Number(t.nominal) || 0, sebab: t.sebab, status: t.status,
      tgl_setor: _tglStr_(t.tgl_setor), diverifikasi_oleh: t.diverifikasi_oleh,
      catatan_hapus: t.catatan_hapus,
      level_aktif: sp ? sp.level : 0,
      tenggat_aktif: sp ? sp.tenggat : ''
    };
  });
  try { cache.put(_CACHE_TAGIHAN_, JSON.stringify(rows), 60); } catch (e) { /* cache >100KB → lewati */ }
  return rows;
}

/**
 * Catat gagal debet batch: {bulan, nit: [], sebab}.
 * Syarat rekap FINAL; nominal snapshot; tolak duplikat; SP-1 langsung terbit.
 */
function tagihanCreate(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var daftar = (payload && payload.nit) || [];
  if (!daftar.length) throw _fail_('nit harus berupa daftar minimal 1 taruna.');
  var sebab = String((payload && payload.sebab) || '');
  if (ENUM.TAGIHAN_SEBAB.indexOf(sebab) < 0) {
    throw _fail_('sebab harus salah satu: ' + ENUM.TAGIHAN_SEBAB.join(' / '));
  }

  var rekap = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  if (!rekap.length) throw _fail_('Belum ada rekap untuk bulan ' + bulan + '.');
  var rekapNit = {};
  rekap.forEach(function (r) {
    // Angka beku HANYA saat FINAL (PPK finalkan, langkah terakhir). DISETUJUI_WADIR3
    // kini langkah AWAL (angka belum beku) → tidak lagi dianggap dasar nominal beku.
    if (r.status !== 'FINAL') {
      throw _fail_('Rekap bulan ' + bulan + ' belum FINAL — tagihan butuh dasar nominal beku (PPK finalkan dulu).');
    }
    rekapNit[String(r.nit)] = r;
  });

  var yyyymm = bulan.replace('-', '');
  var hasil = [];
  daftar.forEach(function (nitRaw) {
    var nit = String(nitRaw).trim();
    var r = rekapNit[nit];
    if (!r) throw _fail_('Taruna ' + nit + ' tidak ada di rekap bulan ' + bulan + '.');
    var id = 'TGH-' + yyyymm + '-' + nit;
    var dobel = sheetRead(SHEETS.TAGIHAN, function (x) { return String(x.tagihan_id) === id; })[0];
    if (dobel) throw _fail_('Tagihan sudah ada: ' + id + ' (duplikat bulan+nit ditolak).');

    var obj = {
      tagihan_id: id, bulan: bulan, nit: nit,
      nominal: _int_(r.nominal, 'nominal'),  // SNAPSHOT dari rekap FINAL
      sebab: sebab, status: 'TERTAGIH',
      tgl_setor: '', diverifikasi_oleh: '', catatan_hapus: ''
    };
    sheetAppend(SHEETS.TAGIHAN, obj);
    auditLog(session, 'tagihan.create', 'TAGIHAN', id, null,
      { bulan: bulan, nit: nit, nominal: obj.nominal, sebab: sebab });

    // SP-1 terbit saat tagihan dicatat (lewati bila sudah ada — aman diulang)
    var adaSp1 = sheetRead(SHEETS.SURAT_PERINGATAN, function (s) {
      return String(s.tagihan_id) === id && Number(s.level) === 1;
    })[0];
    var sp = adaSp1 ? { sp_id: adaSp1.sp_id, no_surat: adaSp1.no_surat }
                    : spTerbitkan(id, 1, session);
    hasil.push({ tagihan_id: id, nominal: obj.nominal, sp1: sp });
  });

  _tagihanCacheClear_();
  return { tagihan: hasil };
}

/** Daftar tagihan + level_aktif + tenggat_aktif. Filter {bulan?, status?}. */
function tagihanList(payload, session) {
  var f = payload || {};
  var rows = _tagihanJoin_().filter(function (t) {
    if (f.bulan && t.bulan !== f.bulan) return false;
    if (f.status && t.status !== f.status) return false;
    return true;
  });
  return { tagihan: rows };
}

/** Dashboard piutang: {per_level: {0..3:{jumlah,nominal}}, total_outstanding}. */
function tagihanSummary(payload, session) {
  var per = { 0: { jumlah: 0, nominal: 0 }, 1: { jumlah: 0, nominal: 0 },
              2: { jumlah: 0, nominal: 0 }, 3: { jumlah: 0, nominal: 0 } };
  var total = 0;
  _tagihanJoin_().forEach(function (t) {
    if (t.status !== 'TERTAGIH') return; // outstanding saja
    var lv = Math.min(Math.max(t.level_aktif, 0), 3);
    per[lv].jumlah++; per[lv].nominal += t.nominal;
    total += t.nominal;
  });
  return { per_level: per, total_outstanding: total };
}

/** Senat lapor setoran: {tagihan_id, tgl_setor, berkas} — bukti WAJIB, status tetap TERTAGIH. */
function tagihanSetor(payload, session) {
  var t = _tagihan_(payload && payload.tagihan_id);
  if (t.status !== 'TERTAGIH') throw _fail_('Tagihan berstatus ' + t.status + ', tidak menerima setoran.');
  var tgl = _wajibTgl_(payload && payload.tgl_setor, 'tgl_setor');
  if (!payload.berkas || !payload.berkas.base64) throw _fail_('Bukti setor wajib dilampirkan (berkas.base64).');

  lampiranSave(session, 'TAGIHAN', t.tagihan_id, 'BUKTI_SETOR',
    payload.berkas.base64, payload.berkas.nama_file || ('setor-' + t.tagihan_id + '.jpg'));
  sheetUpdate(SHEETS.TAGIHAN, 'tagihan_id', t.tagihan_id, { tgl_setor: tgl });
  auditLog(session, 'tagihan.setor', 'TAGIHAN', t.tagihan_id, null, { tgl_setor: tgl });
  _tagihanCacheClear_();
  return { tagihan_id: t.tagihan_id, tgl_setor: tgl, status: 'TERTAGIH' };
}

/** PPK verifikasi setoran: syarat bukti setor ada → LUNAS. */
function tagihanVerify(payload, session) {
  var t = _tagihan_(payload && payload.tagihan_id);
  if (t.status !== 'TERTAGIH') throw _fail_('Tagihan berstatus ' + t.status + ', tidak bisa diverifikasi.');
  var bukti = lampiranList('TAGIHAN', t.tagihan_id).filter(function (l) { return l.jenis === 'BUKTI_SETOR'; });
  if (!bukti.length) throw _fail_('Belum ada bukti setor — verifikasi ditolak.');

  sheetUpdate(SHEETS.TAGIHAN, 'tagihan_id', t.tagihan_id,
    { status: 'LUNAS', diverifikasi_oleh: session.user_id });
  auditLog(session, 'tagihan.verify', 'TAGIHAN', t.tagihan_id,
    { status: t.status }, { status: 'LUNAS' });
  _tagihanCacheClear_();
  return { tagihan_id: t.tagihan_id, status: 'LUNAS' };
}

/**
 * tagihan.status_debet {bulan} — laporan status debet taruna→Senat PER
 * TARUNA, READ-ONLY. Membandingkan seluruh taruna ber-REKAP nominal>0
 * bulan itu (dasar permohonan debet, sama seperti cetakForm07) dengan
 * baris TAGIHAN bulan yang sama.
 *
 * Taruna TANPA baris TAGIHAN → `BERHASIL` — ini INFERENSI (absennya
 * kegagalan tercatat), BUKAN konfirmasi positif dari bank; sistem memang
 * tidak punya integrasi bank utk mengonfirmasi sukses secara aktif (lihat
 * catatan modul). Taruna BER-TAGIHAN → `GAGAL`, apa pun status
 * penyelesaiannya (`status_tagihan`: TERTAGIH/LUNAS/DIHAPUSKAN/
 * ESKALASI_MANUAL tetap dihitung "gagal debet awal" — penyelesaiannya
 * ditampilkan terpisah, tidak mengubah status_debet jadi BERHASIL lagi).
 */
function tagihanStatusDebet(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');

  var rekap = sheetRead(SHEETS.REKAP_BULANAN, function (r) {
    return _bulanStr_(r.bulan) === bulan && _int_(r.nominal || 0, 'nominal') > 0;
  });
  if (!rekap.length) throw _fail_('Belum ada rekap bernominal untuk bulan ' + bulan + '.');

  var tarunaByNit = {};
  sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });

  var tagihanByNit = {};
  _tagihanJoin_().filter(function (t) { return t.bulan === bulan; })
    .forEach(function (t) { tagihanByNit[String(t.nit)] = t; });

  var baris = rekap.map(function (r) {
    var nit = String(r.nit);
    var t = tarunaByNit[nit] || {};
    var tg = tagihanByNit[nit];
    return {
      nit: nit, nama: t.nama || '', prodi: t.prodi || '', tingkat: t.tingkat || '',
      nominal: _int_(r.nominal, 'nominal'),
      status_debet: tg ? 'GAGAL' : 'BERHASIL',
      tagihan_id: tg ? tg.tagihan_id : '',
      sebab: tg ? tg.sebab : '',
      status_tagihan: tg ? tg.status : ''
    };
  }).sort(function (a, b) {
    return (a.prodi || '').localeCompare(b.prodi || '') || (a.tingkat || '').localeCompare(b.tingkat || '') ||
      (a.nama || '').localeCompare(b.nama || '');
  });

  var jmlGagal = baris.filter(function (b) { return b.status_debet === 'GAGAL'; }).length;
  return {
    bulan: bulan, baris: baris,
    total_taruna: baris.length, jml_berhasil: baris.length - jmlGagal, jml_gagal: jmlGagal
  };
}

/** PPK hapus tagihan: catatan_hapus WAJIB → DIHAPUSKAN. */
function tagihanWaive(payload, session) {
  var t = _tagihan_(payload && payload.tagihan_id);
  if (t.status !== 'TERTAGIH') throw _fail_('Tagihan berstatus ' + t.status + ', tidak bisa dihapuskan.');
  var catatan = String((payload && payload.catatan_hapus) || '').trim();
  if (!catatan) throw _fail_('catatan_hapus WAJIB diisi untuk penghapusan tagihan.');

  sheetUpdate(SHEETS.TAGIHAN, 'tagihan_id', t.tagihan_id,
    { status: 'DIHAPUSKAN', catatan_hapus: catatan });
  auditLog(session, 'tagihan.waive', 'TAGIHAN', t.tagihan_id,
    { status: t.status }, { status: 'DIHAPUSKAN', catatan_hapus: catatan });
  _tagihanCacheClear_();
  return { tagihan_id: t.tagihan_id, status: 'DIHAPUSKAN' };
}
