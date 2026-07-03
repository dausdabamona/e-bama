export interface BantuanLuarKampus {
  bantuan_id: string;
  nit: string;
  kegiatan: string;
  bulan: string;
  periode: string;
  total_hari: number;
  nilai_per_hari: number;
  nominal: number;
  pembayaran_ke: number;
  keterangan: string;
}

const NAMA_BULAN: Record<string, string> = {
  januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
  juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12'
};

/**
 * Ambil YYYY-MM dari teks periode bebas (mis. "9 s/d 31 Maret 2026") —
 * ambil pola "<nama bulan> <tahun>" TERAKHIR yang muncul di teks (biasanya
 * itu tanggal akhir periode). null kalau tidak terdeteksi.
 */
export function parsePeriodeBulan(teks: string): string | null {
  const re = /(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{4})/gi;
  let match: RegExpExecArray | null;
  let terakhir: RegExpExecArray | null = null;
  while ((match = re.exec(teks)) !== null) terakhir = match;
  if (!terakhir) return null;
  const bulan = NAMA_BULAN[terakhir[1].toLowerCase()];
  if (!bulan) return null;
  return `${terakhir[2]}-${bulan}`;
}
