// /menu-hari-ini (Senat, Pembina) — papan transparansi menu & gizi, READ-ONLY.
// Ownership Taruna Fitur 2a: menu Pagi/Siang/Malam dari MENU_KONTRAK kontrak
// aktif + standar gizi + status verifikasi piket hari ini (bila sudah ada).
// Besar & kontras — cocok ditayangkan di layar bersama ruang makan.
// NOL data sensitif (tanpa rupiah, rekening, atau daftar per-taruna).
import { Card } from '../components/ui/card';
import { ErrorMessage } from '../components/ui/error-message';
import { LoadingSpinner } from '../components/ui/loading-spinner';
import { useListCache } from '../lib/use-list-cache';

interface MenuHariIni {
  tanggal: string;
  ada_kontrak: boolean;
  menu: { pagi: string; siang: string; malam: string };
  standar_gizi: string[];
  piket: {
    menu_sesuai: boolean;
    porsi_cukup: boolean;
    kualitas: '' | 'BAIK' | 'CUKUP' | 'KURANG';
    gizi: string[];
  } | null;
}

const LABEL_KUALITAS: Record<string, string> = { BAIK: 'Baik', CUKUP: 'Cukup', KURANG: 'Kurang' };

function formatTanggal(tgl: string): string {
  const d = new Date(tgl + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function HalamanMenuHariIni() {
  const { data, memuat, galat, refresh } = useListCache<MenuHariIni>('menu.hari_ini', {});

  if (memuat && !data) return <LoadingSpinner label="Memuat menu…" />;
  if (galat && !data) return <ErrorMessage pesan={galat} onRetry={refresh} />;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">🍽️ Menu Hari Ini</h1>
        <p className="text-sm text-gray-500">{formatTanggal(data.tanggal)}</p>
      </div>

      {!data.ada_kontrak && (
        <Card>
          <p className="text-sm text-gray-500">Tidak ada kontrak aktif untuk hari ini.</p>
        </Card>
      )}

      {(['pagi', 'siang', 'malam'] as const).map((w) => (
        <Card key={w} className="flex flex-col gap-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {w === 'pagi' ? 'Pagi' : w === 'siang' ? 'Siang' : 'Malam'}
          </p>
          <p className="text-xl font-bold text-gray-800">
            {data.menu[w] || '— menu belum diisi —'}
          </p>
        </Card>
      ))}

      <Card className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-gray-600">Standar Gizi</p>
        <div className="flex flex-wrap gap-2">
          {data.standar_gizi.map((g) => (
            <span key={g} className="rounded-full bg-primary-light px-3 py-1 text-sm font-medium text-primary-dark">
              {g}
            </span>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-gray-600">Verifikasi Piket Hari Ini</p>
        {data.piket ? (
          <>
            <p className="text-base">{data.piket.menu_sesuai ? '✅' : '⏳'} Menu sesuai jadwal kontrak</p>
            <p className="text-base">{data.piket.porsi_cukup ? '✅' : '⏳'} Porsi cukup</p>
            <p className="text-base">
              🍚 Kualitas: <span className="font-semibold">{LABEL_KUALITAS[data.piket.kualitas] ?? '—'}</span>
            </p>
            {data.piket.gizi.length > 0 && (
              <p className="text-base">🥗 Gizi tercentang: {data.piket.gizi.join(', ')}</p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">Belum ada verifikasi piket hari ini.</p>
        )}
      </Card>
    </div>
  );
}
