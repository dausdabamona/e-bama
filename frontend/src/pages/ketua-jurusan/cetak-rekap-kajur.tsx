// /luar-kampus-kajur/cetak/:bulan (KETUA_JURUSAN) — cetak Rekap Bantuan Uang
// Makan Luar Kampus prodinya untuk satu bulan. TANPA nomor rekening (data
// kajur.rekap memang tak memuatnya) → boleh di-cache, aman dicetak Kajur.
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { labelBulan } from '../../components/bulan-picker';
import { BlokTtdTengah } from '../../components/cetak/blok-ttd';
import { KopSurat } from '../../components/cetak/kop-surat';
import { SelCetak } from '../../components/cetak/tabel-cetak';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useListCache } from '../../lib/use-list-cache';
import { urutTingkat } from '../../lib/kelompok-prodi-tingkat';
import { formatRupiah } from '../tagihan/tipe';

interface BarisRekap {
  nit: string; nama: string; tingkat: string; kelas: string; kegiatan: string;
  hari_luar_kampus: number; nilai_per_hari: number; nominal: number; ada_blk: boolean; disetujui_kajur: boolean;
}
interface RekapData { bulan: string; prodi: string; baris: BarisRekap[]; total_nominal: number }

export function HalamanCetakRekapKajur() {
  const nav = useNavigate();
  const { session } = useAuth();
  const { bulan = '' } = useParams();
  const { data, memuat, galat, refresh } = useListCache<RekapData>('kajur.rekap', { bulan });

  const baris = data?.baris ?? [];
  const kelompok = (() => {
    const map = new Map<string, BarisRekap[]>();
    baris.forEach((b) => {
      const t = b.tingkat || '?';
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(b);
    });
    return Array.from(map.entries())
      .map(([tingkat, rows]) => ({
        tingkat,
        rows: rows.slice().sort((a, c) => (a.nama || a.nit).localeCompare(c.nama || c.nit, 'id')),
      }))
      .sort((a, c) => urutTingkat(a.tingkat) - urutTingkat(c.tingkat));
  })();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <button className="text-sm text-primary" onClick={() => nav(-1)}>← Kembali</button>
        {baris.length > 0 && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak</Button>}
      </div>

      {memuat && !data && <LoadingSpinner label="Memuat rekap…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}
      {data && baris.length === 0 && (
        <EmptyState pesan="Belum ada aktivitas luar kampus bulan ini." />
      )}

      {data && baris.length > 0 && (
        <div className="flex flex-col gap-2">
          <KopSurat />
          <div className="text-center">
            <h2 className="text-sm font-bold">REKAPITULASI BANTUAN UANG MAKAN TARUNA LUAR KAMPUS</h2>
            <p className="text-xs">Program Studi {data.prodi} · Bulan {labelBulan(bulan)}</p>
          </div>
          <table className="w-full table-fixed border-collapse text-xs">
            <colgroup>
              <col style={{ width: '5%' }} /><col style={{ width: '33%' }} /><col style={{ width: '9%' }} />
              <col style={{ width: '17%' }} /><col style={{ width: '8%' }} /><col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <thead>
              <tr>
                {['No', 'Nama Taruna', 'Tk', 'Kegiatan', 'Hari', 'Tarif/Hari', 'Nominal (Rp)'].map((h) => (
                  <th key={h} className="border border-gray-400 bg-[#D9E2F3] px-2 py-1 text-left align-top font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            {kelompok.map((kt) => {
              const subtotal = kt.rows.reduce((s, b) => s + b.nominal, 0);
              return (
                <tbody key={kt.tingkat}>
                  <tr>
                    <td colSpan={7} className="border border-gray-400 bg-gray-100 px-2 py-1 font-semibold">Tingkat {kt.tingkat}</td>
                  </tr>
                  {kt.rows.map((b, i) => (
                    <tr key={b.nit}>
                      <SelCetak>{i + 1}</SelCetak>
                      <SelCetak>{b.nama || b.nit}</SelCetak>
                      <SelCetak>{b.tingkat}</SelCetak>
                      <SelCetak>{b.kegiatan || '-'}</SelCetak>
                      <SelCetak className="text-right">{b.hari_luar_kampus}</SelCetak>
                      <SelCetak className="text-right">{b.nilai_per_hari ? formatRupiah(b.nilai_per_hari) : '-'}</SelCetak>
                      <SelCetak className="text-right">{formatRupiah(b.nominal)}</SelCetak>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={6} className="border border-gray-400 px-2 py-1 text-right font-semibold">Subtotal Tingkat {kt.tingkat} ({kt.rows.length} taruna)</td>
                    <td className="border border-gray-400 px-2 py-1 text-right font-semibold">{formatRupiah(subtotal)}</td>
                  </tr>
                </tbody>
              );
            })}
            <tfoot>
              <tr>
                <td colSpan={6} className="border border-gray-400 bg-[#D9E2F3] px-2 py-1 text-right font-bold">TOTAL ({baris.length} taruna)</td>
                <td className="border border-gray-400 bg-[#D9E2F3] px-2 py-1 text-right font-bold">{formatRupiah(data.total_nominal)}</td>
              </tr>
            </tfoot>
          </table>
          <div className="mt-6 flex justify-end">
            <BlokTtdTengah pihak={{ label: 'Ketua Jurusan / Program Studi', jabatan: data.prodi, nama: session?.nama || '' }} />
          </div>
        </div>
      )}
    </div>
  );
}
