/**
 * 21_cetak.gs — Cetak Form Manual SOP (Form 01-08, docs/format-dokumen.md)
 *
 * ACTION: cetak.form01 (SENAT, PEMBINA, PPK, ADMIN),
 *         cetak.form03 (PPK, ADMIN, PEMBINA),
 *         cetak.form05 (PEMBINA, PPK, ADMIN),
 *         cetak.form06 (PPK, KPA, ADMIN)
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
