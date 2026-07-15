// /cetak/laporan-penyaluran/:bulan — Laporan Penyaluran ke PENYEDIA (dokumen
// ke-2 pemisahan tagih-ulang). RINCIAN nama taruna + jumlah + tgl setor sebagai
// pertanggungjawaban ke penyedia. TANPA nomor rekening taruna. Total HARUS sama
// dengan Surat Pendebetan ke Bank bulan yang sama.
import { useNavigate, useParams } from 'react-router-dom';
import { labelBulan } from '../../components/bulan-picker';
import { BlokTtd2Kolom, BlokTtdTengah } from '../../components/cetak/blok-ttd';
import { KopSurat } from '../../components/cetak/kop-surat';
import { SelCetak } from '../../components/cetak/tabel-cetak';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useListCache } from '../../lib/use-list-cache';
import { terbilangRupiah } from '../../lib/terbilang';
import { formatRupiah } from '../tagihan/tipe';

interface Pejabat { nama: string; nip: string }
interface Baris { nama: string; prodi: string; tingkat: string; tgl_setor: string; jumlah: number }
interface LaporanData {
  bulan: string; baris: Baris[]; total_nominal: number; penyedia_nama: string;
  pejabat: { PPK: Pejabat; KPA: Pejabat; DIREKTUR: Pejabat; WADIR3: Pejabat };
}

function tglRingkas(s: string): string {
  if (!s) return '-';
  const [y, m, d] = s.split('-');
  return d && m && y ? `${d}/${m}/${y}` : s;
}

export function HalamanCetakLaporanPenyaluranPenyedia() {
  const nav = useNavigate();
  const { bulan = '' } = useParams();
  const { data, memuat, galat, refresh } = useListCache<LaporanData>('cetak.laporan_penyaluran_penyedia', { bulan });

  const baris = data?.baris ?? [];
  const total = data?.total_nominal ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <button className="text-sm text-primary" onClick={() => nav(-1)}>← Kembali</button>
        {baris.length > 0 && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak Laporan</Button>}
      </div>
      <h1 className="text-xl font-bold text-primary-dark print:hidden">Laporan Penyaluran ke Penyedia — {labelBulan(bulan)}</h1>
      <p className="text-xs text-gray-500 print:hidden">
        Pertanggungjawaban ke penyedia: rincian nama taruna + jumlah + tanggal setor. <strong>Tanpa nomor rekening
        taruna.</strong> Total harus sama dengan Surat Pendebetan ke Bank bulan ini.
      </p>

      {memuat && !data && <LoadingSpinner label="Memuat data…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}
      {data && baris.length === 0 && (
        <EmptyState pesan="Tidak ada tagihan LUNAS yang belum diteruskan untuk bulan ini." />
      )}

      {data && baris.length > 0 && (
        <div className="flex flex-col gap-2">
          <KopSurat />
          <div className="text-center">
            <h2 className="text-sm font-bold">LAPORAN PENYALURAN DANA UANG MAKAN (TAGIH-ULANG)</h2>
            <p className="text-xs">Bulan {labelBulan(bulan)}</p>
          </div>
          <p className="text-xs">
            Kepada Yth. Penyedia Jasa Boga{data.penyedia_nama ? ` (a.n. ${data.penyedia_nama})` : ''} — di tempat.
          </p>
          <p className="text-xs leading-relaxed">
            Dengan ini kami laporkan bahwa dana Bantuan Uang Makan berikut telah <strong>disetorkan kembali oleh taruna
            ke rekening Senat Taruna</strong> (setelah gagal auto-debet) dan <strong>diteruskan ke rekening penyedia</strong>{' '}
            untuk bulan {labelBulan(bulan)}, dengan rincian sebagai berikut:
          </p>
          <table className="w-full table-fixed border-collapse text-xs">
            <colgroup>
              <col style={{ width: '6%' }} /><col style={{ width: '40%' }} /><col style={{ width: '16%' }} />
              <col style={{ width: '16%' }} /><col style={{ width: '22%' }} />
            </colgroup>
            <thead>
              <tr>
                {['No', 'Nama Taruna', 'Prodi/Tk', 'Tgl Setor', 'Jumlah (Rp)'].map((h) => (
                  <th key={h} className="border border-gray-400 bg-[#D9E2F3] px-2 py-1 text-left align-top font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {baris.map((b, i) => (
                <tr key={`${b.nama}|${i}`}>
                  <SelCetak>{i + 1}</SelCetak>
                  <SelCetak>{b.nama}</SelCetak>
                  <SelCetak>{b.prodi}/{b.tingkat}</SelCetak>
                  <SelCetak>{tglRingkas(b.tgl_setor)}</SelCetak>
                  <SelCetak className="text-right">{formatRupiah(b.jumlah)}</SelCetak>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between text-sm font-bold">
            <span>TOTAL ({baris.length} taruna)</span>
            <span>{formatRupiah(total)}</span>
          </div>
          <p className="text-xs italic">Terbilang: <strong>{terbilangRupiah(total)}</strong></p>
          <div className="mt-6">
            <BlokTtd2Kolom
              kiri={{ label: 'Menyalurkan,', jabatan: 'Ketua Senat Taruna' }}
              kanan={{ label: 'Mengetahui,', jabatan: 'Pejabat Pembuat Komitmen (PPK)', nama: data.pejabat.PPK.nama, nip: data.pejabat.PPK.nip }}
            />
            <BlokTtdTengah pihak={{ label: 'Mengetahui, Direktur', jabatan: 'Politeknik KP Sorong', nama: data.pejabat.DIREKTUR.nama, nip: data.pejabat.DIREKTUR.nip }} />
          </div>
        </div>
      )}
    </div>
  );
}
