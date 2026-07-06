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
  verif_pembina_oleh: string;
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
