/**
 * 16_tagihan.gs — Tagihan gagal debet ke taruna
 *   status: TERTAGIH → LUNAS | DIHAPUSKAN | ESKALASI_MANUAL
 *
 * Diisi pada TAHAP 4A. Akan memuat:
 * - tagihan.create (Senat, PPK) : payload {bulan, nit[], sebab} batch;
 *                  nominal SNAPSHOT dari REKAP_BULANAN (harus FINAL);
 *                  tagihan_id TGH-{yyyymm}-{nit}; tolak duplikat bulan+nit;
 *                  LANGSUNG panggil spTerbitkan(tagihan_id, 1) — SP-1 terbit saat dicatat
 * - tagihan.list (semua role) : join ringan SURAT_PERINGATAN → level_aktif=MAX(level),
 *                  tenggat_aktif; cache 60 dtk, invalidate saat tulis
 * - tagihan.setor (Senat)  : upload bukti setor (jenis=BUKTI_SETOR), isi tgl_setor
 * - tagihan.verify (PPK)   : syarat bukti setor ada → LUNAS, diverifikasi_oleh
 * - tagihan.waive (PPK)    : catatan_hapus WAJIB → DIHAPUSKAN
 * - tagihan.summary (PPK, KPA) : {per_level:{0..3:{jumlah,nominal}}, total_outstanding}
 *
 * Setiap aksi tulis → withLock + auditLog. nominal adalah snapshot.
 */
