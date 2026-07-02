/**
 * 10_taruna.gs — Master data (taruna, penyedia, kontrak)
 *
 * Diisi pada TAHAP 3. Akan memuat:
 * - taruna.list   : filter status/prodi/tingkat/kelas
 * - taruna.upsert (Admin) : rek_mask WAJIB pola /^•{4}\d{4}$/ atau 4 digit terakhir saja;
 *                   tolak input yang terlihat seperti nomor rekening lengkap (>4 digit angka)
 *
 * Master pendukung (lihat docs/kontrak-api.md) — ditempatkan di modul ini:
 * - penyedia.list / penyedia.upsert (Admin, PPK) : npwp_mask 4 digit
 * - kontrak.list / kontrak.upsert (PPK) / kontrak.approve (PPK) : DRAFT→DISETUJUI_PPK
 *
 * Setiap aksi tulis → withLock + auditLog.
 */
