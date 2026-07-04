// /taruna (Admin, BAAK) — CRUD data taruna + tautan impor CSV.
// Tombol "Rekening Lengkap" HANYA tampil untuk role ADMIN (persembunyian
// frontend saja — backend tetap yang menegakkan lewat rekening.simpan
// role:['ADMIN'], lihat 22_rekening.gs & CLAUDE.md §4/§7).
import { useEffect, useState } from 'react';
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary-dark">Data Taruna</h1>
        <div className="flex gap-2">
          <Link to="/taruna/impor"><Button varian="garis">Impor CSV</Button></Link>
          {session?.role === 'ADMIN' && (
            <Link to="/taruna/impor-rekening"><Button varian="garis">🔒 Impor Rekening</Button></Link>
          )}
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
