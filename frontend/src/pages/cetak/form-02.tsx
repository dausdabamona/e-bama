// /cetak/form-02/:tgl (Pembina, PPK, Admin) — Daftar Hadir / Tanda Terima
// Makan. Keputusan desain (dikonfirmasi Firdaus): TIDAK ada pencatatan
// kehadiran individual di sistem — tanda tangan digital Pembina+Senat di
// REALISASI (ttd_pembina_at/ttd_senat_at) sudah jadi bukti tanda terima sah,
// jadi TIDAK ADA kolom paraf Pagi/Siang/Malam seperti format kertas asli;
// diganti kolom "Status" tunggal + catatan footer yang menjelaskan ini.
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { KopSurat } from '../../components/cetak/kop-surat';
import { SelCetak } from '../../components/cetak/tabel-cetak';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { kelompokProdiTingkat } from '../../lib/kelompok-prodi-tingkat';
import { useListCache } from '../../lib/use-list-cache';

interface TarunaBerhak { nit: string; nama: string; prodi: string; tingkat: string; kelas: string }
interface RealisasiRingkas { porsi_diterima: number; jml_taruna_makan: number; ttd_pembina_at: string; ttd_senat_at: string }
interface Form02Data { tanggal: string; taruna: TarunaBerhak[]; jml_taruna: number; realisasi: RealisasiRingkas | null }

function hariIni(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HalamanCetakForm02() {
  const nav = useNavigate();
  const { tgl: tglParam } = useParams<{ tgl?: string }>();
  const [tgl, setTgl] = useState(tglParam || hariIni());
  const { data, memuat, galat, refresh } = useListCache<Form02Data>('cetak.form02', { tanggal: tgl });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <button className="text-sm text-primary" onClick={() => nav(-1)}>← Kembali</button>
        {data && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak</Button>}
      </div>
      <h1 className="text-xl font-bold text-primary-dark print:hidden">Form 02 — Daftar Hadir / Tanda Terima Makan</h1>

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
        <div className="flex flex-col gap-4 cetak-landscape">
          <KopSurat />
          <div className="text-center">
            <h2 className="text-base font-bold">DAFTAR HADIR / TANDA TERIMA MAKAN</h2>
            <p className="text-sm">Tanggal {data.tanggal}</p>
          </div>

          <Card className="overflow-x-auto print:border-0 print:p-0 print:shadow-none">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  {['No', 'NIT', 'Nama', 'Prodi/Tingkat', 'Status'].map((h) => (
                    <th key={h} className="border border-gray-400 bg-[#D9E2F3] px-2 py-1 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              {kelompokProdiTingkat(data.taruna, (t) => t.prodi, (t) => t.tingkat).map((pt) => (
                <tbody key={`${pt.prodi}|${pt.tingkat}`}>
                  <tr className="bg-primary-light/30 print:bg-gray-100">
                    <td colSpan={5} className="border border-gray-300 px-2 py-1 font-semibold text-primary-dark print:text-black">
                      {pt.prodi} / {pt.tingkat}
                    </td>
                  </tr>
                  {pt.rows.map((t, i) => (
                    <tr key={t.nit}>
                      <SelCetak>{i + 1}</SelCetak>
                      <SelCetak>{t.nit}</SelCetak>
                      <SelCetak>{t.nama}</SelCetak>
                      <SelCetak>{t.prodi} · Tk.{t.tingkat} · {t.kelas}</SelCetak>
                      <SelCetak>Hadir / berhak makan</SelCetak>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td colSpan={5} className="border border-gray-300 px-2 py-1">
                      Subtotal {pt.prodi} / {pt.tingkat} ({pt.rows.length} taruna)
                    </td>
                  </tr>
                </tbody>
              ))}
            </table>
            <p className="mt-2 text-sm font-semibold">Jumlah Taruna Berhak Makan: {data.jml_taruna} orang</p>
          </Card>

          <Card className="print:border-0 print:p-0 print:shadow-none">
            <p className="text-xs text-gray-500 print:text-black">
              Tanda terima diwakili tanda tangan digital Pembina &amp; Senat pada Realisasi tanggal ini
              (Pembina: {data.realisasi?.ttd_pembina_at || 'belum ttd'}; Senat: {data.realisasi?.ttd_senat_at || 'belum ttd'}),
              BUKAN paraf per-taruna — skema e-BAMA tidak mencatat kehadiran individual (keputusan desain,
              lihat <code>docs/kontrak-api.md</code>).
            </p>
            {data.realisasi && (
              <p className="mt-1 text-xs text-gray-500 print:text-black">
                Porsi diterima: {data.realisasi.porsi_diterima} · Taruna makan (realisasi): {data.realisasi.jml_taruna_makan} orang.
              </p>
            )}
          </Card>

          <div className="mt-8 flex justify-end text-center text-xs">
            <div className="w-56">
              <p>Mengetahui,</p>
              <p>Pembina Karakter/Kesiswaan</p>
              <div className="mt-12 font-semibold">&nbsp;</div>
              <p className="border-t border-black pt-0.5">(...........................)</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
