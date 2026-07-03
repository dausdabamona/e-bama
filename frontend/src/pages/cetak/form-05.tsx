// /cetak/form-05/:tgl (Pembina, PPK, Admin) — BA Rekonsiliasi 3 Titik.
// Titik 1/2/3 + selisih dihitung backend (lihat 21_cetak.gs). Kolom
// "Penjelasan/Penyebab" SENGAJA tidak diisi otomatis — wajib diketik manual
// oleh Pembina di sini (state lokal, TIDAK dikirim ke server), sama seperti
// pola field manual di laporan-resmi.tsx.
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BlokTtd2Kolom } from '../../components/cetak/blok-ttd';
import { KopSurat } from '../../components/cetak/kop-surat';
import { BarisCetak, SelCetak, TabelCetak } from '../../components/cetak/tabel-cetak';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useListCache } from '../../lib/use-list-cache';

interface Form05Data {
  tanggal: string;
  titik1_taruna_berhak: number;
  titik2_total_pesanan: number;
  titik3_total_realisasi: number;
  selisih_titik1_titik2: number;
  selisih_titik2_titik3: number;
  cocok: boolean;
  ada_pesanan: boolean;
  ada_realisasi: boolean;
  ketidaksesuaian: string;
  tindak_lanjut: string;
  cek_otomatis: { label: string; cocok: boolean };
}

function hariIni(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HalamanCetakForm05() {
  const nav = useNavigate();
  const { tgl: tglParam } = useParams<{ tgl?: string }>();
  const [tgl, setTgl] = useState(tglParam || hariIni());
  const { data, memuat, galat, refresh } = useListCache<Form05Data>('cetak.form05', { tanggal: tgl });

  // ── Diisi manual oleh Pembina — state lokal, TIDAK tersimpan ke server ──
  const [penjelasan, setPenjelasan] = useState('');
  const [anomali2, setAnomali2] = useState(false);
  const [anomali3, setAnomali3] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <button className="text-sm text-primary" onClick={() => nav(-1)}>← Kembali</button>
        {data && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak</Button>}
      </div>
      <h1 className="text-xl font-bold text-primary-dark print:hidden">Form 05 — BA Rekonsiliasi 3 Titik</h1>

      {!tglParam && (
        <div className="print:hidden">
          <label className="mb-1 block text-sm font-medium text-gray-700">Tanggal</label>
          <input type="date" value={tgl} onChange={(e) => setTgl(e.target.value)}
            className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5" />
        </div>
      )}

      {memuat && !data && <LoadingSpinner label="Memuat data…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}

      {data && (
        <div className="flex flex-col gap-4">
          <KopSurat />
          <div className="text-center">
            <h2 className="text-base font-bold">BERITA ACARA REKONSILIASI 3 TITIK</h2>
            <p className="text-sm">Tanggal {data.tanggal}</p>
          </div>

          <Card className="overflow-x-auto print:border-0 print:p-0 print:shadow-none">
            <p className="mb-2 text-sm font-semibold text-gray-600 print:text-black">Rekonsiliasi Jumlah Taruna</p>
            <TabelCetak headers={['Titik', 'Uraian', 'Sumber Data', 'Jumlah']}>
              <BarisCetak>
                <SelCetak>1</SelCetak>
                <SelCetak>Taruna berhak makan</SelCetak>
                <SelCetak>Taruna AKTIF − Status Harian</SelCetak>
                <SelCetak className="text-right">{data.titik1_taruna_berhak}</SelCetak>
              </BarisCetak>
              <BarisCetak>
                <SelCetak>2</SelCetak>
                <SelCetak>Taruna dipesan</SelCetak>
                <SelCetak>{data.ada_pesanan ? 'PESANAN.jml_taruna' : 'Belum ada Pesanan tanggal ini'}</SelCetak>
                <SelCetak className="text-right">{data.titik2_total_pesanan}</SelCetak>
              </BarisCetak>
              <BarisCetak>
                <SelCetak>3</SelCetak>
                <SelCetak>Taruna yang makan (realisasi)</SelCetak>
                <SelCetak>{data.ada_realisasi ? 'REALISASI.jml_taruna_makan' : 'Belum ada Realisasi tanggal ini'}</SelCetak>
                <SelCetak className="text-right">{data.titik3_total_realisasi}</SelCetak>
              </BarisCetak>
            </TabelCetak>
          </Card>

          <Card className="overflow-x-auto print:border-0 print:p-0 print:shadow-none">
            <p className="mb-2 text-sm font-semibold text-gray-600 print:text-black">Analisis Selisih</p>
            <TabelCetak headers={['Perbandingan', 'Selisih', 'Status']}>
              <BarisCetak>
                <SelCetak>Titik 1 − Titik 2</SelCetak>
                <SelCetak className="text-right">{data.selisih_titik1_titik2}</SelCetak>
                <SelCetak>{data.selisih_titik1_titik2 === 0 ? 'Sesuai' : 'Ada selisih'}</SelCetak>
              </BarisCetak>
              <BarisCetak>
                <SelCetak>Titik 2 − Titik 3</SelCetak>
                <SelCetak className="text-right">{data.selisih_titik2_titik3}</SelCetak>
                <SelCetak>{data.selisih_titik2_titik3 === 0 ? 'Sesuai' : 'Ada selisih'}</SelCetak>
              </BarisCetak>
            </TabelCetak>
            <p className={`mt-2 text-sm font-bold ${data.cocok ? 'text-primary' : 'text-red-600'} print:text-black`}>
              Kesimpulan: {data.cocok ? 'KETIGA TITIK REKONSILIASI SESUAI' : 'TERDAPAT KETIDAKSESUAIAN — lihat penjelasan di bawah'}
            </p>
          </Card>

          <Card className="flex flex-col gap-2 print:border-0 print:p-0 print:shadow-none">
            <p className="text-sm font-semibold text-gray-600 print:text-black">Checklist Anomali</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={data.cek_otomatis.cocok} readOnly disabled className="h-4 w-4" />
              {data.cek_otomatis.label} <span className="text-xs text-gray-400 print:hidden">(otomatis)</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={anomali2} onChange={(e) => setAnomali2(e.target.checked)} className="h-4 w-4" />
              Selisih Titik 1/Titik 2 (bila ada) sudah diverifikasi wajar oleh Pembina
              <span className="text-xs text-gray-400 print:hidden">(manual)</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={anomali3} onChange={(e) => setAnomali3(e.target.checked)} className="h-4 w-4" />
              Selisih Titik 2/Titik 3 (bila ada) sudah diverifikasi wajar oleh Pembina
              <span className="text-xs text-gray-400 print:hidden">(manual)</span>
            </label>
          </Card>

          <Card className="flex flex-col gap-2 print:border-0 print:p-0 print:shadow-none">
            <p className="text-sm font-semibold text-gray-600 print:text-black">Penjelasan / Penyebab</p>
            {(data.ketidaksesuaian || data.tindak_lanjut) && (
              <p className="text-xs text-gray-400 print:text-black">
                Catatan Realisasi: {data.ketidaksesuaian || '-'}{data.tindak_lanjut ? ` — Tindak lanjut: ${data.tindak_lanjut}` : ''}
              </p>
            )}
            <textarea rows={3} value={penjelasan} onChange={(e) => setPenjelasan(e.target.value)}
              placeholder="Wajib diisi manual oleh Pembina sebelum dicetak — bukan diisi/dikarang otomatis oleh sistem."
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs print:border-0 print:border-b print:border-dotted" />
          </Card>

          <BlokTtd2Kolom
            kiri={{ label: 'Merekonsiliasi,', jabatan: 'Pembina Taruna' }}
            kanan={{ label: 'Menyetujui,', jabatan: 'Pejabat Pembuat Komitmen (PPK)' }}
          />
        </div>
      )}
    </div>
  );
}
