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

/**
 * Deteksi pemisah kolom: koma atau titik-koma. Ekspor CSV dari Excel lokal
 * Indonesia (mis. OM-SPAN) memakai ';' karganya ',' dipakai desimal. Ambil
 * beberapa baris awal, hitung mana yang lebih dominan.
 */
export function deteksiPemisah(teks: string): ',' | ';' {
  const awal = teks.split(/\r?\n/).slice(0, 15).join('\n');
  const titikKoma = (awal.match(/;/g) || []).length;
  const koma = (awal.match(/,/g) || []).length;
  return titikKoma > koma ? ';' : ',';
}

/** Parse teks CSV sederhana (kutip dua) → array baris. `pemisah` default ','. */
export function parseCsv(teks: string, pemisah: ',' | ';' = ','): string[][] {
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
    else if (c === pemisah) { sel.push(field); field = ''; }
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
