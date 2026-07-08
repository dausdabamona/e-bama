// Konversi angka rupiah ke kata (Bahasa Indonesia) — dipakai halaman cetak
// yang menghitung ulang total di sisi klien (mis. setelah taruna dipisah
// jadi lembar SPM sendiri) sehingga tidak bisa memakai *_terbilang dari backend.
const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];

export function terbilang(n: number): string {
  n = Math.floor(Math.abs(n));
  // Data hulu (respons API/hitungan klien) semestinya selalu integer — tapi bila
  // ada field yang belum terisi (mis. backend belum di-clasp-push ulang) nilainya
  // bisa jadi undefined/NaN. Tanpa penjaga ini, NaN membuat rekursi tak pernah
  // menyentuh basis kasus manapun → RangeError (stack overflow) yang mematikan
  // seluruh halaman cetak.
  if (!Number.isFinite(n)) return '';
  if (n < 12) return SATUAN[n];
  if (n < 20) return terbilang(n - 10) + ' belas';
  if (n < 100) return terbilang(Math.floor(n / 10)) + ' puluh' + (n % 10 ? ' ' + terbilang(n % 10) : '');
  if (n < 200) return 'seratus' + (n - 100 ? ' ' + terbilang(n - 100) : '');
  if (n < 1000) return terbilang(Math.floor(n / 100)) + ' ratus' + (n % 100 ? ' ' + terbilang(n % 100) : '');
  if (n < 2000) return 'seribu' + (n - 1000 ? ' ' + terbilang(n - 1000) : '');
  if (n < 1e6) return terbilang(Math.floor(n / 1000)) + ' ribu' + (n % 1000 ? ' ' + terbilang(n % 1000) : '');
  if (n < 1e9) return terbilang(Math.floor(n / 1e6)) + ' juta' + (n % 1e6 ? ' ' + terbilang(n % 1e6) : '');
  return terbilang(Math.floor(n / 1e9)) + ' miliar' + (n % 1e9 ? ' ' + terbilang(n % 1e9) : '');
}

export function terbilangRupiah(n: number): string {
  const t = (terbilang(n).trim() || 'nol') + ' rupiah';
  return t.charAt(0).toUpperCase() + t.slice(1);
}
