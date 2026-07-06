/**
 * 26_kokpit.gs — Kokpit PPK: orkestrasi tutup-bulan, READ-ONLY.
 *
 * ACTION: ppk.kokpit (PPK, KPA, WADIR3)
 *
 * Murni agregasi baca dari action/fungsi yang SUDAH ADA (REKAP_BULANAN,
 * bayarList, spmList, sp2dRekonsiliasi, tagihanStatusDebet/tagihanList,
 * PESANAN/REALISASI) — TIDAK menulis apa pun, TIDAK melewati guard action
 * mana pun. `link` di `tahapan`/`tindakan` hanya menautkan ke halaman aksi;
 * penegakan sebenarnya tetap di action masing-masing saat user mengeklik.
 *
 * Degradasi anggun (BUKAN error): SPM kosong untuk suatu bulan (mis. bulan
 * legacy Jan-Mar 2026, lihat docs/skema-sheet.md §9, atau bulan yang belum
 * dibuatkan PEMBAYARAN) → status 'n_a', bukan 'merah'. SURAT_PENDEBETAN
 * (§20) memang belum ada sheet/action-nya (masih PARKIR) → langsung 'n_a'.
 */
function ppkKokpit(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var today = _todayStr_();

  // ── Sumber data (satu kali baca/panggil per domain — reuse, bukan duplikasi) ──
  var rekapRows = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  var pembayaranRows = bayarList({ bulan: bulan }, session).pembayaran;
  var spmRows = spmList({ bulan: bulan }, session).spm;
  var sp2dRek = null;
  try { sp2dRek = sp2dRekonsiliasi({ bulan: bulan }, session); } catch (e) { sp2dRek = null; }
  var statusDebet = null;
  try { statusDebet = tagihanStatusDebet({ bulan: bulan }, session); } catch (e) { statusDebet = null; }
  var tagihanOutstanding = tagihanList({ bulan: bulan, status: 'TERTAGIH' }, session).tagihan;
  var pesananRows = sheetRead(SHEETS.PESANAN, function (r) { return _bulanStr_(r.tgl_makan) === bulan; });
  var realisasiRows = sheetRead(SHEETS.REALISASI, function (r) { return _bulanStr_(r.tanggal) === bulan; });

  // ── Turunan dasar ─────────────────────────────────────────────────────────
  var semuaRekapAda = rekapRows.length > 0;
  var semuaRekapFinal = semuaRekapAda && rekapRows.every(function (r) { return r.status === 'FINAL'; });
  var jmlRekapFinal = rekapRows.filter(function (r) { return r.status === 'FINAL'; }).length;
  var targetRekap = 0;
  rekapRows.forEach(function (r) { targetRekap += _int_(r.nominal || 0, 'nominal'); });

  var pembayaranAda = pembayaranRows.length > 0;
  var pembayaranSelesai = pembayaranAda && pembayaranRows.every(function (b) { return b.status === 'SELESAI'; });
  var terbayarSp2d = 0;
  pembayaranRows.forEach(function (b) { if (b.status === 'SELESAI') terbayarSp2d += _int_(b.nilai_total || 0, 'nilai_total'); });

  var spmAda = spmRows.length > 0; // kosong = bulan legacy (pra-SPM) ATAU belum ada PEMBAYARAN
  var spmAdaDraft = spmAda && spmRows.some(function (s) { return s.status === 'DRAFT'; });
  var spmSemuaDiajukan = spmAda && spmRows.every(function (s) { return s.status !== 'DRAFT'; });
  var spmSemuaSp2dTerbit = spmAda && spmRows.every(function (s) { return s.status === 'SP2D_TERBIT'; });
  var jmlSpmCair = spmRows.filter(function (s) { return s.status === 'SP2D_TERBIT'; }).length;

  var sp2dPerluCekManual = sp2dRek ? sp2dRek.perlu_cek_manual.length : 0;
  var sp2dBersih = sp2dRek ? (sp2dPerluCekManual === 0 &&
    sp2dRek.dalam_kampus.every(function (g) { return g.cocok; }) &&
    sp2dRek.luar_kampus.every(function (g) { return g.cocok; })) : false;

  // Proksi "debet sudah diproses bulan ini" — sistem tak melacak "kapan impor
  // terakhir" secara eksplisit; tagihanStatusDebet hanya berhasil (tak throw)
  // kalau REKAP bernominal>0 untuk bulan itu ADA (dasar permohonan debet siap).
  var jmlGagalDebet = statusDebet ? statusDebet.jml_gagal : 0;
  var jmlBerhasilDebet = statusDebet ? statusDebet.jml_berhasil : 0;
  var debetSiapDiproses = !!statusDebet;

  var outstandingTagihan = 0;
  tagihanOutstanding.forEach(function (t) { outstandingTagihan += _int_(t.nominal || 0, 'nominal'); });
  var tagihanLewatTenggat = tagihanOutstanding.filter(function (t) {
    return t.tenggat_aktif && today > t.tenggat_aktif;
  });

  var porsiDipesan = 0;
  pesananRows.forEach(function (p) { porsiDipesan += _int_(p.jml_taruna || 0, 'jml_taruna'); });
  var porsiDimakan = 0;
  realisasiRows.forEach(function (r) { porsiDimakan += _int_(r.jml_taruna_makan || 0, 'jml_taruna_makan'); });

  // ── Bagian 1: ringkasan (angka kunci) ─────────────────────────────────────
  var ringkasan = {
    bulan: bulan,
    target_rekap: targetRekap,
    terbayar_sp2d: terbayarSp2d,
    outstanding_tagihan: outstandingTagihan,
    porsi_dipesan: porsiDipesan,
    porsi_dimakan: porsiDimakan
  };

  // ── Bagian 2: tahapan tutup-bulan (status diturunkan + gerbang prasyarat) ──
  function langkah(no, label, statusWarna, angka, prasyaratOk, link) {
    return { no: no, label: label, status: statusWarna, angka: angka, prasyarat_ok: prasyaratOk, link: link };
  }

  var tahapan = [
    langkah(1, 'REKAP FINAL',
      semuaRekapFinal ? 'hijau' : (semuaRekapAda ? 'kuning' : 'merah'),
      semuaRekapAda ? (jmlRekapFinal + '/' + rekapRows.length + ' FINAL') : 'belum ada rekap',
      true, '/rekap'),
    langkah(2, 'PEMBAYARAN dibuat',
      pembayaranAda ? 'hijau' : 'merah',
      pembayaranAda ? (pembayaranRows.length + ' baris') : 'belum dibuat',
      semuaRekapFinal, '/pembayaran'),
    langkah(3, 'SPM diajukan',
      !spmAda ? 'n_a' : (spmSemuaDiajukan ? 'hijau' : 'kuning'),
      !spmAda ? 'N/A (bulan legacy / belum ada SPM)' : (spmAdaDraft ? 'ada DRAFT' : 'semua diajukan'),
      pembayaranAda, '/pembayaran'),
    langkah(4, 'SP2D diterima',
      !spmAda ? 'n_a' : (spmSemuaSp2dTerbit ? 'hijau' : 'kuning'),
      !spmAda ? 'N/A' : (jmlSpmCair + '/' + spmRows.length + ' cair'),
      spmSemuaDiajukan, '/pembayaran'),
    langkah(5, 'Rekonsiliasi SP2D bersih',
      !sp2dRek ? 'n_a' : (sp2dBersih ? 'hijau' : 'kuning'),
      !sp2dRek ? 'N/A' : (sp2dPerluCekManual + ' perlu cek manual'),
      pembayaranSelesai || spmSemuaSp2dTerbit, '/laporan'),
    langkah(6, 'Debet diimpor',
      !debetSiapDiproses ? 'n_a' : (jmlGagalDebet > 0 || jmlBerhasilDebet > 0 ? 'hijau' : 'kuning'),
      debetSiapDiproses ? (jmlGagalDebet + ' gagal debet') : 'N/A',
      pembayaranSelesai || spmSemuaSp2dTerbit, '/tagihan/impor-debet'),
    langkah(7, 'SP & penagihan',
      outstandingTagihan === 0 ? 'hijau' : (tagihanLewatTenggat.length > 0 ? 'merah' : 'kuning'),
      outstandingTagihan === 0 ? 'lunas semua' : (tagihanOutstanding.length + ' outstanding'),
      true, '/tagihan'),
    langkah(8, 'Surat pendebetan (remit)', 'n_a', 'N/A — §20 belum ada (masih parkir)', false, ''),
    langkah(9, 'Laporan/SPJ diarsipkan',
      pembayaranSelesai ? 'kuning' : 'merah', // sistem tak melacak "sudah diarsipkan" — kuning = siap, tetap perlu konfirmasi manual di luar sistem
      pembayaranSelesai ? 'siap cetak Laporan Resmi' : 'menunggu PEMBAYARAN SELESAI',
      pembayaranSelesai, '/laporan')
  ];

  // ── Bagian 3: butuh tindakan PPK (pengecualian, prioritas tenggat dulu) ───
  var tindakan = [];
  tagihanLewatTenggat.forEach(function (t) {
    tindakan.push({
      prioritas: 0,
      apa: 'Tindak lanjut tagihan ' + t.tagihan_id + ' (SP-' + t.level_aktif + ' lewat tenggat)',
      kenapa: 'Tenggat ' + t.tenggat_aktif + ' sudah lewat (' + today + ').',
      link: '/tagihan/' + t.tagihan_id
    });
  });
  if (semuaRekapAda && !semuaRekapFinal) {
    tindakan.push({ prioritas: 1, apa: 'Verifikasi & finalkan REKAP bulan ' + bulan, kenapa: 'REKAP belum FINAL — tak bisa lanjut ke PEMBAYARAN/SPM.', link: '/rekap' });
  }
  if (spmAda && spmAdaDraft) {
    var jmlDraft = spmRows.filter(function (s) { return s.status === 'DRAFT'; }).length;
    tindakan.push({ prioritas: 2, apa: 'Ajukan ' + jmlDraft + ' SPM ke KPPN', kenapa: 'Ada SPM berstatus DRAFT.', link: '/pembayaran' });
  }
  if (sp2dPerluCekManual > 0) {
    tindakan.push({ prioritas: 2, apa: 'Cocokkan ' + sp2dPerluCekManual + ' baris SP2D', kenapa: 'perlu_cek_manual pada rekonsiliasi SP2D.', link: '/laporan' });
  }
  var selisihPorsi = porsiDipesan - porsiDimakan;
  if (porsiDipesan > 0 && Math.abs(selisihPorsi) > Math.round(porsiDipesan * 0.1)) {
    tindakan.push({ prioritas: 3, apa: 'Cek realisasi — selisih dipesan-vs-dimakan besar', kenapa: 'Selisih ' + selisihPorsi + ' dari ' + porsiDipesan + ' porsi dipesan.', link: '/realisasi' });
  }
  tindakan.sort(function (a, b) { return a.prioritas - b.prioritas; });

  return { ringkasan: ringkasan, tahapan: tahapan, tindakan: tindakan };
}
