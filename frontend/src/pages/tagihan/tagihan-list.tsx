// /tagihan — daftar tagihan aktif + badge level SP merah (semua role terkait).
// PPK: kartu ringkasan piutang per level + tombol tandai gagal debet massal.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useListCache } from '../../lib/use-list-cache';
import { formatRupiah, type KebijakanTagihan, type Tagihan } from './tipe';
import type { Taruna } from '../taruna/tipe';

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

// Tahap alur pembayaran (verifikasi ganda, peran bebas — siapa pun di antara
// Senat/Pembina/Admin/PPK) — dipakai untuk kelompok + warna kartu, biar
// sekilas kelihatan mana yang perlu tindakan.
type TahapBayar = 'BELUM_SETOR' | 'MENUNGGU_VERIF_1' | 'MENUNGGU_VERIF_2' | 'SELESAI';

function tahapBayar(t: Tagihan): TahapBayar {
  if (t.status !== 'TERTAGIH') return 'SELESAI';
  if (!t.tgl_setor) return 'BELUM_SETOR';
  if (!t.verif_1_oleh) return 'MENUNGGU_VERIF_1';
  return 'MENUNGGU_VERIF_2';
}

// Urutan paling-butuh-tindakan dulu: siap verifikasi ke-2 (final), lalu
// menunggu verifikasi ke-1, lalu belum disetor sama sekali, lalu selesai/lain.
const URUTAN_TAHAP: TahapBayar[] = ['MENUNGGU_VERIF_2', 'MENUNGGU_VERIF_1', 'BELUM_SETOR', 'SELESAI'];
const INFO_TAHAP: Record<TahapBayar, { label: string; kartu: string }> = {
  MENUNGGU_VERIF_2: { label: 'Menunggu Verifikasi ke-2 (Final)', kartu: 'border-l-4 border-blue-400' },
  MENUNGGU_VERIF_1: { label: 'Menunggu Verifikasi ke-1', kartu: 'border-l-4 border-amber-400' },
  BELUM_SETOR: { label: 'Belum Disetor', kartu: 'border-l-4 border-gray-300' },
  SELESAI: { label: 'Selesai / Lainnya', kartu: '' }
};

export function HalamanTagihanList() {
  const { session } = useAuth();
  const { data, memuat, galat, refresh } = useListCache<{ tagihan: Tagihan[]; kebijakan?: KebijakanTagihan }>('tagihan.list', {});
  const toleransi = data?.kebijakan?.toleransiSelisihTransfer ?? 20000;
  const ringkasanQ = useListCache<Ringkasan>('tagihan.summary', {});
  const tarunaQ = useListCache<{ taruna: Taruna[] }>('taruna.list', {});
  const namaByNit = new Map((tarunaQ.data?.taruna ?? []).map((t) => [t.nit, t.nama]));
  const tampilRingkasan = session?.role === 'PPK' || session?.role === 'KPA' || session?.role === 'WADIR3';

  const [cari, setCari] = useState('');
  const daftar = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (data?.tagihan ?? [])
      .filter((t) => !q || (namaByNit.get(t.nit) ?? '').toLowerCase().includes(q) || t.nit.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => b.bulan.localeCompare(a.bulan));
  }, [data, cari, tarunaQ.data]);

  const kelompok = useMemo(() => {
    const map = new Map<TahapBayar, Tagihan[]>();
    URUTAN_TAHAP.forEach((k) => map.set(k, []));
    daftar.forEach((t) => map.get(tahapBayar(t))!.push(t));
    return URUTAN_TAHAP.map((tahap) => ({ tahap, baris: map.get(tahap)! })).filter((g) => g.baris.length > 0);
  }, [daftar]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary-dark">Tagihan</h1>
        <div className="flex gap-2">
          <Link to="/tagihan/status-debet"><Button varian="garis">📊 Status Debet</Button></Link>
          {session?.role === 'PPK' && (
            <>
              <Link to="/tagihan/impor-debet"><Button varian="garis">📥 Impor CSV</Button></Link>
              <Link to="/tagihan/gagal-debet"><Button>+ Gagal Debet</Button></Link>
            </>
          )}
        </div>
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

      {data && (data.tagihan ?? []).length > 0 && (
        <input
          type="search"
          placeholder="Cari nama atau NIT…"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-light"
        />
      )}
      {data && (data.tagihan ?? []).length > 0 && daftar.length === 0 && (
        <EmptyState pesan="Tidak ada tagihan yang cocok dengan pencarian." />
      )}

      <div className="flex flex-col gap-4">
        {kelompok.map((g) => (
          <div key={g.tahap} className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-gray-500">{INFO_TAHAP[g.tahap].label} ({g.baris.length})</p>
            <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4 xl:grid-cols-3">
              {g.baris.map((t) => (
                <Link key={t.tagihan_id} to={`/tagihan/${t.tagihan_id}`}>
                  <Card className={`flex items-center justify-between active:bg-primary-light/30 ${INFO_TAHAP[g.tahap].kartu}`}>
                    <div>
                      <p className="font-semibold">{namaByNit.get(t.nit) ?? t.nit}</p>
                      <p className="text-xs text-gray-400">{t.nit} · {t.bulan}</p>
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
                      {t.status === 'LUNAS' && t.selisih_transfer > toleransi && (
                        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                          Kurang {formatRupiah(t.selisih_transfer)}
                        </span>
                      )}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
