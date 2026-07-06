// /tagihan/:id — riwayat SP (unduh PDF) + form bukti setor (Senat).
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { ambilFotoInput, kompresFotoBase64 } from '../../lib/foto';
import { aksiTulis } from '../../lib/sync';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { useToast } from '../../components/ui/toast';
import { api } from '../../lib/api';
import { useListCache } from '../../lib/use-list-cache';
import { urlDrive } from '../pesanan/tipe';
import { formatRupiah, type SuratPeringatan, type Tagihan } from './tipe';
import type { Taruna } from '../taruna/tipe';

function hariIni(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HalamanTagihanDetail() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const nav = useNavigate();
  const { toast } = useToast();

  const tagihanQ = useListCache<{ tagihan: Tagihan[] }>('tagihan.list', {});
  const spQ = useListCache<{ sp: SuratPeringatan[] }>('sp.list', { tagihan_id: id });
  const tarunaQ = useListCache<{ taruna: Taruna[] }>('taruna.list', {});

  const [tglSetor, setTglSetor] = useState(hariIni());
  const [fotoNama, setFotoNama] = useState('');
  const [fotoBase64, setFotoBase64] = useState('');
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');
  const [tampilHapus, setTampilHapus] = useState(false);

  if (tagihanQ.memuat && !tagihanQ.data) return <LoadingSpinner />;
  if (tagihanQ.galat && !tagihanQ.data) return <ErrorMessage pesan={tagihanQ.galat} onRetry={tagihanQ.refresh} />;
  const t = tagihanQ.data?.tagihan?.find((x) => x.tagihan_id === id);
  if (!t) return <ErrorMessage pesan="Tagihan tidak ditemukan." onRetry={tagihanQ.refresh} />;
  const namaTaruna = tarunaQ.data?.taruna?.find((x) => x.nit === t.nit)?.nama;

  async function pilihBerkas() {
    const file = await ambilFotoInput();
    if (!file) return;
    setFotoNama(file.name);
    setFotoBase64(await kompresFotoBase64(file));
  }

  async function kirimSetor() {
    if (!fotoBase64) { setGalat('Bukti setor wajib diunggah.'); return; }
    setProses(true); setGalat('');
    try {
      const r = await aksiTulis('tagihan.setor', {
        tagihan_id: t!.tagihan_id, tgl_setor: tglSetor,
        berkas: { base64: fotoBase64, nama_file: fotoNama || 'bukti-setor.jpg' }
      });
      toast(r.antri ? 'Disimpan lokal, akan dikirim otomatis.' : 'Bukti setor terkirim, menunggu verifikasi Pembina.', 'sukses');
      tagihanQ.refresh();
      setFotoNama(''); setFotoBase64('');
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setProses(false);
    }
  }

  async function verifikasiPembina() {
    setProses(true); setGalat('');
    try {
      await api('tagihan.verifikasi_pembina', { tagihan_id: t!.tagihan_id });
      toast('Diverifikasi Pembina — menunggu verifikasi PPK/Admin.', 'sukses');
      tagihanQ.refresh();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setProses(false);
    }
  }

  async function verifikasiSetoran() {
    setProses(true);
    try {
      await api('tagihan.verify', { tagihan_id: t!.tagihan_id });
      toast('Tagihan diverifikasi — LUNAS.', 'sukses');
      tagihanQ.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  async function terbitkanUlangSp() {
    setProses(true);
    try {
      await api('tagihan.regenerate_sp', { tagihan_id: t!.tagihan_id });
      toast('SP diterbitkan ulang.', 'sukses');
      spQ.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button className="text-sm text-primary" onClick={() => nav('/tagihan')}>← Kembali</button>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary-dark">{namaTaruna ?? t.nit}</h1>
          <p className="text-xs text-gray-400">{t.nit} · {t.bulan}</p>
        </div>
        <Badge status={t.status} />
      </div>

      <Card className="flex flex-col gap-2">
        <p className="text-sm text-gray-500">Nominal</p>
        <p className="text-lg font-bold">{formatRupiah(t.nominal)}</p>
        <p className="text-sm text-gray-500">Sebab</p>
        <p className="font-medium">{t.sebab.replace(/_/g, ' ')}</p>
        {t.tgl_setor && (
          <>
            <p className="text-sm text-gray-500">Tanggal Setor</p>
            <p className="font-medium">{t.tgl_setor}</p>
          </>
        )}
      </Card>

      {t.status === 'TERTAGIH' && (
        <Card className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-gray-600">Alur Pembayaran → Rekening Senat</p>
          <p className="text-sm">
            {t.tgl_setor ? '✅' : '⏳'} Setor Bukti Transfer (Senat/Pembina)
            {t.tgl_setor ? ` — ${t.tgl_setor}` : ' — belum disetor'}
          </p>
          <p className="text-sm">
            {t.verif_pembina_oleh ? '✅' : '⏳'} Verifikasi Pembina (1/2)
            {t.verif_pembina_oleh ? ` — ${t.verif_pembina_oleh}` : ' — menunggu'}
          </p>
          <p className="text-sm">⏳ Verifikasi PPK/Admin (2/2) — menunggu, memicu LUNAS</p>
        </Card>
      )}

      <Card>
        <p className="mb-2 text-sm font-semibold text-gray-600">Riwayat Surat Peringatan</p>
        {spQ.memuat && !spQ.data && <LoadingSpinner />}
        {spQ.data?.sp?.length === 0 && <p className="text-sm text-gray-400">Belum ada SP terbit.</p>}
        {spQ.data?.sp?.map((s) => (
          <div key={s.sp_id} className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0">
            <div>
              <p className="font-medium">SP-{s.level}: {s.no_surat}</p>
              <p className="text-xs text-gray-400">Terbit {s.tgl_terbit} · Tenggat {s.tenggat}</p>
            </div>
            {s.drive_file_id && (
              <a href={urlDrive(s.drive_file_id)} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                Unduh PDF
              </a>
            )}
          </div>
        ))}
      </Card>

      {t.status === 'TERTAGIH' && (session?.role === 'SENAT' || session?.role === 'PEMBINA') && (
        <Card className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-600">Setor Bukti Transfer ke Rekening Senat</p>
          <label className="block text-sm font-medium text-gray-700">Tanggal Setor</label>
          <input type="date" value={tglSetor} onChange={(e) => setTglSetor(e.target.value)}
            className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5" />
          <Button varian="garis" onClick={() => void pilihBerkas()}>
            {fotoNama ? `📎 ${fotoNama}` : '📷 Unggah Screenshot/Foto Bukti Transfer'}
          </Button>
          {galat && <p className="text-sm text-red-600">{galat}</p>}
          <Button onClick={() => void kirimSetor()} disabled={proses}>
            {proses ? 'Mengirim…' : 'Kirim Bukti Setor'}
          </Button>
        </Card>
      )}

      {t.status === 'TERTAGIH' && session?.role === 'PEMBINA' && t.tgl_setor && !t.verif_pembina_oleh && (
        <Card className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-gray-600">Verifikasi Pembina (1/2)</p>
          <p className="text-xs text-gray-500">Konfirmasi bukti transfer di atas benar dan sah.</p>
          {galat && <p className="text-sm text-red-600">{galat}</p>}
          <Button onClick={() => void verifikasiPembina()} disabled={proses}>
            {proses ? 'Memproses…' : '✅ Konfirmasi Bukti Transfer'}
          </Button>
        </Card>
      )}

      {t.status === 'TERTAGIH' && (session?.role === 'PPK' || session?.role === 'ADMIN') && (
        <Card className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-gray-600">Tindakan PPK/Admin</p>
          {t.tgl_setor && !t.verif_pembina_oleh && (
            <p className="text-xs text-amber-700">⏳ Menunggu verifikasi Pembina dulu (verifikasi ganda wajib).</p>
          )}
          {t.tgl_setor && t.verif_pembina_oleh && (
            <Button onClick={() => void verifikasiSetoran()} disabled={proses}>
              {proses ? 'Memproses…' : 'Verifikasi (2/2) → LUNAS'}
            </Button>
          )}
          {session?.role === 'PPK' && spQ.data && spQ.data.sp.length > 0 && (
            <Button varian="garis" onClick={() => void terbitkanUlangSp()} disabled={proses}>
              Terbitkan Ulang SP Level Aktif
            </Button>
          )}
          {session?.role === 'PPK' && (
            <Button varian="bahaya" onClick={() => setTampilHapus(true)} disabled={proses}>
              Hapuskan Tagihan
            </Button>
          )}
        </Card>
      )}

      {tampilHapus && (
        <ModalHapus
          onClose={() => setTampilHapus(false)}
          onSukses={() => { setTampilHapus(false); tagihanQ.refresh(); }}
          tagihanId={t.tagihan_id}
        />
      )}
    </div>
  );
}

function ModalHapus({ tagihanId, onClose, onSukses }: {
  tagihanId: string; onClose: () => void; onSukses: () => void;
}) {
  const { toast } = useToast();
  const [catatan, setCatatan] = useState('');
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');

  async function kirim() {
    if (!catatan.trim()) { setGalat('Catatan penghapusan wajib diisi.'); return; }
    setProses(true); setGalat('');
    try {
      await api('tagihan.waive', { tagihan_id: tagihanId, catatan_hapus: catatan.trim() });
      toast('Tagihan dihapuskan.', 'sukses');
      onSukses();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setProses(false);
    }
  }

  return (
    <Modal judul="Hapuskan Tagihan" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Input label="Catatan Penghapusan (wajib)" value={catatan} onChange={(e) => setCatatan(e.target.value)} autoFocus />
        {galat && <p className="text-sm text-red-600">{galat}</p>}
        <Button varian="bahaya" onClick={() => void kirim()} disabled={proses}>
          {proses ? 'Memproses…' : 'Hapuskan Tagihan'}
        </Button>
      </div>
    </Modal>
  );
}
