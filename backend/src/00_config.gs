/**
 * 00_config.gs — Konstanta global e-BAMA (satu-satunya tempat konfigurasi)
 *
 * Diisi pada TAHAP 1. Akan memuat:
 * - SHEETS  : nama semua sheet (dirujuk semua file, tidak ada string literal di tempat lain)
 * - ROLES   : KPA | PPK | SENAT | PEMBINA | ADMIN
 * - STATUS  : enum status per tabel (PESANAN, REKAP_BULANAN, PEMBAYARAN, TAGIHAN, ...)
 * - PEJABAT : data penandatangan untuk surat
 *     PPK: Firdaus Dabamona, S.T., NIP 198201032007011002
 *     KPA: Daniel Heintje Ndahawali, S.Pi., M.Si., NIP 197207172002121003
 * - CONFIG   : kebijakan internal (boleh diubah tanpa menyentuh kode)
 *     CONFIG.SP = {
 *       TENGGAT_HARI:  {1: 7, 2: 7, 3: 3},   // hari kalender per level SP
 *       PENANDATANGAN: {1: 'PPK', 2: 'PPK', 3: 'KPA'},
 *       JAM_TRIGGER:   6                       // 06.00 WIT eskalasi harian
 *     }
 *
 * POLA OVERRIDE CONFIG.SP:
 * Nilai di CONFIG.SP adalah DEFAULT. Bila Script Properties memuat kunci
 * SP_TENGGAT_HARI, SP_PENANDATANGAN, atau SP_JAM_TRIGGER (masing-masing JSON),
 * nilai dari properties MENGGANTIKAN default (merge per-kunci).
 *
 * - getKebijakanSP() : kembalikan CONFIG.SP efektif (default ← override properties).
 *     SATU-SATUNYA cara modul lain membaca kebijakan SP.
 *     17_surat_peringatan.gs & 20_trigger.gs WAJIB pakai ini —
 *     DILARANG membaca CONFIG.SP langsung.
 * - setKebijakanSP(obj) : simpan sebagian/seluruh kebijakan ke Script Properties
 *     (JSON per kunci). Dipanggil manual dari editor GAS untuk ubah kebijakan.
 *
 * CATATAN: nilai di CONFIG adalah KEBIJAKAN INTERNAL dan boleh diubah.
 */
