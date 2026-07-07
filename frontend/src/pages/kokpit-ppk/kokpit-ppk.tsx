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

// Warna lingkaran & garis penghubung pipeline stepper (design_handoff_ebama_kokpit).
const WARNA_LINGKARAN: Record<StatusTahap, string> = {
  hijau: 'bg-[#059669] text-white',
  kuning: 'bg-[#D97706] text-white ring-4 ring-[#FFFBEB]',
  merah: 'bg-[#DC2626] text-white',
  n_a: 'bg-white text-gray-400 border-2 border-[#D9EEEA]'
};
const ISI_LINGKARAN: Record<StatusTahap, string> = { hijau: '✓', kuning: '●', merah: '!', n_a: '' };

function PipelineStepper({ tahapan }: { tahapan: Tahap[] }) {
  const selesai = tahapan.filter((t) => t.status === 'hijau').length;
  const perluTindakan = tahapan.find((t) => t.status === 'kuning' || t.status === 'merah');
  const garis = (i: number) => (tahapan[i]?.status === 'hijau' ? 'bg-[#059669]' : 'bg-[#D9EEEA]');

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <p className="text-sm font-semibold text-gray-700">⚡ Tahapan Tutup-Bulan</p>
        <p className="text-xs text-gray-500">
          {selesai} dari {tahapan.length} tahap selesai
          {perluTindakan ? ` · perlu tindakan di ${perluTindakan.label}` : ''}
        </p>
      </div>
      <div className="flex gap-0 overflow-x-auto pb-1">
        {tahapan.map((t, i) => (
          <div key={t.no} title={t.angka} className="flex w-[84px] shrink-0 flex-col items-center gap-1.5">
            <div className="flex w-full items-center">
              <div className={`h-0.5 flex-1 ${i === 0 ? 'invisible' : garis(i - 1)}`} />
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${WARNA_LINGKARAN[t.status]}`}
              >
                {ISI_LINGKARAN[t.status] || t.no}
              </span>
              <div className={`h-0.5 flex-1 ${i === tahapan.length - 1 ? 'invisible' : garis(i)}`} />
            </div>
            <p className="line-clamp-2 text-center text-[10.5px] leading-tight text-gray-500">{t.label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Satu desimal (koma Indonesia) — hindari pembulatan "100%" saat aslinya 99,7%.
function formatPersen(bagian: number, total: number): string {
  if (total <= 0) return '0';
  return (Math.round((bagian / total) * 1000) / 10).toString().replace('.', ',');
}

interface KartuKpiProps {
  ikon: string; warnaIkon: string; bgIkon: string; label: string; nilai: string;
  sub?: string; persen?: number; warnaBullet?: string;
}
function KartuKpi({ ikon, warnaIkon, bgIkon, label, nilai, sub, persen, warnaBullet }: KartuKpiProps) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] text-sm ${bgIkon} ${warnaIkon}`}>
          {ikon}
        </span>
        <span className="text-xs font-semibold text-gray-500">{label}</span>
      </div>
      <span className="text-xl font-bold tracking-tight text-primary-dark tabular-nums">{nilai}</span>
      {typeof persen === 'number' && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div className={`h-full rounded-full ${warnaBullet}`} style={{ width: `${Math.min(100, Math.max(0, persen))}%` }} />
        </div>
      )}
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
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

      {data && (() => {
        const barTerbayar = data.ringkasan.target_rekap > 0
          ? (data.ringkasan.terbayar_sp2d / data.ringkasan.target_rekap) * 100 : 0;
        const barPorsi = data.ringkasan.porsi_dipesan > 0
          ? (data.ringkasan.porsi_dimakan / data.ringkasan.porsi_dipesan) * 100 : 0;
        const persenTerbayar = formatPersen(data.ringkasan.terbayar_sp2d, data.ringkasan.target_rekap);
        const persenPorsi = formatPersen(data.ringkasan.porsi_dimakan, data.ringkasan.porsi_dipesan);
        return (
        <>
          <PipelineStepper tahapan={data.tahapan} />

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KartuKpi
              ikon="🎯" warnaIkon="text-[#0369A1]" bgIkon="bg-[#E8F0F3]"
              label="Target (Rekap FINAL)" nilai={formatRupiah(data.ringkasan.target_rekap)}
            />
            <KartuKpi
              ikon="🏦" warnaIkon="text-[#059669]" bgIkon="bg-[#ECFDF5]"
              label="Terbayar / SP2D Cair" nilai={formatRupiah(data.ringkasan.terbayar_sp2d)}
              persen={barTerbayar} warnaBullet="bg-[#059669]"
              sub={data.ringkasan.target_rekap > 0 ? `${persenTerbayar}% dari target` : undefined}
            />
            <KartuKpi
              ikon="⚠️" warnaIkon="text-[#DC2626]" bgIkon="bg-[#FEF2F2]"
              label="Outstanding Tagihan" nilai={formatRupiah(data.ringkasan.outstanding_tagihan)}
            />
            <KartuKpi
              ikon="🍱" warnaIkon="text-[#0369A1]" bgIkon="bg-[#E8F0F3]"
              label="Porsi Dipesan vs Dimakan" nilai={`${data.ringkasan.porsi_dipesan} / ${data.ringkasan.porsi_dimakan}`}
              persen={barPorsi} warnaBullet="bg-[#0369A1]"
              sub={data.ringkasan.porsi_dipesan > 0 ? `${persenPorsi}% sesuai` : undefined}
            />
          </div>

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
        );
      })()}
    </div>
  );
}
