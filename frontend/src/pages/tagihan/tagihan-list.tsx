// /tagihan — daftar tagihan aktif + badge level SP merah (semua role terkait).
// PPK: kartu ringkasan piutang per level + tombol tandai gagal debet massal.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { labelBulan } from '../../components/bulan-picker';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useListCache } from '../../lib/use-list-cache';
import { formatRupiah, type KebijakanTagihan, type Tagihan } from './tipe';
import { INFO_TAHAP, tahapBayar, URUTAN_TAHAP, type TahapBayar } from './urutan';
import type { Taruna } from '../taruna/tipe';

function labelLevel(level: number): string {
  if (level >= 3) return 'SP-3';
  if (level === 2) return 'SP-2';
  if (level === 1) return 'SP-1';
  return '';
}

interface RekapNilai { jumlah: number; nominal: number }

interface Ringkasan {
  per_level: Record<string, RekapNilai>;
  total_outstanding: number;
  verifikasi_1x: RekapNilai;
  lunas_belum_diteruskan: RekapNilai;
  lunas_sudah_diteruskan: RekapNilai;
}

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

  // Grup UTAMA per bulan (terbaru dulu), sub-grup per tahap pembayaran di dalamnya.
  const kelompokBulan = useMemo(() => {
    const bulanUrut = Array.from(new Set(daftar.map((t) => t.bulan))).sort((a, b) => b.localeCompare(a));
    return bulanUrut.map((bulan) => {
      const barisBulan = daftar.filter((t) => t.bulan === bulan);
      const map = new Map<TahapBayar, Tagihan[]>();
      URUTAN_TAHAP.forEach((k) => map.set(k, []));
      barisBulan.forEach((t) => map.get(tahapBayar(t, session?.user_id))!.push(t));
      const tahap = URUTAN_TAHAP.map((tp) => ({ tahap: tp, baris: map.get(tp)! })).filter((g) => g.baris.length > 0);
      return { bulan, jumlah: barisBulan.length, tahap };
    });
  }, [daftar, session?.user_id]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary-dark">Tagihan</h1>
        <div className="flex gap-2">
          <Link to="/tagihan/status-debet"><Button varian="garis">📊 Status Debet</Button></Link>
          {(session?.role === 'SENAT' || session?.role === 'PEMBINA' || session?.role === 'ADMIN' || session?.role === 'PPK') && (
            <Link to="/tagihan/teruskan-penyedia"><Button varian="garis">📤 Teruskan ke Penyedia</Button></Link>
          )}
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
          <div className="mt-3 flex flex-col gap-1 border-t border-gray-200 pt-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Verifikasi 1x (menunggu verifikator kedua)</span>
              <span className="font-semibold">{ringkasanQ.data!.verifikasi_1x?.jumlah ?? 0} · {formatRupiah(ringkasanQ.data!.verifikasi_1x?.nominal ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-amber-700">Lunas, belum diteruskan ke Penyedia</span>
              <span className="font-semibold text-amber-700">{ringkasanQ.data!.lunas_belum_diteruskan?.jumlah ?? 0} · {formatRupiah(ringkasanQ.data!.lunas_belum_diteruskan?.nominal ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-green-700">Lunas, sudah diteruskan ke Penyedia</span>
              <span className="font-semibold text-green-700">{ringkasanQ.data!.lunas_sudah_diteruskan?.jumlah ?? 0} · {formatRupiah(ringkasanQ.data!.lunas_sudah_diteruskan?.nominal ?? 0)}</span>
            </div>
          </div>
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

      <div className="flex flex-col gap-6">
        {kelompokBulan.map((gb) => (
          <div key={gb.bulan} className="flex flex-col gap-3">
            <h2 className="border-b border-gray-200 pb-1 text-sm font-bold text-primary-dark">
              {labelBulan(gb.bulan)} ({gb.jumlah})
            </h2>
            {gb.tahap.map((g) => (
              <div key={g.tahap} className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-500">{INFO_TAHAP[g.tahap].label} ({g.baris.length})</p>
                <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4 xl:grid-cols-3">
                  {g.baris.map((t) => (
                    <Link key={t.tagihan_id} to={`/tagihan/${t.tagihan_id}`}>
                      <Card className={`flex items-center justify-between active:bg-primary-light/30 ${INFO_TAHAP[g.tahap].kartu}`}>
                        <div>
                          <p className="font-semibold">{namaByNit.get(t.nit) ?? t.nit}</p>
                          <p className="text-xs text-gray-400">{t.nit}</p>
                          <p className="text-sm text-gray-500">{formatRupiah(t.nominal)}</p>
                          <p className="text-xs text-gray-400">{t.sebab.replace(/_/g, ' ')}</p>
                          {INFO_TAHAP[g.tahap].catatan && (
                            <p className="text-xs font-medium text-purple-700">{INFO_TAHAP[g.tahap].catatan}</p>
                          )}
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
        ))}
      </div>
    </div>
  );
}
