// /dashboard-running (PPK, STAF_PPK) — Dashboard Rekap Bulan Berjalan.
// READ-ONLY: seluruh angka diturunkan dari action dashboard.running
// (backend/src/27_dashboard.gs) — tidak ada tulis di halaman ini.
// Komponen dipakai ulang dari yang sudah ada: BulanPicker, Card, KartuStat,
// LoadingSpinner, ErrorMessage, EmptyState, Input (pencarian tabel harian).
// Pola bar progres meniru (bukan mengimpor — komponen itu privat ke
// kokpit-ppk.tsx) class Tailwind KartuKpi di kokpit-ppk.tsx supaya tampilan
// konsisten tanpa menyentuh file itu.
//
// Data via dashboard.service.ts (getRunningDashboard) — BUKAN useListCache —
// supaya method service yang diminta benar-benar terpakai (bukan kode mati).
// Konsekuensinya: halaman ini tidak dapat cache Dexie useListCache; pola
// fetch-on-mount + tombol Perbarui manual ini sama seperti dashboard-kpa.tsx
// (dashboard lain yang juga tidak memakai useListCache).
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BulanPicker, bulanIni, labelBulan } from '../../components/bulan-picker';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { Input } from '../../components/ui/input';
import { KartuStat } from '../../components/ui/kartu-stat';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { formatRupiah } from '../tagihan/tipe';
import { getRunningDashboard } from './dashboard.service';
import type { RunningDailyBaris, RunningDashboard } from './tipe';

type KolomUrut = 'tanggal' | 'jml_taruna_pesanan' | 'status_pesanan' | 'status_realisasi' | 'nominal_hari';

function persenBar(persen: number, warna: string) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div className={`h-full rounded-full ${warna}`} style={{ width: `${Math.min(100, Math.max(0, persen))}%` }} />
    </div>
  );
}

function labelStatusRealisasi(s: RunningDailyBaris['status_realisasi']): string {
  if (s === 'SAH') return 'Sah';
  if (s === 'SEBAGIAN') return 'Sebagian';
  return 'Belum';
}

export function HalamanDashboardRunning() {
  const nav = useNavigate();
  const [bulanStr, setBulanStr] = useState(bulanIni());
  const [tahun, bulanNum] = useMemo(() => {
    const [y, m] = bulanStr.split('-').map(Number);
    return [y, m];
  }, [bulanStr]);

  const [data, setData] = useState<RunningDashboard | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    let aktif = true;
    setMemuat(true); setGalat('');
    getRunningDashboard(bulanNum, tahun)
      .then((r) => { if (aktif) setData(r); })
      .catch((e: unknown) => { if (aktif) setGalat(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (aktif) setMemuat(false); });
    return () => { aktif = false; };
  }, [bulanNum, tahun, tick]);

  const [cari, setCari] = useState('');
  const [urutKolom, setUrutKolom] = useState<KolomUrut>('tanggal');
  const [urutNaik, setUrutNaik] = useState(true);

  function klikKolom(k: KolomUrut) {
    if (k === urutKolom) setUrutNaik((n) => !n);
    else { setUrutKolom(k); setUrutNaik(true); }
  }

  const dailyTampil = useMemo(() => {
    if (!data) return [];
    const q = cari.trim().toLowerCase();
    const filtered = q
      ? data.daily.filter((b) =>
          b.tanggal.includes(q) || b.hari.toLowerCase().includes(q) ||
          b.status_pesanan.toLowerCase().includes(q) || labelStatusRealisasi(b.status_realisasi).toLowerCase().includes(q))
      : data.daily;
    const arah = urutNaik ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[urutKolom], bv = b[urutKolom];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * arah;
      return String(av).localeCompare(String(bv)) * arah;
    });
  }, [data, cari, urutKolom, urutNaik]);

  // Estimasi akhir bulan — proyeksi linear SEDERHANA dari laju hari yang sudah
  // dipesan (bukan rumus baku existing — tidak ada padanannya di backend,
  // jadi ditandai jelas sebagai perkiraan, bukan angka resmi). Dibulatkan ke
  // integer rupiah (aturan uang, CLAUDE.md §3).
  const estimasiAkhirBulan = useMemo(() => {
    if (!data || data.summary.hari_sudah_dipesan <= 0) return 0;
    return Math.round(
      (data.estimation.estimasi_tagihan_bulan_ini / data.summary.hari_sudah_dipesan) * data.summary.total_hari_kalender
    );
  }, [data]);

  const rataRataHarian = useMemo(() => {
    if (!data || data.summary.hari_sudah_dipesan <= 0) return 0;
    return Math.round(data.estimation.estimasi_tagihan_bulan_ini / data.summary.hari_sudah_dipesan);
  }, [data]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button className="text-sm text-primary" onClick={() => nav(-1)}>← Kembali</button>
        {data && <button className="text-sm text-primary" onClick={refresh}>🔄 Perbarui</button>}
      </div>
      <h1 className="text-xl font-bold text-primary-dark">Dashboard Rekap Bulan Berjalan</h1>

      <BulanPicker bulan={bulanStr} onChange={setBulanStr} />

      {memuat && !data && <LoadingSpinner label="Memuat dashboard…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}

      {data && (
        <>
          {/* ── Summary Card ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <KartuStat label="Total Hari Kalender" nilai={String(data.summary.total_hari_kalender)} satuan="hari" />
            <KartuStat label="Hari Sudah Dipesan" nilai={String(data.summary.hari_sudah_dipesan)} satuan="hari" tekankan />
            <KartuStat label="Hari Belum Dipesan" nilai={String(data.summary.hari_belum_dipesan)} satuan="hari" />
            <KartuStat label="Hari Sudah Direalisasi" nilai={String(data.summary.hari_sudah_direalisasi)} satuan="hari" tekankan />
            <KartuStat label="Hari Belum Direalisasi" nilai={String(data.summary.hari_belum_direalisasi)} satuan="hari" />
            <KartuStat label="Total Porsi Dipesan" nilai={data.summary.total_porsi_dipesan.toLocaleString('id-ID')} satuan="OH" />
            <KartuStat label="Total Porsi Direalisasi" nilai={data.summary.total_porsi_direalisasi.toLocaleString('id-ID')} satuan="OH" />
            <KartuStat label="Taruna Aktif" nilai={String(data.summary.jml_taruna_aktif)} satuan="orang" />
          </div>

          {/* ── Progress Card ────────────────────────────────────────────── */}
          <Card className="flex flex-col gap-4">
            <p className="text-sm font-semibold text-gray-600">Progres {labelBulan(data.bulan_str)}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-gray-500">Pesanan</span>
                  <span className="text-sm font-bold tabular-nums text-primary-dark">{data.progress.persen_pesanan}%</span>
                </div>
                {persenBar(data.progress.persen_pesanan, 'bg-primary')}
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-gray-500">Realisasi</span>
                  <span className="text-sm font-bold tabular-nums text-emerald-700">{data.progress.persen_realisasi}%</span>
                </div>
                {persenBar(data.progress.persen_realisasi, 'bg-emerald-600')}
              </div>
            </div>
          </Card>

          {/* ── Panel Hitung (Statistik) ─────────────────────────────────── */}
          <Card className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-gray-600">Statistik</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <KartuStat label="Total Pesanan (OH)" nilai={data.summary.total_porsi_dipesan.toLocaleString('id-ID')} />
              <KartuStat label="Total Realisasi (OH)" nilai={data.summary.total_porsi_direalisasi.toLocaleString('id-ID')} />
              <KartuStat label="Estimasi Tagihan" nilai={formatRupiah(data.estimation.estimasi_tagihan_bulan_ini)} tekankan />
              <KartuStat label="Estimasi Akhir Bulan" nilai={formatRupiah(estimasiAkhirBulan)} />
              <KartuStat label="Rata-rata Harian" nilai={formatRupiah(rataRataHarian)} />
              <KartuStat label="Basis Perhitungan" nilai={data.estimation.basis === 'REKAP' ? 'Rekap (realisasi sah)' : 'Pesanan (proyeksi)'} />
            </div>
            <p className="text-xs text-gray-400">
              "Estimasi Akhir Bulan" &amp; "Rata-rata Harian" adalah proyeksi linear sederhana dari laju hari
              yang sudah dipesan — perkiraan, BUKAN angka resmi rekap.
            </p>
          </Card>

          {/* ── Estimasi Tagihan (rincian) ───────────────────────────────── */}
          <Card className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-gray-600">Estimasi Tagihan — Rincian</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Nominal Proyeksi (Pesanan)</span><span className="font-semibold">{formatRupiah(data.estimation.nominal_proyeksi_pesanan)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Nominal Realisasi Sah</span><span className="font-semibold">{formatRupiah(data.estimation.nominal_realisasi_sah)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Selisih</span><span className="font-semibold">{formatRupiah(data.estimation.selisih)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Status Rekap</span><span className="font-semibold">{data.rekap_status || '(belum ada)'}</span></div>
            </div>
          </Card>

          {/* ── Tabel Harian ─────────────────────────────────────────────── */}
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-600">Tabel Harian</p>
              <span className="text-xs text-gray-400">{dailyTampil.length} / {data.daily.length} hari</span>
            </div>
            <Input placeholder="Cari tanggal, hari, atau status…" value={cari} onChange={(e) => setCari(e.target.value)} />
            {dailyTampil.length === 0
              ? <EmptyState pesan="Tidak ada baris yang cocok dengan pencarian." />
              : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        {([
                          ['tanggal', 'Tanggal'], ['jml_taruna_pesanan', 'Jml Taruna'],
                          ['status_pesanan', 'Pesanan'], ['status_realisasi', 'Realisasi'],
                          ['nominal_hari', 'Nominal']
                        ] as [KolomUrut, string][]).map(([k, label]) => (
                          <th key={k} className="cursor-pointer select-none border-b border-gray-200 px-2 py-2 font-semibold text-gray-600"
                            onClick={() => klikKolom(k)}>
                            {label}{urutKolom === k ? (urutNaik ? ' ▲' : ' ▼') : ''}
                          </th>
                        ))}
                        <th className="border-b border-gray-200 px-2 py-2 font-semibold text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyTampil.map((b) => (
                        <tr key={b.tanggal} className="border-b border-gray-100">
                          <td className="whitespace-nowrap px-2 py-1.5">{b.tanggal} <span className="text-gray-400">({b.hari})</span></td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{b.jml_taruna_pesanan}</td>
                          <td className="px-2 py-1.5">{b.status_pesanan ? <Badge status={b.status_pesanan} /> : <span className="text-gray-300">—</span>}</td>
                          <td className="px-2 py-1.5">{labelStatusRealisasi(b.status_realisasi)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{formatRupiah(b.nominal_hari)}</td>
                          <td className="px-2 py-1.5">
                            {!b.pesanan_id && <span className="text-xs text-red-600">Belum dipesan</span>}
                            {b.pesanan_id && b.status_realisasi === '' && <span className="text-xs text-amber-600">Belum direalisasi</span>}
                            {b.status_realisasi === 'SEBAGIAN' && <span className="text-xs text-amber-600">TTD belum lengkap</span>}
                            {b.status_realisasi === 'SAH' && <span className="text-xs text-emerald-700">Selesai</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </Card>
        </>
      )}
    </div>
  );
}
