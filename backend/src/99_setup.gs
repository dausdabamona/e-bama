/**
 * 99_setup.gs — Inisialisasi database sekali-jalan
 *
 * Diisi pada TAHAP 1. Akan memuat:
 * - setupDatabase()   : idempotent — buat 13 sheet sesuai docs/skema-sheet.md
 *                  (header snake_case, freeze baris 1, header bold bg #E0F2F1,
 *                  data validation enum, format tanggal/timestamp,
 *                  protect warning-only untuk AUDIT_LOG & SURAT_PERINGATAN)
 * - seedAwal()        : 5 akun contoh (kpa01, ppk01, senat01, pembina01, admin01),
 *                  PIN default 123456 di-hash SHA-256 + SALT (Script Properties)
 * - setupFolderDrive(): buat e-BAMA/{LAMPIRAN, SURAT_PERINGATAN, TEMPLATE},
 *                  simpan ID ke Script Properties (FOLDER_LAMPIRAN, FOLDER_SP, FOLDER_TEMPLATE)
 *
 * Semua nama sheet dirujuk dari SHEETS (00_config.gs).
 */
