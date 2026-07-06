// /cetak/surat-pesanan/:id — Surat Pesanan Makan ke Penyedia. Melengkapi
// Form-01 (internal, ada harga), BUKAN menggantikan: dokumen ini untuk
// PENYEDIA/katering (instruksi masak), sehingga TIDAK ADA rupiah/rekening
// sama sekali — hanya tanggal, komposisi antaran, menu, dan jumlah porsi per
// Prodi+Tingkat. Sama pola satu-halaman screen+print seperti form-05.tsx.
import { useNavigate, useParams } from 'react-router-dom';
import { BlokTtd2Kolom } from '../../components/cetak/blok-ttd';
import { KopSurat } from '../../components/cetak/kop-surat';
import { BarisCetak, SelCetak, TabelCetak } from '../../components/cetak/tabel-cetak';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useListCache } from '../../lib/use-list-cache';

interface PorsiKelompok { prodi: string; tingkat: string; jml: number }
interface SuratPesananData {
  pesanan_id: string; tgl_makan: string;
  komposisi: { malam: { hari: string }; pagi: { hari: string }; siang: { hari: string } };
  menu: { malam: string; pagi: string; siang: string };
  porsi_per_kelompok: PorsiKelompok[];
  total: number; total_derivasi: number; selisih_derivasi: number;
  catatan: string;
}

export function HalamanCetakSuratPesanan() {
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data, memuat, galat, refresh } = useListCache<SuratPesananData>(
    'pesanan.surat_penyedia', { pesanan_id: id }
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <button className="text-sm text-primary" onClick={() => nav(-1)}>← Kembali</button>
        {data && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak</Button>}
      </div>
      <h1 className="text-xl font-bold text-primary-dark print:hidden">Surat Pesanan Makan (ke Penyedia)</h1>

      {memuat && !data && <LoadingSpinner label="Memuat data pesanan…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}

      {data && (
        <div className="flex flex-col gap-4">
          <KopSurat />
          <div className="text-center">
            <h2 className="text-base font-bold">SURAT PESANAN MAKAN</h2>
            <p className="text-sm">Tanggal Makan: {data.tgl_makan}</p>
            <p className="text-xs text-gray-500 print:text-black">
              Komposisi Antaran: {data.komposisi.malam.hari} Malam + {data.komposisi.pagi.hari} Pagi &amp; Siang
            </p>
          </div>

          <Card className="overflow-x-auto print:border-0 print:p-0 print:shadow-none">
            <p className="mb-2 text-sm font-semibold text-gray-600 print:text-black">Menu</p>
            <TabelCetak headers={['Waktu Makan', 'Hari', 'Menu']}>
              <BarisCetak>
                <SelCetak>Malam</SelCetak>
                <SelCetak>{data.komposisi.malam.hari}</SelCetak>
                <SelCetak>{data.menu.malam || '-'}</SelCetak>
              </BarisCetak>
              <BarisCetak>
                <SelCetak>Pagi</SelCetak>
                <SelCetak>{data.komposisi.pagi.hari}</SelCetak>
                <SelCetak>{data.menu.pagi || '-'}</SelCetak>
              </BarisCetak>
              <BarisCetak>
                <SelCetak>Siang</SelCetak>
                <SelCetak>{data.komposisi.siang.hari}</SelCetak>
                <SelCetak>{data.menu.siang || '-'}</SelCetak>
              </BarisCetak>
            </TabelCetak>
          </Card>

          <Card className="overflow-x-auto print:border-0 print:p-0 print:shadow-none">
            <p className="mb-2 text-sm font-semibold text-gray-600 print:text-black">Jumlah Porsi per Prodi &amp; Tingkat</p>
            <TabelCetak headers={['Prodi / Tingkat', 'Jumlah Porsi']}>
              {data.porsi_per_kelompok.map((k) => (
                <BarisCetak key={`${k.prodi}|${k.tingkat}`}>
                  <SelCetak>{k.prodi || 'Lainnya'} / {k.tingkat || '?'}</SelCetak>
                  <SelCetak className="text-right">{k.jml}</SelCetak>
                </BarisCetak>
              ))}
              <BarisCetak>
                <SelCetak className="font-bold">TOTAL</SelCetak>
                <SelCetak className="text-right font-bold">{data.total}</SelCetak>
              </BarisCetak>
            </TabelCetak>
            {data.selisih_derivasi !== 0 && (
              <p className="mt-2 text-xs text-amber-700 print:text-black">
                Catatan: turunan otomatis dari data taruna aktif hari ini menghasilkan{' '}
                {data.total_derivasi} porsi, sedangkan jumlah pemesanan (angka mengikat,
                bisa dikoreksi manual) tercatat {data.total} porsi
                {data.catatan ? ` — catatan pesanan: "${data.catatan}"` : ''}.
              </p>
            )}
          </Card>

          <BlokTtd2Kolom
            kiri={{ label: 'Mengajukan,', jabatan: 'Senat' }}
            kanan={{ label: 'Mengetahui,', jabatan: 'Pejabat Pembuat Komitmen (PPK)' }}
          />
        </div>
      )}
    </div>
  );
}
