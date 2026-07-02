/**
 * 05_master.gs — Master data penyedia & kontrak
 *
 * Diisi pada TAHAP 3. Akan memuat:
 * - penyedia.list (semua login)
 * - penyedia.upsert (Admin, PPK) : npwp_mask hanya 4 digit terakhir
 * - kontrak.list (semua login)
 * - kontrak.upsert (PPK)
 * - kontrak.approve (PPK)        : DRAFT → DISETUJUI_PPK (SOP no. 4)
 *
 * Lampiran kontrak (menu & nilai gizi, BA penunjukan, notulen) → LAMPIRAN ref_type=KONTRAK.
 * Setiap aksi tulis → withLock + auditLog.
 */
