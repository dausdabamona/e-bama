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
  // Data dokumen kontrak riil (opsional; rekening penyedia = nomor PENUH, dipakai Form-07/09)
  no_kontrak?: string;
  tgl_kontrak?: string;
  adendum?: string;
  rek_penyedia_bni?: string;
  rek_penyedia_bsi?: string;
}

export const JENIS_LAMPIRAN_KONTRAK: { jenis: string; label: string }[] = [
  { jenis: 'MENU_GIZI', label: '🍽️ Menu & Nilai Gizi' },
  { jenis: 'BA', label: '📝 BA Penunjukan Penyedia' },
  { jenis: 'NOTULEN', label: '🗒️ Notulen Rapat' }
];

export const HARI: string[] = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'];

export interface MenuHari {
  menu_id?: string;
  kontrak_id: string;
  hari: string;
  menu_pagi: string;
  menu_siang: string;
  menu_malam: string;
}

/** Menu mingguan standar (referensi SOP) — dipakai tombol "Isi Contoh Menu SOP". */
export const MENU_SOP_DEFAULT: Record<string, { pagi: string; siang: string; malam: string }> = {
  SENIN: {
    pagi: 'Nasi Putih\nTelur Balado\nSusu Ultra 200 ml\nKerupuk (Udang)',
    siang: 'Nasi Putih\nIkan Tuna Kuah Kuning\nSayur Kangkung\nSalak',
    malam: 'Nasi Putih\nAyam Rica-Rica\nPerkedel Jagung\nSayur Buncis Tumis Telur'
  },
  SELASA: {
    pagi: 'Nasi Putih\nTahu Bumbu Kacang (Pecel)\nTeh\nKerupuk (Udang)',
    siang: 'Nasi Putih\nAyam Opor\nSayur Kacang Panjang Tempe\nSari Kacang Hijau (200ml)',
    malam: 'Nasi Putih\nIkan Goreng Saos\nSayur Gulai Labu Kuning + Kacang Panjang\nTempe Goreng Marinasi'
  },
  RABU: {
    pagi: 'Nasi Putih\nTempe Orek + Kacang\nTeh\nKerupuk (Bunga Putih)',
    siang: 'Nasi Putih\nAyam Goreng Tepung Marinasi\nSayur Bayam Kuah Bening\nYakult (Original)',
    malam: 'Nasi Putih\nUdang Saos (3)\nSawi Tumis\nSemangka'
  },
  KAMIS: {
    pagi: 'Nasi Putih\nTelur Rebus + Sosis + Saos\nTeh\nKerupuk (Bunga Putih)',
    siang: 'Nasi Putih\nAyam Goreng Tepung Crispy + Sambal Terasi\nSayur Sop\nMilku',
    malam: 'Nasi Putih\nIkan Kuah Garang Asem\nSayur Sawi Putih Tumis\nSosis Goreng (2)\nPepaya'
  },
  JUMAT: {
    pagi: 'Nasi Putih\nTempe Kecap\nKerupuk (Udang)\nBubur Kacang Hijau',
    siang: 'Nasi Putih\nIkan Lema Sambal / Ikan Tuna\nSayur Kangkung + Bunga Pepaya\nJagung Rebus',
    malam: 'Nasi Putih\nAyam Kecap\nSayur Capcay\nTempe Tepung'
  },
  SABTU: {
    pagi: 'Nasi Putih\nTelur Mata Sapi Saos\nSusu Milo (120ml)\nKerupuk (Bunga Putih)',
    siang: 'Nasi Putih\nAyam Goreng Tepung + Saos\nSayur Daun Singkong Santan\nSusu Soya',
    malam: 'Nasi Putih\nIkan Goreng Tepung + Sambal Terasi\nSayur Terong Balado\nSemangka'
  },
  MINGGU: {
    pagi: 'Nasi Putih\nSambal Goreng Ikan Teri Halus + Kacang + Tempe\nSusu Coklat\nRoti\nKerupuk (Udang)',
    siang: 'Nasi Putih\nSoto\nAyam Goreng\nJeruk',
    malam: 'Nasi Putih\nIkan Saos Balado\nSayur Tahu Toge'
  }
};

/** Validasi 4 digit terakhir NPWP (cermin _mask4_ backend). */
export function validasiNpwpMask(input: string): { ok: true; nilai: string } | { ok: false; pesan: string } {
  const digit = input.replace(/\D/g, '');
  if (!digit) return { ok: false, pesan: 'npwp_mask wajib diisi.' };
  if (digit.length > 4) return { ok: false, pesan: 'Hanya 4 digit terakhir yang boleh diisi.' };
  if (digit.length < 4) return { ok: false, pesan: 'npwp_mask harus tepat 4 digit terakhir.' };
  return { ok: true, nilai: '••••' + digit };
}
