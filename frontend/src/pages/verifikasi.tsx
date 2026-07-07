// /verifikasi (Pembina) — antrian by-exception (Fitur "Verifikasi
// by-Exception" 1d): bila kebijakan autoLolosRutin aktif (default), antrian
// ini SECARA ALAMI hanya berisi pesanan ANOMALI (rutin sudah auto-lolos
// otomatis di pesanan.submit — lihat 12_pesanan.gs). Bila nonaktif, semua
// pesanan tampil dengan label delta vs kemarin + tombol "Setujui Semua yang
// Rutin" (bulk, satu ketuk). Aksi Setujui/Kembalikan tetap sama untuk anomali.
import { useEffect, useState } from 'react';
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
import { INFO_TAHAP, tahapBayar, URUTAN_TAHAP, type TahapBayar } from './tagihan/urutan';
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

function KartuPesananVerifikasi({ p, proses, tertunda, onSetujui, onKembalikan }: {
  p: BarisAntrian; proses: string | null; tertunda: boolean;
  onSetujui: (p: BarisAntrian) => void; onKembalikan: (p: BarisAntrian) => void;
}) {
  return (
    <Card className="flex flex-col gap-2">
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
      {tertunda ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-700">
          ⏳ Tersimpan lokal — menunggu koneksi utk dikirim ke server
        </p>
      ) : (
        <div className="flex gap-2 pt-1">
          <Button varian="bahaya" className="flex-1" onClick={() => onKembalikan(p)} disabled={proses === p.pesanan_id}>
            Kembalikan
          </Button>
          <Button className="flex-1" onClick={() => onSetujui(p)} disabled={proses === p.pesanan_id}>
            {proses === p.pesanan_id ? 'Memproses…' : 'Setujui'}
          </Button>
        </div>
      )}
    </Card>
  );
}

export function HalamanVerifikasi() {
  const { session } = useAuth();
  const { data, memuat, galat, refresh } = useListCache<AntrianData>('pesanan.antrian_verifikasi', {});
  const { toast } = useToast();
  const [proses, setProses] = useState<string | null>(null);
  const [prosesBulk, setProsesBulk] = useState(false);
  const [tampilKembalikan, setTampilKembalikan] = useState<BarisAntrian | null>(null);
  // Aksi yang BARU DIANTRE offline (aksiTulis mengembalikan antri:true) belum
  // benar-benar sampai ke server — memanggil refresh() saat itu cuma menarik
  // ulang data LAMA dari server dan bikin baris yang baru saja "diproses"
  // muncul lagi seolah tak terjadi apa-apa (dilaporkan: "data tidak update").
  // Solusi: tandai id-nya di sini (tampil "Menunggu sinkron", tombol nonaktif)
  // TANPA memanggil refresh(); begitu antrian offline berhasil terkirim,
  // event 'ebama:antrian-berubah' (lib/sync.ts) memicu refresh() sungguhan +
  // bersihkan tanda ini.
  const [tertundaIds, setTertundaIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    function saatAntrianBerubah() {
      setTertundaIds(new Set());
      refresh();
    }
    window.addEventListener('ebama:antrian-berubah', saatAntrianBerubah);
    return () => window.removeEventListener('ebama:antrian-berubah', saatAntrianBerubah);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const antrian = data?.antrian ?? [];

  // Tagihan yang MASIH BISA ditindak (setor bukti / verifikasi) — ditaruh di
  // halaman Verifikasi yang sama supaya Pembina tak perlu buka menu Tagihan
  // terpisah untuk tahu ada yang perlu diverifikasi (dikonfirmasi Firdaus).
  const tagihanQ = useListCache<{ tagihan: Tagihan[] }>('tagihan.list', {});
  const tarunaQ = useListCache<{ taruna: Taruna[] }>('taruna.list', {});
  const namaByNit = new Map((tarunaQ.data?.taruna ?? []).map((t) => [t.nit, t.nama]));
  const TAHAP_PERLU_TINDAKAN: TahapBayar[] = ['PERLU_VERIFIKASI_ANDA', 'MENUNGGU_VERIF_1', 'BELUM_SETOR'];
  const tagihanPerluVerifikasi = (tagihanQ.data?.tagihan ?? []).filter((t) =>
    TAHAP_PERLU_TINDAKAN.includes(tahapBayar(t, session?.user_id))
  );
  // Sub-grup per tahap (warna sama seperti halaman Tagihan) — supaya jelas mana
  // yang benar-benar bisa Anda tindak sekarang (Perlu Verifikasi Anda) vs yang
  // masih menunggu setoran/verifikator pertama, bukan flat list tercampur.
  const kelompokTagihan = URUTAN_TAHAP
    .filter((tahap) => TAHAP_PERLU_TINDAKAN.includes(tahap))
    .map((tahap) => ({ tahap, baris: tagihanPerluVerifikasi.filter((t) => tahapBayar(t, session?.user_id) === tahap) }))
    .filter((g) => g.baris.length > 0);
  const anomaliList = antrian.filter((p) => p.anomali);
  const rutinList = antrian.filter((p) => !p.anomali);

  async function setujui(p: BarisAntrian) {
    setProses(p.pesanan_id);
    try {
      const r = await aksiTulis('pesanan.verify', { pesanan_id: p.pesanan_id });
      if (r.antri) {
        toast('Disimpan lokal, akan dikirim otomatis.', 'sukses');
        setTertundaIds((s) => new Set(s).add(p.pesanan_id));
      } else {
        toast('Pesanan disetujui.', 'sukses');
        refresh();
      }
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
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-600">
            Tagihan Perlu Verifikasi {tagihanPerluVerifikasi.length > 0 && `(${tagihanPerluVerifikasi.length})`}
          </h2>
          {tagihanPerluVerifikasi.length === 0 && <EmptyState pesan="Tidak ada tagihan menunggu tindakan." />}
          {kelompokTagihan.map((g) => (
            <div key={g.tahap} className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-500">{INFO_TAHAP[g.tahap].label} ({g.baris.length})</p>
              {g.baris.map((t) => (
                <Link key={t.tagihan_id} to={`/tagihan/${t.tagihan_id}`}>
                  <Card className={`flex items-center justify-between active:bg-primary-light/30 ${INFO_TAHAP[g.tahap].kartu}`}>
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
          ))}
        </div>
      )}

      <h2 className="text-sm font-semibold text-gray-600">Pesanan Perlu Verifikasi</h2>

      {memuat && !data && <LoadingSpinner label="Memuat antrian…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}
      {data && antrian.length === 0 && <EmptyState pesan="Tidak ada pesanan menunggu verifikasi." />}

      {anomaliList.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-amber-700">⚠️ Perlu Perhatian — Anomali ({anomaliList.length})</p>
          {anomaliList.map((p) => (
            <KartuPesananVerifikasi key={p.pesanan_id} p={p} proses={proses} tertunda={tertundaIds.has(p.pesanan_id)}
              onSetujui={(x) => void setujui(x)} onKembalikan={setTampilKembalikan} />
          ))}
        </div>
      )}

      {rutinList.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500">Rutin — Sudah Cocok Pola Biasa ({rutinList.length})</p>
            {!data?.kebijakan.autoLolosRutin && (
              <Button varian="garis" onClick={() => void setujuiSemuaRutin()} disabled={prosesBulk}>
                {prosesBulk ? 'Memproses…' : '✅ Setujui Semua'}
              </Button>
            )}
          </div>
          {rutinList.map((p) => (
            <KartuPesananVerifikasi key={p.pesanan_id} p={p} proses={proses} tertunda={tertundaIds.has(p.pesanan_id)}
              onSetujui={(x) => void setujui(x)} onKembalikan={setTampilKembalikan} />
          ))}
        </div>
      )}

      {tampilKembalikan && (
        <ModalKembalikan
          pesanan={tampilKembalikan}
          onClose={() => setTampilKembalikan(null)}
          onSukses={(antri) => {
            setTampilKembalikan(null);
            if (antri) setTertundaIds((s) => new Set(s).add(tampilKembalikan.pesanan_id));
            else refresh();
          }}
        />
      )}
    </div>
  );
}

function ModalKembalikan({ pesanan, onClose, onSukses }: {
  pesanan: BarisAntrian; onClose: () => void; onSukses: (antri: boolean) => void;
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
      onSukses(r.antri);
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
