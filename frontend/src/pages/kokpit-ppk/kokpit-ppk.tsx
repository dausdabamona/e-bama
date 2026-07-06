// /kokpit-ppk (PPK, KPA, WADIR3 — baca saja) — kokpit orkestrasi tutup-bulan.
// READ-ONLY: seluruh status DITURUNKAN dari data (ppk.kokpit), tidak ada
// tulis di halaman ini. Tombol "Kerjakan" hanya MENAUTKAN ke halaman aksi
// yang sudah ada — guard sebenarnya tetap di action masing-masing.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BulanPicker, bulanIni } from '../../components/bulan-picker';
import { Card } from '../../components/ui/card';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useListCache } from '../../lib/use-list-cache';
import { formatRupiah } from '../tagihan/tipe';

interface Ringkasan {
  bulan: string; target_rekap: number; terbayar_sp2d: number;
  outstanding_tagihan: number; porsi_dipesan: number; porsi_dimakan: number;
}
type StatusTahap = 'hijau' | 'kuning' | 'merah' | 'n_a';
interface Tahap {
  no: number; label: string; status: StatusTahap;
  angka: string; prasyarat_ok: boolean; link: string;
}
interface Tindakan { prioritas: number; apa: string; kenapa: string; link: string; }
interface KokpitData { ringkasan: Ringkasan; tahapan: Tahap[]; tindakan: Tindakan[] }

const WARNA_STATUS: Record<StatusTahap, string> = {
  hijau: 'bg-green-100 text-green-800',
  kuning: 'bg-amber-100 text-amber-800',
  merah: 'bg-red-100 text-red-700',
  n_a: 'bg-gray-200 text-gray-600'
};
const IKON_STATUS: Record<StatusTahap, string> = { hijau: '✅', kuning: '⏳', merah: '⚠️', n_a: '➖' };

function KartuStat({ label, nilai }: { label: string; nilai: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-lg font-bold text-primary-dark">{nilai}</span>
    </Card>
  );
}

export function HalamanKokpitPpk() {
  const [bulan, setBulan] = useState(bulanIni());
  const { data, memuat, galat, refresh } = useListCache<KokpitData>('ppk.kokpit', { bulan });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-primary-dark">Kokpit PPK</h1>
      <BulanPicker bulan={bulan} onChange={setBulan} />

      {memuat && !data && <LoadingSpinner label="Memuat kokpit…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <KartuStat label="Target (Rekap FINAL)" nilai={formatRupiah(data.ringkasan.target_rekap)} />
            <KartuStat label="Terbayar / SP2D Cair" nilai={formatRupiah(data.ringkasan.terbayar_sp2d)} />
            <KartuStat label="Outstanding Tagihan" nilai={formatRupiah(data.ringkasan.outstanding_tagihan)} />
            <KartuStat label="Porsi Dipesan vs Dimakan" nilai={`${data.ringkasan.porsi_dipesan} / ${data.ringkasan.porsi_dimakan}`} />
          </div>

          <Card className="flex flex-col gap-1">
            <p className="mb-1 text-sm font-semibold text-gray-600">Tahapan Tutup-Bulan</p>
            {data.tahapan.map((t) => (
              <div key={t.no} className="flex items-center justify-between gap-2 border-b border-gray-100 py-2 last:border-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${WARNA_STATUS[t.status]}`}>
                    {IKON_STATUS[t.status]} {t.no}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.label}</p>
                    <p className="truncate text-xs text-gray-500">{t.angka}</p>
                  </div>
                </div>
                {t.link && (
                  t.prasyarat_ok
                    ? <Link to={t.link} className="shrink-0 text-sm text-primary underline">Kerjakan</Link>
                    : <span className="shrink-0 text-xs text-gray-400">Menunggu</span>
                )}
              </div>
            ))}
          </Card>

          {data.tindakan.length > 0 ? (
            <Card className="flex flex-col gap-1 border-l-4 border-red-400">
              <p className="mb-1 text-sm font-semibold text-red-700">⚠️ Butuh Tindakan PPK ({data.tindakan.length})</p>
              {data.tindakan.map((tv, i) => (
                <Link key={i} to={tv.link}
                  className="flex flex-col gap-0.5 border-b border-gray-100 py-2 last:border-0 active:bg-red-50">
                  <p className="text-sm font-medium text-gray-800">{tv.apa}</p>
                  <p className="text-xs text-gray-500">{tv.kenapa}</p>
                </Link>
              ))}
            </Card>
          ) : (
            <Card className="border-l-4 border-green-400">
              <p className="text-sm text-green-700">✅ Tidak ada yang butuh tindakan segera.</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
