// /laporan (PPK, KPA) — laporan bulanan SOP 17-19: rekap+realisasi+pembayaran+piutang.
// Cetak via window.print() dengan CSS print rapi (lihat index.css @media print).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BulanPicker, bulanIni, labelBulan } from '../../components/bulan-picker';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useListCache } from '../../lib/use-list-cache';
import { formatRupiah } from '../tagihan/tipe';

interface Laporan {
  bulan: string;
  rekap: { jml_taruna: number; total_hari_makan: number; total_nominal: number; status: string };
  realisasi: { jml_hari_sah: number; jml_ketidaksesuaian: number; jml_catatan: number };
  pembayaran: { bayar_id: string; status: string; nilai_total: number; no_spm: string; no_sp2d: string } | null;
  tagihan: { jumlah: number; per_status: Record<string, number>; total_outstanding: number };
}

export function HalamanLaporan() {
  const [bulan, setBulan] = useState(bulanIni());
  const { data, memuat, galat, refresh } = useListCache<Laporan>('laporan.bulanan', { bulan });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-bold text-primary-dark">Laporan Bulanan</h1>
        {data && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak</Button>}
      </div>
      <div className="print:hidden"><BulanPicker bulan={bulan} onChange={setBulan} /></div>
      <Link to="/laporan/resmi" className="text-sm text-primary underline print:hidden">
        📋 Laporan Bulanan Resmi (format Itjen/KKP)
      </Link>

      {memuat && !data && <LoadingSpinner label="Memuat laporan…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}

      {data && (
        <div id="area-cetak" className="flex flex-col gap-4">
          <div className="hidden text-center print:block">
            <h1 className="text-lg font-bold">Laporan Bulanan Bantuan Uang Makan Taruna</h1>
            <p className="text-sm">Politeknik Kelautan dan Perikanan Sorong — {labelBulan(data.bulan)}</p>
          </div>

          <Card>
            <p className="mb-2 font-semibold text-primary-dark">1. Rekapitulasi</p>
            <Baris label="Jumlah Taruna" nilai={String(data.rekap.jml_taruna)} />
            <Baris label="Total Hari Makan" nilai={String(data.rekap.total_hari_makan)} />
            <Baris label="Total Nominal" nilai={formatRupiah(data.rekap.total_nominal)} />
            <Baris label="Status Rekap" nilai={data.rekap.status || '-'} />
          </Card>

          <Card>
            <p className="mb-2 font-semibold text-primary-dark">2. Realisasi</p>
            <Baris label="Hari Realisasi Sah (2 TTD)" nilai={String(data.realisasi.jml_hari_sah)} />
            <Baris label="Jumlah Ketidaksesuaian" nilai={String(data.realisasi.jml_ketidaksesuaian)} />
            <Baris label="Total Baris Realisasi" nilai={String(data.realisasi.jml_catatan)} />
          </Card>

          <Card>
            <p className="mb-2 font-semibold text-primary-dark">3. Pembayaran</p>
            {data.pembayaran ? (
              <>
                <Baris label="No. Pembayaran" nilai={data.pembayaran.bayar_id} />
                <Baris label="Status" nilai={data.pembayaran.status.replace(/_/g, ' ')} />
                <Baris label="Nilai Total" nilai={formatRupiah(data.pembayaran.nilai_total)} />
                <Baris label="No. SPM" nilai={data.pembayaran.no_spm || '-'} />
                <Baris label="No. SP2D" nilai={data.pembayaran.no_sp2d || '-'} />
              </>
            ) : <p className="text-sm text-gray-400">Belum ada pembayaran bulan ini.</p>}
          </Card>

          <Card>
            <p className="mb-2 font-semibold text-primary-dark">4. Piutang (Tagihan Gagal Debet)</p>
            <Baris label="Jumlah Tagihan" nilai={String(data.tagihan.jumlah)} />
            {Object.entries(data.tagihan.per_status).map(([status, n]) => (
              <Baris key={status} label={status.replace(/_/g, ' ')} nilai={String(n)} />
            ))}
            <Baris label="Total Outstanding" nilai={formatRupiah(data.tagihan.total_outstanding)} />
          </Card>
        </div>
      )}
    </div>
  );
}

function Baris({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="flex justify-between border-b border-gray-100 py-1 text-sm last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{nilai}</span>
    </div>
  );
}
