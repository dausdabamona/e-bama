// Alamat resmi tujuan surat ke bank — dipakai di semua surat pemblokiran/
// pendebetan (Form-07, blokir-gagal-debet, surat-pendebetan-bank) supaya
// konsisten. BSI belum diisi (fallback ke label generik "Pimpinan Bank BSI")
// — isi di sini saat alamatnya dikonfirmasi Firdaus.
const ALAMAT_BANK: Partial<Record<string, string[]>> = {
  BNI: [
    'PT. Bank Negara Indonesia (Persero) Tbk',
    'KCP Kementerian Kelautan dan Perikanan',
    'Gedung Mina Bahari III',
    'Jl. Medan Merdeka Timur No. 16, Jakarta Pusat'
  ]
};

/** null utk bank tak dikenal (mis. TANPA_REKENING, bukan bank sungguhan). */
export function alamatTujuanBank(bank: string): string[] | null {
  return ALAMAT_BANK[bank] ?? (bank === 'BNI' || bank === 'BSI' ? [`Pimpinan Bank ${bank}`, 'di tempat'] : null);
}
