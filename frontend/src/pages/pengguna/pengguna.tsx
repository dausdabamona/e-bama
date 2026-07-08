// /pengguna (Admin) — lihat semua pengguna saat ini + CRUD lengkap & reset kata sandi.
// "Hapus" = nonaktifkan (status NONAKTIF) — akun tidak dihapus permanen agar
// riwayat AUDIT_LOG (FK ke user_id) tetap utuh.
import { useMemo, useState } from 'react';
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

interface Pengguna { user_id: string; nama: string; role: string; status: string; penyedia_id?: string; prodi?: string }
interface Penyedia { penyedia_id: string; nama: string }
interface TarunaProdi { prodi: string }

const ROLES = ['KPA', 'PPK', 'STAF_PPK', 'SENAT', 'PEMBINA', 'ADMIN', 'WADIR3', 'BAAK', 'PENYEDIA', 'KETUA_JURUSAN', 'OPERATOR_SAKTI'];

export function HalamanPengguna() {
  const { toast } = useToast();
  const { data, memuat, galat, refresh } = useListCache<{ pengguna: Pengguna[] }>('pengguna.list', {});
  const [modal, setModal] = useState<Pengguna | 'baru' | null>(null);
  const [filterRole, setFilterRole] = useState('');
  const [cari, setCari] = useState('');
  const [proses, setProses] = useState<string | null>(null);

  const daftar = useMemo(() => {
    return (data?.pengguna ?? [])
      .filter((p) => !filterRole || p.role === filterRole)
      .filter((p) => {
        const q = cari.trim().toLowerCase();
        return !q || p.nama.toLowerCase().includes(q) || p.user_id.toLowerCase().includes(q);
      })
      .sort((a, b) => a.role.localeCompare(b.role) || a.nama.localeCompare(b.nama));
  }, [data, filterRole, cari]);

  const jmlAktif = (data?.pengguna ?? []).filter((p) => p.status === 'AKTIF').length;
  const jmlTotal = data?.pengguna?.length ?? 0;

  async function resetPin(userId: string) {
    try {
      // Action tetap pengguna.reset_pin (kontrak API) — mereset kata sandi ke default.
      await api('pengguna.reset_pin', { user_id: userId });
      toast(`Kata sandi ${userId} direset ke default (123456).`, 'sukses');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    }
  }

  async function toggleStatus(p: Pengguna) {
    const statusBaru = p.status === 'AKTIF' ? 'NONAKTIF' : 'AKTIF';
    setProses(p.user_id);
    try {
      await api('pengguna.upsert', { user_id: p.user_id, nama: p.nama, role: p.role, status: statusBaru, penyedia_id: p.penyedia_id ?? '', prodi: p.prodi ?? '' });
      toast(`${p.nama} → ${statusBaru}.`, 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary-dark">Pengguna</h1>
        <Button onClick={() => setModal('baru')}>+ Tambah</Button>
      </div>

      {data && (
        <Card className="text-sm text-gray-600">
          <span className="font-semibold text-primary-dark">{jmlTotal}</span> pengguna terdaftar ·{' '}
          <span className="font-semibold text-green-700">{jmlAktif} aktif</span> ·{' '}
          <span className="font-semibold text-gray-500">{jmlTotal - jmlAktif} nonaktif</span>
        </Card>
      )}

      <div className="flex gap-2">
        <Input placeholder="Cari nama / ID…" value={cari} onChange={(e) => setCari(e.target.value)} className="flex-1" />
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
          className="min-h-tap rounded-xl border border-gray-300 px-3 py-2.5 text-sm">
          <option value="">Semua Role</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {memuat && !data && <LoadingSpinner label="Memuat pengguna…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}
      {data && daftar.length === 0 && <EmptyState pesan="Tidak ada pengguna yang cocok." />}

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4 xl:grid-cols-3">
        {daftar.map((p) => (
          <Card key={p.user_id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{p.nama}</p>
                <p className="text-sm text-gray-500">{p.user_id} · {p.role}</p>
              </div>
              <Badge status={p.status} />
            </div>
            <div className="flex gap-2">
              <Button varian="garis" className="flex-1" onClick={() => setModal(p)}>Ubah</Button>
              <Button varian="garis" className="flex-1" onClick={() => void resetPin(p.user_id)}>Reset Sandi</Button>
            </div>
            <Button
              varian={p.status === 'AKTIF' ? 'bahaya' : 'utama'}
              onClick={() => void toggleStatus(p)}
              disabled={proses === p.user_id}
            >
              {proses === p.user_id ? 'Memproses…' : p.status === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan Kembali'}
            </Button>
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
    </div>
  );
}

function ModalForm({ awal, onClose, onSukses }: {
  awal: Pengguna | null; onClose: () => void; onSukses: () => void;
}) {
  const { toast } = useToast();
  const [userId, setUserId] = useState(awal?.user_id ?? '');
  const [nama, setNama] = useState(awal?.nama ?? '');
  const [role, setRole] = useState(awal?.role ?? ROLES[0]);
  const [status, setStatus] = useState(awal?.status ?? 'AKTIF');
  const [penyediaId, setPenyediaId] = useState(awal?.penyedia_id ?? '');
  const [prodi, setProdi] = useState(awal?.prodi ?? '');
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');

  // Daftar penyedia hanya perlu saat role PENYEDIA (untuk menautkan akun).
  const penyediaQ = useListCache<{ penyedia: Penyedia[] }>('penyedia.list', {});
  // Daftar prodi (dari data taruna) untuk menautkan akun KETUA_JURUSAN.
  const tarunaQ = useListCache<{ taruna: TarunaProdi[] }>('taruna.list', {});
  const daftarProdi = Array.from(new Set((tarunaQ.data?.taruna ?? []).map((t) => t.prodi).filter(Boolean))).sort();

  async function simpan() {
    if (!userId.trim() || !nama.trim()) { setGalat('user_id dan nama wajib diisi.'); return; }
    if (role === 'PENYEDIA' && !penyediaId) { setGalat('Pilih penyedia yang ditautkan ke akun ini.'); return; }
    if (role === 'KETUA_JURUSAN' && !prodi) { setGalat('Pilih prodi yang ditautkan ke akun Ketua Jurusan ini.'); return; }
    setProses(true); setGalat('');
    try {
      await api('pengguna.upsert', {
        user_id: userId.trim(), nama: nama.trim(), role, status,
        penyedia_id: role === 'PENYEDIA' ? penyediaId : '',
        prodi: role === 'KETUA_JURUSAN' ? prodi : ''
      });
      toast(awal ? 'Pengguna diperbarui.' : 'Pengguna baru dibuat (kata sandi default 123456).', 'sukses');
      onSukses();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setProses(false);
    }
  }

  return (
    <Modal judul={awal ? 'Ubah Pengguna' : 'Tambah Pengguna'} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Input label="ID Pengguna" value={userId} onChange={(e) => setUserId(e.target.value)} disabled={!!awal} />
        <Input label="Nama" value={nama} onChange={(e) => setNama(e.target.value)} />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}
            className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5">
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        {role === 'PENYEDIA' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Penyedia yang ditautkan</label>
            <select value={penyediaId} onChange={(e) => setPenyediaId(e.target.value)}
              className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5">
              <option value="">— pilih penyedia —</option>
              {(penyediaQ.data?.penyedia ?? []).map((p) => (
                <option key={p.penyedia_id} value={p.penyedia_id}>{p.nama} ({p.penyedia_id})</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">Akun penyedia hanya bisa melihat data penyedia ini (kontrak, jadwal, pembayaran) — tanpa data taruna/rekening.</p>
          </div>
        )}
        {role === 'KETUA_JURUSAN' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Prodi yang ditautkan</label>
            <select value={prodi} onChange={(e) => setProdi(e.target.value)}
              className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5">
              <option value="">— pilih prodi —</option>
              {daftarProdi.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <p className="mt-1 text-xs text-gray-400">Akun Ketua Jurusan hanya bisa menginput absen luar kampus &amp; melihat rekap taruna prodi ini — tanpa nomor rekening.</p>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5">
            <option value="AKTIF">AKTIF</option>
            <option value="NONAKTIF">NONAKTIF</option>
          </select>
        </div>
        {!awal && <p className="text-xs text-gray-400">Akun baru dibuat dengan kata sandi default 123456 — segera ganti setelah login pertama.</p>}
        {galat && <p className="text-sm text-red-600">{galat}</p>}
        <Button onClick={() => void simpan()} disabled={proses}>
          {proses ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </div>
    </Modal>
  );
}
