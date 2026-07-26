// Tipe data Dashboard Rekap Bulan Berjalan — cermin kontrak JSON action
// dashboard.running (backend/src/27_dashboard.gs). Lihat docs/kontrak-api.md.

export interface RunningSummary {
  total_hari_kalender: number;
  hari_sudah_dipesan: number;
  hari_belum_dipesan: number;
  hari_sudah_direalisasi: number;
  hari_belum_direalisasi: number;
  total_porsi_dipesan: number;
  total_porsi_direalisasi: number;
  jml_taruna_aktif: number;
}

export interface RunningProgress {
  persen_pesanan: number;
  persen_realisasi: number;
}

export type StatusRealisasiHarian = '' | 'SEBAGIAN' | 'SAH';

export interface RunningDailyBaris {
  tanggal: string;
  hari: string;
  pesanan_id: string;
  status_pesanan: string;
  jml_taruna_pesanan: number;
  status_realisasi: StatusRealisasiHarian;
  porsi_diterima: number;
  jml_taruna_makan: number;
  nominal_hari: number;
}

export interface RunningEstimation {
  basis: 'REKAP' | 'PESANAN';
  nominal_proyeksi_pesanan: number;
  nominal_realisasi_sah: number;
  estimasi_tagihan_bulan_ini: number;
  selisih: number;
}

export interface RunningDashboard {
  bulan: number;
  tahun: number;
  bulan_str: string;
  rekap_status: string;
  summary: RunningSummary;
  progress: RunningProgress;
  daily: RunningDailyBaris[];
  estimation: RunningEstimation;
}
