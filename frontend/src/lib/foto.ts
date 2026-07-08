/**
 * Ambil file gambar. Default kamera-saja (`capture='environment'` memaksa
 * browser mobile membuka kamera langsung, bukan galeri) — kontrol anti-
 * rekayasa utk kasus yang MEMANG harus foto real-time (mis. bukti foto
 * status-taruna, BA revisi pesanan). Set `kameraSaja:false` untuk kasus yang
 * boleh galeri/File Manager: dokumen scan (bukti transfer, surat, BA), ATAU
 * foto realisasi (dikonfirmasi Firdaus — dilonggarkan dari kamera-only semula,
 * lihat realisasi-form.tsx). Watermark tanggal/jam yang dibakar ke foto tetap
 * mencatat WAKTU UNGGAH, bukan waktu foto sesungguhnya diambil, kalau file
 * diambil dari galeri.
 */
export function ambilFotoInput(opts: { kameraSaja?: boolean } = {}): Promise<File | null> {
  const kameraSaja = opts.kameraSaja !== false;
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (kameraSaja) input.capture = 'environment';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

/**
 * Bakar watermark (baris teks) ke pojok kiri-bawah kanvas — pita gelap
 * semi-transparan + teks putih, ukuran font mengikuti lebar gambar supaya
 * tetap terbaca di berbagai resolusi kamera.
 */
function bakarWatermark(ctx: CanvasRenderingContext2D, lebar: number, tinggi: number, baris: string[]): void {
  if (!baris.length) return;
  const ukuranFont = Math.max(14, Math.round(lebar / 32));
  ctx.font = `${ukuranFont}px sans-serif`;
  ctx.textBaseline = 'bottom';
  const tinggiBaris = ukuranFont * 1.35;
  const tinggiBlok = tinggiBaris * baris.length + 10;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, tinggi - tinggiBlok, lebar, tinggiBlok);
  ctx.fillStyle = '#ffffff';
  baris.forEach((teks, i) => {
    ctx.fillText(teks, 10, tinggi - 8 - (baris.length - 1 - i) * tinggiBaris);
  });
}

/**
 * Kompres file gambar ke base64 JPEG, target ukuran ≤ maksKB (default 200KB).
 * `watermarkLines` (opsional) dibakar ke gambar SEBELUM kompresi — dipakai
 * untuk tag tanggal-jam + koordinat (realisasi-form.tsx) supaya melekat
 * permanen di file, bukan metadata terpisah yang gampang lepas/dihapus.
 */
export async function kompresFotoBase64(file: File, maksKB = 200, watermarkLines: string[] = []): Promise<string> {
  const bitmap = await createImageBitmap(file);
  let lebar = bitmap.width;
  let tinggi = bitmap.height;
  const MAKS_DIMENSI = 1280;
  if (Math.max(lebar, tinggi) > MAKS_DIMENSI) {
    const skala = MAKS_DIMENSI / Math.max(lebar, tinggi);
    lebar = Math.round(lebar * skala);
    tinggi = Math.round(tinggi * skala);
  }

  const canvas = document.createElement('canvas');
  canvas.width = lebar;
  canvas.height = tinggi;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, lebar, tinggi);
  bakarWatermark(ctx, lebar, tinggi, watermarkLines);

  let kualitas = 0.85;
  let dataUrl = canvas.toDataURL('image/jpeg', kualitas);
  // Turunkan kualitas bertahap sampai di bawah target ukuran
  while (dataUrl.length * 0.75 > maksKB * 1024 && kualitas > 0.3) {
    kualitas -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', kualitas);
  }
  return dataUrl.split(',')[1]; // base64 murni tanpa prefix data:
}
