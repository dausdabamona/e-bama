// /tagihan/gagal-debet (PPK) — tandai taruna gagal debet massal dari rekap bulan berjalan.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BulanPicker, bulanIni } from '../../components/bulan-picker';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useToast } from '../../components/ui/toast';
import { api } from '../../lib/api';
import { useListCache } from '../../lib/use-list-cache';

interface BarisRekap { nit: string; status: string; nominal: number }
interface Taruna { nit: string; nama: string }

const SEBAB = ['GAGAL_DEBET', 'SALDO_KURANG', 'REKENING_BERMASALAH'];

export function HalamanTagihanGagalDebet() {
  const nav = useNavigate();
  const { toast } = useToast();
  const [bulan, setBulan] = useState(bulanIni());
  const rekapQ = useListCache<{ rekap: BarisRekap[] }>('rekap.get', { bulan });
  const tarunaQ = useListCache<{ taruna: Taruna[] }>('taruna.list', {});
  const [terpilih, setTerpilih] = useState<Set<string>>(new Set());
  const [sebab, setSebab] = useState(SEBAB[0]);
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');

  const namaByNit = new Map((tarunaQ.data?.taruna ?? []).map((t) => [t.nit, t.nama]));
  const rekap = rekapQ.data?.rekap ?? [];
  // Angka beku HANYA saat FINAL (PPK finalkan, langkah terakhir). DISETUJUI_WADIR3
  // kini langkah awal (angka belum beku) → belum jadi dasar tagihan.
  const belumFinal = rekap.length > 0 && rekap[0].status !== 'FINAL';

  function toggle(nit: string) {
    setTerpilih((s) => {
      const baru = new Set(s);
      if (baru.has(nit)) baru.delete(nit); else baru.add(nit);
      return baru;
    });
  }

  async function kirim() {
    if (terpilih.size === 0) { setGalat('Pilih minimal satu taruna.'); return; }
    setProses(true); setGalat('');
    try {
      const r = await api<{ tagihan: { tagihan_id: string }[] }>('tagihan.create', {
        bulan, nit: Array.from(terpilih), sebab
      });
      toast(`${r.tagihan.length} tagihan dicatat, SP-1 terbit otomatis.`, 'sukses');
      nav('/tagihan');
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setProses(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button className="text-sm text-primary" onClick={() => nav('/tagihan')}>← Kembali</button>
      <h1 className="text-xl font-bold text-primary-dark">Tandai Gagal Debet</h1>
      <BulanPicker bulan={bulan} onChange={setBulan} />

      {(rekapQ.memuat || tarunaQ.memuat) && !rekapQ.data && <LoadingSpinner />}
      {rekapQ.galat && <ErrorMessage pesan={rekapQ.galat} onRetry={rekapQ.refresh} />}
      {rekapQ.data && rekap.length === 0 && <EmptyState pesan="Belum ada rekap bulan ini." />}
      {belumFinal && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          ⚠️ Rekap bulan ini belum FINAL — finalkan dulu di menu Rekap sebelum menandai gagal debet.
        </p>
      )}

      {rekap.length > 0 && !belumFinal && (
        <Card className="flex flex-col gap-3">
          <label className="block text-sm font-medium text-gray-700">Sebab</label>
          <select value={sebab} onChange={(e) => setSebab(e.target.value)}
            className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5">
            {SEBAB.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>

          <p className="text-sm font-medium text-gray-700">Pilih Taruna</p>
          <div className="flex flex-col gap-1 rounded-xl border border-gray-200 p-2">
            {rekap.map((r) => (
              <label key={r.nit} className="flex min-h-tap items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={terpilih.has(r.nit)} onChange={() => toggle(r.nit)} />
                {namaByNit.get(r.nit) ?? r.nit} ({r.nit})
              </label>
            ))}
          </div>

          {galat && <p className="text-sm text-red-600">{galat}</p>}
          <Button varian="bahaya" onClick={() => void kirim()} disabled={proses}>
            {proses ? 'Memproses…' : `Tandai ${terpilih.size} Taruna Gagal Debet`}
          </Button>
        </Card>
      )}
    </div>
  );
}
