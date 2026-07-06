/**
 * 18_laporan.gs — Laporan bulanan (SOP 17–19) & Audit Log
 *
 * ACTION: laporan.bulanan (PPK, KPA), laporan.resmi (PPK, KPA, WADIR3),
 *         audit.list (Admin, PPK, KPA)
 */

/** Ringkasan satu bulan: rekap + realisasi + pembayaran + piutang. */
function laporanBulanan(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');

  var rekap = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  var totalHariMakan = 0, totalNominal = 0, statusRekap = rekap.length ? rekap[0].status : '';
  rekap.forEach(function (r) {
    totalHariMakan += Number(r.hari_makan) || 0;
    totalNominal += Number(r.nominal) || 0;
    if (r.status !== statusRekap) statusRekap = 'CAMPURAN';
  });

  var realisasi = sheetRead(SHEETS.REALISASI, function (r) { return _bulanStr_(r.tanggal) === bulan; });
  var hariSah = {}, jmlKetidaksesuaian = 0;
  realisasi.forEach(function (r) {
    if (r.ttd_pembina_at && r.ttd_senat_at) hariSah[_tglStr_(r.tanggal)] = true;
    if (r.ketidaksesuaian) jmlKetidaksesuaian++;
  });

  // _bulanStr_ (bukan String() polos) — kolom bulan bisa auto-tertafsir Date
  // oleh Google Sheets (lihat catatan sama di 23_sp2d.gs/15_pembayaran.gs).
  var bayar = sheetRead(SHEETS.PEMBAYARAN, function (r) { return _bulanStr_(r.bulan) === bulan; })[0] || null;

  var tagihan = sheetRead(SHEETS.TAGIHAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  var perStatus = {};
  var totalOutstanding = 0;
  tagihan.forEach(function (t) {
    perStatus[t.status] = (perStatus[t.status] || 0) + 1;
    if (t.status === 'TERTAGIH') totalOutstanding += Number(t.nominal) || 0;
  });

  return {
    bulan: bulan,
    rekap: { jml_taruna: rekap.length, total_hari_makan: totalHariMakan, total_nominal: totalNominal, status: statusRekap },
    realisasi: { jml_hari_sah: Object.keys(hariSah).length, jml_ketidaksesuaian: jmlKetidaksesuaian, jml_catatan: realisasi.length },
    pembayaran: bayar ? {
      bayar_id: bayar.bayar_id, status: bayar.status, nilai_total: Number(bayar.nilai_total) || 0,
      no_spm: bayar.no_spm, no_sp2d: bayar.no_sp2d
    } : null,
    tagihan: { jumlah: tagihan.length, per_status: perStatus, total_outstanding: totalOutstanding }
  };
}

/**
 * laporan.resmi (PPK, KPA, WADIR3) — data untuk format "Laporan Bulanan
 * Pemantauan dan Evaluasi Bantuan Biaya Makan" resmi (acuan Itjen/KKP).
 * Hanya mencakup bagian DALAM KAMPUS yang datanya sudah dilacak e-BAMA —
 * bagian Luar Kampus/Pengusulan/DIPA-SK tidak ada di sini, diisi manual
 * di halaman cetak (lihat frontend pages/laporan/laporan-resmi.tsx).
 */
function laporanResmi(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var awal = bulan + '-01', akhir = bulan + '-31';

  var tarunaByNit = {};
  var jmlAktif = 0;
  sheetRead(SHEETS.TARUNA).forEach(function (t) {
    tarunaByNit[String(t.nit)] = t;
    if (t.status === 'AKTIF') jmlAktif++;
  });

  var kontrakBulan = sheetRead(SHEETS.KONTRAK, function (r) {
    return r.status === 'DISETUJUI_PPK' && _tglStr_(r.tgl_mulai) <= akhir && _tglStr_(r.tgl_akhir) >= awal;
  })[0] || null;

  var rekap = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  var penerima = rekap.map(function (r) {
    var t = tarunaByNit[String(r.nit)] || {};
    var hariMakan = _int_(r.hari_makan || 0, 'hari_makan');
    var nominal = _int_(r.nominal || 0, 'nominal');
    return {
      nit: String(r.nit), nama: t.nama || '', prodi: t.prodi || '', status: t.status || '',
      rek_mask: t.rek_mask || '', hari_makan: hariMakan, nominal: nominal,
      per_hari: hariMakan ? Math.round(nominal / hariMakan) : 0
    };
  });
  var totalHariMakan = 0, totalNominal = 0;
  penerima.forEach(function (p) { totalHariMakan += p.hari_makan; totalNominal += p.nominal; });

  var realisasi = sheetRead(SHEETS.REALISASI, function (r) { return _bulanStr_(r.tanggal) === bulan; });
  var hariSah = {};
  var ketidaksesuaian = [];
  realisasi.forEach(function (r) {
    if (r.ttd_pembina_at && r.ttd_senat_at) hariSah[_tglStr_(r.tanggal)] = true;
    if (r.ketidaksesuaian) {
      ketidaksesuaian.push({ tanggal: _tglStr_(r.tanggal), catatan: r.ketidaksesuaian, tindak_lanjut: r.tindak_lanjut });
    }
  });

  var pesanan = sheetRead(SHEETS.PESANAN, function (r) { return _bulanStr_(r.tgl_makan) === bulan; });
  var porsiDipesan = 0;
  pesanan.forEach(function (p) { porsiDipesan += _int_(p.jml_taruna || 0, 'jml_taruna'); });
  var porsiTerealisasi = 0;
  realisasi.forEach(function (r) { porsiTerealisasi += _int_(r.porsi_diterima || 0, 'porsi_diterima'); });

  // _bulanStr_ (bukan String() polos) — lihat catatan sama di atas.
  var bayar = sheetRead(SHEETS.PEMBAYARAN, function (r) { return _bulanStr_(r.bulan) === bulan; })[0] || null;
  var tagihan = sheetRead(SHEETS.TAGIHAN, function (r) { return _bulanStr_(r.bulan) === bulan; });

  return {
    bulan: bulan,
    jml_taruna_aktif: jmlAktif,
    kontrak: kontrakBulan ? {
      kontrak_id: kontrakBulan.kontrak_id,
      harga_per_porsi: _int_(kontrakBulan.harga_per_porsi, 'harga_per_porsi'),
      porsi_per_hari: _int_(kontrakBulan.porsi_per_hari, 'porsi_per_hari'),
      harga_per_hari_efektif: _hargaPerHariKontrak_(kontrakBulan)
    } : null,
    penerima: penerima,
    total_hari_makan: totalHariMakan,
    total_nominal: totalNominal,
    jml_hari_efektif: Object.keys(hariSah).length,
    porsi_dipesan: porsiDipesan,
    porsi_terealisasi: porsiTerealisasi,
    ketidaksesuaian: ketidaksesuaian,
    pembayaran: bayar,
    jml_gagal_transfer: tagihan.length,
    pejabat: PEJABAT
  };
}

/** Daftar AUDIT_LOG, filter {dari?, sampai?, user_id?, aksi?}. Dibatasi 500 baris terbaru. */
function auditList(payload, session) {
  var f = payload || {};
  var rows = sheetRead(SHEETS.AUDIT_LOG, function (r) {
    var t = (r.timestamp instanceof Date)
      ? Utilities.formatDate(r.timestamp, Session.getScriptTimeZone(), 'yyyy-MM-dd')
      : String(r.timestamp).slice(0, 10);
    if (f.dari && t < f.dari) return false;
    if (f.sampai && t > f.sampai) return false;
    if (f.user_id && String(r.user_id) !== String(f.user_id)) return false;
    if (f.aksi && String(r.aksi).indexOf(f.aksi) < 0) return false;
    return true;
  });
  rows.forEach(function (r) {
    r.timestamp = (r.timestamp instanceof Date)
      ? Utilities.formatDate(r.timestamp, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
      : String(r.timestamp);
  });
  rows.sort(function (a, b) { return b.timestamp.localeCompare(a.timestamp); });
  return { log: rows.slice(0, 500) };
}
