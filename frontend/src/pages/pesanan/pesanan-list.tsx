// /pesanan — daftar per bulan + badge status; tombol buat pesanan baru (Senat).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BulanPicker, bulanIni } from '../../components/bulan-picker';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useListCache } from '../../lib/use-list-cache';
import type { Pesanan } from './tipe';

export function HalamanPesananList() {
  const [bulan, setBulan] = useState(bulanIni());
  const { data, memuat, galat, refresh } = useListCache<{ pesanan: Pesanan[] }>('pesanan.list', { bulan });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary-dark">Pesanan</h1>
        <Link to="/pesanan/baru">
          <Button>+ Buat</Button>
        </Link>
      </div>

      <BulanPicker bulan={bulan} onChange={setBulan} />

      {memuat && !data && <LoadingSpinner label="Memuat pesanan…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}
      {data && (data.pesanan ?? []).length === 0 && <EmptyState pesan="Belum ada pesanan bulan ini." />}

      {(data?.pesanan ?? [])
        .slice()
        .sort((a, b) => b.tgl_makan.localeCompare(a.tgl_makan))
        .map((p) => (
          <Link key={p.pesanan_id} to={`/pesanan/${p.pesanan_id}`}>
            <Card className="flex items-center justify-between active:bg-primary-light/30">
              <div>
                <p className="font-semibold">{p.tgl_makan}</p>
                <p className="text-sm text-gray-500">{p.menu}</p>
                <p className="text-xs text-gray-400">{p.jml_taruna} taruna</p>
              </div>
              <Badge status={p.status} />
            </Card>
          </Link>
        ))}
    </div>
  );
}
