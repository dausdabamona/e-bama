// /cetak/form-06/:bulan (PPK, KPA, Admin) — Verifikasi & Rencana Pembayaran
// PPK. Backend menolak kalau rekap bulan itu belum FINAL (lihat 21_cetak.gs).
// Checklist 8 dokumen kelengkapan disederhanakan jadi checkbox manual di sini
// (belum ada sumber data terstruktur untuk itu) — status LENGKAP/TIDAK LENGKAP
// dan checklist adalah state lokal, TIDAK dikirim ke server.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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

interface BarisForm06 { nit: string; nama: string; hari_makan: number; nominal: number }
interface Pejabat { nama: string; nip: string }
interface Form06Data {
  bulan: string; baris: BarisForm06[]; total_taruna: number; total_hari_makan: number;
  total_nominal: number; nominal_terbilang: string; pejabat: { PPK: Pejabat; KPA: Pejabat };
}

const DAFTAR_DOKUMEN = [
  'SK KPA tentang Penetapan Nama Penerima Bantuan',
  'SK PPK tentang Nomor Rekening & Nilai Dibayarkan',
  'Kontrak Penyediaan Makan & Persetujuan PPK',
  'Form 02 — Daftar Hadir/Tanda Terima Makan (lengkap)',
  'Form 03 — Rekap Taruna Tidak Menerima Makan + bukti',
  'Form 04 — Rekapitulasi Bulanan Porsi Makan',
  'Form 05 — BA Rekonsiliasi 3 Titik',
  'Persetujuan Kepala Pusdik KP'
];

export function HalamanCetakForm06() {
  const nav = useNavigate();
  const { bulan: bulanParam } = useParams<{ bulan?: string }>();
  const [bulan, setBulan] = useState(bulanParam || bulanIni());
  const { data, memuat, galat, refresh } = useListCache<Form06Data>('cetak.form06', { bulan });

  // ── Diisi manual oleh PPK — state lokal, TIDAK tersimpan ke server ──
  const [checklist, setChecklist] = useState<boolean[]>(() => DAFTAR_DOKUMEN.map(() => false));
  const [kelengkapan, setKelengkapan] = useState<'LENGKAP' | 'TIDAK_LENGKAP' | ''>('');

  function toggleChecklist(i: number) {
    setChecklist((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <button className="text-sm text-primary" onClick={() => nav(-1)}>← Kembali</button>
        {data && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak</Button>}
      </div>
      <h1 className="text-xl font-bold text-primary-dark print:hidden">Form 06 — Verifikasi &amp; Rencana Pembayaran PPK</h1>

      {!bulanParam && (
        <div className="print:hidden"><BulanPicker bulan={bulan} onChange={setBulan} /></div>
      )}

      {memuat && !data && <LoadingSpinner label="Memuat data…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}

      {data && (
        <div className="flex flex-col gap-4">
          <KopSurat />
          <div className="text-center">
            <h2 className="text-base font-bold">VERIFIKASI DAN RENCANA PEMBAYARAN</h2>
            <p className="text-sm">Bulan {labelBulan(data.bulan)}</p>
          </div>

          <Card className="overflow-x-auto print:border-0 print:p-0 print:shadow-none">
            <p className="mb-2 text-sm font-semibold text-gray-600 print:text-black">Rincian Rekap Bulanan (FINAL)</p>
            <TabelCetak headers={['NIT', 'Nama', 'Hari Makan', 'Nominal']}>
              {data.baris.map((b) => (
                <BarisCetak key={b.nit}>
                  <SelCetak>{b.nit}</SelCetak>
                  <SelCetak>{b.nama}</SelCetak>
                  <SelCetak className="text-right">{b.hari_makan}</SelCetak>
                  <SelCetak className="text-right">{formatRupiah(b.nominal)}</SelCetak>
                </BarisCetak>
              ))}
            </TabelCetak>
            <div className="mt-2 flex flex-col gap-1 text-sm">
              <div className="flex justify-between"><span>Jumlah Taruna Penerima</span><span className="font-semibold">{data.total_taruna} orang</span></div>
              <div className="flex justify-between"><span>Total Hari Makan</span><span className="font-semibold">{data.total_hari_makan} OH</span></div>
              <div className="flex justify-between font-bold"><span>TOTAL NOMINAL PEMBAYARAN</span><span>{formatRupiah(data.total_nominal)}</span></div>
            </div>
            <p className="mt-2 text-xs italic text-gray-500 print:text-black">Terbilang: {data.nominal_terbilang}</p>
          </Card>

          <Card className="flex flex-col gap-2 print:border-0 print:p-0 print:shadow-none">
            <p className="text-sm font-semibold text-gray-600 print:text-black">Checklist Kelengkapan Dokumen</p>
            {DAFTAR_DOKUMEN.map((d, i) => (
              <label key={i} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={checklist[i]} onChange={() => toggleChecklist(i)} className="h-4 w-4" />
                <span className="flex-1">{d}</span>
                {d.indexOf('Form 04') === 0 && (
                  <Link to={`/cetak/form-04/${data.bulan}`} className="text-xs text-primary underline print:hidden">Buka →</Link>
                )}
              </label>
            ))}
            <p className="text-xs text-gray-400 print:hidden">
              Diisi manual oleh PPK saat verifikasi — belum ada sumber data terstruktur di sistem untuk dokumen-dokumen ini.
            </p>
          </Card>

          <Card className="flex flex-col gap-2 print:border-0 print:p-0 print:shadow-none">
            <p className="text-sm font-semibold text-gray-600 print:text-black">Status Kelengkapan</p>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="kelengkapan" checked={kelengkapan === 'LENGKAP'}
                  onChange={() => setKelengkapan('LENGKAP')} className="h-4 w-4" />
                LENGKAP
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="kelengkapan" checked={kelengkapan === 'TIDAK_LENGKAP'}
                  onChange={() => setKelengkapan('TIDAK_LENGKAP')} className="h-4 w-4" />
                TIDAK LENGKAP
              </label>
            </div>
          </Card>

          <BlokTtd2Kolom
            kiri={{ label: 'Memverifikasi,', jabatan: 'Pejabat Pembuat Komitmen (PPK)', nama: data.pejabat.PPK.nama, nip: data.pejabat.PPK.nip }}
            kanan={{ label: 'Mengetahui,', jabatan: 'Kuasa Pengguna Anggaran (KPA)', nama: data.pejabat.KPA.nama, nip: data.pejabat.KPA.nip }}
          />
        </div>
      )}
    </div>
  );
}
