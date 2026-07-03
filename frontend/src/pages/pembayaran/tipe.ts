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
}
