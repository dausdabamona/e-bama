// Status sinkron JUJUR: titik online/offline + jumlah aksi "menunggu sinkron"
// dari antrean lib/sync.ts (Dexie). Dipakai di header (layout.tsx) — diekstrak
// jadi komponen supaya bisa dipakai ulang di layar lain (mis. ringkasan
// Beranda) tanpa duplikasi logika. Prompt "Beranda Kotak-Tugas", Bagian 2e.
//
// PENTING (pagar pengaman prompt): angka & status di sini SELALU dari
// `navigator.onLine` + `jumlahAntrian()` sungguhan — TIDAK boleh dipalsukan
// "sukses" saat sebenarnya masih tertunda di antrean offline.
import { useEffect, useState } from 'react';
import { jumlahAntrian } from '../../lib/sync';

export function useSyncStatus(): { online: boolean; nAntrian: number } {
  const [online, setOnline] = useState(navigator.onLine);
  const [nAntrian, setNAntrian] = useState(0);

  useEffect(() => {
    const nyala = () => setOnline(true);
    const mati = () => setOnline(false);
    const hitung = () => { void jumlahAntrian().then(setNAntrian); };
    window.addEventListener('online', nyala);
    window.addEventListener('offline', mati);
    window.addEventListener('ebama:antrian-berubah', hitung);
    hitung();
    const timer = setInterval(hitung, 5000);
    return () => {
      window.removeEventListener('online', nyala);
      window.removeEventListener('offline', mati);
      window.removeEventListener('ebama:antrian-berubah', hitung);
      clearInterval(timer);
    };
  }, []);

  return { online, nAntrian };
}

/** Titik indikator online/offline saja (dipakai di header, dekat nama app). */
export function TitikStatusOnline({ online, className = '' }: { online: boolean; className?: string }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'} ${className}`}
      title={online ? 'Online' : 'Offline'}
      aria-label={online ? 'Online' : 'Offline'}
    />
  );
}

/** Badge ringkas "N menunggu sinkron" — dipakai di header atau ringkasan Beranda. */
export function BadgeAntrianSinkron({ nAntrian, className = '' }: { nAntrian: number; className?: string }) {
  if (nAntrian <= 0) return null;
  return (
    <span className={`rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 ${className}`}>
      {nAntrian} menunggu sinkron
    </span>
  );
}
