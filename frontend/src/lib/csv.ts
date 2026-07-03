// Utilitas CSV — ekspor (unduh) & impor (parse) sederhana, tanpa dependensi.

/** Unduh array objek sebagai file CSV. */
export function unduhCsv(namaFile: string, header: string[], baris: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const teks = [header, ...baris].map((r) => r.map(escape).join(',')).join('\n');
  const blob = new Blob(['﻿' + teks], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = namaFile;
  a.click();
  URL.revokeObjectURL(url);
}

/** Parse teks CSV sederhana (koma, kutip dua) → array baris (array string). */
export function parseCsv(teks: string): string[][] {
  const baris: string[][] = [];
  let sel: string[] = [];
  let field = '';
  let dalamKutip = false;
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];
    if (dalamKutip) {
      if (c === '"' && teks[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') dalamKutip = false;
      else field += c;
    } else if (c === '"') dalamKutip = true;
    else if (c === ',') { sel.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && teks[i + 1] === '\n') i++;
      sel.push(field); field = '';
      if (sel.some((x) => x !== '')) baris.push(sel);
      sel = [];
    } else field += c;
  }
  if (field !== '' || sel.length) { sel.push(field); baris.push(sel); }
  return baris;
}

/** Baca file yang dipilih pengguna sebagai teks. */
export function bacaFileTeks(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsText(file, 'utf-8');
  });
}
