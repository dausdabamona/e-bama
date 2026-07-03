// /verifikasi (Pembina) — antrian pesanan DIAJUKAN → setujui / kembalikan (alasan wajib)
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { aksiTulis } from '../lib/sync';
import { useListCache } from '../lib/use-list-cache';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorMessage } from '../components/ui/error-message';
import { Input } from '../components/ui/input';
import { LoadingSpinner } from '../components/ui/loading-spinner';
import { Modal } from '../components/ui/modal';
import { useToast } from '../components/ui/toast';
import type { Pesanan } from './pesanan/tipe';

export function HalamanVerifikasi() {
  const { data, memuat, galat, refresh } = useListCache<{ pesanan: Pesanan[] }>('pesanan.list', {});
  const { toast } = useToast();
  const [proses, setProses] = useState<string | null>(null);
  const [tampilKembalikan, setTampilKembalikan] = useState<Pesanan | null>(null);

  const antrian = data?.pesanan?.filter((p) => p.status === 'DIAJUKAN') ?? [];

  async function setujui(p: Pesanan) {
    setProses(p.pesanan_id);
    try {
      const r = await aksiTulis('pesanan.verify', { pesanan_id: p.pesanan_id });
      toast(r.antri ? 'Disimpan lokal, akan dikirim otomatis.' : 'Pesanan disetujui.', 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-primary-dark">Verifikasi Pesanan</h1>

      {memuat && !data && <LoadingSpinner label="Memuat antrian…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}
      {data && antrian.length === 0 && <EmptyState pesan="Tidak ada pesanan menunggu verifikasi." />}

      {antrian.map((p) => (
        <Card key={p.pesanan_id} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Link to={`/pesanan/${p.pesanan_id}`} className="font-semibold text-primary-dark underline">
              {p.tgl_makan}
            </Link>
            <Badge status={p.status} />
          </div>
          <p className="text-sm text-gray-600">{p.menu}</p>
          <p className="text-xs text-gray-400">{p.jml_taruna} taruna</p>
          <div className="flex gap-2 pt-1">
            <Button varian="bahaya" className="flex-1" onClick={() => setTampilKembalikan(p)} disabled={proses === p.pesanan_id}>
              Kembalikan
            </Button>
            <Button className="flex-1" onClick={() => void setujui(p)} disabled={proses === p.pesanan_id}>
              {proses === p.pesanan_id ? 'Memproses…' : 'Setujui'}
            </Button>
          </div>
        </Card>
      ))}

      {tampilKembalikan && (
        <ModalKembalikan
          pesanan={tampilKembalikan}
          onClose={() => setTampilKembalikan(null)}
          onSukses={() => { setTampilKembalikan(null); refresh(); }}
        />
      )}
    </div>
  );
}

function ModalKembalikan({ pesanan, onClose, onSukses }: {
  pesanan: Pesanan; onClose: () => void; onSukses: () => void;
}) {
  const { toast } = useToast();
  const [alasan, setAlasan] = useState('');
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');

  async function kirim() {
    if (!alasan.trim()) { setGalat('Alasan pengembalian wajib diisi.'); return; }
    setProses(true);
    setGalat('');
    try {
      const r = await aksiTulis('pesanan.return', { pesanan_id: pesanan.pesanan_id, alasan: alasan.trim() });
      toast(r.antri ? 'Disimpan lokal, akan dikirim otomatis.' : 'Pesanan dikembalikan.', 'sukses');
      onSukses();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setProses(false);
    }
  }

  return (
    <Modal judul={`Kembalikan Pesanan ${pesanan.tgl_makan}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Input label="Alasan Pengembalian" value={alasan} onChange={(e) => setAlasan(e.target.value)} autoFocus />
        {galat && <p className="text-sm text-red-600">{galat}</p>}
        <Button varian="bahaya" onClick={() => void kirim()} disabled={proses}>
          {proses ? 'Memproses…' : 'Kembalikan Pesanan'}
        </Button>
      </div>
    </Modal>
  );
}
