// /verifikasi (Pembina) — antrian by-exception (Fitur "Verifikasi
// by-Exception" 1d): bila kebijakan autoLolosRutin aktif (default), antrian
// ini SECARA ALAMI hanya berisi pesanan ANOMALI (rutin sudah auto-lolos
// otomatis di pesanan.submit — lihat 12_pesanan.gs). Bila nonaktif, semua
// pesanan tampil dengan label delta vs kemarin + tombol "Setujui Semua yang
// Rutin" (bulk, satu ketuk). Aksi Setujui/Kembalikan tetap sama untuk anomali.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { aksiTulis } from '../lib/sync';
import { api } from '../lib/api';
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
import { formatRupiah, type Tagihan } from './tagihan/tipe';
import { tahapBayar } from './tagihan/urutan';
import type { Taruna } from './taruna/tipe';

interface BarisAntrian extends Pesanan {
  anomali: boolean; label: string; alasan: string;
  jml_kemarin: number | null; selisih: number | null;
}
interface AntrianData { kebijakan: { autoLolosRutin: boolean }; antrian: BarisAntrian[] }

function warnaLabel(label: string): string {
  if (label === 'SAMA') return 'bg-green-100 text-green-800';
  if (label === 'TIDAK ADA PEMBANDING') return 'bg-gray-200 text-gray-600';
  return 'bg-amber-100 text-amber-800'; // NAIK/TURUN/OVERRIDE MANUAL/STATUS BERUBAH
}

export function HalamanVerifikasi() {
  const { session } = useAuth();
  const { data, memuat, galat, refresh } = useListCache<AntrianData>('pesanan.antrian_verifikasi', {});
  const { toast } = useToast();
  const [proses, setProses] = useState<string | null>(null);
  const [prosesBulk, setProsesBulk] = useState(false);
  const [tampilKembalikan, setTampilKembalikan] = useState<BarisAntrian | null>(null);

  const antrian = data?.antrian ?? [];
  const jmlRutin = antrian.filter((p) => !p.anomali).length;

  // Tagihan yang MASIH BISA ditindak (setor bukti / verifikasi) — ditaruh di
  // halaman Verifikasi yang sama supaya Pembina tak perlu buka menu Tagihan
  // terpisah untuk tahu ada yang perlu diverifikasi (dikonfirmasi Firdaus).
  const tagihanQ = useListCache<{ tagihan: Tagihan[] }>('tagihan.list', {});
  const tarunaQ = useListCache<{ taruna: Taruna[] }>('taruna.list', {});
  const namaByNit = new Map((tarunaQ.data?.taruna ?? []).map((t) => [t.nit, t.nama]));
  const tagihanPerluVerifikasi = (tagihanQ.data?.tagihan ?? []).filter((t) => {
    const tahap = tahapBayar(t, session?.user_id);
    return tahap === 'BELUM_SETOR' || tahap === 'MENUNGGU_VERIF_1' || tahap === 'PERLU_VERIFIKASI_ANDA';
  });

  async function setujui(p: BarisAntrian) {
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

  async function setujuiSemuaRutin() {
    setProsesBulk(true);
    try {
      const r = await api<{ disetujui: number }>('pesanan.bulk_approve_rutin', {});
      toast(`${r.disetujui} pesanan rutin disetujui sekaligus.`, 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProsesBulk(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-primary-dark">Verifikasi</h1>

      {tagihanQ.data && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-gray-600">
            Tagihan Perlu Verifikasi {tagihanPerluVerifikasi.length > 0 && `(${tagihanPerluVerifikasi.length})`}
          </h2>
          {tagihanPerluVerifikasi.length === 0 && <EmptyState pesan="Tidak ada tagihan menunggu tindakan." />}
          {tagihanPerluVerifikasi.map((t) => (
            <Link key={t.tagihan_id} to={`/tagihan/${t.tagihan_id}`}>
              <Card className="flex items-center justify-between active:bg-primary-light/30">
                <div>
                  <p className="font-semibold">{namaByNit.get(t.nit) ?? t.nit}</p>
                  <p className="text-xs text-gray-400">{t.nit} · {t.bulan}</p>
                  <p className="text-sm text-gray-500">{formatRupiah(t.nominal)}</p>
                </div>
                <Badge status={t.status} />
              </Card>
            </Link>
          ))}
        </div>
      )}

      <h2 className="text-sm font-semibold text-gray-600">Pesanan Perlu Verifikasi</h2>

      {memuat && !data && <LoadingSpinner label="Memuat antrian…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}
      {data && antrian.length === 0 && <EmptyState pesan="Tidak ada pesanan menunggu verifikasi." />}

      {data && !data.kebijakan.autoLolosRutin && jmlRutin > 0 && (
        <Button onClick={() => void setujuiSemuaRutin()} disabled={prosesBulk}>
          {prosesBulk ? 'Memproses…' : `✅ Setujui Semua yang Rutin (${jmlRutin})`}
        </Button>
      )}

      {antrian.map((p) => (
        <Card key={p.pesanan_id} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Link to={`/pesanan/${p.pesanan_id}`} className="font-semibold text-primary-dark underline">
              {p.tgl_makan}
            </Link>
            <Badge status={p.status} />
          </div>
          <span className={`self-start rounded-full px-2 py-0.5 text-xs font-semibold ${warnaLabel(p.label)}`}>
            {p.label}
          </span>
          {p.anomali && p.alasan && <p className="text-xs text-amber-700">{p.alasan}</p>}
          <p className="text-sm text-gray-600">{p.menu}</p>
          {/* Jumlah taruna ditonjolkan — angka paling kritikal saat verifikasi
              (dikonfirmasi Firdaus: menekan risiko salah-verifikasi). */}
          <div className="flex items-baseline gap-1.5 rounded-xl bg-primary-light px-3 py-2">
            <span className="text-2xl font-bold text-primary-dark">{p.jml_taruna}</span>
            <span className="text-sm text-gray-600">taruna</span>
            {p.jml_kemarin !== null && <span className="text-xs text-gray-400">(kemarin {p.jml_kemarin})</span>}
          </div>
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
  pesanan: BarisAntrian; onClose: () => void; onSukses: () => void;
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
