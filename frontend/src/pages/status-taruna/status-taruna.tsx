// /status-taruna (Pembina, Admin, BAAK) — input status harian individual &
// massal per kelas; BAAK juga pakai ini untuk surat taruna keluar kampus
// (PKL) & surat penarikan kembali, lampirkan lewat "Surat Pendukung".
import { useMemo, useState } from 'react';
import { ambilFotoInput, kompresFotoBase64 } from '../../lib/foto';
import { aksiTulis } from '../../lib/sync';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useListCache } from '../../lib/use-list-cache';
import { useToast } from '../../components/ui/toast';

interface Taruna { nit: string; nama: string; kelas: string; status: string }
interface StatusHarian { status_id: string; tanggal: string; nit: string; status: string }

// Urutan tampil: alasan non-kegiatan dulu, lalu kegiatan luar kampus (PKL/KPA/
// Magang/PTB), KEGIATAN_LUAR_KAMPUS sebagai catch-all "lainnya" di akhir.
const ENUM_STATUS = [
  'PESIAR', 'CUTI', 'SAKIT_RUMAH', 'PENUNDAAN_STUDI',
  'PKL_1', 'PKL_2', 'PKL_3', 'KPA', 'MAGANG', 'PTB', 'KEGIATAN_LUAR_KAMPUS'
];

const LABEL_STATUS: Record<string, string> = {
  PESIAR: 'Pesiar', CUTI: 'Cuti', SAKIT_RUMAH: 'Sakit (Rumah)', PENUNDAAN_STUDI: 'Penundaan Studi',
  PKL_1: 'PKL I', PKL_2: 'PKL II', PKL_3: 'PKL III', KPA: 'KPA', MAGANG: 'Magang', PTB: 'PTB',
  KEGIATAN_LUAR_KAMPUS: 'Kegiatan Luar Kampus (lainnya)'
};

/** Label tampilan status; fallback ganti underscore jadi spasi utk nilai tak dikenal. */
function labelStatus(s: string): string {
  return LABEL_STATUS[s] ?? s.replace(/_/g, ' ');
}

function hariIni(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HalamanStatusTaruna() {
  const { toast } = useToast();
  const tarunaQ = useListCache<{ taruna: Taruna[] }>('taruna.list', { status: 'AKTIF' });
  const dari = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10);
  }, []);
  const statusQ = useListCache<{ status: StatusHarian[] }>('status.list', { dari, sampai: hariIni() });

  const [mode, setMode] = useState<'individu' | 'massal'>('individu');
  const [tanggal, setTanggal] = useState(hariIni());
  const [statusPilih, setStatusPilih] = useState(ENUM_STATUS[0]);
  const [nitTerpilih, setNitTerpilih] = useState('');
  const [kelasTerpilih, setKelasTerpilih] = useState('');
  const [nitMassal, setNitMassal] = useState<Set<string>>(new Set());
  const [fotoNama, setFotoNama] = useState('');
  const [fotoBase64, setFotoBase64] = useState('');
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');

  const daftarTaruna = tarunaQ.data?.taruna ?? [];
  const kelasUnik = Array.from(new Set(daftarTaruna.map((t) => t.kelas))).sort();
  const anggotaKelas = daftarTaruna.filter((t) => t.kelas === kelasTerpilih);

  async function pilihBerkas() {
    const file = await ambilFotoInput();
    if (!file) return;
    setFotoNama(file.name);
    setFotoBase64(await kompresFotoBase64(file));
  }

  function berkasPayload() {
    return fotoBase64 ? { base64: fotoBase64, nama_file: fotoNama || 'surat.jpg', jenis: 'SURAT' } : undefined;
  }

  async function simpanIndividu() {
    if (!nitTerpilih) { setGalat('Pilih taruna.'); return; }
    setProses(true); setGalat('');
    try {
      const r = await aksiTulis('status.set', { tanggal, nit: nitTerpilih, status: statusPilih, berkas: berkasPayload() });
      toast(r.antri ? 'Disimpan lokal, akan dikirim otomatis.' : 'Status tersimpan.', 'sukses');
      statusQ.refresh();
      setNitTerpilih(''); setFotoNama(''); setFotoBase64('');
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setProses(false);
    }
  }

  async function simpanMassal() {
    if (nitMassal.size === 0) { setGalat('Pilih minimal satu taruna.'); return; }
    setProses(true); setGalat('');
    try {
      const r = await aksiTulis('status.batch', {
        tanggal, status: statusPilih, nit: Array.from(nitMassal), berkas: berkasPayload()
      });
      toast(r.antri ? 'Disimpan lokal, akan dikirim otomatis.' : `${nitMassal.size} taruna tersimpan.`, 'sukses');
      statusQ.refresh();
      setNitMassal(new Set()); setFotoNama(''); setFotoBase64('');
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setProses(false);
    }
  }

  function toggleNit(nit: string) {
    setNitMassal((s) => {
      const baru = new Set(s);
      if (baru.has(nit)) baru.delete(nit); else baru.add(nit);
      return baru;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-primary-dark">Status Taruna</h1>

      <Card className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Button varian={mode === 'individu' ? 'utama' : 'garis'} className="flex-1" onClick={() => setMode('individu')}>Individu</Button>
          <Button varian={mode === 'massal' ? 'utama' : 'garis'} className="flex-1" onClick={() => setMode('massal')}>Massal (Kelas)</Button>
        </div>

        <label className="block text-sm font-medium text-gray-700">Tanggal</label>
        <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)}
          className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5" />

        <label className="block text-sm font-medium text-gray-700">Status</label>
        <select value={statusPilih} onChange={(e) => setStatusPilih(e.target.value)}
          className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5">
          {ENUM_STATUS.map((s) => <option key={s} value={s}>{labelStatus(s)}</option>)}
        </select>

        {mode === 'individu' ? (
          <>
            <label className="block text-sm font-medium text-gray-700">Taruna</label>
            <select value={nitTerpilih} onChange={(e) => setNitTerpilih(e.target.value)}
              className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5">
              <option value="">— Pilih taruna —</option>
              {daftarTaruna.map((t) => <option key={t.nit} value={t.nit}>{t.nama} ({t.nit})</option>)}
            </select>
          </>
        ) : (
          <>
            <label className="block text-sm font-medium text-gray-700">Kelas</label>
            <select value={kelasTerpilih} onChange={(e) => { setKelasTerpilih(e.target.value); setNitMassal(new Set()); }}
              className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5">
              <option value="">— Pilih kelas —</option>
              {kelasUnik.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            {kelasTerpilih && (
              <div className="flex flex-col gap-1 rounded-xl border border-gray-200 p-2">
                <button className="text-left text-sm text-primary underline"
                  onClick={() => setNitMassal(new Set(anggotaKelas.map((t) => t.nit)))}>
                  Pilih semua ({anggotaKelas.length})
                </button>
                {anggotaKelas.map((t) => (
                  <label key={t.nit} className="flex min-h-tap items-center gap-2 text-sm">
                    <input type="checkbox" checked={nitMassal.has(t.nit)} onChange={() => toggleNit(t.nit)} className="h-5 w-5" />
                    {t.nama} ({t.nit})
                  </label>
                ))}
              </div>
            )}
          </>
        )}

        <Button varian="garis" onClick={() => void pilihBerkas()}>
          {fotoNama ? `📎 ${fotoNama}` : '📷 Lampirkan Surat Pendukung (opsional)'}
        </Button>

        {galat && <p className="text-sm text-red-600">{galat}</p>}
        <Button onClick={() => void (mode === 'individu' ? simpanIndividu() : simpanMassal())} disabled={proses}>
          {proses ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </Card>

      <h2 className="text-sm font-semibold text-gray-600">Riwayat 14 Hari Terakhir</h2>
      {statusQ.memuat && !statusQ.data && <LoadingSpinner />}
      {statusQ.galat && !statusQ.data && <ErrorMessage pesan={statusQ.galat} onRetry={statusQ.refresh} />}
      {statusQ.data?.status?.length === 0 && <EmptyState pesan="Tidak ada status tercatat." />}
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4 xl:grid-cols-3">
        {(statusQ.data?.status ?? [])
          .slice().sort((a, b) => b.tanggal.localeCompare(a.tanggal))
          .map((s) => {
            const t = daftarTaruna.find((x) => x.nit === s.nit);
            return (
              <Card key={s.status_id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t?.nama ?? s.nit}</p>
                  <p className="text-xs text-gray-400">{s.tanggal}</p>
                </div>
                <Badge status="DIKEMBALIKAN">{labelStatus(s.status)}</Badge>
              </Card>
            );
          })}
      </div>
    </div>
  );
}
