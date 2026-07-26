/**
 * 27_dashboard.gs — Dashboard Rekap Bulan Berjalan (baca-saja, tanpa efek samping)
 *
 * ACTION: dashboard.running {bulan, tahun} → {summary, progress, daily, estimation}
 * Roles: PPK, STAF_PPK, PENYEDIA (dikonfirmasi Firdaus — termasuk portal rekanan;
 * PENYEDIA HARUS juga terdaftar di PENYEDIA_ACTIONS, lihat 01_router.gs, supaya
 * lolos pagar khusus PENYEDIA sebelum def.roles diperiksa).
 *
 * TIDAK MENDUPLIKASI RUMUS — menggabungkan fungsi yang SUDAH ADA:
 *  - _basisPesananBulan_ (14_rekap.gs)   → proyeksi hari/OH/nominal basis PESANAN final
 *  - SHEETS.REKAP_BULANAN (dibaca sama seperti rekapGet, 14_rekap.gs) → basis realisasi sah
 *  - _hargaPerHariKontrak_ (05_master.gs) → tarif per kontrak_id
 *  - _tarunaAktifBulan_ (10_taruna.gs)     → aturan eligibilitas taruna bulan berjalan
 *  - _hariDalamMinggu_ (05_master.gs)      → nama hari dari tanggal
 * Satu-satunya logika BARU di file ini: breakdown per-tanggal (`daily[]`) — tidak
 * ada fungsi existing yang menghasilkannya (rekapGet per-nit, rekapHarian cuma
 * SATU tanggal, _basisPesananBulan_/_rekapProyeksiPesanan_ agregat/per-nit bulanan,
 * bukan per-tanggal).
 *
 * Definisi (dikonfirmasi Firdaus):
 *  - "hari sudah dipesan" = ADA baris PESANAN tanggal itu, APA PUN statusnya
 *    (DRAFT/DIAJUKAN/DISETUJUI/DIKEMBALIKAN/TERKIRIM) — beda sengaja dari
 *    _basisPesananBulan_ yang hanya menghitung DISETUJUI/TERKIRIM: di sini yang
 *    diukur progres KERJA Senat (sudah dibuatkan pesanan atau belum), bukan
 *    yang sudah lolos verifikasi Pembina.
 *  - Progress % = terhadap TOTAL HARI KALENDER bulan itu (bukan terhadap hari
 *    yang sudah dipesan).
 *  - "Estimasi Tagihan" = proyeksi NILAI PEMBAYARAN bulan ini (BUKAN sheet
 *    TAGIHAN/piutang gagal debet) — dari REKAP_BULANAN kalau bulan itu sudah
 *    ada barisnya, fallback _basisPesananBulan_ kalau belum (pola sama seperti
 *    _daftarKuasaDebet_ di 21_cetak.gs).
 *
 * PERFORMA: mengikuti pelajaran _rekapProyeksiPesanan_ (lihat catatan di sana,
 * 14_rekap.gs) — PESANAN & REALISASI bulan ini masing-masing dibaca TEPAT SATU
 * KALI di awal lalu dipetakan per tanggal, BUKAN sheetRead di dalam loop
 * tanggal. Hanya KONTRAK yang dibaca per kontrak_id BARU ditemui (di-cache
 * di `tarifPerKontrak`), sama seperti pola di _basisPesananBulan_.
 */
function dashboardRunning(payload, session) {
  var bulanNum = Number(payload && payload.bulan);
  var tahun = Number(payload && payload.tahun);
  if (!isFinite(bulanNum) || bulanNum < 1 || bulanNum > 12) throw _fail_('bulan harus angka 1-12.');
  if (!isFinite(tahun) || tahun < 2020 || tahun > 2100) throw _fail_('tahun tidak valid.');
  var bulan = tahun + '-' + (bulanNum < 10 ? '0' + bulanNum : String(bulanNum));
  var totalHariKalender = new Date(tahun, bulanNum, 0).getDate();

  // ── PESANAN & REALISASI bulan ini — dibaca SEKALI, dipetakan per tanggal ──
  var pesananPerTgl = {}; // tgl -> baris PESANAN (tgl_makan unik di skema, lihat docs/skema-sheet.md §7)
  sheetRead(SHEETS.PESANAN, function (r) { return _bulanStr_(r.tgl_makan) === bulan; })
    .forEach(function (p) { pesananPerTgl[_tglStr_(p.tgl_makan)] = p; });

  var realisasiPerTgl = {}; // tgl -> baris REALISASI (satu pesanan = satu realisasi)
  sheetRead(SHEETS.REALISASI, function (r) { return _bulanStr_(r.tanggal) === bulan; })
    .forEach(function (r) { realisasiPerTgl[_tglStr_(r.tanggal)] = r; });

  // ── Tarif per kontrak_id — cache, HANYA baca KONTRAK saat kontrak_id baru
  //    ditemui (pola sama _basisPesananBulan_/_rekapProyeksiPesanan_, 14_rekap.gs) ──
  var tarifPerKontrak = {};
  function tarifUntukKontrak(kontrakId) {
    var kid = String(kontrakId || '');
    if (!(kid in tarifPerKontrak)) {
      var k = sheetRead(SHEETS.KONTRAK, function (r) { return String(r.kontrak_id) === kid; })[0];
      tarifPerKontrak[kid] = k ? _hargaPerHariKontrak_(k) : 0;
    }
    return tarifPerKontrak[kid];
  }

  // ── Rakit daily[] — SATU baris per hari kalender bulan itu (termasuk yang
  //    belum ada pesanan sama sekali, supaya "belum dipesan" terlihat konkret
  //    tanggalnya — pola sama seperti cetak.rekap_pesanan_bulan) ─────────────
  var daily = [];
  var hariSudahDipesan = 0, hariSudahDirealisasi = 0;
  var totalPorsiDipesan = 0, totalPorsiDirealisasi = 0;
  for (var d = 1; d <= totalHariKalender; d++) {
    var tgl = bulan + '-' + (d < 10 ? '0' + d : String(d));
    var p = pesananPerTgl[tgl];
    var r = realisasiPerTgl[tgl];

    var statusRealisasi = '';
    if (r) statusRealisasi = (r.ttd_pembina_at && r.ttd_senat_at) ? 'SAH' : 'SEBAGIAN';

    var jmlTarunaPesanan = p ? _int_(p.jml_taruna || 0, 'jml_taruna') : 0;
    if (p) { hariSudahDipesan++; totalPorsiDipesan += jmlTarunaPesanan; }
    if (statusRealisasi === 'SAH') hariSudahDirealisasi++;
    if (r) totalPorsiDirealisasi += _int_(r.porsi_diterima || 0, 'porsi_diterima');

    daily.push({
      tanggal: tgl,
      hari: _hariDalamMinggu_(tgl),
      pesanan_id: p ? String(p.pesanan_id) : '',
      status_pesanan: p ? String(p.status) : '',
      jml_taruna_pesanan: jmlTarunaPesanan,
      status_realisasi: statusRealisasi,
      porsi_diterima: r ? _int_(r.porsi_diterima || 0, 'porsi_diterima') : 0,
      jml_taruna_makan: r ? _int_(r.jml_taruna_makan || 0, 'jml_taruna_makan') : 0,
      // integer rupiah (aturan uang, CLAUDE.md §3) — Math.round jaga-jaga walau
      // jmlTarunaPesanan*tarif seharusnya sudah bulat.
      nominal_hari: p ? Math.round(jmlTarunaPesanan * tarifUntukKontrak(p.kontrak_id)) : 0
    });
  }

  var hariBelumDipesan = totalHariKalender - hariSudahDipesan;
  // Hanya dihitung dari hari yang SUDAH dipesan — hari yang belum dipesan
  // otomatis belum bisa direalisasi, jangan dobel-hitung sebagai "belum direalisasi".
  // Math.max(0, ...) berjaga dari data anomali (REALISASI ada tanpa PESANAN
  // hari itu — ditemukan saat pengujian skenario "tidak ada pesanan").
  var hariBelumDirealisasi = Math.max(0, hariSudahDipesan - hariSudahDirealisasi);

  var jmlTarunaAktif = sheetRead(SHEETS.TARUNA, function (r) { return _tarunaAktifBulan_(r, bulan); }).length;

  // ── Estimasi — REUSE _basisPesananBulan_ + REKAP_BULANAN, BUKAN rumus baru ──
  var basisPesanan = _basisPesananBulan_(bulan);
  var rekapRows = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  var nominalRealisasiSah = 0;
  rekapRows.forEach(function (rr) { nominalRealisasiSah += _int_(rr.nominal || 0, 'nominal'); });
  var basis = rekapRows.length ? 'REKAP' : 'PESANAN';
  var estimasiTagihan = rekapRows.length ? nominalRealisasiSah : basisPesanan.nominal_proyeksi;

  return {
    bulan: bulanNum,
    tahun: tahun,
    bulan_str: bulan,
    rekap_status: rekapRows.length ? String(rekapRows[0].status || 'DRAFT') : '',
    summary: {
      total_hari_kalender: totalHariKalender,
      hari_sudah_dipesan: hariSudahDipesan,
      hari_belum_dipesan: hariBelumDipesan,
      hari_sudah_direalisasi: hariSudahDirealisasi,
      hari_belum_direalisasi: hariBelumDirealisasi,
      total_porsi_dipesan: totalPorsiDipesan,
      total_porsi_direalisasi: totalPorsiDirealisasi,
      jml_taruna_aktif: jmlTarunaAktif
    },
    progress: {
      persen_pesanan: totalHariKalender ? Math.round((hariSudahDipesan / totalHariKalender) * 1000) / 10 : 0,
      persen_realisasi: totalHariKalender ? Math.round((hariSudahDirealisasi / totalHariKalender) * 1000) / 10 : 0
    },
    daily: daily,
    estimation: {
      basis: basis,
      nominal_proyeksi_pesanan: basisPesanan.nominal_proyeksi,
      nominal_realisasi_sah: nominalRealisasiSah,
      estimasi_tagihan_bulan_ini: estimasiTagihan,
      selisih: basisPesanan.nominal_proyeksi - nominalRealisasiSah
    }
  };
}
