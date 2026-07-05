// Kop surat resmi — HANYA tampil saat print (pola sama seperti blok kop di
// laporan-resmi.tsx). Gambar kop utuh (KKP → BPPSDM KP → Politeknik KP Sorong +
// alamat) diletakkan di frontend/public/kop/kop-surat-2024.png — dilayani apa
// adanya oleh Vite dari folder public/ (bukan berkas yang di-import). Dipakai
// SEMUA form lewat komponen ini. Bila file belum ada, gambar disembunyikan
// otomatis (tidak menampilkan ikon rusak).
export function KopSurat() {
  return (
    <div className="hidden print:block">
      <img
        src={`${import.meta.env.BASE_URL}kop/kop-surat-2024.png`}
        alt="Kop Surat Politeknik Kelautan dan Perikanan Sorong"
        className="w-full"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
      />
      <div className="mt-1 border-b-2 border-black" />
    </div>
  );
}
