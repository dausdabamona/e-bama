// Pembaca .xlsx MINIMAL & aman: unzip pakai `fflate` (≈8KB, 0 kerentanan
// diketahui), parsing XML pakai DOMParser bawaan browser (bukan regex).
// SENGAJA TIDAK memakai paket `xlsx` (SheetJS) — versi yang dipublikasikan di
// npm registry (0.18.5) punya 2 kerentanan HIGH severity (Prototype Pollution
// GHSA-4r6h-8v6p-xvw6, ReDoS GHSA-5pgg-2g8v-p4x9) yang perbaikannya hanya
// dirilis lewat CDN SheetJS sendiri, tidak lewat npm. Hanya baca sheet
// PERTAMA — cukup untuk kebutuhan impor SP2D (satu sheet data per file).

async function unzipXlsx(buf: ArrayBuffer): Promise<Record<string, Uint8Array>> {
  const { unzipSync } = await import('fflate');
  try {
    return unzipSync(new Uint8Array(buf));
  } catch {
    throw new Error('File bukan .xlsx yang valid (gagal dibuka sebagai arsip zip).');
  }
}

function bacaEntriTeks(files: Record<string, Uint8Array>, path: string): string | null {
  const f = files[path];
  return f ? new TextDecoder('utf-8').decode(f) : null;
}

function parseXml(teks: string, konteks: string): Document {
  const doc = new DOMParser().parseFromString(teks, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error(`Gagal membaca XML (${konteks}) — file .xlsx mungkin rusak.`);
  }
  return doc;
}

/** "B12" → indeks kolom 0-based (B → 1). */
function kolomKeIndeks(ref: string): number {
  const huruf = (ref.match(/^[A-Z]+/) || [''])[0];
  let n = 0;
  for (let i = 0; i < huruf.length; i++) n = n * 26 + (huruf.charCodeAt(i) - 64);
  return n - 1;
}

/** Gabungkan semua <t> di dalam node (langsung atau lewat <r> rich-text run). */
function teksDariNode(el: Element): string {
  return Array.from(el.querySelectorAll('t')).map((t) => t.textContent || '').join('');
}

/** Nilai satu sel <c> sebagai string apa adanya (tanpa dikonversi ke Number — hindari presisi hilang utk angka besar mis. No. SP2D). */
function nilaiSel(c: Element, sharedStrings: string[]): string {
  const tipe = c.getAttribute('t');
  if (tipe === 'inlineStr') {
    const is = c.querySelector('is');
    return is ? teksDariNode(is) : '';
  }
  const teksV = c.querySelector('v')?.textContent || '';
  if (tipe === 's') {
    const idx = parseInt(teksV, 10);
    return sharedStrings[idx] ?? '';
  }
  if (tipe === 'b') return teksV === '1' ? 'TRUE' : 'FALSE';
  return teksV; // 'str' (formula-string), numerik (tanpa t), atau lainnya — apa adanya
}

/**
 * Baca file .xlsx (SHEET PERTAMA saja) → array baris (array string), meniru
 * bentuk keluaran parseCsv() supaya bisa dipakai halaman impor yang sama tanpa
 * perubahan logika parsing kolom.
 */
export async function bacaXlsxSebagaiBaris(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  const arsip = await unzipXlsx(buf);

  const workbookXml = bacaEntriTeks(arsip, 'xl/workbook.xml');
  if (!workbookXml) throw new Error('Format .xlsx tidak dikenali (xl/workbook.xml tidak ada).');
  const wbDoc = parseXml(workbookXml, 'workbook.xml');
  const sheetEl = wbDoc.querySelector('sheets > sheet');
  if (!sheetEl) throw new Error('Tidak ada sheet di file .xlsx ini.');
  const rId = sheetEl.getAttribute('r:id') || '';

  let target = 'worksheets/sheet1.xml';
  const relsXml = bacaEntriTeks(arsip, 'xl/_rels/workbook.xml.rels');
  if (relsXml && rId) {
    const relsDoc = parseXml(relsXml, 'workbook.xml.rels');
    const rel = Array.from(relsDoc.querySelectorAll('Relationship')).find((r) => r.getAttribute('Id') === rId);
    if (rel) target = rel.getAttribute('Target') || target;
  }
  const sheetPath = `xl/${target.replace(/^\/?xl\//, '').replace(/^\.?\//, '')}`;

  let sharedStrings: string[] = [];
  const sharedXml = bacaEntriTeks(arsip, 'xl/sharedStrings.xml');
  if (sharedXml) {
    const ssDoc = parseXml(sharedXml, 'sharedStrings.xml');
    sharedStrings = Array.from(ssDoc.querySelectorAll('si')).map(teksDariNode);
  }

  const sheetXml = bacaEntriTeks(arsip, sheetPath);
  if (!sheetXml) throw new Error(`Sheet tidak ditemukan di dalam file: ${sheetPath}`);
  const sheetDoc = parseXml(sheetXml, sheetPath);

  const baris: string[][] = [];
  sheetDoc.querySelectorAll('sheetData > row').forEach((rowEl) => {
    const row: string[] = [];
    rowEl.querySelectorAll(':scope > c').forEach((c) => {
      const ref = c.getAttribute('r') || '';
      const idx = ref ? kolomKeIndeks(ref) : row.length;
      row[idx] = nilaiSel(c, sharedStrings);
    });
    for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = '';
    baris.push(row);
  });
  return baris;
}
