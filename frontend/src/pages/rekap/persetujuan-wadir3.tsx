// /persetujuan-wadir3 (Wadir 3) — otorisasi pencairan pembayaran: FINAL → DISETUJUI_WADIR3.
// Bukan koreksi angka — nominal sudah beku sejak PPK memfinalkan rekap.
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
      toast('Pencairan pembayaran disetujui — PPK dapat memproses pembayaran.', 'sukses');
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
      <h1 className="text-xl font-bold text-primary-dark">Persetujuan Pencairan</h1>
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

      {status === 'FINAL' && (
        <Button onClick={() => setTampilKonfirmasi(true)}>Setujui Pencairan Pembayaran</Button>
      )}
      {status === 'DISETUJUI_WADIR3' && (
        <Card className="bg-green-50 text-center text-sm text-green-800">
          ✅ Sudah disetujui — PPK dapat memproses pembayaran bulan ini.
        </Card>
      )}
      {(status === 'DRAFT' || status === 'TERVERIFIKASI_PPK') && (
        <Card className="bg-amber-50 text-center text-sm text-amber-800">
          ⏳ Menunggu PPK memfinalkan rekap bulan ini terlebih dahulu.
        </Card>
      )}

      {tampilKonfirmasi && (
        <Modal judul="Setujui Pencairan?" onClose={() => setTampilKonfirmasi(false)}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-600">
              Anda akan menyetujui pencairan pembayaran bulan ini sebesar{' '}
              <strong>{formatRupiah(data?.total ?? 0)}</strong> untuk {jmlTaruna} taruna.
              Nominal sudah beku (difinalkan PPK) — persetujuan ini adalah otorisasi
              pencairan, bukan koreksi angka.
            </p>
            <Button onClick={() => void setujui()} disabled={proses}>
              {proses ? 'Memproses…' : 'Ya, Setujui Pencairan'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
