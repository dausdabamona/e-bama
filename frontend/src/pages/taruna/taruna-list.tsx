// /taruna (Admin) — CRUD data taruna + tautan impor CSV.
import { useState } from 'react';
import { Link } from 'react-router-dom';
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
  const { data, memuat, galat, refresh } = useListCache<{ taruna: Taruna[] }>('taruna.list', {});
  const [modal, setModal] = useState<Taruna | 'baru' | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary-dark">Data Taruna</h1>
        <div className="flex gap-2">
          <Link to="/taruna/impor"><Button varian="garis">Impor CSV</Button></Link>
          <Button onClick={() => setModal('baru')}>+ Tambah</Button>
        </div>
      </div>

      {memuat && !data && <LoadingSpinner label="Memuat data taruna…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}
      {data && data.taruna.length === 0 && <EmptyState pesan="Belum ada data taruna." />}

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4 xl:grid-cols-3">
        {(data?.taruna ?? [])
          .slice()
          .sort((a, b) => a.nama.localeCompare(b.nama))
          .map((t) => (
            <Card key={t.nit} className="flex items-center justify-between active:bg-primary-light/30" onClick={() => setModal(t)}>
              <div>
                <p className="font-semibold">{t.nama}</p>
                <p className="text-sm text-gray-500">{t.nit} · {t.prodi} · Tk.{t.tingkat} · {t.kelas}</p>
              </div>
              <Badge status={t.status} />
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
