/**
 * 21_cetak.gs — Cetak Form Manual SOP (Form 01-08, docs/format-dokumen.md)
 *
 * ACTION: cetak.form01 (SENAT, PEMBINA, PPK, ADMIN),
 *         cetak.form02 (PEMBINA, PPK, ADMIN),
 *         cetak.form03 (PPK, ADMIN, PEMBINA),
 *         cetak.form04 (SENAT, PEMBINA, PPK, ADMIN),
 *         cetak.form05 (PEMBINA, PPK, ADMIN),
 *         cetak.form06 (PPK, KPA, ADMIN),
 *         cetak.form07 (ADMIN, PPK SAJA — baca TARUNA_REKENING, lihat 22_rekening.gs),
 *         cetak.form08 (ADMIN, PPK SAJA — baca TARUNA_REKENING, lihat 22_rekening.gs)
 *
 * Setiap cetak.formNN adalah action GET-style (tanpa efek samping) — hanya
 * membaca & merangkai data untuk dirender+dicetak di frontend. Tidak ada
 * withLock/AUDIT_LOG di sini KECUALI form yang membaca data sensitif
 * (rekening lengkap, lihat cetak.form07/form08 di tahap lanjutan).
 */

/**
 * Form 01: Rencana & Persetujuan Pemesanan Makan Harian (H-1). Payload {tgl_makan}.
 * Skema TIDAK memisahkan porsi per waktu makan (KONTRAK.porsi_per_hari cuma
 * angka agregat, bukan Sarapan/Siang/Malam terpisah) — sengaja TIDAK
 * mengarang rincian per waktu; frontend menampilkan total porsi harian saja
 * dan mencatat keterbatasan ini di halaman cetak.
 */
function cetakForm01(payload, session) {
  var tgl = _wajibTgl_(payload && payload.tgl_makan, 'tgl_makan');
  var pesanan = sheetRead(SHEETS.PESANAN, function (r) { return _tglStr_(r.tgl_makan) === tgl; })[0];
  if (!pesanan) throw _fail_('Belum ada pesanan untuk tanggal ' + tgl + '.');

  var kontrak = sheetRead(SHEETS.KONTRAK, function (r) { return String(r.kontrak_id) === String(pesanan.kontrak_id); })[0];
  var namaPengguna = {};
  sheetRead(SHEETS.PENGGUNA).forEach(function (p) { namaPengguna[String(p.user_id)] = p.nama; });
  var statusHarianHari = sheetRead(SHEETS.STATUS_HARIAN, function (r) { return _tglStr_(r.tanggal) === tgl; });

  return {
    pesanan: {
      pesanan_id: pesanan.pesanan_id,
      tgl_makan: _tglStr_(pesanan.tgl_makan),
      jml_taruna: _int_(pesanan.jml_taruna, 'jml_taruna'),
      menu: pesanan.menu,
      catatan: pesanan.catatan,
      status: pesanan.status
    },
    kontrak: kontrak ? {
      kontrak_id: kontrak.kontrak_id,
      harga_per_porsi: _int_(kontrak.harga_per_porsi, 'harga_per_porsi'),
      porsi_per_hari: _int_(kontrak.porsi_per_hari, 'porsi_per_hari')
    } : null,
    jml_status_harian: statusHarianHari.length,
    dibuat_oleh_nama: namaPengguna[String(pesanan.created_by)] || pesanan.created_by || '',
    diverifikasi_oleh_nama: namaPengguna[String(pesanan.verif_by)] || pesanan.verif_by || '',
    verif_at: (pesanan.verif_at instanceof Date)
      ? Utilities.formatDate(pesanan.verif_at, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
      : String(pesanan.verif_at || '')
  };
}

/**
 * Form 02: Daftar Hadir / Tanda Terima Makan. Payload {tanggal}.
 * Keputusan desain (dikonfirmasi Firdaus): TIDAK ada pencatatan kehadiran
 * individual di skema — tanda tangan digital Pembina+Senat di REALISASI
 * (ttd_pembina_at/ttd_senat_at) sudah jadi bukti sah tanda terima, jadi form
 * ini HANYA daftar taruna berhak makan (taruna AKTIF dikurangi STATUS_HARIAN
 * tanggal itu — subset sama seperti _hitungJmlTaruna_ PESANAN) tanpa kolom
 * paraf per waktu makan.
 */
function cetakForm02(payload, session) {
  var tgl = _wajibTgl_(payload && payload.tanggal, 'tanggal');

  var tidakBerhak = {};
  sheetRead(SHEETS.STATUS_HARIAN, function (r) { return _tglStr_(r.tanggal) === tgl; })
    .forEach(function (r) { tidakBerhak[String(r.nit)] = true; });

  var daftar = sheetRead(SHEETS.TARUNA, function (r) { return r.status === 'AKTIF' && !tidakBerhak[String(r.nit)]; })
    .map(function (t) { return { nit: String(t.nit), nama: t.nama, prodi: t.prodi, tingkat: t.tingkat, kelas: t.kelas }; })
    .sort(function (a, b) { return a.nama.localeCompare(b.nama); });

  var realisasi = sheetRead(SHEETS.REALISASI, function (r) { return _tglStr_(r.tanggal) === tgl; })[0];

  return {
    tanggal: tgl,
    taruna: daftar,
    jml_taruna: daftar.length,
    realisasi: realisasi ? {
      porsi_diterima: _int_(realisasi.porsi_diterima, 'porsi_diterima'),
      jml_taruna_makan: _int_(realisasi.jml_taruna_makan, 'jml_taruna_makan'),
      ttd_pembina_at: (realisasi.ttd_pembina_at instanceof Date)
        ? Utilities.formatDate(realisasi.ttd_pembina_at, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
        : String(realisasi.ttd_pembina_at || ''),
      ttd_senat_at: (realisasi.ttd_senat_at instanceof Date)
        ? Utilities.formatDate(realisasi.ttd_senat_at, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
        : String(realisasi.ttd_senat_at || '')
    } : null
  };
}

/**
 * Form 03: Rekap Taruna Tidak Menerima Makan (bulanan). Payload {bulan}.
 * Kelompokkan STATUS_HARIAN sebulan per jenis status, sertakan referensi
 * LAMPIRAN (surat bukti) per baris kalau ada.
 */
function cetakForm03(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');

  var tarunaByNit = {};
  sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });

  var rows = sheetRead(SHEETS.STATUS_HARIAN, function (r) { return _bulanStr_(r.tanggal) === bulan; });

  var perStatus = {};
  ENUM.STATUS_HARIAN.forEach(function (s) { perStatus[s] = []; });

  rows.forEach(function (r) {
    var t = tarunaByNit[String(r.nit)] || {};
    var lampiran = lampiranList('STATUS_HARIAN', r.status_id).map(function (l) {
      return { lamp_id: l.lamp_id, nama_file: l.nama_file, drive_file_id: l.drive_file_id };
    });
    var baris = {
      nit: String(r.nit), nama: t.nama || '', prodi: t.prodi || '',
      tanggal: _tglStr_(r.tanggal), status: r.status, lampiran: lampiran
    };
    if (!perStatus[r.status]) perStatus[r.status] = [];
    perStatus[r.status].push(baris);
  });

  // Urutkan tiap kelompok status berdasarkan tanggal
  Object.keys(perStatus).forEach(function (s) {
    perStatus[s].sort(function (a, b) { return a.tanggal.localeCompare(b.tanggal); });
  });

  return { bulan: bulan, per_status: perStatus, total: rows.length };
}

/**
 * Form 04: Rekapitulasi Bulanan Porsi Makan. Payload {bulan}.
 * Keputusan desain (dikonfirmasi Firdaus): TIDAK ada rincian porsi per waktu
 * makan (Sarapan/Siang/Malam) — skema hanya simpan REALISASI.porsi_diterima
 * agregat per tanggal, sama seperti Form 01. Baris per tanggal yang ADA
 * REALISASI (bukan 1..31 buta), diurutkan tanggal, + baris JUMLAH TOTAL.
 */
function cetakForm04(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var realisasiBulan = sheetRead(SHEETS.REALISASI, function (r) { return _bulanStr_(r.tanggal) === bulan; });

  var penyediaById = {};
  sheetRead(SHEETS.PENYEDIA).forEach(function (p) { penyediaById[String(p.penyedia_id)] = p; });

  var kontrakCache = {};
  var kontrakRingkasById = {};
  function kontrakPada(tgl) {
    if (kontrakCache.hasOwnProperty(tgl)) return kontrakCache[tgl];
    var k = null;
    try { k = _kontrakAktifPada_(tgl); } catch (e) { k = null; }
    kontrakCache[tgl] = k;
    if (k && !kontrakRingkasById[k.kontrak_id]) {
      var p = penyediaById[String(k.penyedia_id)] || {};
      kontrakRingkasById[k.kontrak_id] = {
        kontrak_id: k.kontrak_id, penyedia_nama: p.nama || '',
        harga_per_porsi: _int_(k.harga_per_porsi, 'harga_per_porsi')
      };
    }
    return k;
  }

  var totalTarunaAktif = 0, totalPorsi = 0, totalBiaya = 0;
  var baris = realisasiBulan
    .map(function (r) {
      var tgl = _tglStr_(r.tanggal);
      var tarunaAktif = _hitungJmlTaruna_(tgl);
      var porsi = _int_(r.porsi_diterima, 'porsi_diterima');
      var kontrak = kontrakPada(tgl);
      var harga = kontrak ? _int_(kontrak.harga_per_porsi, 'harga_per_porsi') : 0;
      var biaya = Math.round(porsi * harga);
      totalTarunaAktif += tarunaAktif; totalPorsi += porsi; totalBiaya += biaya;
      return {
        tanggal: tgl, taruna_aktif: tarunaAktif, total_porsi: porsi,
        jumlah_biaya: biaya, kontrak_ditemukan: !!kontrak
      };
    })
    .sort(function (a, b) { return a.tanggal.localeCompare(b.tanggal); });

  return {
    bulan: bulan, baris: baris,
    total_taruna_aktif: totalTarunaAktif, total_porsi: totalPorsi, total_biaya: totalBiaya,
    kontrak_ringkas: Object.keys(kontrakRingkasById).map(function (k) { return kontrakRingkasById[k]; })
  };
}

/**
 * Form 05: BA Rekonsiliasi 3 Titik. Payload {tanggal}.
 * Titik 1 = taruna AKTIF dikurangi STATUS_HARIAN pada tanggal itu (headcount
 *   berhak makan, sama seperti perhitungan jml_taruna PESANAN — pakai
 *   _hitungJmlTaruna_ yang sudah ada di 12_pesanan.gs, jangan hitung ulang).
 * Titik 2 = PESANAN.jml_taruna pada tgl_makan = tanggal itu (headcount dipesan).
 * Titik 3 = REALISASI.jml_taruna_makan pada tanggal itu — dipilih (BUKAN
 *   porsi_diterima) supaya satuannya konsisten dengan Titik 1/2, yaitu
 *   headcount taruna, bukan jumlah porsi/menu yang bisa berbeda kalau
 *   porsi_per_hari > 1.
 * Kolom "Penjelasan/Penyebab" SENGAJA tidak dihasilkan otomatis di sini —
 * itu wajib diisi manual oleh Pembina di halaman cetak (state lokal frontend,
 * tidak dikirim ke server).
 */
function cetakForm05(payload, session) {
  var tgl = _wajibTgl_(payload && payload.tanggal, 'tanggal');
  var titik1 = _hitungJmlTaruna_(tgl);
  var pesanan = sheetRead(SHEETS.PESANAN, function (r) { return _tglStr_(r.tgl_makan) === tgl; })[0];
  var titik2 = pesanan ? _int_(pesanan.jml_taruna, 'jml_taruna') : 0;
  var realisasi = sheetRead(SHEETS.REALISASI, function (r) { return _tglStr_(r.tanggal) === tgl; })[0];
  var titik3 = realisasi ? _int_(realisasi.jml_taruna_makan, 'jml_taruna_makan') : 0;
  var selisih1_2 = titik1 - titik2;
  var selisih2_3 = titik2 - titik3;
  var cekOtomatis = {
    label: 'Tidak ada taruna non-aktif/tidak berhak makan yang ikut menerima makan',
    cocok: titik3 <= titik1
  };

  return {
    tanggal: tgl,
    titik1_taruna_berhak: titik1,
    titik2_total_pesanan: titik2,
    titik3_total_realisasi: titik3,
    selisih_titik1_titik2: selisih1_2,
    selisih_titik2_titik3: selisih2_3,
    cocok: selisih1_2 === 0 && selisih2_3 === 0,
    ada_pesanan: !!pesanan,
    ada_realisasi: !!realisasi,
    ketidaksesuaian: realisasi ? (realisasi.ketidaksesuaian || '') : '',
    tindak_lanjut: realisasi ? (realisasi.tindak_lanjut || '') : '',
    cek_otomatis: cekOtomatis
  };
}

/**
 * Form 06: Verifikasi & Rencana Pembayaran PPK (bulanan). Payload {bulan}.
 * HANYA boleh dicetak dari REKAP_BULANAN berstatus FINAL — nominal FINAL
 * sudah beku (§5 CLAUDE.md), jadi angka yang tercetak tidak akan berubah lagi.
 * Kalau bulan itu belum ada rekap sama sekali, atau ada baris yang BUKAN
 * FINAL, tolak dengan pesan jelas (jangan cetak angka yang masih bisa berubah).
 * Checklist 8 dokumen kelengkapan SENGAJA disederhanakan jadi checkbox manual
 * di frontend pada tahap ini (belum ada sumber data terstruktur utk itu).
 */
function cetakForm06(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var rows = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  if (!rows.length) throw _fail_('Belum ada rekap untuk bulan ' + bulan + ' — Form 06 hanya bisa dicetak setelah rekap dibuat dan FINAL.');

  var belumFinal = rows.filter(function (r) { return String(r.status) !== 'FINAL'; });
  if (belumFinal.length) {
    throw _fail_('Rekap bulan ' + bulan + ' belum FINAL (masih berstatus ' + belumFinal[0].status + ') — ' +
      'Form 06 hanya boleh dicetak dari rekap yang sudah FINAL supaya angka yang tercetak tidak berubah lagi. ' +
      'Selesaikan rekap.verify dan rekap.final terlebih dahulu.');
  }

  var tarunaByNit = {};
  sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });

  var totalHariMakan = 0, totalNominal = 0;
  var baris = rows.map(function (r) {
    var t = tarunaByNit[String(r.nit)] || {};
    var nominal = _int_(r.nominal, 'nominal');
    var hariMakan = _int_(r.hari_makan, 'hari_makan');
    totalHariMakan += hariMakan;
    totalNominal += nominal;
    return { nit: String(r.nit), nama: t.nama || '', hari_makan: hariMakan, nominal: nominal };
  });

  return {
    bulan: bulan,
    baris: baris,
    total_taruna: baris.length,
    total_hari_makan: totalHariMakan,
    total_nominal: totalNominal,
    nominal_terbilang: _terbilangRupiah_(totalNominal),
    pejabat: PEJABAT
  };
}

/**
 * Form 07: Usulan Penahanan & Pendebetan Rekening ke Bank. Payload {bulan}.
 * Satu-satunya form yang menampilkan nomor rekening PENUH (join ke
 * TARUNA_REKENING) — role dibatasi ADMIN/PPK dua lapis (ACTION_MAP.roles DAN
 * _hanyaAdminPPK_ di sini), dan setiap panggilan WAJIB 1 baris AUDIT_LOG
 * (daftar NIT yang rekeningnya ikut terbaca, BUKAN nomor rekeningnya).
 * Mensyaratkan PEMBAYARAN bulan itu sudah ada (dibuat lewat bayar.create,
 * yang sendirinya mensyaratkan REKAP_BULANAN berstatus FINAL — setelah alur
 * Wadir 3 setujui → PPK verifikasi → PPK finalkan) — supaya nominal yang
 * tercetak sudah melalui seluruh gerbang persetujuan.
 */
function cetakForm07(payload, session) {
  _hanyaAdminPPK_(session);
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');

  return withLock(function () {
    var pembayaran = sheetRead(SHEETS.PEMBAYARAN, function (r) { return _bulanStr_(r.bulan) === bulan; })[0];
    if (!pembayaran) {
      throw _fail_('Belum ada PEMBAYARAN untuk bulan ' + bulan + ' — Form 07 hanya bisa dicetak setelah proses pembayaran dibuat (bayar.create).');
    }

    var rekapRows = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
    if (!rekapRows.length) throw _fail_('Belum ada rekap untuk bulan ' + bulan + '.');

    var tarunaByNit = {};
    sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });

    var nitList = rekapRows.map(function (r) { return String(r.nit); });
    var rekeningByNit = {};
    sheetRead(SHEETS.TARUNA_REKENING, function (r) { return nitList.indexOf(String(r.nit)) >= 0; })
      .forEach(function (r) { rekeningByNit[String(r.nit)] = r; });

    var totalNominal = 0;
    var baris = rekapRows.map(function (r) {
      var nit = String(r.nit);
      var t = tarunaByNit[nit] || {};
      var rek = rekeningByNit[nit];
      var nominal = _int_(r.nominal, 'nominal');
      totalNominal += nominal;
      return {
        nit: nit, nama: t.nama || '', prodi: t.prodi || '', tingkat: t.tingkat || '',
        bank: rek ? rek.bank : '', no_rekening_lengkap: rek ? rek.no_rekening_lengkap : '',
        nama_pemilik: rek ? rek.nama_pemilik : '', nominal: nominal,
        hari_makan: _int_(r.hari_makan || 0, 'hari_makan'), rekening_lengkap_ada: !!rek
      };
    });

    // AUDIT: satu baris untuk seluruh daftar penerima bulan ini — catat SIAPA
    // (session.user_id) membaca rekening SIAPA (nitList) dan KAPAN, TANPA
    // pernah menulis nomor rekeningnya sendiri ke AUDIT_LOG.
    auditLog(session, 'cetak.form07', 'TARUNA_REKENING', nitList.join(','), null, { nit_list: nitList });

    return {
      bulan: bulan,
      pembayaran: {
        bayar_id: pembayaran.bayar_id,
        nilai_total: _int_(pembayaran.nilai_total, 'nilai_total'),
        no_spm: pembayaran.no_spm, tgl_spm: _tglStr_(pembayaran.tgl_spm),
        no_sp2d: pembayaran.no_sp2d, tgl_sp2d: _tglStr_(pembayaran.tgl_sp2d),
        status: pembayaran.status
      },
      baris: baris,
      total_nominal: totalNominal,
      pejabat: PEJABAT,
      rekening_senat: getRekeningInstansi().senat  // rekening Senat tujuan debet per bank
    };
  });
}

/**
 * Form 08: Usulan Pembayaran Luar Kampus (PKL/Magang/KPA/PTB). Payload
 * {bulan, kegiatan?}. Keputusan desain (dikonfirmasi Firdaus):
 * - Tarif harian TIDAK diinput manual per panggilan — dipakai
 *   BANTUAN_LUAR_KAMPUS.nilai_per_hari yang sudah diimpor (rate bisa beda
 *   per individu/wilayah, tidak ada sheet tarif-per-provinsi baru).
 * - "Jumlah hari kegiatan luar kampus" = dihitung ULANG dari STATUS_HARIAN
 *   (baris berstatus KEGIATAN_LUAR_KAMPUS per nit pada bulan itu), BUKAN
 *   dipercaya dari BANTUAN_LUAR_KAMPUS.total_hari yang diimpor manual dari
 *   dokumen kertas Ketua Jurusan/panitia — konsisten dengan cara Form 03/05
 *   menghitung dari STATUS_HARIAN sebagai sumber kebenaran. total_hari hasil
 *   impor tetap ditampilkan sebagai pembanding (hari_cocok), tapi nominal
 *   yang dicetak memakai hasil hitung ulang ini.
 * Sama seperti Form 07: menampilkan rekening lengkap → ADMIN/PPK saja,
 * wajib AUDIT_LOG per panggilan.
 */
function cetakForm08(payload, session) {
  _hanyaAdminPPK_(session);
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var kegiatan = (payload && payload.kegiatan) ? String(payload.kegiatan).trim() : '';

  return withLock(function () {
    var blkRows = sheetRead(SHEETS.BANTUAN_LUAR_KAMPUS, function (r) {
      return _bulanStr_(r.bulan) === bulan && (!kegiatan || String(r.kegiatan) === kegiatan);
    });
    if (!blkRows.length) {
      throw _fail_('Belum ada data Bantuan Luar Kampus untuk bulan ' + bulan + (kegiatan ? (' kegiatan ' + kegiatan) : '') + '.');
    }

    // Hitung ulang jml hari dari STATUS_HARIAN — sumber kebenaran (dikonfirmasi Firdaus),
    // bukan total_hari hasil impor CSV.
    var hariStatusHarianByNit = {};
    sheetRead(SHEETS.STATUS_HARIAN, function (r) {
      return _bulanStr_(r.tanggal) === bulan && STATUS_LUAR_KAMPUS.indexOf(r.status) >= 0;
    }).forEach(function (r) {
      var nit = String(r.nit);
      hariStatusHarianByNit[nit] = (hariStatusHarianByNit[nit] || 0) + 1;
    });

    var tarunaByNit = {};
    sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });

    var nitList = blkRows.map(function (r) { return String(r.nit); });
    var rekeningByNit = {};
    sheetRead(SHEETS.TARUNA_REKENING, function (r) { return nitList.indexOf(String(r.nit)) >= 0; })
      .forEach(function (r) { rekeningByNit[String(r.nit)] = r; });

    var totalNominal = 0;
    var baris = blkRows.map(function (r) {
      var nit = String(r.nit);
      var t = tarunaByNit[nit] || {};
      var rek = rekeningByNit[nit];
      var nilaiPerHari = _int_(r.nilai_per_hari, 'nilai_per_hari');
      var totalHariImpor = _int_(r.total_hari, 'total_hari');
      var jmlHari = hariStatusHarianByNit[nit] || 0;
      var nominal = Math.round(jmlHari * nilaiPerHari);
      totalNominal += nominal;
      return {
        nit: nit, nama: t.nama || '', kegiatan: r.kegiatan, periode: r.periode,
        bank: rek ? rek.bank : '', no_rekening_lengkap: rek ? rek.no_rekening_lengkap : '',
        nama_pemilik: rek ? rek.nama_pemilik : '', rekening_lengkap_ada: !!rek,
        jml_hari: jmlHari, total_hari_impor: totalHariImpor, hari_cocok: jmlHari === totalHariImpor,
        nilai_per_hari: nilaiPerHari, nominal: nominal
      };
    });

    auditLog(session, 'cetak.form08', 'TARUNA_REKENING', nitList.join(','), null, { nit_list: nitList });

    return { bulan: bulan, kegiatan: kegiatan, baris: baris, total_nominal: totalNominal, pejabat: PEJABAT };
  });
}

/**
 * Form 09: Permohonan Pendebetan Rekening Senat → Penyedia (tahap-2 pembayaran).
 * Payload {bulan}. Setelah dana taruna didebet ke rekening Senat (Form 07),
 * Senat mengajukan pendebetan rekening Senat ke rekening Penyedia — PER BANK
 * (BNI & BSI), karena rekening Senat & Penyedia masing-masing 2 (alur paralel:
 * Senat BSI→Penyedia BSI, Senat BNI→Penyedia BNI).
 *
 * TIDAK membaca TARUNA_REKENING (bukan rekening taruna) → tidak wajib AUDIT_LOG
 * rekening. Nominal per bank = SUM(REKAP_BULANAN.nominal) dikelompokkan lewat
 * join TARUNA.bank (pola sama seperti rekonsiliasi SP2D & Form 07). Rekening
 * Senat/Penyedia dari getRekeningInstansi() (Script Property, diisi Admin).
 */
function cetakForm09(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');

  var pembayaran = sheetRead(SHEETS.PEMBAYARAN, function (r) { return _bulanStr_(r.bulan) === bulan; })[0];
  if (!pembayaran) {
    throw _fail_('Belum ada PEMBAYARAN untuk bulan ' + bulan + ' — Form 09 hanya bisa dicetak setelah proses pembayaran dibuat.');
  }
  var rekapRows = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  if (!rekapRows.length) throw _fail_('Belum ada rekap untuk bulan ' + bulan + '.');

  var tarunaByNit = {};
  sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });

  var rek = getRekeningInstansi();
  var agg = {}; // bank -> {total, jml}
  rekapRows.forEach(function (r) {
    var t = tarunaByNit[String(r.nit)] || {};
    var bank = t.bank || 'LAINNYA';
    if (!agg[bank]) agg[bank] = { total: 0, jml: 0 };
    agg[bank].total += _int_(r.nominal || 0, 'nominal');
    agg[bank].jml += 1;
  });

  var urut = { BSI: 0, BNI: 1 };
  var perBank = Object.keys(agg)
    .sort(function (a, b) { return (urut[a] == null ? 9 : urut[a]) - (urut[b] == null ? 9 : urut[b]); })
    .map(function (bank) {
      return {
        bank: bank, jml_taruna: agg[bank].jml, total: agg[bank].total,
        rek_senat_sumber: rek.senat[bank] || '',
        rek_penyedia_tujuan: rek.penyedia[bank] || ''
      };
    });

  // Nama penyedia dari kontrak pembayaran.
  var penyediaNama = '';
  var kontrak = sheetRead(SHEETS.KONTRAK, function (r) { return String(r.kontrak_id) === String(pembayaran.kontrak_id); })[0];
  if (kontrak) {
    var p = sheetRead(SHEETS.PENYEDIA, function (r) { return String(r.penyedia_id) === String(kontrak.penyedia_id); })[0];
    if (p) penyediaNama = p.nama || '';
  }

  var totalNominal = 0;
  perBank.forEach(function (b) { totalNominal += b.total; });

  return {
    bulan: bulan,
    penyedia_nama: penyediaNama,
    per_bank: perBank,
    total_nominal: totalNominal,
    nominal_terbilang: _terbilangRupiah_(totalNominal),
    pembayaran: {
      no_spm: pembayaran.no_spm, tgl_spm: _tglStr_(pembayaran.tgl_spm),
      no_sp2d: pembayaran.no_sp2d, tgl_sp2d: _tglStr_(pembayaran.tgl_sp2d),
      status: pembayaran.status
    },
    pejabat: PEJABAT
  };
}
