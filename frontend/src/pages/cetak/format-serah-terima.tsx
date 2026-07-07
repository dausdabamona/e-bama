// /cetak/format-serah-terima — Format KOSONG siap-cetak untuk serah-terima
// makanan dari penyedia (bukan salah satu dari 10 Form Manual SOP resmi;
// alat bantu operasional tambahan). Satu lembar PER HARI (Senin–Minggu, 7
// lembar total) menampilkan menu acuan Pagi/Siang/Malam hari itu dari
// kontrak aktif — TANPA tanggal/jumlah terisi, supaya bisa dicetak banyak
// salinan sekaligus dan dipakai berulang tiap minggu. Tanggal, jumlah
// komponen, dan tanda tangan diisi TANGAN saat serah-terima sesungguhnya.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KopSurat } from '../../components/cetak/kop-surat';
import { Button } from '../../components/ui/button';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { api } from '../../lib/api';

const HARI = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'] as const;
const LABEL_HARI: Record<string, string> = {
  SENIN: 'Senin', SELASA: 'Selasa', RABU: 'Rabu', KAMIS: 'Kamis', JUMAT: 'Jumat', SABTU: 'Sabtu', MINGGU: 'Minggu'
};
const WAKTU_MAKAN = ['pagi', 'siang', 'malam'] as const;
const LABEL_WAKTU: Record<string, string> = { pagi: 'Pagi', siang: 'Siang', malam: 'Malam' };

interface MenuHari { hari: string; menu_pagi: string; menu_siang: string; menu_malam: string }
interface KontrakRingkas { kontrak_id: string; status: string; tgl_mulai: string; tgl_akhir: string }

function hariIni(): string {
  return new Date().toISOString().slice(0, 10);
}

function menuUntukWaktu(m: MenuHari, waktu: (typeof WAKTU_MAKAN)[number]): string {
  if (waktu === 'pagi') return m.menu_pagi;
  if (waktu === 'siang') return m.menu_siang;
  return m.menu_malam;
}

export function HalamanFormatSerahTerima() {
  const nav = useNavigate();
  const [menuByHari, setMenuByHari] = useState<Record<string, MenuHari> | null>(null);
  const [komponen, setKomponen] = useState<string[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    let aktif = true;
    (async () => {
      setMemuat(true); setGalat('');
      try {
        const tgl = hariIni();
        const [kres, kbres] = await Promise.all([
          api<{ kontrak: KontrakRingkas[] }>('kontrak.list', {}),
          api<{ komponen: string[] }>('realisasi.kebijakan_penerimaan', {})
        ]);
        const kontrakAktif = kres.kontrak.find(
          (k) => k.status === 'DISETUJUI_PPK' && k.tgl_mulai <= tgl && tgl <= k.tgl_akhir
        );
        if (!kontrakAktif) {
          if (aktif) { setGalat('Belum ada kontrak aktif (DISETUJUI_PPK) untuk hari ini.'); setMemuat(false); }
          return;
        }
        const mres = await api<{ menu: MenuHari[] }>('menu.list', { kontrak_id: kontrakAktif.kontrak_id });
        const byHari: Record<string, MenuHari> = {};
        mres.menu.forEach((m) => { byHari[m.hari] = m; });
        if (aktif) { setMenuByHari(byHari); setKomponen(kbres.komponen); }
      } catch (e) {
        if (aktif) setGalat(e instanceof Error ? e.message : 'Gagal memuat.');
      } finally {
        if (aktif) setMemuat(false);
      }
    })();
    return () => { aktif = false; };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <button className="text-sm text-primary" onClick={() => nav(-1)}>← Kembali</button>
        {menuByHari && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak Semua (7 Lembar)</Button>}
      </div>
      <h1 className="text-xl font-bold text-primary-dark print:hidden">Format Serah Terima Makanan</h1>
      <p className="text-xs text-gray-500 print:hidden">
        Format kosong siap-cetak — satu lembar per hari (Senin–Minggu, 7 lembar total), berisi menu acuan
        dari kontrak aktif sebagai referensi. Tanggal, jumlah komponen, dan tanda tangan SENGAJA dikosongkan
        (diisi tangan) supaya bisa dicetak banyak salinan sekaligus dan dipakai berulang tiap minggu.
      </p>

      {memuat && <LoadingSpinner label="Memuat menu kontrak…" />}
      {galat && <ErrorMessage pesan={galat} onRetry={() => window.location.reload()} />}

      {menuByHari && HARI.map((h, i) => {
        const m = menuByHari[h];
        return (
          <div key={h}
            className={`flex flex-col gap-3 rounded-2xl border-2 border-dashed border-gray-200 p-4 print:rounded-none print:border-0 print:p-0 ${i > 0 ? 'break-before-page' : ''}`}>
            <KopSurat />
            <div className="text-center">
              <h2 className="text-base font-bold">BERITA ACARA SERAH TERIMA MAKANAN</h2>
              <p className="text-sm font-semibold">{LABEL_HARI[h]}</p>
            </div>

            <div className="flex justify-between border-b border-gray-300 pb-1 text-sm">
              <span className="text-gray-500 print:text-black">Tanggal</span>
              <span className="w-48 border-b border-dotted border-gray-500">&nbsp;</span>
            </div>

            {!m && (
              <p className="text-xs text-amber-700 print:text-black">
                ⚠️ Menu untuk hari {LABEL_HARI[h]} belum diisi di kontrak aktif — lengkapi dulu di halaman Kontrak.
              </p>
            )}

            {WAKTU_MAKAN.map((waktu) => (
              <div key={waktu} className="rounded-lg border border-gray-300 p-3">
                <p className="mb-1 text-sm font-semibold">{LABEL_WAKTU[waktu]}</p>
                <p className="mb-2 text-xs text-gray-600 print:text-black">
                  Menu acuan: {m ? (menuUntukWaktu(m, waktu) || '-') : '-'}
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
                  {komponen.map((k) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 border-2 border-gray-500" aria-hidden />
                      <span>{k}</span>
                      <span className="ml-auto w-12 border-b border-dotted border-gray-500 text-right text-xs text-gray-400">jml</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="mt-4 grid grid-cols-2 gap-6 text-center text-xs">
              <div>
                <p>Diserahkan oleh,</p>
                <p className="text-gray-500 print:text-black">Penyedia / Katering</p>
                <div className="mt-10 border-t border-black pt-0.5">(...........................)</div>
              </div>
              <div>
                <p>Diterima oleh,</p>
                <p className="text-gray-500 print:text-black">Petugas Piket / Senat</p>
                <div className="mt-10 border-t border-black pt-0.5">(...........................)</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
