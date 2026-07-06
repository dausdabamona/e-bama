// /tagihan/status-debet — laporan status debet taruna→Senat per taruna
// (berhasil/gagal) untuk satu bulan. "Berhasil" adalah INFERENSI (taruna
// yang tidak punya baris Tagihan bulan itu) — sistem tidak punya integrasi
// bank utk konfirmasi sukses aktif, hanya kegagalan yang dicatat manual
// lewat /tagihan/gagal-debet.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BulanPicker, bulanIni } from '../../components/bulan-picker';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useListCache } from '../../lib/use-list-cache';
import { formatRupiah } from './tipe';

interface BarisStatusDebet {
  nit: string; nama: string; prodi: string; tingkat: string;
  nominal: number; status_debet: 'BERHASIL' | 'GAGAL';
  tagihan_id: string; sebab: string; status_tagihan: string;
}
interface StatusDebetData {
  bulan: string; baris: BarisStatusDebet[];
  total_taruna: number; jml_berhasil: number; jml_gagal: number;
}

export function HalamanStatusDebet() {
  const [bulan, setBulan] = useState(bulanIni());
  const { data, memuat, galat, refresh } = useListCache<StatusDebetData>('tagihan.status_debet', { bulan });

  const gagal = (data?.baris ?? []).filter((b) => b.status_debet === 'GAGAL');
  const berhasil = (data?.baris ?? []).filter((b) => b.status_debet === 'BERHASIL');

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-primary-dark">Status Debet Taruna → Senat</h1>
      <BulanPicker bulan={bulan} onChange={setBulan} />

      {memuat && !data && <LoadingSpinner label="Memuat status debet…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}
      {data && data.baris.length === 0 && <EmptyState pesan="Belum ada rekap bernominal untuk bulan ini." />}

      {data && data.baris.length > 0 && (
        <>
          <p className="text-xs text-gray-500">
            "Berhasil" = taruna yang TIDAK tercatat gagal debet bulan ini
            (kesimpulan dari ketiadaan Tagihan, bukan konfirmasi sukses aktif
            dari bank). "Gagal" = tercatat di{' '}
            <Link to="/tagihan" className="text-primary underline">Tagihan</Link>, apa pun status penyelesaiannya.
          </p>

          <div className="grid grid-cols-3 gap-3">
            <Card className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Total Taruna</span>
              <span className="text-lg font-bold">{data.total_taruna}</span>
            </Card>
            <Card className="flex flex-col gap-1 bg-green-50">
              <span className="text-xs text-green-700">Berhasil</span>
              <span className="text-lg font-bold text-green-800">{data.jml_berhasil}</span>
            </Card>
            <Card className="flex flex-col gap-1 bg-red-50">
              <span className="text-xs text-red-700">Gagal</span>
              <span className="text-lg font-bold text-red-800">{data.jml_gagal}</span>
            </Card>
          </div>

          {gagal.length > 0 && (
            <Card className="overflow-x-auto">
              <p className="mb-2 text-sm font-semibold text-red-700">❌ Gagal Debet ({gagal.length})</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-1 pr-2">NIT</th>
                    <th className="py-1 pr-2">Nama</th>
                    <th className="py-1 pr-2">Prodi/Tingkat</th>
                    <th className="py-1 pr-2 text-right">Nominal</th>
                    <th className="py-1 pr-2">Sebab</th>
                    <th className="py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {gagal.map((b) => (
                    <tr key={b.nit} className="border-b border-gray-100">
                      <td className="py-1 pr-2">{b.nit}</td>
                      <td className="py-1 pr-2">{b.nama}</td>
                      <td className="py-1 pr-2">{b.prodi} / {b.tingkat}</td>
                      <td className="py-1 pr-2 text-right">{formatRupiah(b.nominal)}</td>
                      <td className="py-1 pr-2 text-xs">{b.sebab.replace(/_/g, ' ')}</td>
                      <td className="py-1">
                        <Link to={`/tagihan/${b.tagihan_id}`} className="text-xs text-primary underline">
                          {b.status_tagihan}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          <div>
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-green-700">
                ✅ Berhasil ({berhasil.length})
              </summary>
              <Card className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="py-1 pr-2">NIT</th>
                      <th className="py-1 pr-2">Nama</th>
                      <th className="py-1 pr-2">Prodi/Tingkat</th>
                      <th className="py-1 text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {berhasil.map((b) => (
                      <tr key={b.nit} className="border-b border-gray-100">
                        <td className="py-1 pr-2">{b.nit}</td>
                        <td className="py-1 pr-2">{b.nama}</td>
                        <td className="py-1 pr-2">{b.prodi} / {b.tingkat}</td>
                        <td className="py-1 text-right">{formatRupiah(b.nominal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </details>
          </div>
        </>
      )}
    </div>
  );
}
