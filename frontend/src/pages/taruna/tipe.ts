export interface Taruna {
  nit: string;
  nama: string;
  prodi: string;
  tingkat: string;
  kelas: string;
  bank: 'BNI' | 'BSI';
  rek_mask: string;
  status: 'AKTIF' | 'NONAKTIF';
}

/**
 * Validasi & normalisasi rek_mask di klien (cermin dari _mask4_ backend):
 * hanya boleh 4 digit terakhir. Menolak input yang terlihat seperti rekening lengkap.
 */
export function validasiRekMask(input: string): { ok: true; nilai: string } | { ok: false; pesan: string } {
  const digit = input.replace(/\D/g, '');
  if (!digit) return { ok: false, pesan: 'rek_mask wajib diisi.' };
  if (digit.length > 4) return { ok: false, pesan: 'Hanya 4 digit terakhir yang boleh diisi — nomor rekening lengkap DILARANG masuk sistem.' };
  if (digit.length < 4) return { ok: false, pesan: 'rek_mask harus tepat 4 digit terakhir.' };
  return { ok: true, nilai: '••••' + digit };
}
