/**
 * 10_taruna.gs — Master data taruna
 *
 * Diisi pada TAHAP 3. Akan memuat:
 * - taruna.list   : filter status/prodi/tingkat/kelas
 * - taruna.upsert (Admin) : rek_mask WAJIB pola /^•{4}\d{4}$/ atau 4 digit terakhir saja;
 *                   tolak input yang terlihat seperti nomor rekening lengkap (>4 digit angka)
 *
 * Master penyedia & kontrak ada di 05_master.gs.
 * Setiap aksi tulis → withLock + auditLog.
 */
