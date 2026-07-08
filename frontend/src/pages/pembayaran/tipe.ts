// Satu baris SP2D nyata (dari SP2D_MONITORING) di dalam satu kelompok Prodi+Tingkat.
export interface Sp2dRincianBaris {
  no_spm: string;
  no_sp2d: string;
  tgl_spm: string;
  tgl_sp2d: string;
  jumlah_pembayaran: number;
  status_sp2d: string;
}

// Pecahan per suplier DI DALAM satu kelompok Prodi+Tingkat. `sistem` ASLI
// (SUM REKAP_BULANAN suplier itu); `sp2d_perkiraan`/`selisih_perkiraan` SELALU
// TAKSIRAN (dibagi proporsional dari total SP2D kelompok — SP2D_MONITORING/KPPN
// tidak punya kolom suplier sama sekali) — WAJIB ditandai "perkiraan" di UI,
// jangan pernah ditampilkan seolah angka resmi KPPN per suplier.
export interface Sp2dPerSuplier {
  penyedia_id: string;
  penyedia_nama: string;
  sistem: number;
  sp2d_perkiraan: number;
  selisih_perkiraan: number;
}

// Satu kelompok Prodi+Tingkat: KPPN menerbitkan 1 SP2D per kelompok, jadi satu
// bulan pembayaran = banyak kelompok. `sistem` = SUM REKAP_BULANAN kelompok itu,
// `sp2d` = SUM SP2D yang sudah terunggah; `cocok` bila sama.
export interface Sp2dRincianKelompok {
  prodi: string;
  tingkat: string;
  sistem: number;
  sp2d: number;
  selisih: number;
  cocok: boolean;
  per_suplier: Sp2dPerSuplier[];
  rincian: Sp2dRincianBaris[];
}

export interface Pembayaran {
  bayar_id: string;
  bulan: string;
  kontrak_id: string;
  nilai_total: number;
  no_spm: string;
  tgl_spm: string;
  no_sp2d: string;
  tgl_sp2d: string;
  konfirmasi_senat_at: string;
  status: 'DIAJUKAN' | 'SP2D_TERBIT' | 'DITRANSFER' | 'DIKONFIRMASI' | 'SELESAI';
  // Diturunkan LIVE dari SP2D_MONITORING (bukan kolom sheet) — relasi 1 bulan : N SP2D.
  sp2d_rincian?: Sp2dRincianKelompok[];
  sp2d_lengkap?: boolean;
  sp2d_perlu_cek_manual?: number;
}
