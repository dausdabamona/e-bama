/**
 * 12_pesanan.gs — Pesanan makan (mesin status)
 *   DRAFT → DIAJUKAN → (DIKEMBALIKAN | DISETUJUI) → TERKIRIM
 *
 * Diisi pada TAHAP 3. Akan memuat:
 * - pesanan.create (Senat) : tgl_makan unik; jml_taruna otomatis = taruna AKTIF − STATUS_HARIAN;
 *                  boleh dikoreksi manual dengan catatan wajib; disimpan sebagai SNAPSHOT
 * - pesanan.submit (Senat) : DRAFT→DIAJUKAN, hanya pembuat
 * - pesanan.verify (Pembina): DIAJUKAN→DISETUJUI (verif_by, verif_at)
 * - pesanan.return (Pembina): DIAJUKAN→DIKEMBALIKAN (alasan wajib)
 * - pesanan.kirim (Senat)  : DISETUJUI→TERKIRIM, hanya H-1 atau lebih awal
 * - pesanan.revisi (Senat) : pesanan baru revisi_dari terisi (SOP 7b), wajib lampiran BA
 * - Transisi ilegal → error eksplisit
 *
 * Setiap aksi tulis → withLock + auditLog. jml_taruna adalah snapshot (tak diedit manual).
 */
