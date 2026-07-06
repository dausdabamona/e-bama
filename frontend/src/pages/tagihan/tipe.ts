export interface Tagihan {
  tagihan_id: string;
  bulan: string;
  nit: string;
  nominal: number;
  sebab: string;
  status: 'TERTAGIH' | 'LUNAS' | 'DIHAPUSKAN' | 'ESKALASI_MANUAL';
  tgl_setor: string;
  diverifikasi_oleh: string;
  catatan_hapus: string;
  verif_1_oleh: string;
  verif_2_oleh: string;
  nilai_transfer: number;
  bukti_setor_drive_file_id: string;
  level_aktif: number;
  tenggat_aktif: string;
}

export interface SuratPeringatan {
  sp_id: string;
  tagihan_id: string;
  level: number;
  no_surat: string;
  tgl_terbit: string;
  tenggat: string;
  ditandatangani_oleh: string;
  generated_by: string;
  drive_file_id: string;
}

export function formatRupiah(n: number): string {
  return 'Rp' + (Number.isFinite(n) ? n : 0).toLocaleString('id-ID');
}
