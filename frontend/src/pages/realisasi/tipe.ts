export interface Realisasi {
  real_id: string;
  pesanan_id: string;
  tanggal: string;
  porsi_diterima: number;
  jml_taruna_makan: number;
  ketidaksesuaian: string;
  tindak_lanjut: string;
  geotag_lat: number;
  geotag_lng: number;
  ttd_pembina_at: string;
  ttd_senat_at: string;
  piket_nit: string;
  piket_nama: string;
  piket_menu_sesuai: boolean;
  piket_porsi_cukup: boolean;
  piket_kualitas: '' | 'BAIK' | 'CUKUP' | 'KURANG';
  piket_gizi: string;
  piket_catatan: string;
  piket_at: string;
  penerimaan: string;
}

export interface KebijakanPiket {
  wajib: boolean;
  komponen_gizi: string[];
}

export type WaktuMakan = 'pagi' | 'siang' | 'malam';

export interface PenerimaanBaris {
  komponen: string;
  ada: boolean;
  jumlah: number;
  keterangan: string;
}

export type Penerimaan = Record<WaktuMakan, PenerimaanBaris[]>;

export interface KebijakanPenerimaan {
  komponen: string[];
}
