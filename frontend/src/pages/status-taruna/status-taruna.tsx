// /status-taruna (Pembina, Admin, BAAK) — input status harian individual &
// massal per kelas; BAAK juga pakai ini untuk surat taruna keluar kampus
// (PKL) & surat penarikan kembali, lampirkan lewat "Surat Pendukung".
import { useMemo, useState, type ChangeEvent } from 'react';
import { useAuth } from '../../auth/auth-context';
import { api } from '../../lib/api';
import { ambilFotoInput, kompresFotoBase64 } from '../../lib/foto';
import { aksiTulis } from '../../lib/sync';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useListCache } from '../../lib/use-list-cache';
import { SearchSelect } from '../../components/ui/search-select';
import { useToast } from '../../components/ui/toast';

interface Taruna { nit: string; nama: string; kelas: string; status: string }
interface StatusHarian { status_id: string; tanggal: string; nit: string; status: string }

// Urutan tampil: alasan non-kegiatan dulu, lalu kegiatan luar kampus (PKL/KPA/
// Magang/PTB), KEGIATAN_LUAR_KAMPUS sebagai catch-all "lainnya" di akhir.
const ENUM_STATUS = [
  'PESIAR', 'CUTI', 'SAKIT_RUMAH', 'PENUNDAAN_STUDI', 'TANPA_KETERANGAN',
  'PKL_1', 'PKL_2', 'PKL_3', 'KPA', 'MAGANG', 'PTB', 'KEGIATAN_LUAR_KAMPUS'
];

const LABEL_STATUS: Record<string, string> = {
  PESIAR: 'Pesiar', CUTI: 'Cuti', SAKIT_RUMAH: 'Sakit (Rumah)', PENUNDAAN_STUDI: 'Penundaan Studi',
  TANPA_KETERANGAN: 'Tanpa Keterangan (Alpa)',
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

/** Jumlah hari inklusif antara dua tanggal 'yyyy-MM-dd'. */
function jmlHari(dari: string, sampai: string): number {
  const a = new Date(dari + 'T00:00:00');
  const b = new Date(sampai + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

function tambahHari(tgl: string, n: number): string {
  const d = new Date(tgl + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

interface GrupMendatang { nit: string; status: string; sedangHariIni: boolean; tglAwal: string; tglAkhir: string }

export function HalamanStatusTaruna() {
  const { toast } = useToast();
  const tarunaQ = useListCache<{ taruna: Taruna[] }>('taruna.list', { status: 'AKTIF' });
  const dari = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10);
  }, []);
  const statusQ = useListCache<{ status: StatusHarian[] }>('status.list', { dari, sampai: hariIni() });
  const sampaiMendatang = useMemo(() => tambahHari(hariIni(), 186), []);
  const mendatangQ = useListCache<{ status: StatusHarian[] }>('status.list', { dari: hariIni(), sampai: sampaiMendatang });
  const [tglKembali, setTglKembali] = useState<Record<string, string>>({});
  const [prosesKembali, setProsesKembali] = useState<string>('');

  const grupMendatang = useMemo<GrupMendatang[]>(() => {
    const per: Record<string, StatusHarian[]> = {};
    (mendatangQ.data?.status ?? []).forEach((s) => { (per[s.nit] ??= []).push(s); });
    return Object.entries(per).map(([nit, baris]) => {
      const urut = baris.slice().sort((a, b) => a.tanggal.localeCompare(b.tanggal));
      return {
        nit,
        status: (urut.find((r) => r.tanggal === hariIni()) ?? urut[0]).status,
        sedangHariIni: urut.some((r) => r.tanggal === hariIni()),
        tglAwal: urut[0].tanggal,
        tglAkhir: urut[urut.length - 1].tanggal
      };
    }).sort((a, b) => (b.sedangHariIni ? 1 : 0) - (a.sedangHariIni ? 1 : 0));
  }, [mendatangQ.data]);

  async function tandaiKembali(nit: string) {
    setProsesKembali(nit);
    try {
      const r = await aksiTulis<{ jml_dibatalkan: number }>('status.tandai_kembali', { nit, tanggal_kembali: tglKembali[nit] || hariIni() });
      toast(r.antri ? 'Disimpan lokal, akan dikirim otomatis.' : `${r.data?.jml_dibatalkan ?? 0} hari status dibatalkan.`, 'sukses');
      mendatangQ.refresh();
      statusQ.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menandai kembali.', 'galat');
    } finally {
      setProsesKembali('');
    }
  }

  const [mode, setMode] = useState<'individu' | 'massal'>('individu');
  const [tanggal, setTanggal] = useState(hariIni());
  const [tglAkhir, setTglAkhir] = useState('');
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
    if (tglAkhir && tglAkhir < tanggal) { setGalat('Tanggal Sampai tidak boleh sebelum Mulai.'); return; }
    setProses(true); setGalat('');
    try {
      const r = await aksiTulis('status.set', {
        tanggal, tgl_akhir: tglAkhir || undefined, nit: nitTerpilih, status: statusPilih, berkas: berkasPayload()
      });
      const hari = tglAkhir ? jmlHari(tanggal, tglAkhir) : 1;
      toast(r.antri ? 'Disimpan lokal, akan dikirim otomatis.' : `Status tersimpan${hari > 1 ? ` untuk ${hari} hari` : ''}.`, 'sukses');
      statusQ.refresh();
      setNitTerpilih(''); setTglAkhir(''); setFotoNama(''); setFotoBase64('');
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setProses(false);
    }
  }

  async function simpanMassal() {
    if (nitMassal.size === 0) { setGalat('Pilih minimal satu taruna.'); return; }
    if (tglAkhir && tglAkhir < tanggal) { setGalat('Tanggal Sampai tidak boleh sebelum Mulai.'); return; }
    setProses(true); setGalat('');
    try {
      const r = await aksiTulis('status.batch', {
        tanggal, tgl_akhir: tglAkhir || undefined, status: statusPilih, nit: Array.from(nitMassal), berkas: berkasPayload()
      });
      const hari = tglAkhir ? jmlHari(tanggal, tglAkhir) : 1;
      toast(r.antri ? 'Disimpan lokal, akan dikirim otomatis.' : `${nitMassal.size} taruna tersimpan${hari > 1 ? ` × ${hari} hari` : ''}.`, 'sukses');
      statusQ.refresh();
      setNitMassal(new Set()); setTglAkhir(''); setFotoNama(''); setFotoBase64('');
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

      <KartuMigrasiPeriode />
      <KartuImporPeriode />

      <Card className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Button varian={mode === 'individu' ? 'utama' : 'garis'} className="flex-1" onClick={() => setMode('individu')}>Individu</Button>
          <Button varian={mode === 'massal' ? 'utama' : 'garis'} className="flex-1" onClick={() => setMode('massal')}>Massal (Kelas)</Button>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">Mulai</label>
            <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)}
              className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5" />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">Sampai (opsional)</label>
            <input type="date" value={tglAkhir} min={tanggal} onChange={(e) => setTglAkhir(e.target.value)}
              className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5" />
          </div>
        </div>
        {statusPilih === 'TANPA_KETERANGAN' ? (
          <p className="-mt-2 text-xs text-amber-600">
            Tanpa Keterangan: kosongkan "Sampai" → berlaku <strong>setiap hari sampai dicabut</strong>{' '}
            (isi otomatis s/d akhir kontrak). Cabut lewat tombol "Tandai Sudah Kembali" saat taruna kembali.
          </p>
        ) : (
          <p className="-mt-2 text-xs text-gray-400">Kosongkan "Sampai" jika hanya satu hari.</p>
        )}

        <label className="block text-sm font-medium text-gray-700">Status</label>
        <select value={statusPilih} onChange={(e) => setStatusPilih(e.target.value)}
          className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5">
          {ENUM_STATUS.map((s) => <option key={s} value={s}>{labelStatus(s)}</option>)}
        </select>

        {mode === 'individu' ? (
          <>
            <SearchSelect
              label="Taruna"
              value={nitTerpilih}
              onChange={setNitTerpilih}
              placeholder="Ketik nama atau NIT untuk mencari…"
              opsi={daftarTaruna.map((t) => ({ value: t.nit, label: `${t.nama} (${t.nit})` }))}
            />
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

      <h2 className="text-sm font-semibold text-gray-600">Sedang / Akan Berstatus ({grupMendatang.length})</h2>
      <p className="-mt-2 text-xs text-gray-400">
        Taruna dengan status ke depan (hari ini s.d. yang sudah diinput). Bila sudah kembali lebih cepat
        dari tanggal yang diinput, tandai di sini agar tidak salah tercatat "di luar" di rekap.
      </p>
      {mendatangQ.memuat && !mendatangQ.data && <LoadingSpinner />}
      {grupMendatang.length === 0 && !mendatangQ.memuat && <EmptyState pesan="Tidak ada taruna berstatus ke depan." />}
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4 xl:grid-cols-3">
        {grupMendatang.map((g) => {
          const t = daftarTaruna.find((x) => x.nit === g.nit);
          return (
            <Card key={g.nit} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t?.nama ?? g.nit}</p>
                  <p className="text-xs text-gray-400">
                    {g.sedangHariIni ? 'Sedang di luar' : `Mulai ${g.tglAwal}`} · s.d. {g.tglAkhir}
                  </p>
                </div>
                <Badge status="DIKEMBALIKAN">{labelStatus(g.status)}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <input type="date" min={hariIni()} max={g.tglAkhir}
                  value={tglKembali[g.nit] || hariIni()}
                  onChange={(e) => setTglKembali((s) => ({ ...s, [g.nit]: e.target.value }))}
                  className="min-h-tap flex-1 rounded-xl border border-gray-300 px-2 py-1.5 text-sm" />
                <Button varian="garis" onClick={() => void tandaiKembali(g.nit)} disabled={prosesKembali === g.nit}>
                  {prosesKembali === g.nit ? 'Memproses…' : 'Tandai Sudah Kembali'}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

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

interface HasilMigrasi {
  dry_run?: boolean; luar_rows?: number; periode?: number; sisa_status_harian?: number;
  migrasi?: number; contoh?: { nit: string; status: string; tgl_mulai: string; tgl_akhir: string }[];
}

/** ADMIN saja: migrasi baris STATUS_HARIAN luar kampus (per hari) → PERIODE_LUAR
 * (rentang). Dry-run dulu untuk pratinjau, lalu jalankan. */
function KartuMigrasiPeriode() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [pratinjau, setPratinjau] = useState<HasilMigrasi | null>(null);
  const [proses, setProses] = useState(false);
  if (session?.role !== 'ADMIN') return null;

  async function jalankan(dryRun: boolean) {
    if (!dryRun && !window.confirm(
      'Migrasi akan mengubah baris STATUS_HARIAN luar kampus (per hari) menjadi PERIODE_LUAR (rentang) dan menghapus baris harian tsb. Hari efektif tetap sama. Lanjut?'
    )) return;
    setProses(true);
    try {
      const r = await api<HasilMigrasi>('luar.migrasi_periode', { dry_run: dryRun });
      if (dryRun) {
        setPratinjau(r);
        toast(`Pratinjau: ${r.luar_rows} baris → ${r.periode} periode (sisa harian ${r.sisa_status_harian}).`, 'sukses');
      } else {
        setPratinjau(null);
        toast(`Migrasi selesai: ${r.migrasi} baris → ${r.periode} periode.`, 'sukses');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  return (
    <Card className="flex flex-col gap-2 border-amber-200 bg-amber-50/40">
      <p className="text-sm font-semibold text-amber-800">🛠️ Migrasi Luar Kampus → Periode (Admin, sekali jalan)</p>
      <p className="text-xs text-gray-600">
        Mengubah status luar kampus (PKL/KPA/Magang/PTB) dari per-hari menjadi 1 baris periode per taruna — hemat &amp;
        cepat. Hari efektif tidak berubah. Klik <b>Pratinjau</b> dulu.
      </p>
      {pratinjau && (
        <div className="rounded-lg bg-white p-2 text-xs text-gray-700">
          <p><b>{pratinjau.luar_rows}</b> baris harian luar kampus → <b>{pratinjau.periode}</b> periode · sisa harian non-luar: {pratinjau.sisa_status_harian}</p>
          {pratinjau.contoh && pratinjau.contoh.length > 0 && (
            <ul className="mt-1 list-disc pl-4">
              {pratinjau.contoh.map((c, i) => (
                <li key={i}>{c.nit} · {c.status.replace(/_/g, ' ')} · {c.tgl_mulai} s.d {c.tgl_akhir}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <Button varian="garis" className="flex-1" disabled={proses} onClick={() => void jalankan(true)}>
          {proses ? '…' : '🔍 Pratinjau'}
        </Button>
        <Button className="flex-1" disabled={proses || !pratinjau || !pratinjau.periode} onClick={() => void jalankan(false)}>
          {proses ? 'Memproses…' : 'Jalankan Migrasi'}
        </Button>
      </div>
    </Card>
  );
}

/** ADMIN saja: impor massal periode luar kampus dari CSV
 * (nit,status,tgl_mulai,tgl_akhir). Untuk rekap PKL/KPA se-angkatan dari Excel. */
function KartuImporPeriode() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [baris, setBaris] = useState<{ nit: string; status: string; tgl_mulai: string; tgl_akhir: string }[]>([]);
  const [namaFile, setNamaFile] = useState('');
  const [proses, setProses] = useState(false);
  const [hasil, setHasil] = useState<{ dibuat: number; dobel: number; dilewati_nit: string[] } | null>(null);
  if (session?.role !== 'ADMIN') return null;

  function bacaCsv(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNamaFile(file.name); setHasil(null);
    const reader = new FileReader();
    reader.onload = () => {
      const teks = String(reader.result || '');
      const lines = teks.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const out: { nit: string; status: string; tgl_mulai: string; tgl_akhir: string }[] = [];
      lines.forEach((l, i) => {
        const c = l.split(',').map((x) => x.trim());
        if (i === 0 && /nit/i.test(c[0])) return; // header
        if (c.length < 4) return;
        out.push({ nit: c[0], status: c[1], tgl_mulai: c[2], tgl_akhir: c[3] });
      });
      setBaris(out);
      toast(`${out.length} baris terbaca dari CSV.`, 'sukses');
    };
    reader.readAsText(file);
  }

  async function impor() {
    if (!baris.length) { toast('Unggah CSV dulu.', 'galat'); return; }
    setProses(true);
    try {
      const r = await api<{ dibuat: number; dobel: number; dilewati_nit: string[] }>('periode.impor', { baris });
      setHasil(r);
      toast(`${r.dibuat} periode dibuat · ${r.dobel} duplikat dilewati · ${r.dilewati_nit.length} NIT tak cocok.`, 'sukses');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal impor.', 'galat');
    } finally {
      setProses(false);
    }
  }

  return (
    <Card className="flex flex-col gap-2 border-teal-200 bg-teal-50/40">
      <p className="text-sm font-semibold text-primary-dark">📥 Impor Periode Luar Kampus dari CSV (Admin)</p>
      <p className="text-xs text-gray-600">
        Kolom CSV: <code>nit,status,tgl_mulai,tgl_akhir</code> (status: PKL_2/PKL_3/KPA/PTB/MAGANG/dst; tanggal YYYY-MM-DD).
        NIT yang tak ada di data taruna akan dilewati &amp; dilaporkan. Aman diulang (duplikat dilewati).
      </p>
      <input type="file" accept=".csv,text/csv" onChange={bacaCsv} className="text-sm" />
      {namaFile && <p className="text-xs text-gray-500">{namaFile} — {baris.length} baris siap.</p>}
      {hasil && (
        <div className="rounded-lg bg-white p-2 text-xs text-gray-700">
          <p>✅ Dibuat: <b>{hasil.dibuat}</b> · Duplikat dilewati: {hasil.dobel} · NIT tak cocok: <b>{hasil.dilewati_nit.length}</b></p>
          {hasil.dilewati_nit.length > 0 && (
            <p className="mt-1 text-amber-700 break-words">Tak cocok: {hasil.dilewati_nit.slice(0, 30).join(', ')}{hasil.dilewati_nit.length > 30 ? ' …' : ''}</p>
          )}
        </div>
      )}
      <Button disabled={proses || baris.length === 0} onClick={() => void impor()}>
        {proses ? 'Mengimpor…' : `Impor ${baris.length} Periode`}
      </Button>
    </Card>
  );
}
