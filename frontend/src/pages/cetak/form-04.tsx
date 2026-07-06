// /cetak/form-04/:bulan (Senat, Pembina, PPK, Admin) — Rekapitulasi Bulanan
// Porsi Makan. Keputusan desain (dikonfirmasi Firdaus): TIDAK ada rincian
// porsi per waktu makan (Sarapan/Siang/Malam) — kolom itu DIHILANGKAN dari
// layout asli karena datanya tidak dilacak sistem, dicatat di footer form.
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BulanPicker, bulanIni, labelBulan } from '../../components/bulan-picker';
import { BlokTtd2Kolom } from '../../components/cetak/blok-ttd';
import { KopSurat } from '../../components/cetak/kop-surat';
import { BarisCetak, SelCetak, TabelCetak } from '../../components/cetak/tabel-cetak';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useListCache } from '../../lib/use-list-cache';
import { formatRupiah } from '../tagihan/tipe';

interface BarisForm04 { tanggal: string; taruna_aktif: number; total_porsi: number; jumlah_biaya: number; kontrak_ditemukan: boolean }
interface KontrakRingkas { kontrak_id: string; penyedia_nama: string; harga_per_porsi: number; harga_per_hari_efektif: number }
interface Form04Data {
  bulan: string; baris: BarisForm04[]; total_taruna_aktif: number; total_porsi: number;
  total_biaya: number; kontrak_ringkas: KontrakRingkas[];
}

export function HalamanCetakForm04() {
  const nav = useNavigate();
  const { bulan: bulanParam } = useParams<{ bulan?: string }>();
  const [bulan, setBulan] = useState(bulanParam || bulanIni());
  const { data, memuat, galat, refresh } = useListCache<Form04Data>('cetak.form04', { bulan });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <button className="text-sm text-primary" onClick={() => nav(-1)}>← Kembali</button>
        {data && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak</Button>}
      </div>
      <h1 className="text-xl font-bold text-primary-dark print:hidden">Form 04 — Rekapitulasi Bulanan Porsi Makan</h1>

      {!bulanParam && (
        <div className="print:hidden"><BulanPicker bulan={bulan} onChange={setBulan} /></div>
      )}

      {memuat && !data && <LoadingSpinner label="Memuat data…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}

      {data && (
        <div className="flex flex-col gap-4 cetak-landscape">
          <KopSurat />
          <div className="text-center">
            <h2 className="text-base font-bold">REKAPITULASI BULANAN PORSI MAKAN</h2>
            <p className="text-sm">Bulan {labelBulan(data.bulan)}</p>
          </div>

          <Card className="print:border-0 print:p-0 print:shadow-none">
            {data.kontrak_ringkas.length === 0 && (
              <p className="text-xs text-gray-400 print:text-black">Tidak ada kontrak aktif ditemukan pada bulan ini.</p>
            )}
            {data.kontrak_ringkas.map((k) => (
              <div key={k.kontrak_id} className="flex justify-between border-b border-gray-100 py-1 text-xs">
                <span className="text-gray-500 print:text-black">Kontrak {k.kontrak_id} — {k.penyedia_nama || '-'}</span>
                <span className="font-medium">{formatRupiah(k.harga_per_hari_efektif)}/hari</span>
              </div>
            ))}
          </Card>

          <Card className="overflow-x-auto print:border-0 print:p-0 print:shadow-none">
            <TabelCetak headers={['No', 'Tanggal', 'Taruna Aktif', 'Total Porsi', 'Jumlah Biaya', 'Ket']}>
              {data.baris.map((b, i) => (
                <BarisCetak key={b.tanggal}>
                  <SelCetak>{i + 1}</SelCetak>
                  <SelCetak>{b.tanggal}</SelCetak>
                  <SelCetak className="text-right">{b.taruna_aktif}</SelCetak>
                  <SelCetak className="text-right">{b.total_porsi}</SelCetak>
                  <SelCetak className="text-right">{formatRupiah(b.jumlah_biaya)}</SelCetak>
                  <SelCetak>{b.kontrak_ditemukan ? '' : 'Kontrak tidak ditemukan'}</SelCetak>
                </BarisCetak>
              ))}
              <BarisCetak>
                <td colSpan={3} className="border border-gray-300 px-2 py-1 font-bold">JUMLAH TOTAL SATU BULAN</td>
                <SelCetak className="text-right font-bold">{data.total_porsi}</SelCetak>
                <SelCetak className="text-right font-bold">{formatRupiah(data.total_biaya)}</SelCetak>
                <SelCetak></SelCetak>
              </BarisCetak>
            </TabelCetak>
            <p className="mt-2 text-xs text-gray-400 print:text-black">
              Catatan: skema e-BAMA belum memisahkan porsi per waktu makan (Sarapan/Siang/Malam) —
              kolom itu DIHILANGKAN dari format asli, angka di atas adalah total porsi harian.
            </p>
          </Card>

          <BlokTtd2Kolom
            kiri={{ label: 'Disusun oleh,', jabatan: 'Senat Taruna' }}
            kanan={{ label: 'Diverifikasi oleh,', jabatan: 'Pembina' }}
          />
        </div>
      )}
    </div>
  );
}
