// Nilai default cerdas untuk field tanggal — dipakai form Pesanan, Status
// Harian, Realisasi, dsb. supaya field tanggal terisi otomatis (bukan kosong)
// dan pengguna cukup ubah kalau memang beda. Sebelumnya `hariIni()` disalin
// lokal di banyak halaman; ini SATU sumber untuk toolkit "smart defaults"
// (Prompt "Beranda Kotak-Tugas", Bagian 2b) — halaman yang sudah punya
// salinan lokal TIDAK diubah di tahap ini (lihat Tahap 3 prompt), file ini
// hanya menyediakan versi bersama untuk pemakaian baru ke depan.
function keFormatTanggal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function hariIni(): string {
  return keFormatTanggal(new Date());
}

export function besok(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return keFormatTanggal(d);
}

export function kemarin(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return keFormatTanggal(d);
}
