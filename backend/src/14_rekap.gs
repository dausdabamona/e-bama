/**
 * 14_rekap.gs — REKAP_BULANAN: materialized view incremental (SOP no. 10)
 * Status: DRAFT → DISETUJUI_WADIR3 (Wadir 3) → TERVERIFIKASI_PPK (PPK verifikasi)
 *          → FINAL (PPK finalkan; beku, dasar SPM, siap dibayar)
 *
 * ACTION: rekap.get (PPK, KPA), rekap.verify (PPK), rekap.final (PPK),
 *         rekap.approve_wadir3 / rekap.batal_wadir3 (WADIR3),
 *         rekap.input_historis (PPK, Admin) — migrasi bulan pra-aplikasi
 * INTERNAL: rekapUpdate(tanggal) — dipanggil realisasi.ttd, BUKAN action publik.
 *
 * Uang selalu integer rupiah: nominal = hari_makan × harga_per_hari (tarif
 * kontrak, lihat _hargaPerHariKontrak_ di 05_master.gs — fallback ke
 * harga_per_porsi × porsi_per_hari untuk kontrak lama yang belum diisi ulang).
 * Setelah FINAL semua update bulan tsb DITOLAK.
 */

/**
 * rekapUpdate(tanggal) — hitung ulang bulan berjalan secara incremental.
 * hari_makan  = jumlah hari realisasi SAH (kedua ttd) bulan itu MINUS hari
 *               taruna berstatus harian; hari_tidak_makan = hari berstatus.
 * Ditulis batch per baris (bukan 247 update terpisah) demi kuota GAS 6 menit.
 */
function rekapUpdate(tanggal) {
  var bulan = _bulanStr_(tanggal);
  var kontrak = _kontrakAktifPada_(tanggal);
  var hargaPerHari = _hargaPerHariKontrak_(kontrak);

  // Hari-hari realisasi sah pada bulan tsb
  var hariSah = {};
  sheetRead(SHEETS.REALISASI, function (r) {
    return _bulanStr_(r.tanggal) === bulan && r.ttd_pembina_at && r.ttd_senat_at;
  }).forEach(function (r) { hariSah[_tglStr_(r.tanggal)] = true; });
  var jmlHariSah = Object.keys(hariSah).length;

  // Status harian per taruna pada bulan tsb — hari apa pun taruna berstatus
  // (tidak makan di kampus) menurunkan hari_makan-nya.
  var statusPerNit = {};
  sheetRead(SHEETS.STATUS_HARIAN, function (r) { return _bulanStr_(r.tanggal) === bulan; })
    .forEach(function (r) {
      var nit = String(r.nit);
      if (!statusPerNit[nit]) statusPerNit[nit] = {};
      statusPerNit[nit][_tglStr_(r.tanggal)] = true;
    });
  // Sertakan hari PERIODE_LUAR (model periode) yang jatuh di bulan ini — taruna
  // PKL/KPA tidak makan di kampus, jadi hari itu bukan hari_makan dalam kampus.
  (function () {
    var pinfo = bulan.split('-');
    var awal = bulan + '-01';
    var akhir = _tglStr_(new Date(Number(pinfo[0]), Number(pinfo[1]), 0));
    _periodeLuarRows_().forEach(function (pr) {
      if (!pr.tgl_mulai || !pr.tgl_akhir) return;
      var d0 = pr.tgl_mulai > awal ? pr.tgl_mulai : awal;
      var d1 = pr.tgl_akhir < akhir ? pr.tgl_akhir : akhir;
      if (d1 < d0) return;
      if (!statusPerNit[pr.nit]) statusPerNit[pr.nit] = {};
      _daftarTanggal_(d0, d1).forEach(function (t) { statusPerNit[pr.nit][t] = true; });
    });
  })();

  var tarunaAktif = sheetRead(SHEETS.TARUNA, function (r) { return r.status === 'AKTIF'; });

  return withLock(function () {
    var sh = _sheet_(SHEETS.REKAP_BULANAN);
    var lastCol = sh.getLastColumn();
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var last = sh.getLastRow();
    var data = last >= 2 ? sh.getRange(2, 1, last - 1, lastCol).getValues() : [];

    var iBulan = headers.indexOf('bulan'), iNit = headers.indexOf('nit'),
        iStatus = headers.indexOf('status');

    // Peta baris bulan berjalan; tolak bila ada yang FINAL
    var barisNit = {};
    for (var i = 0; i < data.length; i++) {
      if (_bulanStr_(data[i][iBulan]) !== bulan) continue;
      if (String(data[i][iStatus]) === 'FINAL') {
        throw _fail_('Rekap bulan ' + bulan + ' sudah FINAL — update ditolak.');
      }
      barisNit[String(data[i][iNit])] = i + 2; // nomor baris sheet
    }

    var barisBaru = [];
    tarunaAktif.forEach(function (t) {
      var nit = String(t.nit);
      var st = statusPerNit[nit] || {};
      // hari tidak makan yang relevan = status pada hari yang ADA realisasi sah
      var tidak = 0;
      for (var tgl in st) if (hariSah[tgl]) tidak++;
      var makan = jmlHariSah - tidak;
      var nominal = Math.round(makan * hargaPerHari); // integer rupiah

      var nilai = {};
      nilai.bulan = bulan; nilai.nit = nit;
      nilai.hari_makan = makan; nilai.hari_tidak_makan = tidak;
      nilai.nominal = nominal; nilai.status = 'DRAFT';
      nilai.verif_by = ''; nilai.verif_at = '';

      if (barisNit[nit]) {
        var row = headers.map(function (h) { return nilai[h] !== undefined ? nilai[h] : ''; });
        sh.getRange(barisNit[nit], 1, 1, lastCol).setValues([row]);
      } else {
        barisBaru.push(headers.map(function (h) { return nilai[h] !== undefined ? nilai[h] : ''; }));
      }
    });
    if (barisBaru.length) {
      sh.getRange(sh.getLastRow() + 1, 1, barisBaru.length, lastCol).setValues(barisBaru);
    }

    auditLog(null, 'rekap.update', 'REKAP_BULANAN', bulan, null,
      { hari_sah: jmlHariSah, taruna: tarunaAktif.length, harga_per_hari: hargaPerHari });
    return { bulan: bulan, hari_sah: jmlHariSah, taruna: tarunaAktif.length };
  });
}

/** Baris rekap satu bulan. */
function _rekapBulan_(bulan) {
  var rows = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  if (!rows.length) throw _fail_('Belum ada rekap untuk bulan ' + bulan + '.');
  return rows;
}

/**
 * rekap.get {bulan} → baris + total (PPK, KPA).
 * D = hari realisasi sah bulan itu (hari_makan + hari_tidak_makan per baris —
 * konstan untuk semua taruna AKTIF sejak recompute rekapUpdate terakhir).
 * ambang_outlier dari getKebijakanRekap() — dipakai frontend untuk penanda
 * anomali (Redesign Rekap Bulanan), TIDAK memengaruhi hitungan nominal.
 */
function rekapGet(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var rows = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  var total = 0;
  rows.forEach(function (r) { total += _int_(r.nominal || 0, 'nominal'); });
  var d = rows.length ? (_int_(rows[0].hari_makan || 0, 'hari_makan') + _int_(rows[0].hari_tidak_makan || 0, 'hari_tidak_makan')) : 0;
  return { rekap: rows, total: total, bulan: bulan, D: d, ambang_outlier: getKebijakanRekap().ambangOutlier };
}

/** Ubah status semua baris satu bulan (verify/final). */
function _rekapSetStatus_(session, bulan, dari, ke, aksi) {
  var rows = _rekapBulan_(bulan);
  rows.forEach(function (r) {
    if (String(r.status) !== dari) {
      throw _fail_('Ada baris rekap berstatus ' + r.status + ' — seluruh bulan harus ' + dari + ' untuk ' + aksi + '.');
    }
  });
  return withLock(function () {
    var sh = _sheet_(SHEETS.REKAP_BULANAN);
    var lastCol = sh.getLastColumn();
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var last = sh.getLastRow();
    var data = last >= 2 ? sh.getRange(2, 1, last - 1, lastCol).getValues() : [];
    var iBulan = headers.indexOf('bulan'), iStatus = headers.indexOf('status'),
        iBy = headers.indexOf('verif_by'), iAt = headers.indexOf('verif_at');
    var n = 0;
    for (var i = 0; i < data.length; i++) {
      if (_bulanStr_(data[i][iBulan]) !== bulan) continue;
      sh.getRange(i + 2, iStatus + 1).setValue(ke);
      sh.getRange(i + 2, iBy + 1).setValue(session.user_id);
      sh.getRange(i + 2, iAt + 1).setValue(new Date());
      n++;
    }
    auditLog(session, 'rekap.' + aksi, 'REKAP_BULANAN', bulan, { status: dari }, { status: ke, baris: n });
    return { bulan: bulan, status: ke, baris: n };
  });
}

/**
 * DISETUJUI_WADIR3 → TERVERIFIKASI_PPK (PPK verifikasi). PPK memeriksa hasil
 * yang sudah disetujui Wadir 3 — langkah kedua dari akhir sebelum finalisasi.
 */
function rekapVerify(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  return _rekapSetStatus_(session, bulan, 'DISETUJUI_WADIR3', 'TERVERIFIKASI_PPK', 'verify');
}

/**
 * TERVERIFIKASI_PPK → FINAL (PPK finalkan — angka BEKU, dasar SPM, siap dibayar).
 * Langkah TERAKHIR: PPK menyatakan hasil siap dibayar (gerbang bayar.create).
 */
function rekapFinal(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  return _rekapSetStatus_(session, bulan, 'TERVERIFIKASI_PPK', 'FINAL', 'final');
}

/**
 * DRAFT → DISETUJUI_WADIR3 (Wadir 3): persetujuan PALING AWAL atas rekap yang
 * baru tersusun, SEBELUM PPK memverifikasi & memfinalkan. Angka BELUM beku di
 * sini (baru beku saat PPK finalkan) — Wadir 3 menyetujui substansi hasil, lalu
 * diteruskan ke PPK. Prinsip: PPK di posisi terakhir (menerima hasil siap bayar).
 */
function rekapApproveWadir3(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  return _rekapSetStatus_(session, bulan, 'DRAFT', 'DISETUJUI_WADIR3', 'approve_wadir3');
}

/**
 * DISETUJUI_WADIR3 → DRAFT (Wadir 3 batalkan persetujuan — mis. salah klik,
 * atau ternyata ada koreksi hari makan yang perlu diperbaiki dulu sebelum
 * disetujui ulang). HANYA bisa dibatalkan selama PPK BELUM memverifikasi
 * (_rekapSetStatus_ menolak kalau status sudah bukan DISETUJUI_WADIR3, jadi
 * TERVERIFIKASI_PPK/FINAL otomatis tertutup dari pembatalan ini).
 */
function rekapBatalWadir3(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  return _rekapSetStatus_(session, bulan, 'DISETUJUI_WADIR3', 'DRAFT', 'batal_wadir3');
}

/**
 * rekap.input_historis (PPK, Admin) — migrasi bulan yang SUDAH BERJALAN sebelum
 * e-BAMA ada (mis. Januari–Juni), TANPA Pesanan/Realisasi harian palsu.
 * Payload {bulan, biaya_per_hari, baris:[{nit, hari_makan, hari_tidak_makan?}]}.
 * `biaya_per_hari` = satu angka Rp/hari per taruna (cermin dokumen kertas —
 * bukan harga_per_porsi × porsi_per_hari, karena rate historis bisa beda per
 * kelompok, mis. tingkat 3 beda dari tingkat 1–2). Panggil action ini SEKALI
 * PER KELOMPOK RATE dalam bulan yang sama kalau ratenya tidak seragam — baris
 * ditulis per-nit jadi aman dipanggil berkali-kali untuk bulan yang sama.
 * Ditulis batch (bukan per-baris) demi kuota GAS. Ditolak bila bulan itu sudah
 * punya baris berstatus selain DRAFT (mencegah menimpa rekap yang sedang berjalan
 * lewat alur normal). Jejak sumber tercatat di AUDIT_LOG, BUKAN kolom sheet baru.
 */
function rekapInputHistoris(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var biayaPerHari = _int_(payload && payload.biaya_per_hari, 'biaya_per_hari');
  var baris = (payload && payload.baris) || [];
  if (!baris.length) throw _fail_('baris tidak boleh kosong.');

  var existing = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  existing.forEach(function (r) {
    if (String(r.status) !== 'DRAFT') {
      throw _fail_('Rekap bulan ' + bulan + ' sudah berstatus ' + r.status + ' — tidak bisa diimpor historis lagi.');
    }
  });

  var tarunaValid = {};
  sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaValid[String(t.nit)] = true; });

  return withLock(function () {
    var sh = _sheet_(SHEETS.REKAP_BULANAN);
    var lastCol = sh.getLastColumn();
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var last = sh.getLastRow();
    var data = last >= 2 ? sh.getRange(2, 1, last - 1, lastCol).getValues() : [];
    var iBulan = headers.indexOf('bulan'), iNit = headers.indexOf('nit');

    var barisNit = {};
    for (var i = 0; i < data.length; i++) {
      if (_bulanStr_(data[i][iBulan]) !== bulan) continue;
      barisNit[String(data[i][iNit])] = i + 2; // nomor baris sheet
    }

    var barisBaru = [];
    var n = 0;
    baris.forEach(function (b) {
      var nit = String((b && b.nit) || '').trim();
      if (!nit) throw _fail_('nit wajib diisi pada setiap baris.');
      if (!tarunaValid[nit]) throw _fail_('Taruna tidak ditemukan: ' + nit);
      var makan = _int_(b.hari_makan, 'hari_makan');
      var tidak = _int_(b.hari_tidak_makan || 0, 'hari_tidak_makan');
      var nominal = Math.round(makan * biayaPerHari);

      var nilai = {
        bulan: bulan, nit: nit, hari_makan: makan, hari_tidak_makan: tidak,
        nominal: nominal, status: 'DRAFT', verif_by: '', verif_at: ''
      };
      var row = headers.map(function (h) { return nilai[h] !== undefined ? nilai[h] : ''; });
      if (barisNit[nit]) {
        sh.getRange(barisNit[nit], 1, 1, lastCol).setValues([row]);
      } else {
        barisBaru.push(row);
      }
      n++;
    });
    if (barisBaru.length) {
      sh.getRange(sh.getLastRow() + 1, 1, barisBaru.length, lastCol).setValues(barisBaru);
    }

    auditLog(session, 'rekap.input_historis', 'REKAP_BULANAN', bulan, null, {
      baris: n, biaya_per_hari: biayaPerHari,
      sumber: 'INPUT_HISTORIS_PRA_APLIKASI'
    });
    return { bulan: bulan, baris: n };
  });
}

/**
 * rekap.harian {tanggal} — rekonsiliasi 3 titik HARIAN per Prodi+Tingkat,
 * READ-ONLY (tanpa withLock, tanpa efek samping). Beda dari REKAP_BULANAN
 * (materialized view bulanan): dihitung LIVE dari TARUNA+STATUS_HARIAN untuk
 * SATU tanggal, dikelompokkan Prodi+Tingkat supaya langsung terbaca per kelas
 * — pelengkap tampilan modul Taruna + dasar cetak "Rekapitulasi Harian Taruna".
 *
 * "Tidak makan" = STATUS_HARIAN ∈ {PESIAR, CUTI, SAKIT_RUMAH, PENUNDAAN_STUDI, TANPA_KETERANGAN}.
 * "Luar kampus" = STATUS_HARIAN ∈ STATUS_LUAR_KAMPUS (00_config.gs, berhak
 * BANTUAN_LUAR_KAMPUS, bukan makan di kampus). "Makan" = aktif − keduanya —
 * subset yang sama seperti _hitungJmlTaruna_ (12_pesanan.gs)/cetakForm02.
 *
 * `realisasi` (opsional) = rekonsiliasi ke PESANAN.jml_taruna vs
 * REALISASI.jml_taruna_makan tanggal itu — null bila belum ada salah satunya.
 */
function rekapHarian(payload, session) {
  var tgl = _wajibTgl_(payload && payload.tanggal, 'tanggal');

  var tarunaAktif = sheetRead(SHEETS.TARUNA, function (r) { return r.status === 'AKTIF'; });
  var statusHari = {};
  sheetRead(SHEETS.STATUS_HARIAN, function (r) { return _tglStr_(r.tanggal) === tgl; })
    .forEach(function (r) { statusHari[String(r.nit)] = String(r.status); });
  // Sertakan taruna berperiode luar kampus (model periode) yang mencakup tgl ini
  // — kalau belum punya baris STATUS_HARIAN hari itu, pakai status periodenya.
  var luarPeriode = _nitLuarPadaTanggal_(tgl);
  Object.keys(luarPeriode).forEach(function (nit) { if (!statusHari[nit]) statusHari[nit] = luarPeriode[nit]; });

  var kelompok = {};
  function _grupHarian_(prodi, tingkat) {
    var kunci = (prodi || '') + '|' + (tingkat || '');
    if (!kelompok[kunci]) {
      kelompok[kunci] = { prodi: prodi || '', tingkat: tingkat || '', aktif: 0, tidak_makan: 0, luar_kampus: 0, makan: 0 };
    }
    return kelompok[kunci];
  }

  tarunaAktif.forEach(function (t) {
    var g = _grupHarian_(t.prodi, t.tingkat);
    g.aktif++;
    var st = statusHari[String(t.nit)];
    if (!st) { g.makan++; }
    else if (STATUS_LUAR_KAMPUS.indexOf(st) >= 0) { g.luar_kampus++; }
    else { g.tidak_makan++; }
  });

  var perKelompok = Object.keys(kelompok).map(function (k) { return kelompok[k]; })
    .sort(function (a, b) { return a.prodi.localeCompare(b.prodi) || a.tingkat.localeCompare(b.tingkat); });

  var total = { aktif: 0, tidak_makan: 0, luar_kampus: 0, makan: 0 };
  perKelompok.forEach(function (g) {
    total.aktif += g.aktif; total.tidak_makan += g.tidak_makan;
    total.luar_kampus += g.luar_kampus; total.makan += g.makan;
  });

  var pesanan = sheetRead(SHEETS.PESANAN, function (r) { return _tglStr_(r.tgl_makan) === tgl; })[0];
  var realisasi = sheetRead(SHEETS.REALISASI, function (r) { return _tglStr_(r.tanggal) === tgl; })[0];
  var rekonsiliasiHarian = null;
  if (pesanan && realisasi) {
    var dipesan = _int_(pesanan.jml_taruna, 'jml_taruna');
    var dimakan = _int_(realisasi.jml_taruna_makan, 'jml_taruna_makan');
    rekonsiliasiHarian = { dipesan: dipesan, dimakan: dimakan, selisih: dipesan - dimakan };
  }

  return { tanggal: tgl, per_kelompok: perKelompok, total: total, realisasi: rekonsiliasiHarian };
}
