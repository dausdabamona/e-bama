/**
 * 25_ketua_jurusan.gs — Peran KETUA_JURUSAN (ketua jurusan/prodi).
 *
 * Tugas (di-scope ke session.prodi):
 *  1. Input absen luar kampus taruna prodinya → STATUS_HARIAN dengan status ∈
 *     STATUS_LUAR_KAMPUS. BOLEH tanggal lampau (taruna PKL berada di luar kampus,
 *     absen sering diinput mundur) — memang tidak ada date-guard.
 *  2. Menyetujui rekap bantuan luar kampus prodinya: BANTUAN_LUAR_KAMPUS
 *     DRAFT → DISETUJUI_KAJUR (persetujuan Ketua Jurusan sebelum PPK memproses).
 *  3. Melihat REKAP saja (TANPA nomor rekening).
 *
 * Setiap handler memanggil _hanyaKajur_(session) (pagar dalam-handler) DAN router
 * membatasi lewat KETUA_JURUSAN_ACTIONS (deny-by-default, seperti PENYEDIA).
 * ACTION: kajur.taruna_list, kajur.status_set, kajur.status_batch, kajur.rekap, kajur.approve.
 * Setiap aksi tulis → withLock + auditLog.
 */

/** Baris TARUNA satu prodi (nit, nama, tingkat, kelas — TANPA rekening). */
function _tarunaProdi_(prodi) {
  return sheetRead(SHEETS.TARUNA, function (r) { return String(r.prodi) === String(prodi); });
}

/** Pastikan taruna ada & berada di prodi Ketua Jurusan. */
function _pastikanTarunaProdi_(nit, prodi) {
  var t = sheetRead(SHEETS.TARUNA, function (r) { return String(r.nit) === String(nit); })[0];
  if (!t) throw _fail_('Taruna tidak ditemukan: ' + nit);
  if (String(t.prodi) !== String(prodi)) throw _fail_('Taruna di luar prodi Anda: ' + nit);
  return t;
}

/** Daftar taruna prodi Ketua Jurusan (untuk UI input absen). */
function kajurTarunaList(payload, session) {
  var prodi = _hanyaKajur_(session);
  var rows = _tarunaProdi_(prodi).map(function (t) {
    return {
      nit: String(t.nit), nama: t.nama || '', prodi: t.prodi || '',
      tingkat: t.tingkat || '', kelas: t.kelas || '', status: t.status || ''
    };
  });
  return { taruna: rows, prodi: prodi };
}

/**
 * Set absen luar kampus satu taruna. Payload {tanggal, nit, status, tgl_akhir?}.
 * Backdate diizinkan. `tgl_akhir` opsional → isi rentang tanggal (PKL/KPA biasanya
 * berlangsung berbulan-bulan, tidak perlu input per hari).
 */
function kajurStatusSet(payload, session) {
  var prodi = _hanyaKajur_(session);
  var tanggal = _wajibTgl_(payload && payload.tanggal, 'tanggal');
  var nit = String((payload && payload.nit) || '').trim();
  if (!nit) throw _fail_('nit wajib diisi.');
  var status = String((payload && payload.status) || '');
  if (STATUS_LUAR_KAMPUS.indexOf(status) < 0) {
    throw _fail_('Ketua Jurusan hanya boleh menginput status luar kampus: ' + STATUS_LUAR_KAMPUS.join(' / '));
  }
  _pastikanTarunaProdi_(nit, prodi);
  var daftarTgl = (payload && payload.tgl_akhir)
    ? _daftarTanggal_(tanggal, _wajibTgl_(payload.tgl_akhir, 'tgl_akhir'))
    : [tanggal];
  return withLock(function () {
    var hasil = daftarTgl.map(function (t) { return _statusUpsert_(session, t, nit, status); });
    return hasil.length === 1 ? hasil[0] : { jml: hasil.length };
  });
}

/** Set absen luar kampus massal. Payload {tanggal, status, nit:[], tgl_akhir?}. */
function kajurStatusBatch(payload, session) {
  var prodi = _hanyaKajur_(session);
  var tanggal = _wajibTgl_(payload && payload.tanggal, 'tanggal');
  var status = String((payload && payload.status) || '');
  if (STATUS_LUAR_KAMPUS.indexOf(status) < 0) {
    throw _fail_('Ketua Jurusan hanya boleh menginput status luar kampus: ' + STATUS_LUAR_KAMPUS.join(' / '));
  }
  var daftar = (payload && payload.nit) || [];
  if (!daftar.length) throw _fail_('nit harus berupa daftar minimal 1 taruna.');
  // Validasi semua nit dalam prodi DULU (all-or-nothing sebelum menulis).
  var prodiNit = {};
  _tarunaProdi_(prodi).forEach(function (t) { prodiNit[String(t.nit)] = true; });
  daftar.forEach(function (nit) {
    if (!prodiNit[String(nit).trim()]) throw _fail_('Taruna di luar prodi Anda: ' + nit);
  });
  var daftarTgl = (payload && payload.tgl_akhir)
    ? _daftarTanggal_(tanggal, _wajibTgl_(payload.tgl_akhir, 'tgl_akhir'))
    : [tanggal];
  return withLock(function () {
    // Tulis MASSAL sekali jalan (hindari timeout: 25 taruna × 30 hari = 750 baris).
    return _statusTulisBatch_(session, daftarTgl, daftar, status, 'kajur.status_batch');
  });
}

/**
 * Rekap luar kampus prodi untuk bulan (TANPA rekening). Per taruna: jml hari luar
 * kampus dihitung dari STATUS_HARIAN (status ∈ STATUS_LUAR_KAMPUS) bulan itu —
 * sumber kebenaran yang sama dengan Form-08 — di-join BANTUAN_LUAR_KAMPUS
 * (kegiatan/nilai_per_hari/nominal/status) bila ada. Payload {bulan}.
 */
function kajurRekap(payload, session) {
  var prodi = _hanyaKajur_(session);
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var nitSet = {};
  _tarunaProdi_(prodi).forEach(function (t) { nitSet[String(t.nit)] = t; });

  // Hari luar kampus per nit dari STATUS_HARIAN bulan itu (prodi ini saja).
  var hariByNit = {};
  sheetRead(SHEETS.STATUS_HARIAN, function (r) {
    return _bulanStr_(r.tanggal) === bulan && STATUS_LUAR_KAMPUS.indexOf(r.status) >= 0 && nitSet[String(r.nit)];
  }).forEach(function (r) {
    var nit = String(r.nit);
    hariByNit[nit] = (hariByNit[nit] || 0) + 1;
  });

  // Join BANTUAN_LUAR_KAMPUS (bulan itu, prodi ini) untuk kegiatan/tarif/nominal/status.
  var blkByNit = {};
  sheetRead(SHEETS.BANTUAN_LUAR_KAMPUS, function (r) {
    return _bulanStr_(r.bulan) === bulan && nitSet[String(r.nit)];
  }).forEach(function (r) {
    var nit = String(r.nit);
    if (!blkByNit[nit]) blkByNit[nit] = [];
    blkByNit[nit].push(r);
  });

  var kunci = {};
  Object.keys(hariByNit).forEach(function (n) { kunci[n] = true; });
  Object.keys(blkByNit).forEach(function (n) { kunci[n] = true; });
  var baris = Object.keys(kunci).sort().map(function (nit) {
    var t = nitSet[nit] || {};
    var blkRows = blkByNit[nit] || [];
    var kegiatan = blkRows.map(function (r) { return r.kegiatan; }).join(', ');
    var nilaiPerHari = blkRows.length ? _int_(blkRows[0].nilai_per_hari || 0, 'nilai_per_hari') : 0;
    var hari = hariByNit[nit] || 0;
    // Nominal = hari (dari absen) × tarif (dari BLK) — konsisten dengan Form-08.
    var nominal = Math.round(hari * nilaiPerHari);
    // disetujui_kajur = SEMUA baris BLK taruna ini sudah DISETUJUI_KAJUR.
    var semuaSetuju = blkRows.length > 0 && blkRows.every(function (r) { return String(r.status) === 'DISETUJUI_KAJUR'; });
    return {
      nit: nit, nama: t.nama || '', tingkat: t.tingkat || '', kelas: t.kelas || '',
      kegiatan: kegiatan, hari_luar_kampus: hari, nilai_per_hari: nilaiPerHari,
      nominal: nominal, ada_blk: blkRows.length > 0, disetujui_kajur: semuaSetuju
    };
  });

  var totalNominal = 0;
  baris.forEach(function (b) { totalNominal += b.nominal; });
  return { bulan: bulan, prodi: prodi, baris: baris, total_nominal: totalNominal };
}

/**
 * Set HARGA SATUAN (tarif per hari) luar kampus di aplikasi — tanpa impor CSV.
 * Ketua Jurusan mengetahui harga daerah setempat, jadi boleh mengisinya untuk
 * taruna prodinya. Payload {bulan, kegiatan, nilai_per_hari, nit_list:[],
 * pembayaran_ke?}. Upsert baris BANTUAN_LUAR_KAMPUS per (nit, kegiatan, bulan,
 * pembayaran_ke); total_hari & nominal DI-SNAPSHOT dari STATUS_HARIAN saat ini
 * (rekap tetap menghitung ulang hari × tarif, jadi angka konsisten). Mengubah
 * tarif mengembalikan status ke DRAFT (butuh persetujuan ulang karena nominal
 * berubah). Di-scope ke prodi Ketua Jurusan; withLock + audit per baris.
 */
function kajurSetTarif(payload, session) {
  var prodi = _hanyaKajur_(session);
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var kegiatan = String((payload && payload.kegiatan) || '').trim();
  if (!kegiatan) throw _fail_('kegiatan wajib diisi.');
  var nilaiPerHari = _int_(payload && payload.nilai_per_hari, 'nilai_per_hari');
  if (nilaiPerHari <= 0) throw _fail_('nilai_per_hari (harga satuan) harus lebih dari 0.');
  var daftar = (payload && payload.nit_list) || [];
  if (!daftar.length) throw _fail_('nit_list harus berupa daftar minimal 1 taruna.');
  var bayarKe = _int_((payload && payload.pembayaran_ke) || 1, 'pembayaran_ke');

  // Validasi semua nit dalam prodi DULU (all-or-nothing sebelum menulis).
  var prodiNit = {};
  _tarunaProdi_(prodi).forEach(function (t) { prodiNit[String(t.nit)] = true; });
  daftar.forEach(function (nit) {
    if (!prodiNit[String(nit).trim()]) throw _fail_('Taruna di luar prodi Anda: ' + nit);
  });

  return withLock(function () {
    // Snapshot jml hari luar kampus per nit dari STATUS_HARIAN bulan itu.
    var hariByNit = {};
    sheetRead(SHEETS.STATUS_HARIAN, function (r) {
      return _bulanStr_(r.tanggal) === bulan && STATUS_LUAR_KAMPUS.indexOf(r.status) >= 0 && prodiNit[String(r.nit)];
    }).forEach(function (r) { var n = String(r.nit); hariByNit[n] = (hariByNit[n] || 0) + 1; });

    var n = 0;
    daftar.forEach(function (nitRaw) {
      var nit = String(nitRaw).trim();
      var totalHari = hariByNit[nit] || 0;
      var nominal = Math.round(totalHari * nilaiPerHari);
      var ada = sheetRead(SHEETS.BANTUAN_LUAR_KAMPUS, function (r) {
        return String(r.nit) === nit && String(r.kegiatan) === kegiatan &&
          _bulanStr_(r.bulan) === bulan && _int_(r.pembayaran_ke || 1, 'pembayaran_ke') === bayarKe;
      })[0];
      if (ada) {
        sheetUpdate(SHEETS.BANTUAN_LUAR_KAMPUS, 'bantuan_id', ada.bantuan_id,
          { nilai_per_hari: nilaiPerHari, total_hari: totalHari, nominal: nominal, status: 'DRAFT' });
        auditLog(session, 'kajur.set_tarif', 'BANTUAN_LUAR_KAMPUS', ada.bantuan_id,
          { nilai_per_hari: _int_(ada.nilai_per_hari || 0, 'nilai_per_hari') },
          { nilai_per_hari: nilaiPerHari, kegiatan: kegiatan, bulan: bulan });
      } else {
        var id = nextId('BLK');
        sheetAppend(SHEETS.BANTUAN_LUAR_KAMPUS, {
          bantuan_id: id, nit: nit, kegiatan: kegiatan, bulan: bulan, periode: '',
          total_hari: totalHari, nilai_per_hari: nilaiPerHari, nominal: nominal,
          pembayaran_ke: bayarKe, keterangan: '', status: 'DRAFT'
        });
        auditLog(session, 'kajur.set_tarif', 'BANTUAN_LUAR_KAMPUS', id, null,
          { nit: nit, kegiatan: kegiatan, bulan: bulan, nilai_per_hari: nilaiPerHari });
      }
      n++;
    });
    return { jml: n, nilai_per_hari: nilaiPerHari, kegiatan: kegiatan };
  });
}

/**
 * Daftar TANGGAL luar kampus satu taruna pada satu bulan (untuk editor kalender
 * & ringkasan periode). READ murni, di-scope prodi. Payload {nit, bulan} →
 * {nit, bulan, tanggal:[{tanggal,status}], hari, min, max}.
 */
function kajurTanggalTaruna(payload, session) {
  var prodi = _hanyaKajur_(session);
  var nit = String((payload && payload.nit) || '').trim();
  if (!nit) throw _fail_('nit wajib diisi.');
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  _pastikanTarunaProdi_(nit, prodi);

  var rows = sheetRead(SHEETS.STATUS_HARIAN, function (r) {
    return String(r.nit) === nit && _bulanStr_(r.tanggal) === bulan &&
      STATUS_LUAR_KAMPUS.indexOf(r.status) >= 0;
  }).map(function (r) { return { tanggal: _tglStr_(r.tanggal), status: r.status }; });
  rows.sort(function (a, b) { return a.tanggal.localeCompare(b.tanggal); });
  return {
    nit: nit, bulan: bulan, tanggal: rows, hari: rows.length,
    min: rows.length ? rows[0].tanggal : '', max: rows.length ? rows[rows.length - 1].tanggal : ''
  };
}

/**
 * KOREKSI: hapus absen luar kampus satu taruna. Beri SALAH SATU cakupan:
 *  • `tanggal` → hapus HANYA hari itu (editor kalender ketuk-tanggal).
 *  • `dari` + `sampai` → hapus semua hari luar kampus dalam rentang (LINTAS BULAN
 *    boleh) — mis. taruna berhenti KPA lebih awal: periode 2 Jan–21 Mei dipotong
 *    dengan menghapus 1–21 Mei, sisa 2 Jan–30 Apr tetap.
 *  • `bulan` → hapus SEMUA hari luar kampus taruna itu pada bulan tsb.
 * BEDA dari status.tandai_kembali (yg hanya hari KE DEPAN) — koreksi ini boleh
 * tanggal LAMPAU. HANYA menyentuh status luar kampus (tak mengutak-atik
 * Pesiar/Cuti/Sakit). Di-scope prodi; withLock + audit.
 * Payload {nit, tanggal?} | {nit, dari, sampai} | {nit, bulan}.
 */
function kajurHapusAbsen(payload, session) {
  var prodi = _hanyaKajur_(session);
  var nit = String((payload && payload.nit) || '').trim();
  if (!nit) throw _fail_('nit wajib diisi.');
  _pastikanTarunaProdi_(nit, prodi);
  var tglSatu = (payload && payload.tanggal) ? _wajibTgl_(payload.tanggal, 'tanggal') : '';
  var dari = (payload && payload.dari) ? _wajibTgl_(payload.dari, 'dari') : '';
  var sampai = (payload && payload.sampai) ? _wajibTgl_(payload.sampai, 'sampai') : '';
  var bulan = (payload && payload.bulan) ? _wajibBulan_(payload.bulan, 'bulan') : '';
  if (!tglSatu && !(dari && sampai) && !bulan) {
    throw _fail_('Beri salah satu cakupan: tanggal, atau dari+sampai, atau bulan.');
  }
  if (dari && sampai && sampai < dari) throw _fail_('sampai tidak boleh sebelum dari.');

  return withLock(function () {
    var target = sheetRead(SHEETS.STATUS_HARIAN, function (r) {
      if (String(r.nit) !== nit) return false;
      if (STATUS_LUAR_KAMPUS.indexOf(r.status) < 0) return false;
      var t = _tglStr_(r.tanggal);
      if (tglSatu) return t === tglSatu;
      if (dari && sampai) return t >= dari && t <= sampai;
      return _bulanStr_(r.tanggal) === bulan;
    });
    if (!target.length) return { jml_dihapus: 0 };
    var dihapus = sheetDeleteRows(SHEETS.STATUS_HARIAN, 'status_id',
      target.map(function (r) { return r.status_id; }));
    auditLog(session, 'kajur.hapus_absen', 'STATUS_HARIAN', nit,
      { baris: dihapus.map(function (r) { return { tanggal: _tglStr_(r.tanggal), status: r.status }; }) },
      { nit: nit, bulan: bulan || null, tanggal: tglSatu || null, dari: dari || null, sampai: sampai || null, prodi: prodi });
    return { jml_dihapus: dihapus.length, nit: nit };
  });
}

/**
 * Setujui rekap luar kampus prodi untuk bulan: set BANTUAN_LUAR_KAMPUS.status
 * (baris nit berprodi session.prodi & bulan itu) DRAFT → DISETUJUI_KAJUR.
 * Payload {bulan}.
 */
function kajurApprove(payload, session) {
  var prodi = _hanyaKajur_(session);
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  return withLock(function () {
    var nitProdi = {};
    _tarunaProdi_(prodi).forEach(function (t) { nitProdi[String(t.nit)] = true; });
    var rows = sheetRead(SHEETS.BANTUAN_LUAR_KAMPUS, function (r) {
      return _bulanStr_(r.bulan) === bulan && nitProdi[String(r.nit)];
    });
    if (!rows.length) throw _fail_('Belum ada data bantuan luar kampus prodi ' + prodi + ' untuk bulan ' + bulan + '.');
    var n = 0;
    rows.forEach(function (r) {
      if (String(r.status) === 'DISETUJUI_KAJUR') return;
      sheetUpdate(SHEETS.BANTUAN_LUAR_KAMPUS, 'bantuan_id', r.bantuan_id,
        { status: 'DISETUJUI_KAJUR', approved_by: session.user_id, approved_at: new Date() });
      auditLog(session, 'kajur.approve', 'BANTUAN_LUAR_KAMPUS', r.bantuan_id,
        { status: r.status || 'DRAFT' }, { status: 'DISETUJUI_KAJUR', prodi: prodi, bulan: bulan });
      n++;
    });
    return { disetujui: n, prodi: prodi, bulan: bulan };
  });
}
