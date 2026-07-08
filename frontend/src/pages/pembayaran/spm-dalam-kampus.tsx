// Kartu "SPM Dalam Kampus" (halaman Pembayaran, PPK) — pengganti kartu "Rincian
// SP2D" berbasis perkiraan (sp2d.rekonsiliasi) UNTUK BULAN YANG SUDAH PUNYA baris
// SPM tersimpan (sheet SPM, dibuat otomatis oleh bayar.create sejak Tahap 3).
// Beda dari kartu lama: angka di sini PERSIS (baris SPM asli per prodi+tingkat+
// suplier), bukan estimasi dibagi proporsional — dan bisa diedit langsung
// (isi No. SPM/tanggal, lalu No. SP2D/tanggal) tanpa lewat menu Laporan.
//
// Bulan yang BELUM punya baris SPM (dibuat sebelum Tahap 3 ada) tetap pakai
// kartu lama — lihat pembayaran.tsx (dipilih berdasar panjang array `spm`).
import { useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { useToast } from '../../components/ui/toast';
import { api } from '../../lib/api';
import { useListCache } from '../../lib/use-list-cache';
import { formatRupiah } from '../tagihan/tipe';

export interface SpmBaris {
  spm_id: string;
  bayar_id: string;
  kategori: string;
  bulan: string;
  prodi: string;
  tingkat: string;
  penyedia_id: string;
  penyedia_nama?: string;
  nominal: number;
  no_spm: string;
  tgl_spm: string;
  no_sp2d: string;
  tgl_sp2d: string;
  status: 'DRAFT' | 'DIAJUKAN' | 'SP2D_TERBIT';
}

export function useSpmDalamKampus(bulan: string) {
  return useListCache<{ spm: SpmBaris[] }>('spm.list', { bulan, kategori: 'DALAM_KAMPUS' });
}

function BarisSpm({ s, proses, onSimpanSpm, onSimpanSp2d }: {
  s: SpmBaris; proses: boolean;
  onSimpanSpm: (spmId: string, noSpm: string, tglSpm: string) => void;
  onSimpanSp2d: (spmId: string, noSp2d: string, tglSp2d: string) => void;
}) {
  const [noSpm, setNoSpm] = useState(s.no_spm);
  const [tglSpm, setTglSpm] = useState(s.tgl_spm);
  const [noSp2d, setNoSp2d] = useState(s.no_sp2d);
  const [tglSp2d, setTglSp2d] = useState(s.tgl_sp2d);

  return (
    <tr className="border-b border-gray-100 align-top">
      <td className="py-2 pr-2">
        <div className="font-medium">{s.prodi} / {s.tingkat}</div>
        <div className="text-gray-500">{s.penyedia_nama || s.penyedia_id || '(belum ditentukan)'}</div>
      </td>
      <td className="py-2 pr-2 text-right">{formatRupiah(s.nominal)}</td>
      <td className="py-2 pr-2"><Badge status={s.status} /></td>
      <td className="py-2 pr-2">
        {s.status === 'DRAFT' ? (
          <div className="flex flex-wrap items-center gap-1">
            <input value={noSpm} onChange={(e) => setNoSpm(e.target.value)} placeholder="No. SPM"
              className="w-24 rounded border border-gray-300 px-1.5 py-1 text-xs" />
            <input type="date" value={tglSpm} onChange={(e) => setTglSpm(e.target.value)}
              className="rounded border border-gray-300 px-1.5 py-1 text-xs" />
            <button className="text-primary underline disabled:opacity-50" disabled={proses || !noSpm || !tglSpm}
              onClick={() => onSimpanSpm(s.spm_id, noSpm, tglSpm)}>
              Simpan
            </button>
          </div>
        ) : (
          <span>{s.no_spm || '-'}{s.tgl_spm ? ` (${s.tgl_spm})` : ''}</span>
        )}
      </td>
      <td className="py-2">
        {s.status === 'DIAJUKAN' ? (
          <div className="flex flex-wrap items-center gap-1">
            <input value={noSp2d} onChange={(e) => setNoSp2d(e.target.value)} placeholder="No. SP2D"
              className="w-24 rounded border border-gray-300 px-1.5 py-1 text-xs" />
            <input type="date" value={tglSp2d} onChange={(e) => setTglSp2d(e.target.value)}
              className="rounded border border-gray-300 px-1.5 py-1 text-xs" />
            <button className="text-primary underline disabled:opacity-50" disabled={proses || !noSp2d || !tglSp2d}
              onClick={() => onSimpanSp2d(s.spm_id, noSp2d, tglSp2d)}>
              Simpan
            </button>
          </div>
        ) : s.status === 'SP2D_TERBIT' ? (
          <span>{s.no_sp2d || '-'}{s.tgl_sp2d ? ` (${s.tgl_sp2d})` : ''}</span>
        ) : (
          <span className="text-gray-400">— (ajukan SPM dulu)</span>
        )}
      </td>
    </tr>
  );
}

export function KartuSpmDalamKampus({ bulan, bayarId, spm, refresh }: {
  bulan: string; bayarId: string; spm: SpmBaris[]; refresh: () => void;
}) {
  const { toast } = useToast();
  const [proses, setProses] = useState(false);

  const semuaDraft = spm.length > 0 && spm.every((s) => s.status === 'DRAFT');
  const total = spm.reduce((s, x) => s + x.nominal, 0);
  const jmlSp2dTerbit = spm.filter((s) => s.status === 'SP2D_TERBIT').length;

  async function simpanSpm(spmId: string, noSpm: string, tglSpm: string) {
    setProses(true);
    try {
      const baris = spm.find((s) => s.spm_id === spmId);
      await api('spm.update', {
        spm_id: spmId, no_spm: noSpm, tgl_spm: tglSpm,
        status: baris?.status === 'DRAFT' ? 'DIAJUKAN' : undefined
      });
      toast('No. SPM tersimpan.', 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  async function simpanSp2d(spmId: string, noSp2d: string, tglSp2d: string) {
    setProses(true);
    try {
      await api('spm.set_sp2d', { spm_id: spmId, no_sp2d: noSp2d, tgl_sp2d: tglSp2d });
      toast('No. SP2D tersimpan.', 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  async function regenerate() {
    setProses(true);
    try {
      const hasil = await api<{ dihapus: number; dibuat: number }>('spm.regenerate', { bayar_id: bayarId });
      toast(`SPM dibuat ulang dari rekap terbaru (${hasil.dibuat} kelompok).`, 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-600">📋 SPM Dalam Kampus — per Prodi+Tingkat+Suplier</p>
        <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary-dark">
          {jmlSp2dTerbit}/{spm.length} SP2D terbit
        </span>
      </div>
      <p className="text-xs text-gray-500">
        Baris di bawah <strong>tersimpan</strong> (bukan perkiraan) — dibuat otomatis dari rekap saat
        pembayaran ini dibuat, satu baris per suplier. Isi No. SPM begitu diajukan ke KPPN, lalu No. SP2D
        begitu terbit.
      </p>

      {semuaDraft && (
        <div>
          <Button varian="garis" onClick={() => void regenerate()} disabled={proses}>
            🔄 Buat ulang dari Rekap terbaru
          </Button>
          <p className="mt-1 text-xs text-gray-400">
            Hanya bisa selama SEMUA baris masih DRAFT — dipakai kalau Rekap dikoreksi setelah pembayaran dibuat.
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-1 pr-2">Prodi/Tingkat · Suplier</th>
              <th className="py-1 pr-2 text-right">Nominal</th>
              <th className="py-1 pr-2">Status</th>
              <th className="py-1 pr-2">No. SPM</th>
              <th className="py-1">No. SP2D</th>
            </tr>
          </thead>
          <tbody>
            {spm.map((s) => (
              <BarisSpm key={s.spm_id} s={s} proses={proses} onSimpanSpm={simpanSpm} onSimpanSp2d={simpanSp2d} />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-300 font-bold">
              <td className="py-1 pr-2">TOTAL</td>
              <td className="py-1 pr-2 text-right">{formatRupiah(total)}</td>
              <td colSpan={3} className="py-1 text-gray-500">{bulan}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
