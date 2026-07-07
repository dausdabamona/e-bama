// Urutan tampilan tagihan — dipakai tagihan-list.tsx (pengelompokan tampilan)
// DAN tagihan-detail.tsx (tombol "Lanjut ke Transaksi Berikutnya") supaya
// keduanya konsisten: "berikutnya" di halaman detail = baris setelahnya
// persis seperti yang terlihat di daftar.
//
// Verifikasi wajib DUA ORANG BERBEDA (peran bebas) — begitu satu orang
// memverifikasi (verif_1_oleh terisi), orang yang SAMA tidak bisa
// memverifikasi ke-2 (tagihan-detail.tsx menolak di UI). `userId` (opsional,
// dari sesi aktif) dipakai untuk memilah tagihan yang MASIH bisa ditindak
// pengguna ini vs yang murni menunggu verifikator LAIN.
import type { Tagihan } from './tipe';

export type TahapBayar =
  | 'BELUM_SETOR' | 'MENUNGGU_VERIF_1' | 'PERLU_VERIFIKASI_ANDA'
  | 'MENUNGGU_VERIFIKATOR_LAIN' | 'SELESAI';

export function tahapBayar(t: Tagihan, userId?: string): TahapBayar {
  if (t.status !== 'TERTAGIH') return 'SELESAI';
  if (!t.tgl_setor) return 'BELUM_SETOR';
  if (!t.verif_1_oleh) return 'MENUNGGU_VERIF_1';
  if (userId && t.verif_1_oleh === userId) return 'MENUNGGU_VERIFIKATOR_LAIN';
  return 'PERLU_VERIFIKASI_ANDA';
}

// Urutan paling-butuh-tindakan dulu: siap Anda verifikasi (final), lalu
// menunggu verifikasi ke-1 (siapa saja), lalu belum disetor, lalu yang
// murni menunggu ORANG LAIN (tak ada yang bisa Anda lakukan), lalu selesai.
export const URUTAN_TAHAP: TahapBayar[] = [
  'PERLU_VERIFIKASI_ANDA', 'MENUNGGU_VERIF_1', 'BELUM_SETOR', 'MENUNGGU_VERIFIKATOR_LAIN', 'SELESAI'
];

export const INFO_TAHAP: Record<TahapBayar, { label: string; kartu: string; catatan?: string }> = {
  PERLU_VERIFIKASI_ANDA: { label: 'Perlu Verifikasi Anda (Final)', kartu: 'border-l-4 border-blue-400' },
  MENUNGGU_VERIF_1: { label: 'Menunggu Verifikasi ke-1', kartu: 'border-l-4 border-amber-400' },
  BELUM_SETOR: { label: 'Belum Disetor', kartu: 'border-l-4 border-gray-300' },
  MENUNGGU_VERIFIKATOR_LAIN: {
    label: 'Sudah Anda Verifikasi — Menunggu Orang Lain',
    kartu: 'border-l-4 border-purple-300 opacity-75',
    catatan: '✅ Anda sudah verifikasi ke-1'
  },
  SELESAI: { label: 'Selesai / Lainnya', kartu: '' }
};

/** Urutkan tagihan: kelompok tahap (paling butuh tindakan dulu), lalu bulan terbaru dalam kelompok. */
export function urutkanTagihan(daftar: Tagihan[], userId?: string): Tagihan[] {
  const bobot = new Map(URUTAN_TAHAP.map((tahap, i) => [tahap, i]));
  return [...daftar].sort((a, b) => {
    const ba = bobot.get(tahapBayar(a, userId))!, bb = bobot.get(tahapBayar(b, userId))!;
    if (ba !== bb) return ba - bb;
    return b.bulan.localeCompare(a.bulan);
  });
}
