// Urutan & pengelompokan Prodi+Tingkat standar — dipakai semua halaman rekap/
// laporan/cetak yang menampilkan data per taruna, supaya tampilannya konsisten
// (grup Prodi/Tingkat + total per grup) di seluruh app, bukan hanya di
// beberapa halaman. Tingkat mendukung format Romawi (I/II/III) MAUPUN angka
// ('1'/'2'/'3') — data taruna riil memakai keduanya tergantung sumbernya.
const URUT_ROMAWI: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5 };

export function urutTingkat(tingkat: string): number {
  if (URUT_ROMAWI[tingkat] !== undefined) return URUT_ROMAWI[tingkat];
  const n = parseInt(tingkat, 10);
  return Number.isFinite(n) ? n : 99;
}

export function urutProdiTingkat(a: { prodi: string; tingkat: string }, b: { prodi: string; tingkat: string }): number {
  return urutTingkat(a.tingkat) - urutTingkat(b.tingkat) || a.prodi.localeCompare(b.prodi);
}

export interface KelompokProdiTingkat<T> {
  prodi: string;
  tingkat: string;
  rows: T[];
}

/**
 * Kelompokkan baris apa pun ke {prodi, tingkat, rows}, urut Tingkat lalu Prodi.
 * Baris tanpa data prodi/tingkat masuk grup "Lainnya / ?" — bukan dibuang.
 */
export function kelompokProdiTingkat<T>(
  rows: T[],
  ambilProdi: (r: T) => string,
  ambilTingkat: (r: T) => string
): KelompokProdiTingkat<T>[] {
  const map = new Map<string, T[]>();
  rows.forEach((r) => {
    const prodi = ambilProdi(r) || 'Lainnya';
    const tingkat = ambilTingkat(r) || '?';
    const kunci = `${tingkat}|${prodi}`;
    if (!map.has(kunci)) map.set(kunci, []);
    map.get(kunci)!.push(r);
  });
  return Array.from(map.entries())
    .map(([kunci, rs]) => {
      const [tingkat, prodi] = kunci.split('|');
      return { prodi, tingkat, rows: rs };
    })
    .sort(urutProdiTingkat);
}
