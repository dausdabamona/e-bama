// /taruna/rekap-harian — Rekapitulasi Harian Taruna: tampilan DALAM APP +
// cetak PDF (SATU halaman, sama pola seperti form-05.tsx — konten yang sama
// dipakai layar & cetak, KopSurat/blok TTD HANYA tampak saat print). Ini
// rekonsiliasi 3 titik versi HARIAN (per Prodi+Tingkat), pelengkap Form-05
// (BA Rekonsiliasi 3 Titik) yang agregat harian tanpa rincian per kelompok.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BlokTtd2Kolom } from '../../components/cetak/blok-ttd';
import { KopSurat } from '../../components/cetak/kop-surat';
import { BarisCetak, SelCetak, TabelCetak } from '../../components/cetak/tabel-cetak';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useListCache } from '../../lib/use-list-cache';

interface Kelompok {
  prodi: string; tingkat: string;
  aktif: number; tidak_makan: number; luar_kampus: number; makan: number;
}
interface RekapHarianData {
  tanggal: string;
  per_kelompok: Kelompok[];
  total: { aktif: number; tidak_makan: number; luar_kampus: number; makan: number };
  realisasi: { dipesan: number; dimakan: number; selisih: number } | null;
}

function hariIni(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HalamanRekapHarianTaruna() {
  const nav = useNavigate();
  const [tanggal, setTanggal] = useState(hariIni());
  const { data, memuat, galat, refresh } = useListCache<RekapHarianData>('rekap.harian', { tanggal });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <button className="text-sm text-primary" onClick={() => nav(-1)}>← Kembali</button>
        {data && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak</Button>}
      </div>
      <h1 className="text-xl font-bold text-primary-dark print:hidden">Rekap Harian Taruna</h1>

      <div className="print:hidden">
        <label className="mb-1 block text-sm font-medium text-gray-700">Tanggal</label>
        <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)}
          className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5" />
      </div>

      {memuat && !data && <LoadingSpinner label="Memuat rekap harian…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}
      {data && data.per_kelompok.length === 0 && <EmptyState pesan="Tidak ada taruna aktif." />}

      {data && data.per_kelompok.length > 0 && (
        <div className="flex flex-col gap-4">
          <KopSurat />
          <div className="text-center">
            <h2 className="text-base font-bold">REKAPITULASI HARIAN TARUNA</h2>
            <p className="text-sm">Tanggal {data.tanggal}</p>
          </div>

          {/* Kartu total — hanya layar, kop+tabel sudah cukup untuk cetak */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:hidden">
            <KartuStat label="Aktif" nilai={data.total.aktif} />
            <KartuStat label="Tidak Makan" nilai={data.total.tidak_makan} />
            <KartuStat label="Luar Kampus" nilai={data.total.luar_kampus} />
            <KartuStat label="Makan" nilai={data.total.makan} tekankan />
          </div>

          <Card className="overflow-x-auto print:border-0 print:p-0 print:shadow-none">
            <TabelCetak headers={['Prodi / Tingkat', 'Aktif', 'Tidak Makan', 'Luar Kampus', 'Makan']}>
              {data.per_kelompok.map((k) => (
                <BarisCetak key={`${k.prodi}|${k.tingkat}`}>
                  <SelCetak>{k.prodi || 'Lainnya'} / {k.tingkat || '?'}</SelCetak>
                  <SelCetak className="text-right">{k.aktif}</SelCetak>
                  <SelCetak className="text-right">{k.tidak_makan}</SelCetak>
                  <SelCetak className="text-right">{k.luar_kampus}</SelCetak>
                  <SelCetak className="text-right">{k.makan}</SelCetak>
                </BarisCetak>
              ))}
              <BarisCetak>
                <SelCetak className="font-bold">JUMLAH</SelCetak>
                <SelCetak className="text-right font-bold">{data.total.aktif}</SelCetak>
                <SelCetak className="text-right font-bold">{data.total.tidak_makan}</SelCetak>
                <SelCetak className="text-right font-bold">{data.total.luar_kampus}</SelCetak>
                <SelCetak className="text-right font-bold">{data.total.makan}</SelCetak>
              </BarisCetak>
            </TabelCetak>
          </Card>

          {data.realisasi && (
            <Card className="overflow-x-auto print:border-0 print:p-0 print:shadow-none">
              <p className="mb-2 text-sm font-semibold text-gray-600 print:text-black">
                Rekonsiliasi ke Pesanan &amp; Realisasi
              </p>
              <TabelCetak headers={['Dipesan', 'Dimakan (Realisasi)', 'Selisih']}>
                <BarisCetak>
                  <SelCetak className="text-right">{data.realisasi.dipesan}</SelCetak>
                  <SelCetak className="text-right">{data.realisasi.dimakan}</SelCetak>
                  <SelCetak className="text-right">{data.realisasi.selisih}</SelCetak>
                </BarisCetak>
              </TabelCetak>
            </Card>
          )}

          <p className="text-xs text-gray-500 print:text-black">
            Rujukan: rekonsiliasi harian mengikuti prinsip yang sama dengan
            Form-05 (BA Rekonsiliasi 3 Titik) — Taruna Aktif dikurangi Status
            Harian (Tidak Makan + Luar Kampus) menghasilkan jumlah Makan dalam
            kampus, dipecah per Prodi &amp; Tingkat.
          </p>

          <BlokTtd2Kolom
            kiri={{ label: 'Mengetahui,', jabatan: 'Pembina Taruna' }}
            kanan={{ label: 'Menyetujui,', jabatan: 'Pejabat Pembuat Komitmen (PPK)' }}
          />
        </div>
      )}
    </div>
  );
}

function KartuStat({ label, nilai, tekankan }: { label: string; nilai: number; tekankan?: boolean }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={tekankan ? 'text-lg font-bold text-primary-dark' : 'text-lg font-bold'}>
        {nilai.toLocaleString('id-ID')}
      </span>
    </Card>
  );
}
