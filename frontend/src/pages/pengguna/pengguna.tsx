// /pengguna (Admin) — CRUD akun & reset PIN.
import { useState } from 'react';
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

interface Pengguna { user_id: string; nama: string; role: string; status: string }

const ROLES = ['KPA', 'PPK', 'SENAT', 'PEMBINA', 'ADMIN'];

export function HalamanPengguna() {
  const { toast } = useToast();
  const { data, memuat, galat, refresh } = useListCache<{ pengguna: Pengguna[] }>('pengguna.list', {});
  const [modal, setModal] = useState<Pengguna | 'baru' | null>(null);

  async function resetPin(userId: string) {
    try {
      await api('pengguna.reset_pin', { user_id: userId });
      toast(`PIN ${userId} direset ke default (123456).`, 'sukses');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary-dark">Pengguna</h1>
        <Button onClick={() => setModal('baru')}>+ Tambah</Button>
      </div>

      {memuat && !data && <LoadingSpinner label="Memuat pengguna…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}
      {data && data.pengguna.length === 0 && <EmptyState pesan="Belum ada pengguna." />}

      {data?.pengguna.map((p) => (
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
            <Button varian="garis" className="flex-1" onClick={() => void resetPin(p.user_id)}>Reset PIN</Button>
          </div>
        </Card>
      ))}

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
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');

  async function simpan() {
    if (!userId.trim() || !nama.trim()) { setGalat('user_id dan nama wajib diisi.'); return; }
    setProses(true); setGalat('');
    try {
      await api('pengguna.upsert', { user_id: userId.trim(), nama: nama.trim(), role, status });
      toast(awal ? 'Pengguna diperbarui.' : 'Pengguna baru dibuat (PIN default 123456).', 'sukses');
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
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5">
            <option value="AKTIF">AKTIF</option>
            <option value="NONAKTIF">NONAKTIF</option>
          </select>
        </div>
        {!awal && <p className="text-xs text-gray-400">Akun baru dibuat dengan PIN default 123456 — segera ganti setelah login pertama.</p>}
        {galat && <p className="text-sm text-red-600">{galat}</p>}
        <Button onClick={() => void simpan()} disabled={proses}>
          {proses ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </div>
    </Modal>
  );
}
