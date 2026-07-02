/**
 * 13_realisasi.gs — Realisasi penyerahan makan harian
 *
 * Diisi pada TAHAP 3. Akan memuat:
 * - realisasi.create (Pembina, Senat) : pesanan harus TERKIRIM; simpan porsi,
 *                  ketidaksesuaian, geotag; foto via lampiranSave jenis=FOTO
 * - realisasi.ttd  : Pembina/Senat masing-masing set ttd_*_at milik rolenya
 * - Setelah kedua ttd terisi → panggil rekapUpdate(tanggal) otomatis
 *
 * Setiap aksi tulis → withLock + auditLog.
 */
