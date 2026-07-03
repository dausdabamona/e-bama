// Header cetak (kop surat resmi) — HANYA tampil saat print (pola sama
// seperti blok kop di laporan-resmi.tsx). Gambar diletakkan di
// frontend/public/kop/kop-surat-2024.png (bukan berkas yang di-import —
// dilayani apa adanya oleh Vite dari folder public/).
export function KopSurat() {
  return (
    <div className="hidden print:block">
      <img
        src={`${import.meta.env.BASE_URL}kop/kop-surat-2024.png`}
        alt="Kop Surat Politeknik Kelautan dan Perikanan Sorong"
        className="w-full"
      />
      <div className="mt-1 border-b-2 border-black" />
    </div>
  );
}
