// /luar-kampus-kajur (KETUA_JURUSAN) — input absen luar kampus taruna prodinya
// (boleh tanggal lampau), lihat REKAP (tanpa rekening), dan setujui rekap bulan
// (BANTUAN_LUAR_KAMPUS DRAFT→DISETUJUI_KAJUR). Semua di-scope ke prodi akun oleh
// backend (25_ketua_jurusan.gs); frontend hanya menyajikan.
import { useState } from 'react';
import { BulanPicker, bulanIni, labelBulan } from '../../components/bulan-picker';
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
import { formatRupiah } from '../tagihan/tipe';

// Status luar kampus yang boleh diinput Ketua Jurusan (subset STATUS_HARIAN).
const STATUS_LUAR_KAMPUS = ['KEGIATAN_LUAR_KAMPUS', 'PKL_1', 'PKL_2', 'PKL_3', 'KPA', 'MAGANG', 'PTB'];

interface TarunaKajur { nit: string; nama: string; prodi: string; tingkat: string; kelas: string }
interface BarisRekap {
  nit: string; nama: string; tingkat: string; kelas: string; kegiatan: string;
  hari_luar_kampus: number; nilai_per_hari: number; nominal: number; ada_blk: boolean; disetujui_kajur: boolean;
}

function hariIni(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Jumlah hari inklusif antara dua tanggal 'yyyy-MM-dd'. */
function jmlHari(dari: string, sampai: string): number {
  const a = new Date(dari + 'T00:00:00');
  const b = new Date(sampai + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

export function HalamanKetuaJurusan() {
  const { toast } = useToast();
  const [bulan, setBulan] = useState(bulanIni());
  const rekapQ = useListCache<{ bulan: string; prodi: string; baris: BarisRekap[]; total_nominal: number }>('kajur.rekap', { bulan });
  const tarunaQ = useListCache<{ taruna: TarunaKajur[]; prodi: string }>('kajur.taruna_list', {});
  const [tampilKonfirmasi, setTampilKonfirmasi] = useState(false);
  const [proses, setProses] = useState(false);

  // ── Form input absen ──
  const [tanggal, setTanggal] = useState(hariIni());
  const [tglAkhir, setTglAkhir] = useState('');
  const [status, setStatus] = useState(STATUS_LUAR_KAMPUS[0]);
  const [terpilih, setTerpilih] = useState<Record<string, boolean>>({});

  const prodi = rekapQ.data?.prodi || tarunaQ.data?.prodi || '';
  const baris = rekapQ.data?.baris ?? [];
  const daftarTaruna = tarunaQ.data?.taruna ?? [];
  const nitTerpilih = Object.keys(terpilih).filter((n) => terpilih[n]);

  async function simpanAbsen() {
    if (!tanggal) { toast('Pilih tanggal.', 'galat'); return; }
    if (tglAkhir && tglAkhir < tanggal) { toast('Tanggal Sampai tidak boleh sebelum Mulai.', 'galat'); return; }
    if (nitTerpilih.length === 0) { toast('Pilih minimal satu taruna.', 'galat'); return; }
    setProses(true);
    try {
      const tgl_akhir = tglAkhir || undefined;
      if (nitTerpilih.length === 1) {
        await api('kajur.status_set', { tanggal, tgl_akhir, nit: nitTerpilih[0], status });
      } else {
        await api('kajur.status_batch', { tanggal, tgl_akhir, status, nit: nitTerpilih });
      }
      const hari = tglAkhir ? jmlHari(tanggal, tglAkhir) : 1;
      const rentang = hari > 1 ? `${tanggal} s.d. ${tglAkhir} (${hari} hari)` : tanggal;
      toast(`Absen ${status.replace(/_/g, ' ')} tersimpan untuk ${nitTerpilih.length} taruna (${rentang}).`, 'sukses');
      setTerpilih({}); setTglAkhir('');
      rekapQ.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menyimpan.', 'galat');
    } finally {
      setProses(false);
    }
  }

  async function setujuiRekap() {
    setProses(true);
    try {
      const hasil = await api<{ disetujui: number }>('kajur.approve', { bulan });
      toast(`${hasil.disetujui} baris rekap disetujui.`, 'sukses');
      setTampilKonfirmasi(false);
      rekapQ.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  const adaBelumSetuju = baris.some((b) => b.ada_blk && !b.disetujui_kajur);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-primary-dark">Bantuan Luar Kampus — Ketua Jurusan</h1>
        {prodi && <p className="text-sm text-gray-500">Prodi {prodi}</p>}
      </div>
      <BulanPicker bulan={bulan} onChange={setBulan} />

      {/* ── Input absen luar kampus ── */}
      <Card className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-gray-700">Input Absen Luar Kampus</p>
        <p className="text-xs text-gray-500">
          Absen taruna PKL/KPA/Magang/PTB yang berada di luar kampus. Boleh diisi untuk
          tanggal yang sudah lewat.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input label="Mulai" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          <Input label="Sampai (opsional)" type="date" value={tglAkhir} min={tanggal} onChange={(e) => setTglAkhir(e.target.value)} />
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5">
              {STATUS_LUAR_KAMPUS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        </div>
        <p className="-mt-2 text-xs text-gray-400">Kosongkan "Sampai" jika hanya satu hari.</p>

        {tarunaQ.memuat && !tarunaQ.data && <LoadingSpinner label="Memuat taruna…" />}
        {tarunaQ.data && daftarTaruna.length === 0 && <EmptyState pesan="Belum ada taruna di prodi ini." />}
        {daftarTaruna.length > 0 && (
          <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100">
            {daftarTaruna.map((t) => (
              <label key={t.nit} className="flex items-center gap-2 border-b border-gray-50 px-3 py-2 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={!!terpilih[t.nit]}
                  onChange={(e) => setTerpilih((prev) => ({ ...prev, [t.nit]: e.target.checked }))} />
                <span className="flex-1">{t.nama || t.nit}</span>
                <span className="text-xs text-gray-400">{t.tingkat}{t.kelas ? `/${t.kelas}` : ''}</span>
              </label>
            ))}
          </div>
        )}
        <Button onClick={() => void simpanAbsen()} disabled={proses || nitTerpilih.length === 0}>
          {proses ? 'Menyimpan…' : `Simpan Absen (${nitTerpilih.length} taruna)`}
        </Button>
      </Card>

      {/* ── Rekap bulan ── */}
      <Card className="flex flex-col gap-2 overflow-x-auto">
        <p className="text-sm font-semibold text-gray-700">Rekap Luar Kampus — {labelBulan(bulan)}</p>
        {rekapQ.memuat && !rekapQ.data && <LoadingSpinner label="Memuat rekap…" />}
        {rekapQ.galat && !rekapQ.data && <ErrorMessage pesan={rekapQ.galat} onRetry={rekapQ.refresh} />}
        {rekapQ.data && baris.length === 0 && <EmptyState pesan="Belum ada aktivitas luar kampus bulan ini." />}
        {baris.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-1 pr-2">Nama</th><th className="py-1 pr-2">Tingkat</th>
                <th className="py-1 pr-2">Kegiatan</th><th className="py-1 pr-2 text-right">Hari</th>
                <th className="py-1 pr-2 text-right">Nominal</th><th className="py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {baris.map((b) => (
                <tr key={b.nit} className="border-b border-gray-100">
                  <td className="py-1 pr-2">{b.nama || b.nit}</td>
                  <td className="py-1 pr-2">{b.tingkat}</td>
                  <td className="py-1 pr-2">{b.kegiatan || '-'}</td>
                  <td className="py-1 pr-2 text-right">{b.hari_luar_kampus}</td>
                  <td className="py-1 pr-2 text-right">{formatRupiah(b.nominal)}</td>
                  <td className="py-1">
                    {!b.ada_blk
                      ? <span className="text-gray-400">belum ada tarif</span>
                      : b.disetujui_kajur
                        ? <span className="text-green-700">Disetujui</span>
                        : <span className="text-amber-600">Belum disetujui</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td className="pt-2" colSpan={4}>Total</td>
                <td className="pt-2 pr-2 text-right">{formatRupiah(rekapQ.data?.total_nominal ?? 0)}</td>
                <td className="pt-2"></td>
              </tr>
            </tfoot>
          </table>
        )}
      </Card>

      {baris.some((b) => b.ada_blk) && (
        <Button onClick={() => setTampilKonfirmasi(true)} disabled={!adaBelumSetuju}>
          {adaBelumSetuju ? 'Setujui Rekap Bulan Ini' : '✅ Semua sudah disetujui'}
        </Button>
      )}

      {tampilKonfirmasi && (
        <Modal judul="Setujui Rekap Luar Kampus?" onClose={() => setTampilKonfirmasi(false)}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-600">
              Anda menyetujui rekap bantuan luar kampus prodi <strong>{prodi}</strong> untuk{' '}
              <strong>{labelBulan(bulan)}</strong>. Setelah disetujui, rekap diteruskan ke PPK
              untuk diproses pembayarannya.
            </p>
            <Button onClick={() => void setujuiRekap()} disabled={proses}>
              {proses ? 'Memproses…' : 'Ya, Setujui'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
