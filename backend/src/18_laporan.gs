/**
 * 18_laporan.gs — Laporan bulanan (SOP 17–19) & Audit Log
 *
 * ACTION: laporan.bulanan (PPK, KPA), audit.list (Admin, PPK, KPA)
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

  var bayar = sheetRead(SHEETS.PEMBAYARAN, function (r) { return String(r.bulan) === bulan; })[0] || null;

  var tagihan = sheetRead(SHEETS.TAGIHAN, function (r) { return String(r.bulan) === bulan; });
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
