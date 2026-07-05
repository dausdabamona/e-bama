// /persetujuan-wadir3 (Wadir 3) — persetujuan PALING AWAL rekap: DRAFT → DISETUJUI_WADIR3.
// Wadir 3 menyetujui substansi rekap lebih dulu, lalu diteruskan ke PPK untuk
// verifikasi & finalisasi (siap bayar). Angka BELUM beku di sini — baru beku saat PPK finalkan.
import { useState } from 'react';
import { BulanPicker, bulanIni } from '../../components/bulan-picker';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { Modal } from '../../components/ui/modal';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useToast } from '../../components/ui/toast';
import { api } from '../../lib/api';
import { useListCache } from '../../lib/use-list-cache';
import { formatRupiah } from '../tagihan/tipe';

interface BarisRekap { nit: string; status: string; nominal: number }

export function HalamanPersetujuanWadir3() {
  const [bulan, setBulan] = useState(bulanIni());
  const { toast } = useToast();
  const { data, memuat, galat, refresh } = useListCache<{ rekap: BarisRekap[]; total: number }>('rekap.get', { bulan });
  const [tampilKonfirmasi, setTampilKonfirmasi] = useState(false);
  const [proses, setProses] = useState(false);

  const baris = data?.rekap ?? [];
  const status = baris[0]?.status ?? '';
  const jmlTaruna = baris.length;

  async function setujui() {
    setProses(true);
    try {
      await api('rekap.approve_wadir3', { bulan });
      toast('Rekap disetujui — diteruskan ke PPK untuk verifikasi & finalisasi.', 'sukses');
      setTampilKonfirmasi(false);
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-primary-dark">Persetujuan Rekap (Wadir 3)</h1>
      <BulanPicker bulan={bulan} onChange={setBulan} />

      {memuat && !data && <LoadingSpinner label="Memuat rekap…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}
      {data && baris.length === 0 && <EmptyState pesan="Belum ada rekap bulan ini." />}

      {baris.length > 0 && (
        <Card className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Status Rekap</p>
            <Badge status={status} />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Jumlah Taruna</span>
            <span className="font-medium">{jmlTaruna}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total Nominal</span>
            <span className="text-lg font-bold">{formatRupiah(data?.total ?? 0)}</span>
          </div>
        </Card>
      )}

      {status === 'DRAFT' && (
        <Button onClick={() => setTampilKonfirmasi(true)}>Setujui Rekap</Button>
      )}
      {status === 'DISETUJUI_WADIR3' && (
        <Card className="bg-green-50 text-center text-sm text-green-800">
          ✅ Sudah disetujui — menunggu PPK memverifikasi &amp; memfinalkan (siap bayar).
        </Card>
      )}
      {(status === 'TERVERIFIKASI_PPK' || status === 'FINAL') && (
        <Card className="bg-green-50 text-center text-sm text-green-800">
          ✅ Sudah disetujui — PPK sedang/menyelesaikan proses finalisasi &amp; pembayaran.
        </Card>
      )}

      {tampilKonfirmasi && (
        <Modal judul="Setujui Rekap?" onClose={() => setTampilKonfirmasi(false)}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-600">
              Anda akan menyetujui rekap bulan ini sebesar{' '}
              <strong>{formatRupiah(data?.total ?? 0)}</strong> untuk {jmlTaruna} taruna.
              Setelah disetujui, rekap diteruskan ke <strong>PPK</strong> untuk diverifikasi
              dan difinalkan (angka dikunci PPK saat finalisasi) sebelum pembayaran dibuat.
            </p>
            <Button onClick={() => void setujui()} disabled={proses}>
              {proses ? 'Memproses…' : 'Ya, Setujui Rekap'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
