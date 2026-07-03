// Pemilih & pembaca berkas umum (gambar/PDF) — dipakai untuk lampiran dokumen
// (kontrak, dsb.) yang TIDAK boleh dikompres canvas seperti foto realisasi.
const MAKS_BYTE = 5 * 1024 * 1024; // batas backend

export function ambilBerkasInput(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

/** Baca file sebagai base64 murni (tanpa kompresi). Menolak jika > 5MB. */
export function berkasKeBase64(file: File): Promise<string> {
  if (file.size > MAKS_BYTE) {
    return Promise.reject(new Error('Ukuran berkas melebihi 5 MB.'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Gagal membaca berkas.'));
    reader.readAsDataURL(file);
  });
}
