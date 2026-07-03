// /dashboard (KPA) — kartu ringkasan bulan berjalan + grafik batang nominal 6 bulan.
import { useEffect, useState } from 'react';
import { bulanIni, labelBulan } from '../../components/bulan-picker';
import { Card } from '../../components/ui/card';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { api } from '../../lib/api';
import { formatRupiah } from '../tagihan/tipe';
import { GrafikBatang } from './grafik-batang';

interface Ringkasan {
  tarunaAktif: number;
  realisasiHariIni: number;
  bayarStatus: string;
  outstanding: number;
  grafik: { label: string; nilai: number }[];
}

function enamBulanTerakhir(): string[] {
  const hasil: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    hasil.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return hasil;
}

export function HalamanDashboardKpa() {
  const [data, setData] = useState<Ringkasan | null>(null);
  const [galat, setGalat] = useState('');
  const [memuat, setMemuat] = useState(true);

  async function muat() {
    setMemuat(true);
    setGalat('');
    try {
      const bulan = bulanIni();
      const hariIni = new Date().toISOString().slice(0, 10);
      const bulanList = enamBulanTerakhir();

      const [taruna, realisasi, bayar, ringkasanTagihan, ...rekapPerBulan] = await Promise.all([
        api<{ taruna: unknown[] }>('taruna.list', { status: 'AKTIF' }),
        api<{ realisasi: { tanggal: string }[] }>('realisasi.list', { bulan }),
        api<{ pembayaran: { status: string }[] }>('bayar.list', { bulan }),
        api<{ total_outstanding: number }>('tagihan.summary', {}),
        ...bulanList.map((b) => api<{ total: number }>('rekap.get', { bulan: b }).catch(() => ({ total: 0 })))
      ]);

      setData({
        tarunaAktif: taruna.taruna.length,
        realisasiHariIni: realisasi.realisasi.filter((r) => r.tanggal === hariIni).length,
        bayarStatus: bayar.pembayaran[0]?.status ?? 'Belum ada',
        outstanding: ringkasanTagihan.total_outstanding,
        grafik: bulanList.map((b, i) => ({ label: labelBulan(b).slice(0, 3), nilai: rekapPerBulan[i].total }))
      });
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat dashboard.');
    } finally {
      setMemuat(false);
    }
  }

  useEffect(() => { void muat(); }, []);

  if (memuat && !data) return <LoadingSpinner label="Memuat dashboard…" />;
  if (galat && !data) return <ErrorMessage pesan={galat} onRetry={() => void muat()} />;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-primary-dark">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <p className="text-2xl font-bold text-primary-dark">{data.tarunaAktif}</p>
          <p className="text-xs text-gray-500">Taruna Aktif</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-primary-dark">{data.realisasiHariIni}</p>
          <p className="text-xs text-gray-500">Realisasi Hari Ini</p>
        </Card>
        <Card className="text-center">
          <p className="text-sm font-bold text-primary-dark">{data.bayarStatus.replace(/_/g, ' ')}</p>
          <p className="text-xs text-gray-500">Status Pembayaran Bulan Ini</p>
        </Card>
        <Card className="text-center">
          <p className="text-sm font-bold text-red-600">{formatRupiah(data.outstanding)}</p>
          <p className="text-xs text-gray-500">Piutang Outstanding</p>
        </Card>
      </div>

      <Card>
        <p className="mb-2 text-sm font-semibold text-gray-600">Nominal Rekap 6 Bulan Terakhir</p>
        <GrafikBatang data={data.grafik} />
      </Card>
    </div>
  );
}
