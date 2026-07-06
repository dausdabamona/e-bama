// /realisasi (Senat + Pembina) — pesanan TERKIRIM menunggu realisasi + riwayat realisasi.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BulanPicker, bulanIni } from '../../components/bulan-picker';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useListCache } from '../../lib/use-list-cache';
import type { Pesanan } from '../pesanan/tipe';
import type { Realisasi } from './tipe';

function statusTtd(r: Realisasi): { label: string; status: string } {
  if (r.ttd_pembina_at && r.ttd_senat_at) return { label: 'Lengkap', status: 'SELESAI' };
  if (r.ttd_pembina_at) return { label: 'Menunggu TTD Senat', status: 'DIAJUKAN' };
  if (r.ttd_senat_at) return { label: 'Menunggu TTD Pembina', status: 'DIAJUKAN' };
  return { label: 'Belum ada TTD', status: 'DRAFT' };
}

export function HalamanRealisasiList() {
  const [bulan, setBulan] = useState(bulanIni());
  const pesananQ = useListCache<{ pesanan: Pesanan[] }>('pesanan.list', { bulan });
  const realisasiQ = useListCache<{ realisasi: Realisasi[] }>('realisasi.list', { bulan });

  const memuat = pesananQ.memuat || realisasiQ.memuat;
  const galat = pesananQ.galat || realisasiQ.galat;
  const data = pesananQ.data && realisasiQ.data ? { pesanan: pesananQ.data.pesanan, realisasi: realisasiQ.data.realisasi } : null;

  const punyaRealisasi = new Set(data?.realisasi?.map((r) => r.pesanan_id));
  const menunggu = data?.pesanan?.filter((p) => p.status === 'TERKIRIM' && !punyaRealisasi.has(p.pesanan_id)) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary-dark">Realisasi</h1>
        <Link to="/menu-hari-ini" className="text-sm text-primary underline">🍽️ Menu Hari Ini</Link>
      </div>
      <BulanPicker bulan={bulan} onChange={setBulan} />

      {memuat && !data && <LoadingSpinner label="Memuat…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={() => { pesananQ.refresh(); realisasiQ.refresh(); }} />}

      {data && (
        <>
          <h2 className="text-sm font-semibold text-gray-600">Menunggu Realisasi</h2>
          {menunggu.length === 0 && <EmptyState pesan="Tidak ada pesanan menunggu realisasi." />}
          {menunggu.map((p) => (
            <Link key={p.pesanan_id} to={`/realisasi/baru/${p.pesanan_id}`}>
              <Card className="flex items-center justify-between active:bg-primary-light/30">
                <div>
                  <p className="font-semibold">{p.tgl_makan}</p>
                  <p className="text-sm text-gray-500">{p.menu}</p>
                </div>
                <Badge status="TERKIRIM" />
              </Card>
            </Link>
          ))}

          <h2 className="mt-2 text-sm font-semibold text-gray-600">Riwayat Realisasi</h2>
          {(data.realisasi ?? []).length === 0 && <EmptyState pesan="Belum ada realisasi bulan ini." />}
          {(data.realisasi ?? [])
            .slice()
            .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
            .map((r) => {
              const st = statusTtd(r);
              return (
                <Link key={r.real_id} to={`/realisasi/${r.real_id}`}>
                  <Card className="flex items-center justify-between active:bg-primary-light/30">
                    <div>
                      <p className="font-semibold">{r.tanggal}</p>
                      <p className="text-sm text-gray-500">{r.jml_taruna_makan} taruna makan · {r.porsi_diterima} porsi</p>
                    </div>
                    <Badge status={st.status}>{st.label}</Badge>
                  </Card>
                </Link>
              );
            })}
        </>
      )}
    </div>
  );
}
