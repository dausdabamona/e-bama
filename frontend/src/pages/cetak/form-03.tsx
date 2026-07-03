// /cetak/form-03 (PPK, Admin, Pembina) — Rekap Taruna Tidak Menerima Makan
// (bulanan). Sumber: STATUS_HARIAN + LAMPIRAN. Pola cetak: lihat
// laporan-resmi.tsx — tombol Cetak = window.print(), kop surat print:block.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BulanPicker, bulanIni, labelBulan } from '../../components/bulan-picker';
import { BlokTtd2Kolom } from '../../components/cetak/blok-ttd';
import { KopSurat } from '../../components/cetak/kop-surat';
import { BarisCetak, SelCetak, TabelCetak } from '../../components/cetak/tabel-cetak';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useListCache } from '../../lib/use-list-cache';
import { urlDrive } from '../pesanan/tipe';

interface LampiranRingkas { lamp_id: string; nama_file: string; drive_file_id: string }
interface BarisStatus {
  nit: string; nama: string; prodi: string; tanggal: string; status: string; lampiran: LampiranRingkas[];
}
interface Form03Data { bulan: string; per_status: Record<string, BarisStatus[]>; total: number }

export function HalamanCetakForm03() {
  const nav = useNavigate();
  const [bulan, setBulan] = useState(bulanIni());
  const { data, memuat, galat, refresh } = useListCache<Form03Data>('cetak.form03', { bulan });

  const baris = data
    ? Object.entries(data.per_status)
        .flatMap(([status, list]) => list.map((b) => ({ ...b, status })))
        .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.nama.localeCompare(b.nama))
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <button className="text-sm text-primary" onClick={() => nav('/cetak')}>← Kembali</button>
        {data && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak</Button>}
      </div>
      <h1 className="text-xl font-bold text-primary-dark print:hidden">Form 03 — Rekap Taruna Tidak Menerima Makan</h1>
      <div className="print:hidden"><BulanPicker bulan={bulan} onChange={setBulan} /></div>

      {memuat && !data && <LoadingSpinner label="Memuat data…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}

      {data && (
        <div className="flex flex-col gap-4">
          <KopSurat />
          <div className="text-center">
            <h2 className="text-base font-bold">REKAP TARUNA TIDAK MENERIMA MAKAN</h2>
            <p className="text-sm">Bulan {labelBulan(data.bulan)}</p>
          </div>

          <Card className="overflow-x-auto print:border-0 print:p-0 print:shadow-none">
            {baris.length === 0 ? (
              <p className="text-sm text-gray-400">Tidak ada taruna berstatus tidak menerima makan bulan ini.</p>
            ) : (
              <TabelCetak headers={['No', 'NIT', 'Nama', 'Prodi', 'Status', 'Periode', 'No. Surat Bukti']}>
                {baris.map((b, i) => (
                  <BarisCetak key={`${b.nit}-${b.tanggal}-${i}`}>
                    <SelCetak>{i + 1}</SelCetak>
                    <SelCetak>{b.nit}</SelCetak>
                    <SelCetak>{b.nama}</SelCetak>
                    <SelCetak>{b.prodi}</SelCetak>
                    <SelCetak>{b.status.replace(/_/g, ' ')}</SelCetak>
                    <SelCetak>{b.tanggal}</SelCetak>
                    <SelCetak>
                      {b.lampiran.length > 0
                        ? b.lampiran.map((l) => (
                            <a key={l.lamp_id} href={urlDrive(l.drive_file_id)} target="_blank" rel="noreferrer"
                              className="block text-primary underline print:text-black print:no-underline">
                              {l.nama_file}
                            </a>
                          ))
                        : '-'}
                    </SelCetak>
                  </BarisCetak>
                ))}
              </TabelCetak>
            )}
          </Card>

          <BlokTtd2Kolom
            kiri={{ label: 'Disusun oleh,', jabatan: 'Pembina' }}
            kanan={{ label: 'Mengetahui,', jabatan: 'Pejabat Pembuat Komitmen (PPK)' }}
          />
        </div>
      )}
    </div>
  );
}
