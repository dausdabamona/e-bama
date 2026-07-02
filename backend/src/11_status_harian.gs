/**
 * 11_status_harian.gs — Status harian taruna (pesiar/cuti/sakit/penundaan/dinas)
 *
 * Kolom `status` enum: PESIAR / CUTI / SAKIT_RUMAH / PENUNDAAN_STUDI.
 *
 * Diisi pada TAHAP 3. Akan memuat:
 * - status.set (Admin, Pembina)  : upsert per (tanggal, nit)
 * - status.batch                 : input massal (mis. satu kelas pesiar)
 * - status.list                  : per rentang tanggal
 *
 * Setiap aksi tulis → withLock + auditLog.
 */
