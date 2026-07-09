// Kop surat resmi — HANYA tampil saat print. Dipakai SEMUA form cetak.
// Prioritas: gambar kop utuh (KKP → BPPSDM KP → Politeknik KP Sorong + alamat)
// di frontend/public/kop/kop-surat-2024.png. Bila file belum diunggah / gagal
// dimuat, otomatis JATUH ke kop TEKS (nama instansi + alamat resmi) supaya
// setiap cetakan TETAP berkop — begitu gambar diunggah, gambar yang dipakai.
import { useState } from 'react';

export function KopSurat() {
  // Mulai pakai teks; kalau gambar berhasil dimuat, pakai gambar (sembunyikan teks).
  const [gambarOk, setGambarOk] = useState(false);
  return (
    <div className="hidden print:block">
      <img
        src={`${import.meta.env.BASE_URL}kop/kop-surat-2024.png`}
        alt="Kop Surat Politeknik Kelautan dan Perikanan Sorong"
        className={gambarOk ? 'w-full' : 'hidden'}
        onLoad={() => setGambarOk(true)}
        onError={() => setGambarOk(false)}
      />
      {!gambarOk && (
        <div className="text-center leading-tight">
          <p className="text-xs font-semibold">KEMENTERIAN KELAUTAN DAN PERIKANAN</p>
          <p className="text-xs font-semibold">BADAN PENYULUHAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA KELAUTAN DAN PERIKANAN</p>
          <p className="text-sm font-bold">POLITEKNIK KELAUTAN DAN PERIKANAN SORONG</p>
          <p className="text-[10px]">Jl. Kapitan Pattimura, Tanjung Kasuari - Suprau, Kota Sorong, Papua Barat Daya 98411</p>
        </div>
      )}
      <div className="mt-1 border-b-2 border-black" />
    </div>
  );
}
