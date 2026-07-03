// /tagihan — daftar tagihan aktif + badge level SP merah (semua role terkait).
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
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

export function HalamanTagihanList() {
  const { data, memuat, galat, refresh } = useListCache<{ tagihan: Tagihan[] }>('tagihan.list', {});

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-primary-dark">Tagihan</h1>

      {memuat && !data && <LoadingSpinner label="Memuat tagihan…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}
      {data && data.tagihan.length === 0 && <EmptyState pesan="Tidak ada tagihan." />}

      {data?.tagihan
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
  );
}
