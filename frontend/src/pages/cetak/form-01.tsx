// /cetak/form-01/:tgl (Senat, Pembina, PPK, Admin) — Rencana & Persetujuan
// Pemesanan Makan Harian (H-1). Sumber: PESANAN+KONTRAK. Skema TIDAK
// memisahkan porsi per waktu makan — sengaja TIDAK mengarang rincian
// Sarapan/Siang/Malam, hanya total porsi harian (lihat catatan di halaman).
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BlokTtd3Berjenjang } from '../../components/cetak/blok-ttd';
import { KopSurat } from '../../components/cetak/kop-surat';
import { BarisCetak, SelCetak, TabelCetak } from '../../components/cetak/tabel-cetak';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useListCache } from '../../lib/use-list-cache';
import { formatRupiah } from '../tagihan/tipe';

interface PesananRingkas {
  pesanan_id: string; tgl_makan: string; jml_taruna: number; menu: string; catatan: string; status: string;
}
interface KontrakRingkas { kontrak_id: string; harga_per_porsi: number; porsi_per_hari: number }
interface Form01Data {
  pesanan: PesananRingkas; kontrak: KontrakRingkas | null; jml_status_harian: number;
  dibuat_oleh_nama: string; diverifikasi_oleh_nama: string; verif_at: string;
}

const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
function hariIndonesia(tgl: string): string {
  const d = new Date(tgl + 'T00:00:00');
  return isNaN(d.getTime()) ? '' : NAMA_HARI[d.getDay()];
}
function hariIni(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HalamanCetakForm01() {
  const nav = useNavigate();
  const { tgl: tglParam } = useParams<{ tgl?: string }>();
  const [tgl, setTgl] = useState(tglParam || hariIni());
  const { data, memuat, galat, refresh } = useListCache<Form01Data>('cetak.form01', { tgl_makan: tgl });

  const kontrak = data?.kontrak ?? null;
  const totalBiaya = data && kontrak ? data.pesanan.jml_taruna * kontrak.harga_per_porsi * kontrak.porsi_per_hari : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <button className="text-sm text-primary" onClick={() => nav(-1)}>← Kembali</button>
        {data && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak</Button>}
      </div>
      <h1 className="text-xl font-bold text-primary-dark print:hidden">Form 01 — Rencana & Persetujuan Pemesanan Harian</h1>

      {!tglParam && (
        <div className="print:hidden">
          <label className="mb-1 block text-sm font-medium text-gray-700">Tanggal Makan</label>
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
            <h2 className="text-base font-bold">RENCANA &amp; PERSETUJUAN PEMESANAN MAKAN HARIAN (H-1)</h2>
          </div>

          <Card className="print:border-0 print:p-0 print:shadow-none">
            <div className="flex justify-between border-b border-gray-100 py-1 text-sm">
              <span className="text-gray-500 print:text-black">Hari</span>
              <span className="font-medium">{hariIndonesia(data.pesanan.tgl_makan)}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 py-1 text-sm">
              <span className="text-gray-500 print:text-black">Tanggal</span>
              <span className="font-medium">{data.pesanan.tgl_makan}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 py-1 text-sm">
              <span className="text-gray-500 print:text-black">Menu</span>
              <span className="font-medium">{data.pesanan.menu}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 py-1 text-sm">
              <span className="text-gray-500 print:text-black">Status Pesanan</span>
              <span className="font-medium">{data.pesanan.status.replace(/_/g, ' ')}</span>
            </div>
          </Card>

          <Card className="overflow-x-auto print:border-0 print:p-0 print:shadow-none">
            <p className="mb-2 text-sm font-semibold text-gray-600 print:text-black">Rincian Jumlah &amp; Biaya</p>
            <TabelCetak headers={['Uraian', 'Jumlah Taruna', 'Porsi/Hari', 'Harga/Porsi', 'Jumlah Biaya']}>
              <BarisCetak>
                <SelCetak>Total Porsi Harian</SelCetak>
                <SelCetak>{data.pesanan.jml_taruna}</SelCetak>
                <SelCetak>{kontrak ? kontrak.porsi_per_hari : '-'}</SelCetak>
                <SelCetak>{kontrak ? formatRupiah(kontrak.harga_per_porsi) : '-'}</SelCetak>
                <SelCetak>{formatRupiah(totalBiaya)}</SelCetak>
              </BarisCetak>
            </TabelCetak>
            <div className="mt-2 flex justify-between text-sm font-bold">
              <span>JUMLAH TOTAL</span>
              <span>{formatRupiah(totalBiaya)}</span>
            </div>
            <p className="mt-2 text-xs text-gray-400 print:text-black">
              Catatan: skema e-BAMA belum memisahkan porsi per waktu makan
              (Sarapan/Siang/Malam) — angka di atas adalah total porsi harian,
              BUKAN rincian per waktu makan.
            </p>
          </Card>

          <Card className="flex flex-col gap-2 print:border-0 print:p-0 print:shadow-none">
            <p className="text-sm font-semibold text-gray-600 print:text-black">Catatan</p>
            <div className="text-xs">
              <p className="text-gray-500 print:text-black">Catatan Senat:</p>
              <p className="min-h-[1.5em] border-b border-dotted border-gray-400">{data.pesanan.catatan || ''}</p>
            </div>
            <div className="text-xs">
              <p className="text-gray-500 print:text-black">Catatan Pembina:</p>
              <p className="min-h-[1.5em] border-b border-dotted border-gray-400">
                {data.diverifikasi_oleh_nama ? `Diverifikasi oleh ${data.diverifikasi_oleh_nama}${data.verif_at ? ' pada ' + data.verif_at : ''}` : ''}
              </p>
            </div>
            <div className="text-xs">
              <p className="text-gray-500 print:text-black">Catatan PPK:</p>
              <p className="min-h-[1.5em] border-b border-dotted border-gray-400"></p>
            </div>
          </Card>

          <Card className="border-2 border-black text-center text-sm font-bold print:border print:shadow-none">
            DITERUSKAN KE PENYEDIA (H-1) — {data.pesanan.status === 'TERKIRIM' ? 'SUDAH TERKIRIM' : 'BELUM TERKIRIM'}
          </Card>

          <p className="text-xs text-gray-400 print:text-black">
            <strong>Penting:</strong> PPK <strong>tidak</strong> menyetujui pesanan harian di sistem —
            Pembina adalah satu-satunya verifikator (lihat <code>docs/skema-sheet.md</code>).
            Kolom tanda tangan PPK di bawah ini bersifat administratif/arsip
            sesuai Form-01, BUKAN indikasi bahwa sistem meminta persetujuan PPK per hari.
          </p>

          <BlokTtd3Berjenjang
            pihak1={{ label: 'Diajukan oleh,', jabatan: 'Senat', nama: data.dibuat_oleh_nama }}
            pihak2={{ label: 'Diverifikasi oleh,', jabatan: 'Pembina', nama: data.diverifikasi_oleh_nama, tanggal: data.verif_at }}
            pihak3={{ label: 'Mengetahui (administratif/arsip),', jabatan: 'Pejabat Pembuat Komitmen (PPK)' }}
          />
        </div>
      )}
    </div>
  );
}
