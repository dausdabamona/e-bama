/**
 * 15_pembayaran.gs — Pembayaran LS ke penyedia (SOP 11–17)
 *   status: DIAJUKAN → SP2D_TERBIT → DITRANSFER → DIKONFIRMASI → SELESAI
 *
 * Diisi pada TAHAP 4A. Akan memuat:
 * - bayar.create (PPK)  : syarat REKAP_BULANAN bulan tsb FINAL;
 *                  nilai_total = SUM(nominal) rekap bulan tsb (SNAPSHOT)
 * - bayar.update (PPK)  : isi no_spm/tgl_spm → no_sp2d/tgl_sp2d menaikkan status berurutan;
 *                  lampiran surat blokir/bukti debet/invoice via lampiranSave
 * - bayar.confirm (Senat): DITRANSFER→DIKONFIRMASI (konfirmasi_senat_at)
 * - bayar.close (PPK)   : →SELESAI (SOP 17)
 *
 * Setiap aksi tulis → withLock + auditLog. Uang selalu integer rupiah.
 */
