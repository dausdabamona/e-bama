/**
 * 14_rekap.gs — Rekap bulanan (materialized view incremental)
 *   status: DRAFT → TERVERIFIKASI_PPK → FINAL
 *
 * Diisi pada TAHAP 3. Akan memuat:
 * - rekapUpdate(tanggal) : per taruna AKTIF hitung hari_makan (realisasi sah) &
 *                  hari_tidak_makan (STATUS_HARIAN); nominal = hari_makan ×
 *                  harga_per_porsi × porsi_per_hari dari KONTRAK aktif (INTEGER);
 *                  update hanya baris bulan berjalan; tolak bila status FINAL
 * - rekap.get (PPK, KPA)  : per bulan
 * - rekap.verify (PPK)    : DRAFT→TERVERIFIKASI_PPK
 * - rekap.final (PPK)     : TERVERIFIKASI_PPK→FINAL (beku, dasar SPM)
 *
 * REKAP_BULANAN adalah SNAPSHOT sistem — tidak boleh diedit manual.
 */
