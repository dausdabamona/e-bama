// Kop surat resmi — HANYA tampil saat print (pola sama seperti blok kop di
// laporan-resmi.tsx). Direproduksi sebagai TEKS (HTML/CSS) agar tajam saat
// dicetak di segala resolusi. Logo KKP (emblem bulat + Garuda) diletakkan di
// frontend/public/kop/logo-kkp.png — dilayani apa adanya oleh Vite dari public/.
// Kalau file logo belum ada, gambar disembunyikan (teks kop tetap tampil rapi).
const BIRU_KKP = '#1616cc';

export function KopSurat() {
  return (
    <div className="hidden print:block">
      <div className="flex items-center gap-3">
        <img
          src={`${import.meta.env.BASE_URL}kop/logo-kkp.png`}
          alt="Logo Kementerian Kelautan dan Perikanan"
          className="h-24 w-24 shrink-0 object-contain"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
        />
        <div className="flex-1 text-center leading-tight">
          <p className="text-[15px] font-bold" style={{ color: BIRU_KKP }}>
            KEMENTERIAN KELAUTAN DAN PERIKANAN
          </p>
          <p className="text-[13px]" style={{ color: BIRU_KKP }}>
            BADAN PENYULUHAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA KELAUTAN DAN PERIKANAN
          </p>
          <p className="text-[17px] font-bold" style={{ color: BIRU_KKP }}>
            POLITEKNIK KELAUTAN DAN PERIKANAN SORONG
          </p>
          <p className="mt-1 text-[11px] text-black">JALAN KAPITAN PATTIMURA, TANJUNG KASUARI - SUPRAU</p>
          <p className="text-[11px] text-black">KOTAK POS 118 KOTA SORONG, PAPUA BARAT DAYA 98411</p>
          <p className="text-[11px] text-black">
            LAMAN <span className="italic" style={{ color: BIRU_KKP }}>www.polikpsorong.ac.id</span>
            {'  '}SUREL <span className="italic" style={{ color: BIRU_KKP }}>polteksorong@kkp.go.id</span>
          </p>
        </div>
      </div>
      {/* Garis penutup kop: tebal lalu tipis (khas kop surat resmi) */}
      <div className="mt-1 border-b-4 border-black" />
      <div className="mt-0.5 border-b border-black" />
    </div>
  );
}
