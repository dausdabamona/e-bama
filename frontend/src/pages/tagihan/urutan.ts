// Urutan tampilan tagihan — dipakai tagihan-list.tsx (pengelompokan tampilan)
// DAN tagihan-detail.tsx (tombol "Lanjut ke Transaksi Berikutnya") supaya
// keduanya konsisten: "berikutnya" di halaman detail = baris setelahnya
// persis seperti yang terlihat di daftar.
import type { Tagihan } from './tipe';

export type TahapBayar = 'BELUM_SETOR' | 'MENUNGGU_VERIF_1' | 'MENUNGGU_VERIF_2' | 'SELESAI';

export function tahapBayar(t: Tagihan): TahapBayar {
  if (t.status !== 'TERTAGIH') return 'SELESAI';
  if (!t.tgl_setor) return 'BELUM_SETOR';
  if (!t.verif_1_oleh) return 'MENUNGGU_VERIF_1';
  return 'MENUNGGU_VERIF_2';
}

// Urutan paling-butuh-tindakan dulu: siap verifikasi ke-2 (final), lalu
// menunggu verifikasi ke-1, lalu belum disetor sama sekali, lalu selesai/lain.
export const URUTAN_TAHAP: TahapBayar[] = ['MENUNGGU_VERIF_2', 'MENUNGGU_VERIF_1', 'BELUM_SETOR', 'SELESAI'];

export const INFO_TAHAP: Record<TahapBayar, { label: string; kartu: string }> = {
  MENUNGGU_VERIF_2: { label: 'Menunggu Verifikasi ke-2 (Final)', kartu: 'border-l-4 border-blue-400' },
  MENUNGGU_VERIF_1: { label: 'Menunggu Verifikasi ke-1', kartu: 'border-l-4 border-amber-400' },
  BELUM_SETOR: { label: 'Belum Disetor', kartu: 'border-l-4 border-gray-300' },
  SELESAI: { label: 'Selesai / Lainnya', kartu: '' }
};

/** Urutkan tagihan: kelompok tahap (paling butuh tindakan dulu), lalu bulan terbaru dalam kelompok. */
export function urutkanTagihan(daftar: Tagihan[]): Tagihan[] {
  const bobot = new Map(URUTAN_TAHAP.map((tahap, i) => [tahap, i]));
  return [...daftar].sort((a, b) => {
    const ba = bobot.get(tahapBayar(a))!, bb = bobot.get(tahapBayar(b))!;
    if (ba !== bb) return ba - bb;
    return b.bulan.localeCompare(a.bulan);
  });
}
