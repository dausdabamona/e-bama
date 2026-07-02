/**
 * 00_config.gs — Konstanta global e-BAMA (satu-satunya tempat konfigurasi)
 *
 * Diisi pada TAHAP 1. Akan memuat:
 * - SHEETS  : nama semua sheet (dirujuk semua file, tidak ada string literal di tempat lain)
 * - ROLES   : KPA | PPK | SENAT | PEMBINA | ADMIN
 * - STATUS  : enum status per tabel (PESANAN, REKAP_BULANAN, PEMBAYARAN, TAGIHAN, ...)
 * - PEJABAT : data penandatangan (PPK, KPA) untuk surat
 * - CONFIG   : kebijakan internal yang boleh diubah tanpa menyentuh kode
 *     CONFIG.SP = {
 *       TENGGAT_HARI:  {1: 7, 2: 7, 3: 3},   // hari kalender per level SP
 *       PENANDATANGAN: {1: 'PPK', 2: 'PPK', 3: 'KPA'},
 *       JAM_TRIGGER:   6                       // 06.00 WIT eskalasi harian
 *     }
 *
 * CATATAN: nilai di CONFIG adalah KEBIJAKAN INTERNAL dan boleh diubah.
 */
