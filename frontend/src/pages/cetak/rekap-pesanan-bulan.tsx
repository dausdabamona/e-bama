// /cetak/rekap-pesanan-bulan — Rekap PESANAN satu bulan penuh (laporan
// kontrol tambahan, BUKAN salah satu dari 10 form SOP). Menampilkan SEMUA
// baris PESANAN bulan itu apa pun statusnya, PLUS tanggal kalender yang
// SAMA SEKALI tidak punya baris PESANAN — supaya celah seperti Juli 2026
// (lihat pesananOtomatis21, 20_trigger.gs) kelihatan sebelum jadi masalah
// di rekap bulanan. Sama pola cetak lain: konten sama dipakai layar & print,
// kop HANYA tampak saat print.
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { BulanPicker, bulanIni, labelBulan } from '../../components/bulan-picker';
import { KopSurat } from '../../components/cetak/kop-surat';
import { BarisCetak, SelCetak, TabelCetak } from '../../components/cetak/tabel-cetak';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { formatRupiah } from '../tagihan/tipe';
import { useListCache } from '../../lib/use-list-cache';

interface BarisPesanan {
  pesanan_id: string; tgl_makan: string; hari: string; jml_taruna: number;
  status: string; menu: string; catatan: string; created_by: string;
}
interface RekapPesananBulan {
  bulan: string; baris: BarisPesanan[]; tanggal_kosong: string[]; hari_kalender: number;
  basis: { hari_dipesan: number; oh_dipesan: number; nominal_proyeksi: number };
}

function tglIndoPendek(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/** Baris ringkas menu (baris pertama saja, mis. "SENIN Malam: Nasi Putih, ..."). */
function menuRingkas(menu: string): string {
  return (menu.split('\n')[0] || '').trim();
}

export function HalamanRekapPesananBulan() {
  const nav = useNavigate();
  const [bulan, setBulan] = useState(bulanIni());
  const { data, memuat, galat, refresh } = useListCache<RekapPesananBulan>('cetak.rekap_pesanan_bulan', { bulan });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <button className="text-sm text-primary" onClick={() => nav(-1)}>← Kembali</button>
        {data && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak</Button>}
      </div>
      <h1 className="text-xl font-bold text-primary-dark print:hidden">Rekap Pesanan Bulanan</h1>

      <div className="print:hidden"><BulanPicker bulan={bulan} onChange={setBulan} /></div>

      {memuat && !data && <LoadingSpinner label="Memuat rekap pesanan…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}
      {data && data.baris.length === 0 && <EmptyState pesan="Belum ada pesanan bulan ini." />}

      {data && data.baris.length > 0 && (
        <>
          <div className="hidden print:block">
            <KopSurat />
            <h2 className="mt-2 text-center text-sm font-bold">REKAP PESANAN BULANAN</h2>
            <p className="text-center text-xs">Bulan {labelBulan(data.bulan)}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 print:hidden">
            <Card className="flex flex-col gap-0.5">
              <p className="text-xs text-gray-500">Hari Terisi Pesanan</p>
              <p className="text-lg font-bold text-primary-dark">
                {data.baris.length} <span className="text-sm font-normal text-gray-400">baris / {data.hari_kalender} hari</span>
              </p>
            </Card>
            <Card className="flex flex-col gap-0.5">
              <p className="text-xs text-gray-500">Basis Pesanan Final (OH)</p>
              <p className="text-lg font-bold text-primary-dark">{data.basis.oh_dipesan.toLocaleString('id-ID')}</p>
            </Card>
            <Card className="flex flex-col gap-0.5">
              <p className="text-xs text-gray-500">Proyeksi Nominal</p>
              <p className="text-lg font-bold text-primary-dark">{formatRupiah(data.basis.nominal_proyeksi)}</p>
            </Card>
          </div>

          {data.tanggal_kosong.length > 0 && (
            <Card className="border-l-4 border-l-red-500">
              <p className="text-sm font-semibold text-red-700">
                ⚠️ {data.tanggal_kosong.length} tanggal TANPA pesanan sama sekali bulan ini:
              </p>
              <p className="mt-1 text-xs text-gray-600">
                {data.tanggal_kosong.map(tglIndoPendek).join(', ')}
              </p>
            </Card>
          )}

          <div className="overflow-x-auto">
            <TabelCetak headers={['Tgl', 'Hari', 'Menu (ringkas)', 'Jml', 'Status', 'Catatan']}>
              {data.baris.map((b) => (
                <BarisCetak key={b.pesanan_id}>
                  <SelCetak className="whitespace-nowrap">{tglIndoPendek(b.tgl_makan)}</SelCetak>
                  <SelCetak className="whitespace-nowrap">{b.hari}</SelCetak>
                  <SelCetak>{menuRingkas(b.menu)}</SelCetak>
                  <SelCetak className="text-right">{b.jml_taruna}</SelCetak>
                  <SelCetak><Badge status={b.status} /></SelCetak>
                  <SelCetak>{b.catatan}</SelCetak>
                </BarisCetak>
              ))}
            </TabelCetak>
          </div>

          <p className="print:hidden text-xs text-gray-400">
            Basis pesanan (hari/OH/nominal) hanya menghitung pesanan berstatus DISETUJUI/TERKIRIM —
            sama rumus dengan kartu Pemantauan di Rekap Bulanan. Dasar pembayaran tetap rekap realisasi sah.
          </p>
        </>
      )}
    </div>
  );
}
