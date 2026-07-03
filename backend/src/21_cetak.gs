/**
 * 21_cetak.gs — Cetak Form Manual SOP (Form 01-08, docs/format-dokumen.md)
 *
 * ACTION: cetak.form03 (PPK, ADMIN, PEMBINA)
 *
 * Setiap cetak.formNN adalah action GET-style (tanpa efek samping) — hanya
 * membaca & merangkai data untuk dirender+dicetak di frontend. Tidak ada
 * withLock/AUDIT_LOG di sini KECUALI form yang membaca data sensitif
 * (rekening lengkap, lihat cetak.form07/form08 di tahap lanjutan).
 */

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
