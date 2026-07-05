// /pembayaran — PPK: buat & kelola SPM/SP2D bertahap; Senat: konfirmasi; KPA: lihat.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { BulanPicker, bulanIni } from '../../components/bulan-picker';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { Input } from '../../components/ui/input';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useToast } from '../../components/ui/toast';
import { api } from '../../lib/api';
import { ambilFotoInput, kompresFotoBase64 } from '../../lib/foto';
import { useListCache } from '../../lib/use-list-cache';
import { formatRupiah } from '../tagihan/tipe';
import type { Pembayaran } from './tipe';

const URUTAN_STATUS: Pembayaran['status'][] = ['DIAJUKAN', 'SP2D_TERBIT', 'DITRANSFER', 'DIKONFIRMASI', 'SELESAI'];

export function HalamanPembayaran() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [bulan, setBulan] = useState(bulanIni());
  const { data, memuat, galat, refresh } = useListCache<{ pembayaran: Pembayaran[] }>('bayar.list', { bulan });
  const [proses, setProses] = useState(false);

  const b = data?.pembayaran?.find((x) => x.bulan === bulan);
  const [noSpm, setNoSpm] = useState('');
  const [tglSpm, setTglSpm] = useState('');
  const [noSp2d, setNoSp2d] = useState('');
  const [tglSp2d, setTglSp2d] = useState('');

  async function buat() {
    setProses(true);
    try {
      await api('bayar.create', { bulan });
      toast('Pembayaran dibuat.', 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  async function simpanSpm() {
    if (!noSpm || !tglSpm) { toast('No. SPM dan tanggal wajib diisi.', 'galat'); return; }
    setProses(true);
    try {
      await api('bayar.update', { bayar_id: b!.bayar_id, no_spm: noSpm, tgl_spm: tglSpm });
      toast('SPM tersimpan.', 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  async function simpanSp2d() {
    if (!noSp2d || !tglSp2d) { toast('No. SP2D dan tanggal wajib diisi.', 'galat'); return; }
    setProses(true);
    try {
      await api('bayar.update', { bayar_id: b!.bayar_id, no_sp2d: noSp2d, tgl_sp2d: tglSp2d });
      toast('SP2D tersimpan — status naik ke SP2D_TERBIT.', 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  async function tandaiDitransfer() {
    setProses(true);
    try {
      await api('bayar.update', { bayar_id: b!.bayar_id, ditransfer: true });
      toast('Ditandai DITRANSFER.', 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  async function unggahLampiran(jenis: string) {
    const file = await ambilFotoInput();
    if (!file) return;
    const base64 = await kompresFotoBase64(file);
    setProses(true);
    try {
      await api('bayar.update', { bayar_id: b!.bayar_id, berkas: { base64, nama_file: file.name, jenis } });
      toast('Lampiran terunggah.', 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  async function konfirmasiSenat() {
    setProses(true);
    try {
      await api('bayar.confirm', { bayar_id: b!.bayar_id });
      toast('Pembayaran dikonfirmasi.', 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  async function tutup() {
    setProses(true);
    try {
      await api('bayar.close', { bayar_id: b!.bayar_id });
      toast('Pembayaran ditutup — SELESAI.', 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  const idx = b ? URUTAN_STATUS.indexOf(b.status) : -1;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-primary-dark">Pembayaran</h1>
      <BulanPicker bulan={bulan} onChange={setBulan} />

      {memuat && !data && <LoadingSpinner label="Memuat…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}

      {data && !b && session?.role === 'PPK' && (
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-gray-500">Belum ada pembayaran untuk bulan ini.</p>
          <Button onClick={() => void buat()} disabled={proses}>
            {proses ? 'Memproses…' : 'Buat Pembayaran (dari Rekap FINAL)'}
          </Button>
        </Card>
      )}
      {data && !b && session?.role !== 'PPK' && <EmptyState pesan="Belum ada pembayaran bulan ini." />}

      {b && (
        <>
          <Card className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-lg font-bold">{formatRupiah(b.nilai_total)}</p>
              <Badge status={b.status} />
            </div>
            <ol className="mt-2 flex flex-col gap-1 text-sm">
              {URUTAN_STATUS.map((s, i) => (
                <li key={s} className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${i <= idx ? 'bg-primary' : 'bg-gray-200'}`} />
                  <span className={i <= idx ? 'font-medium' : 'text-gray-400'}>{s.replace(/_/g, ' ')}</span>
                </li>
              ))}
            </ol>
          </Card>

          {session?.role === 'PPK' && (b.status === 'DIAJUKAN' || b.status === 'SP2D_TERBIT') && (
            <Card className="flex flex-col gap-2 border-l-4 border-l-primary">
              <p className="text-sm font-semibold text-gray-600">📄 Dokumen: Blokir &amp; Pendebetan Bank</p>
              <p className="text-xs text-gray-500">
                Sebelum menandai "Sudah Ditransfer", cetak &amp; kirimkan surat permohonan blokir
                dan pendebetan massal rekening taruna ke rekening Senat — <strong>terpisah untuk
                Bank BSI dan BNI</strong>.
              </p>
              <Link to={`/cetak/form-07/${bulan}`}>
                <Button varian="garis" className="w-full">🖨️ Cetak Form 07 — Usulan Penahanan &amp; Pendebetan Bank</Button>
              </Link>
            </Card>
          )}

          {(session?.role === 'PPK' || session?.role === 'SENAT') && b.status === 'DITRANSFER' && (
            <Card className="flex flex-col gap-2 border-l-4 border-l-primary">
              <p className="text-sm font-semibold text-gray-600">📄 Dokumen: Pendebetan Senat → Penyedia</p>
              <p className="text-xs text-gray-500">
                Dana sudah masuk rekening Senat. Sebelum konfirmasi diterima penyedia, ajukan
                pendebetan rekening Senat ke rekening penyedia — <strong>per bank (BSI &amp; BNI)</strong>.
              </p>
              <Link to={`/cetak/form-09/${bulan}`}>
                <Button varian="garis" className="w-full">🖨️ Cetak Form 09 — Pendebetan Rekening Senat → Penyedia</Button>
              </Link>
            </Card>
          )}

          {session?.role === 'PPK' && b.status === 'DIAJUKAN' && (
            <Card className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-gray-600">Input SPM</p>
              <Input label="No. SPM" value={noSpm} onChange={(e) => setNoSpm(e.target.value)} />
              <Input label="Tanggal SPM" type="date" value={tglSpm} onChange={(e) => setTglSpm(e.target.value)} />
              <Button onClick={() => void simpanSpm()} disabled={proses}>Simpan SPM</Button>

              <p className="mt-2 text-sm font-semibold text-gray-600">Input SP2D (naikkan ke SP2D_TERBIT)</p>
              <Input label="No. SP2D" value={noSp2d} onChange={(e) => setNoSp2d(e.target.value)} />
              <Input label="Tanggal SP2D" type="date" value={tglSp2d} onChange={(e) => setTglSp2d(e.target.value)} />
              <Button onClick={() => void simpanSp2d()} disabled={proses}>Simpan SP2D</Button>
            </Card>
          )}

          {session?.role === 'PPK' && b.status === 'SP2D_TERBIT' && (
            <Button onClick={() => void tandaiDitransfer()} disabled={proses}>Tandai Sudah Ditransfer</Button>
          )}

          {session?.role === 'SENAT' && b.status === 'DITRANSFER' && (
            <Button onClick={() => void konfirmasiSenat()} disabled={proses}>Konfirmasi Diterima Penyedia</Button>
          )}

          {session?.role === 'PPK' && b.status === 'DIKONFIRMASI' && (
            <Button onClick={() => void tutup()} disabled={proses}>Tutup Pembayaran (SELESAI)</Button>
          )}

          {session?.role === 'PPK' && b.status !== 'SELESAI' && (
            <Card className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-gray-600">Unggah Lampiran</p>
              <div className="flex flex-wrap gap-2">
                <Button varian="garis" onClick={() => void unggahLampiran('SURAT')}>📄 Surat Blokir</Button>
                <Button varian="garis" onClick={() => void unggahLampiran('BUKTI_DEBET')}>📄 Bukti Debet</Button>
                <Button varian="garis" onClick={() => void unggahLampiran('INVOICE')}>📄 Invoice</Button>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
