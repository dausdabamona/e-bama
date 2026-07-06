// /pesanan/:id — detail + timeline status, kirim H-1, revisi (upload BA)
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { ambilFotoInput, kompresFotoBase64 } from '../../lib/foto';
import { aksiTulis } from '../../lib/sync';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { Modal } from '../../components/ui/modal';
import { Input } from '../../components/ui/input';
import { useToast } from '../../components/ui/toast';
import { useListCache } from '../../lib/use-list-cache';
import { urlDrive, type Lampiran, type Pesanan } from './tipe';

const TIMELINE: { status: Pesanan['status']; label: string }[] = [
  { status: 'DRAFT', label: 'Dibuat Senat' },
  { status: 'DIAJUKAN', label: 'Diajukan' },
  { status: 'DISETUJUI', label: 'Disetujui Pembina' },
  { status: 'TERKIRIM', label: 'Terkirim ke Penyedia' }
];

export function HalamanPesananDetail() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const nav = useNavigate();
  const { toast } = useToast();
  const { data, memuat, galat, refresh } = useListCache<{ pesanan: Pesanan; lampiran: Lampiran[] }>(
    'pesanan.get', { pesanan_id: id }
  );
  const [tampilRevisi, setTampilRevisi] = useState(false);
  const [proses, setProses] = useState(false);

  if (memuat && !data) return <LoadingSpinner />;
  if (galat && !data) return <ErrorMessage pesan={galat} onRetry={refresh} />;
  if (!data) return null;

  const p = data.pesanan;
  const bisaSubmit = p.status === 'DRAFT' && p.created_by === session?.user_id;
  const bisaKirim = p.status === 'DISETUJUI';
  const bisaRevisi = p.status === 'TERKIRIM';
  const idxTimeline = TIMELINE.findIndex((t) => t.status === p.status);

  async function submit() {
    setProses(true);
    try {
      const r = await aksiTulis('pesanan.submit', { pesanan_id: p.pesanan_id });
      toast(r.antri ? 'Disimpan lokal, akan dikirim otomatis.' : 'Pesanan diajukan.', 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  async function kirim() {
    setProses(true);
    try {
      const r = await aksiTulis('pesanan.kirim', { pesanan_id: p.pesanan_id });
      toast(r.antri ? 'Disimpan lokal, akan dikirim otomatis.' : 'Pesanan terkirim ke penyedia.', 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button className="text-sm text-primary" onClick={() => nav('/pesanan')}>← Kembali</button>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary-dark">{p.tgl_makan}</h1>
        <Badge status={p.status} />
      </div>

      <Card>
        <p className="text-sm text-gray-500">Menu</p>
        <p className="mb-2 font-medium">{p.menu}</p>
        <p className="text-sm text-gray-500">Jumlah Taruna</p>
        <p className="font-medium">{p.jml_taruna} orang</p>
        {p.catatan && (
          <>
            <p className="mt-2 text-sm text-gray-500">Catatan</p>
            <p className="text-sm">{p.catatan}</p>
          </>
        )}
      </Card>

      <DaftarPenerima tglMakan={p.tgl_makan} />

      {/* Timeline status */}
      <Card>
        <p className="mb-3 text-sm font-semibold text-gray-600">Riwayat Status</p>
        <ol className="flex flex-col gap-2">
          {TIMELINE.map((t, i) => (
            <li key={t.status} className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${i <= idxTimeline && p.status !== 'DIKEMBALIKAN' ? 'bg-primary' : 'bg-gray-200'}`} />
              <span className={i <= idxTimeline ? 'font-medium text-gray-800' : 'text-gray-400'}>{t.label}</span>
            </li>
          ))}
          {p.status === 'DIKEMBALIKAN' && (
            <li className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              <span className="font-medium text-red-700">Dikembalikan — lihat catatan di atas</span>
            </li>
          )}
        </ol>
      </Card>

      {data.lampiran.length > 0 && (
        <Card>
          <p className="mb-2 text-sm font-semibold text-gray-600">Lampiran</p>
          {data.lampiran.map((l) => (
            <a key={l.lamp_id} href={urlDrive(l.drive_file_id)} target="_blank" rel="noreferrer"
              className="block text-sm text-primary underline">
              {l.jenis}: {l.nama_file}
            </a>
          ))}
        </Card>
      )}

      <div className="flex flex-col gap-2">
        <Link to={`/cetak/form-01/${p.tgl_makan}`}>
          <Button varian="garis" className="w-full">🖨️ Cetak Form 01</Button>
        </Link>
        <Link to={`/cetak/surat-pesanan/${p.pesanan_id}`}>
          <Button varian="garis" className="w-full">🖨️ Cetak Surat Pesanan (ke Penyedia)</Button>
        </Link>
        {bisaSubmit && (
          <Button onClick={() => void submit()} disabled={proses}>Ajukan ke Pembina</Button>
        )}
        {bisaKirim && (
          <Button onClick={() => void kirim()} disabled={proses}>Kirim ke Penyedia</Button>
        )}
        {bisaRevisi && (
          <Button varian="garis" onClick={() => setTampilRevisi(true)}>Buat Revisi (BA Perubahan)</Button>
        )}
      </div>

      {tampilRevisi && (
        <ModalRevisi
          pesanan={p}
          onClose={() => setTampilRevisi(false)}
          onSukses={(idBaru) => { setTampilRevisi(false); nav(`/pesanan/${idBaru}`); }}
        />
      )}
    </div>
  );
}

interface TarunaRingkas { nit: string; nama: string; prodi: string; tingkat: string }
interface StatusRingkas { nit: string; status: string }

/**
 * Daftar nama taruna penerima makan hari itu — turunan real-time dari Taruna
 * AKTIF dikurangi yang punya STATUS_HARIAN tanggal ini (logika identik
 * _hitungJmlTaruna_ di backend 12_pesanan.gs), bukan data/snapshot baru.
 */
function DaftarPenerima({ tglMakan }: { tglMakan: string }) {
  const [tampil, setTampil] = useState(false);
  const tarunaQ = useListCache<{ taruna: TarunaRingkas[] }>('taruna.list', { status: 'AKTIF' });
  const statusQ = useListCache<{ status: StatusRingkas[] }>('status.list', { dari: tglMakan, sampai: tglMakan });

  const tarunaAktif = tarunaQ.data?.taruna ?? [];
  const statusByNit = new Map((statusQ.data?.status ?? []).map((s) => [s.nit, s.status]));
  const penerima = tarunaAktif.filter((t) => !statusByNit.has(t.nit));
  const tidakMenerima = tarunaAktif.filter((t) => statusByNit.has(t.nit));
  const memuat = tarunaQ.memuat || statusQ.memuat;

  return (
    <Card>
      <button className="flex w-full items-center justify-between text-sm font-semibold text-gray-600"
        onClick={() => setTampil((v) => !v)}>
        <span>Daftar Penerima{!memuat && ` (${penerima.length})`}</span>
        <span aria-hidden>{tampil ? '▲' : '▼'}</span>
      </button>
      {tampil && (
        memuat ? <LoadingSpinner label="Memuat daftar penerima…" /> : (
          <div className="mt-2 flex flex-col gap-2">
            <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-100">
              {penerima.length === 0 && <p className="p-2 text-sm text-gray-400">Tidak ada penerima.</p>}
              {penerima.map((t) => (
                <div key={t.nit} className="border-b border-gray-50 px-3 py-2 text-sm last:border-0">
                  <p>{t.nama}</p>
                  <p className="text-xs text-gray-400">{t.nit} · {t.prodi} · Tk.{t.tingkat}</p>
                </div>
              ))}
            </div>
            {tidakMenerima.length > 0 && (
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer">{tidakMenerima.length} taruna tidak menerima (status)</summary>
                <div className="mt-1 flex flex-col gap-1">
                  {tidakMenerima.map((t) => (
                    <p key={t.nit}>{t.nama} — {(statusByNit.get(t.nit) ?? '').replace(/_/g, ' ')}</p>
                  ))}
                </div>
              </details>
            )}
          </div>
        )
      )}
    </Card>
  );
}

function ModalRevisi({ pesanan, onClose, onSukses }: {
  pesanan: Pesanan; onClose: () => void; onSukses: (id: string) => void;
}) {
  const { toast } = useToast();
  const [menu, setMenu] = useState(pesanan.menu);
  const [jml, setJml] = useState(String(pesanan.jml_taruna));
  const [catatan, setCatatan] = useState('');
  const [fotoNama, setFotoNama] = useState('');
  const [fotoBase64, setFotoBase64] = useState('');
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');

  async function pilihBerkas() {
    const file = await ambilFotoInput();
    if (!file) return;
    setFotoNama(file.name);
    setFotoBase64(await kompresFotoBase64(file));
  }

  async function kirim() {
    if (!catatan.trim()) { setGalat('Catatan alasan revisi wajib diisi.'); return; }
    if (!fotoBase64) { setGalat('Lampiran BA perubahan wajib diunggah.'); return; }
    setProses(true);
    setGalat('');
    try {
      const r = await aksiTulis<{ pesanan: Pesanan }>('pesanan.revisi', {
        pesanan_id: pesanan.pesanan_id,
        menu: menu.trim(),
        jml_taruna: Number(jml),
        catatan: catatan.trim(),
        berkas: { base64: fotoBase64, nama_file: fotoNama || 'BA-perubahan.jpg' }
      });
      if (r.antri) {
        toast('Disimpan lokal, akan dikirim otomatis.', 'info');
        onClose();
        return;
      }
      toast('Revisi berhasil dibuat.', 'sukses');
      onSukses(r.data!.pesanan.pesanan_id);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal membuat revisi.');
    } finally {
      setProses(false);
    }
  }

  return (
    <Modal judul="Revisi Pesanan (SOP 7b)" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Input label="Menu" value={menu} onChange={(e) => setMenu(e.target.value)} />
        <Input label="Jumlah Taruna" type="number" value={jml} onChange={(e) => setJml(e.target.value)} />
        <Input label="Catatan Alasan Revisi" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        <Button varian="garis" onClick={() => void pilihBerkas()}>
          {fotoNama ? `📎 ${fotoNama}` : '📷 Unggah BA Perubahan'}
        </Button>
        {galat && <p className="text-sm text-red-600">{galat}</p>}
        <Button onClick={() => void kirim()} disabled={proses}>
          {proses ? 'Menyimpan…' : 'Simpan Revisi'}
        </Button>
      </div>
    </Modal>
  );
}
