// Ambil foto dari kamera & kompres via canvas ke maksimal ~200KB.
export function ambilFotoInput(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

/** Kompres file gambar ke base64 JPEG, target ukuran ≤ maksKB (default 200KB). */
export async function kompresFotoBase64(file: File, maksKB = 200): Promise<string> {
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

  let kualitas = 0.85;
  let dataUrl = canvas.toDataURL('image/jpeg', kualitas);
  // Turunkan kualitas bertahap sampai di bawah target ukuran
  while (dataUrl.length * 0.75 > maksKB * 1024 && kualitas > 0.3) {
    kualitas -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', kualitas);
  }
  return dataUrl.split(',')[1]; // base64 murni tanpa prefix data:
}
