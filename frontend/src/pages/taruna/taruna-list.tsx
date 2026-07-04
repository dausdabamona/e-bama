// /taruna (Admin, BAAK) — CRUD data taruna + tautan impor CSV.
// Tombol "Rekening Lengkap" HANYA tampil untuk role ADMIN (persembunyian
// frontend saja — backend tetap yang menegakkan lewat rekening.simpan
// role:['ADMIN'], lihat 22_rekening.gs & CLAUDE.md §4/§7).
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { Input } from '../../components/ui/input';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { Modal } from '../../components/ui/modal';
import { useToast } from '../../components/ui/toast';
import { api } from '../../lib/api';
import { useListCache } from '../../lib/use-list-cache';
import { validasiRekMask, type Taruna } from './tipe';

const BANK = ['BNI', 'BSI'];
const STATUS = ['AKTIF', 'NONAKTIF'];

export function HalamanTarunaList() {
  const { session } = useAuth();
  const { data, memuat, galat, refresh } = useListCache<{ taruna: Taruna[] }>('taruna.list', {});
  const [modal, setModal] = useState<Taruna | 'baru' | null>(null);
  const [modalRekening, setModalRekening] = useState<Taruna | null>(null);

  const [cari, setCari] = useState('');
  const [filterProdi, setFilterProdi] = useState('');
  const [filterTingkat, setFilterTingkat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const semua = data?.taruna;
  const prodiOpsi = useMemo(() => Array.from(new Set((semua ?? []).map((t) => t.prodi).filter(Boolean))).sort(), [semua]);
  const tingkatOpsi = useMemo(() => Array.from(new Set((semua ?? []).map((t) => t.tingkat).filter(Boolean))).sort(), [semua]);

  const hasil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (semua ?? [])
      .filter((t) => {
        if (q && !(t.nama.toLowerCase().includes(q) || t.nit.toLowerCase().includes(q))) return false;
        if (filterProdi && t.prodi !== filterProdi) return false;
        if (filterTingkat && t.tingkat !== filterTingkat) return false;
        if (filterStatus && t.status !== filterStatus) return false;
        return true;
      })
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }, [semua, cari, filterProdi, filterTingkat, filterStatus]);

  const adaFilter = !!(cari || filterProdi || filterTingkat || filterStatus);

  return (
    <div className="flex flex-col gap-4">
      {/* Header + search + filter — sticky di bawah header aplikasi. Offset sedikit
          di bawah tinggi header (~68px mobile) supaya header aplikasi yang opak
          menutup tumpang tindih tanpa celah. -mx supaya latar membentang penuh kolom. */}
      <div className="sticky top-[64px] z-30 -mx-4 flex flex-col gap-2 border-b border-gray-200 bg-ivory px-4 py-3 lg:top-[72px] lg:-mx-8 lg:px-8">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-primary-dark">Data Taruna</h1>
          <div className="flex gap-2">
            <Link to="/taruna/impor"><Button varian="garis">Impor CSV</Button></Link>
            {session?.role === 'ADMIN' && (
              <Link to="/taruna/impor-rekening"><Button varian="garis">🔒 Impor Rekening</Button></Link>
            )}
            <Button onClick={() => setModal('baru')}>+ Tambah</Button>
          </div>
        </div>

        <input
          type="search"
          placeholder="Cari nama atau NIT…"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-light"
        />

        <div className="flex flex-wrap items-center gap-2">
          <select value={filterProdi} onChange={(e) => setFilterProdi(e.target.value)}
            className="min-h-tap min-w-[6rem] flex-1 rounded-xl border border-gray-300 px-2 py-1.5 text-sm">
            <option value="">Semua Prodi</option>
            {prodiOpsi.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filterTingkat} onChange={(e) => setFilterTingkat(e.target.value)}
            className="min-h-tap min-w-[6rem] flex-1 rounded-xl border border-gray-300 px-2 py-1.5 text-sm">
            <option value="">Semua Tingkat</option>
            {tingkatOpsi.map((t) => <option key={t} value={t}>Tk.{t}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="min-h-tap min-w-[6rem] flex-1 rounded-xl border border-gray-300 px-2 py-1.5 text-sm">
            <option value="">Semua Status</option>
            {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{hasil.length} taruna{adaFilter ? ' (terfilter)' : ''}</span>
          {adaFilter && (
            <button className="font-semibold text-primary"
              onClick={() => { setCari(''); setFilterProdi(''); setFilterTingkat(''); setFilterStatus(''); }}>
              Reset filter
            </button>
          )}
        </div>
      </div>

      {memuat && !data && <LoadingSpinner label="Memuat data taruna…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}
      {data && data.taruna.length === 0 && <EmptyState pesan="Belum ada data taruna." />}
      {data && data.taruna.length > 0 && hasil.length === 0 && <EmptyState pesan="Tidak ada taruna yang cocok dengan pencarian/filter." />}

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4 xl:grid-cols-3">
        {hasil.map((t) => (
            <Card key={t.nit} className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1 active:bg-primary-light/30" onClick={() => setModal(t)}>
                <p className="font-semibold">{t.nama}</p>
                <p className="text-sm text-gray-500">{t.nit} · {t.prodi} · Tk.{t.tingkat} · {t.kelas}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {session?.role === 'ADMIN' && (
                  <Button varian="polos" className="px-2 text-xs" onClick={() => setModalRekening(t)}>🔒 Rekening</Button>
                )}
                <Badge status={t.status} />
              </div>
            </Card>
          ))}
      </div>

      {modal && (
        <ModalForm
          awal={modal === 'baru' ? null : modal}
          onClose={() => setModal(null)}
          onSukses={() => { setModal(null); refresh(); }}
        />
      )}

      {modalRekening && (
        <ModalRekening taruna={modalRekening} onClose={() => setModalRekening(null)} />
      )}
    </div>
  );
}

/**
 * Form rekening lengkap (Admin saja) — nomor rekening PENUH, BUKAN rek_mask.
 * Dimuat via rekening.lihat_lengkap (Admin juga berwenang aksi itu) supaya
 * form terisi otomatis kalau sudah pernah diisi sebelumnya.
 */
function ModalRekening({ taruna, onClose }: { taruna: Taruna; onClose: () => void }) {
  const { toast } = useToast();
  const [noRek, setNoRek] = useState('');
  const [bank, setBank] = useState(taruna.bank || BANK[0]);
  const [namaPemilik, setNamaPemilik] = useState('');
  const [memuat, setMemuat] = useState(true);
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        const r = await api<{ rekening: { nit: string; no_rekening_lengkap: string; bank: 'BNI' | 'BSI'; nama_pemilik: string }[] }>(
          'rekening.lihat_lengkap', { nit: taruna.nit }
        );
        if (batal) return;
        const baris = r.rekening[0];
        if (baris && baris.no_rekening_lengkap) {
          setNoRek(baris.no_rekening_lengkap);
          setBank(baris.bank || BANK[0] as 'BNI' | 'BSI');
          setNamaPemilik(baris.nama_pemilik || '');
        }
      } catch (e) {
        if (!batal) setGalat(e instanceof Error ? e.message : 'Gagal memuat rekening.');
      } finally {
        if (!batal) setMemuat(false);
      }
    })();
    return () => { batal = true; };
  }, [taruna.nit]);

  async function simpan() {
    if (!noRek.trim()) { setGalat('Nomor rekening lengkap wajib diisi.'); return; }
    if (!namaPemilik.trim()) { setGalat('Nama pemilik rekening wajib diisi.'); return; }
    setProses(true); setGalat('');
    try {
      await api('rekening.simpan', {
        nit: taruna.nit, no_rekening_lengkap: noRek.trim(), bank, nama_pemilik: namaPemilik.trim()
      });
      toast('Rekening lengkap tersimpan.', 'sukses');
      onClose();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setProses(false);
    }
  }

  return (
    <Modal judul={`Rekening Lengkap — ${taruna.nama}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-xs text-gray-500">
          Data sensitif — setiap pembacaan tercatat di Log Audit (siapa, kapan).
          Nomor rekening lengkap HANYA dipakai internal Form 07/08, tidak pernah
          ditampilkan di halaman/laporan lain (lihat CLAUDE.md §4/§7).
        </p>
        {memuat && <LoadingSpinner label="Memuat…" />}
        {!memuat && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Bank</label>
              <select value={bank} onChange={(e) => setBank(e.target.value as 'BNI' | 'BSI')}
                className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5">
                {BANK.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <Input label="Nomor Rekening Lengkap" value={noRek} onChange={(e) => setNoRek(e.target.value)} inputMode="numeric" />
            <Input label="Nama Pemilik Rekening" value={namaPemilik} onChange={(e) => setNamaPemilik(e.target.value)} />
            {galat && <p className="text-sm text-red-600">{galat}</p>}
            <Button onClick={() => void simpan()} disabled={proses}>
              {proses ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}

function ModalForm({ awal, onClose, onSukses }: {
  awal: Taruna | null; onClose: () => void; onSukses: () => void;
}) {
  const { toast } = useToast();
  const [nit, setNit] = useState(awal?.nit ?? '');
  const [nama, setNama] = useState(awal?.nama ?? '');
  const [prodi, setProdi] = useState(awal?.prodi ?? '');
  const [tingkat, setTingkat] = useState(awal?.tingkat ?? '');
  const [kelas, setKelas] = useState(awal?.kelas ?? '');
  const [bank, setBank] = useState(awal?.bank ?? BANK[0]);
  const [rek, setRek] = useState(awal ? awal.rek_mask.replace(/\D/g, '') : '');
  const [status, setStatus] = useState(awal?.status ?? 'AKTIF');
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');

  async function simpan() {
    if (!nit.trim() || !nama.trim()) { setGalat('NIT dan nama wajib diisi.'); return; }
    const v = validasiRekMask(rek);
    if (!v.ok) { setGalat(v.pesan); return; }

    setProses(true); setGalat('');
    try {
      await api('taruna.upsert', {
        nit: nit.trim(), nama: nama.trim(), prodi: prodi.trim(), tingkat: tingkat.trim(),
        kelas: kelas.trim(), bank, rek_mask: rek.replace(/\D/g, ''), status
      });
      toast('Data taruna tersimpan.', 'sukses');
      onSukses();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setProses(false);
    }
  }

  return (
    <Modal judul={awal ? 'Ubah Taruna' : 'Tambah Taruna'} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Input label="NIT" value={nit} onChange={(e) => setNit(e.target.value)} disabled={!!awal} />
        <Input label="Nama" value={nama} onChange={(e) => setNama(e.target.value)} />
        <div className="flex gap-2">
          <Input label="Prodi" value={prodi} onChange={(e) => setProdi(e.target.value)} />
          <Input label="Tingkat" value={tingkat} onChange={(e) => setTingkat(e.target.value)} />
        </div>
        <Input label="Kelas" value={kelas} onChange={(e) => setKelas(e.target.value)} />
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">Bank</label>
            <select value={bank} onChange={(e) => setBank(e.target.value)}
              className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5">
              {BANK.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <Input label="4 Digit Terakhir Rekening" value={rek} onChange={(e) => setRek(e.target.value)} maxLength={4} inputMode="numeric" className="flex-1" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as 'AKTIF' | 'NONAKTIF')}
            className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5">
            {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {galat && <p className="text-sm text-red-600">{galat}</p>}
        <Button onClick={() => void simpan()} disabled={proses}>
          {proses ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </div>
    </Modal>
  );
}
