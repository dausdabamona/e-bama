// /tagihan — daftar tagihan aktif + badge level SP merah (semua role terkait).
// PPK: kartu ringkasan piutang per level + tombol tandai gagal debet massal.
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useListCache } from '../../lib/use-list-cache';
import { formatRupiah, type Tagihan } from './tipe';

function labelLevel(level: number): string {
  if (level >= 3) return 'SP-3';
  if (level === 2) return 'SP-2';
  if (level === 1) return 'SP-1';
  return '';
}

interface Ringkasan {
  per_level: Record<string, { jumlah: number; nominal: number }>;
  total_outstanding: number;
}

export function HalamanTagihanList() {
  const { session } = useAuth();
  const { data, memuat, galat, refresh } = useListCache<{ tagihan: Tagihan[] }>('tagihan.list', {});
  const ringkasanQ = useListCache<Ringkasan>('tagihan.summary', {});
  const tampilRingkasan = session?.role === 'PPK' || session?.role === 'KPA' || session?.role === 'WADIR3';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary-dark">Tagihan</h1>
        {session?.role === 'PPK' && (
          <Link to="/tagihan/gagal-debet"><Button>+ Gagal Debet</Button></Link>
        )}
      </div>

      {tampilRingkasan && ringkasanQ.data && (
        <Card>
          <p className="mb-2 text-sm font-semibold text-gray-600">Ringkasan Piutang Outstanding</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {['1', '2', '3'].map((lv) => (
              <div key={lv} className="rounded-xl bg-red-50 p-2">
                <p className="text-xs text-red-700">SP-{lv}</p>
                <p className="font-bold">{ringkasanQ.data!.per_level[lv]?.jumlah ?? 0}</p>
              </div>
            ))}
            <div className="rounded-xl bg-gray-100 p-2">
              <p className="text-xs text-gray-500">Belum SP</p>
              <p className="font-bold">{ringkasanQ.data!.per_level['0']?.jumlah ?? 0}</p>
            </div>
          </div>
          <p className="mt-2 text-sm">Total Outstanding: <span className="font-bold">{formatRupiah(ringkasanQ.data!.total_outstanding)}</span></p>
        </Card>
      )}

      {memuat && !data && <LoadingSpinner label="Memuat tagihan…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}
      {data && (data.tagihan ?? []).length === 0 && <EmptyState pesan="Tidak ada tagihan." />}

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4 xl:grid-cols-3">
        {(data?.tagihan ?? [])
          .slice()
          .sort((a, b) => b.bulan.localeCompare(a.bulan))
          .map((t) => (
            <Link key={t.tagihan_id} to={`/tagihan/${t.tagihan_id}`}>
              <Card className="flex items-center justify-between active:bg-primary-light/30">
                <div>
                  <p className="font-semibold">{t.nit} — {t.bulan}</p>
                  <p className="text-sm text-gray-500">{formatRupiah(t.nominal)}</p>
                  <p className="text-xs text-gray-400">{t.sebab.replace(/_/g, ' ')}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge status={t.status} />
                  {t.status === 'TERTAGIH' && t.level_aktif > 0 && (
                    <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                      {labelLevel(t.level_aktif)}
                    </span>
                  )}
                </div>
              </Card>
            </Link>
          ))}
      </div>
    </div>
  );
}
