/**
 * 11_status_harian.gs — Status harian taruna (pesiar/cuti/sakit/penundaan/dinas)
 *
 * Diisi pada TAHAP 3. Akan memuat:
 * - status.set (Admin, Pembina)  : satu taruna satu status per tanggal (upsert)
 * - status.list                  : per rentang tanggal
 * - status.batch                 : input massal (mis. satu kelas pesiar)
 *
 * Setiap aksi tulis → withLock + auditLog.
 */
