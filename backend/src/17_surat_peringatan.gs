/**
 * 17_surat_peringatan.gs — Surat Peringatan (SP-1/2/3) + generate PDF
 *
 * Diisi pada TAHAP 4B. Akan memuat:
 * - spTerbitkan(tagihanId, level, session|null):
 *     1. Ambil tagihan + taruna + CONFIG.SP
 *     2. no_surat = nextId('SP'+level) → B-{urut}/PKPS/SP{level}/{bulan-romawi}/{tahun}
 *     3. tenggat = today + CONFIG.SP.TENGGAT_HARI[level] (hari kalender)
 *     4. Generate PDF dari template Doc (TPL_SP1/2/3): replace placeholder
 *        {{NO_SURAT}} {{TGL_SURAT}} {{NAMA}} {{NIT}} {{PRODI_TINGKAT}} {{BULAN}}
 *        {{NOMINAL}} {{NOMINAL_TERBILANG}} {{REK_SENAT}} {{TENGGAT}}
 *        {{PENANDATANGAN_NAMA}} {{PENANDATANGAN_NIP}}
 *        → export PDF ke FOLDER_SP → hapus copy Doc
 *     5. Append SURAT_PERINGATAN + LAMPIRAN(ref_type=SP) + AUDIT_LOG
 *        (generated_by = SISTEM bila session null, selain itu MANUAL)
 * - terbilang(n)             : angka → teks rupiah (fungsi sendiri)
 * - sp.list (role login)     : riwayat SP per tagihan
 * - tagihan.regenerate_sp (PPK): terbitkan ulang PDF level aktif (no_surat BARU, baris baru)
 */
