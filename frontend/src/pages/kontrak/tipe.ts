export interface Penyedia {
  penyedia_id: string;
  nama: string;
  kontak: string;
  alamat: string;
  npwp_mask: string;
  status: 'AKTIF' | 'NONAKTIF';
}

export interface Kontrak {
  kontrak_id: string;
  penyedia_id: string;
  harga_per_porsi: number;
  porsi_per_hari: number;
  tgl_mulai: string;
  tgl_akhir: string;
  status: 'DRAFT' | 'DISETUJUI_PPK';
  approved_by: string;
  approved_at: string;
}

export const JENIS_LAMPIRAN_KONTRAK: { jenis: string; label: string }[] = [
  { jenis: 'MENU_GIZI', label: '🍽️ Menu & Nilai Gizi' },
  { jenis: 'BA', label: '📝 BA Penunjukan Penyedia' },
  { jenis: 'NOTULEN', label: '🗒️ Notulen Rapat' }
];

/** Validasi 4 digit terakhir NPWP (cermin _mask4_ backend). */
export function validasiNpwpMask(input: string): { ok: true; nilai: string } | { ok: false; pesan: string } {
  const digit = input.replace(/\D/g, '');
  if (!digit) return { ok: false, pesan: 'npwp_mask wajib diisi.' };
  if (digit.length > 4) return { ok: false, pesan: 'Hanya 4 digit terakhir yang boleh diisi.' };
  if (digit.length < 4) return { ok: false, pesan: 'npwp_mask harus tepat 4 digit terakhir.' };
  return { ok: true, nilai: '••••' + digit };
}
