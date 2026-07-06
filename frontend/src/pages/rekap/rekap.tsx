// /rekap (PPK) — tabel rekap bulanan, Verifikasi → Finalkan (konfirmasi ganda), ekspor CSV.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BulanPicker, bulanIni } from '../../components/bulan-picker';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { Modal } from '../../components/ui/modal';
import { useToast } from '../../components/ui/toast';
import { api } from '../../lib/api';
import { unduhCsv } from '../../lib/csv';
import { useListCache } from '../../lib/use-list-cache';
import { formatRupiah } from '../tagihan/tipe';

interface BarisRekap {
  bulan: string; nit: string; hari_makan: number; hari_tidak_makan: number;
  nominal: number; status: string; verif_by: string; verif_at: string;
}
interface Taruna { nit: string; nama: string; prodi: string; tingkat: string }

interface Kelompok {
  prodi: string; tingkat: string;
  jml_taruna: number; hari_makan: number; nominal: number;
}

export function HalamanRekap() {
  const [bulan, setBulan] = useState(bulanIni());
  const { toast } = useToast();
  const rekapQ = useListCache<{ rekap: BarisRekap[]; total: number }>('rekap.get', { bulan });
  const tarunaQ = useListCache<{ taruna: Taruna[] }>('taruna.list', {});
  const [tampilFinal, setTampilFinal] = useState(false);
  const [tampilRincian, setTampilRincian] = useState(false);
  const [proses, setProses] = useState(false);

  const memuat = rekapQ.memuat || tarunaQ.memuat;
  const galat = rekapQ.galat || tarunaQ.galat;
  const tarunaByNit = new Map((tarunaQ.data?.taruna ?? []).map((t) => [t.nit, t]));
  const namaByNit = new Map((tarunaQ.data?.taruna ?? []).map((t) => [t.nit, t.nama]));
  const baris = rekapQ.data?.rekap ?? [];
  const status = baris[0]?.status ?? '';

  // Kelompokkan per Prodi + Tingkat (taruna tanpa data TARUNA → grup "Lainnya/?").
  const kelompok: Kelompok[] = (() => {
    const peta = new Map<string, Kelompok>();
    baris.forEach((r) => {
      const t = tarunaByNit.get(r.nit);
      const prodi = t?.prodi || 'Lainnya';
      const tingkat = t?.tingkat || '?';
      const kunci = `${prodi}|${tingkat}`;
      let k = peta.get(kunci);
      if (!k) { k = { prodi, tingkat, jml_taruna: 0, hari_makan: 0, nominal: 0 }; peta.set(kunci, k); }
      k.jml_taruna += 1;
      k.hari_makan += r.hari_makan || 0;
      k.nominal += r.nominal || 0;
    });
    return [...peta.values()].sort((a, b) =>
      a.prodi.localeCompare(b.prodi) || a.tingkat.localeCompare(b.tingkat));
  })();

  // Rincian per taruna, urut mengikuti tabel kelompok (prodi → tingkat → nama).
  const rincian = [...baris].sort((a, b) => {
    const ta = tarunaByNit.get(a.nit), tb = tarunaByNit.get(b.nit);
    return (ta?.prodi || 'Lainnya').localeCompare(tb?.prodi || 'Lainnya')
      || (ta?.tingkat || '?').localeCompare(tb?.tingkat || '?')
      || (ta?.nama || a.nit).localeCompare(tb?.nama || b.nit);
  });

  async function verifikasi() {
    setProses(true);
    try {
      await api('rekap.verify', { bulan });
      toast('Rekap diverifikasi.', 'sukses');
      rekapQ.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  async function finalkan() {
    setProses(true);
    try {
      await api('rekap.final', { bulan });
      toast('Rekap difinalkan — beku sebagai dasar SPM.', 'sukses');
      setTampilFinal(false);
      rekapQ.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  function ekspor() {
    unduhCsv(
      `rekap-${bulan}.csv`,
      ['NIT', 'Nama', 'Hari Makan', 'Hari Tidak Makan', 'Nominal'],
      baris.map((r) => [r.nit, namaByNit.get(r.nit) ?? '', r.hari_makan, r.hari_tidak_makan, r.nominal])
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary-dark">Rekap Bulanan</h1>
        {baris.length > 0 && <Badge status={status} />}
      </div>
      <BulanPicker bulan={bulan} onChange={setBulan} />

      {memuat && !rekapQ.data && <LoadingSpinner label="Memuat rekap…" />}
      {galat && !rekapQ.data && <ErrorMessage pesan={galat} onRetry={rekapQ.refresh} />}
      {rekapQ.data && baris.length === 0 && <EmptyState pesan="Belum ada rekap bulan ini." />}

      {baris.length > 0 && (
        <Card className="overflow-x-auto">
          <p className="mb-2 text-sm font-semibold text-gray-700">Rekap per Prodi &amp; Tingkat</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-1 pr-2">Prodi / Tingkat</th>
                <th className="py-1 pr-2 text-right">Taruna</th>
                <th className="py-1 pr-2 text-right">Hari Makan</th>
                <th className="py-1 text-right">Nominal</th>
              </tr>
            </thead>
            <tbody>
              {kelompok.map((k) => (
                <tr key={`${k.prodi}|${k.tingkat}`} className="border-b border-gray-100">
                  <td className="py-1 pr-2">{k.prodi} / {k.tingkat}</td>
                  <td className="py-1 pr-2 text-right">{k.jml_taruna}</td>
                  <td className="py-1 pr-2 text-right">{k.hari_makan.toLocaleString('id-ID')}</td>
                  <td className="py-1 text-right">{formatRupiah(k.nominal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td className="pt-2 pr-2">Total</td>
                <td className="pt-2 pr-2 text-right">{baris.length}</td>
                <td className="pt-2 pr-2 text-right">
                  {kelompok.reduce((s, k) => s + k.hari_makan, 0).toLocaleString('id-ID')}
                </td>
                <td className="pt-2 text-right">{formatRupiah(rekapQ.data?.total ?? 0)}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      {baris.length > 0 && (
        <div>
          <Button varian="garis" onClick={() => setTampilRincian((v) => !v)}>
            {tampilRincian ? 'Sembunyikan rincian per taruna' : 'Lihat rincian per taruna'}
          </Button>
          {tampilRincian && (
            <Card className="mt-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-1 pr-2">NIT</th>
                    <th className="py-1 pr-2">Nama</th>
                    <th className="py-1 pr-2">Prodi/Tingkat</th>
                    <th className="py-1 pr-2 text-right">Hari Makan</th>
                    <th className="py-1 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {rincian.map((r) => {
                    const t = tarunaByNit.get(r.nit);
                    return (
                      <tr key={r.nit} className="border-b border-gray-100">
                        <td className="py-1 pr-2">{r.nit}</td>
                        <td className="py-1 pr-2">{t?.nama || '-'}</td>
                        <td className="py-1 pr-2">{(t?.prodi || 'Lainnya')} / {(t?.tingkat || '?')}</td>
                        <td className="py-1 pr-2 text-right">{r.hari_makan}</td>
                        <td className="py-1 text-right">{formatRupiah(r.nominal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td className="pt-2 pr-2" colSpan={3}>Total</td>
                    <td className="pt-2 pr-2 text-right">
                      {kelompok.reduce((s, k) => s + k.hari_makan, 0).toLocaleString('id-ID')}
                    </td>
                    <td className="pt-2 text-right">{formatRupiah(rekapQ.data?.total ?? 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </Card>
          )}
        </div>
      )}

      {baris.length > 0 && (
        <div className="flex flex-col gap-2">
          <Button varian="garis" onClick={ekspor}>Ekspor CSV</Button>
          {status === 'DRAFT' && (
            <Card className="bg-amber-50 text-center text-sm text-amber-800">
              ⏳ Menunggu <strong>Wadir 3</strong> menyetujui rekap bulan ini dulu, baru PPK bisa memverifikasi.
            </Card>
          )}
          {status === 'DISETUJUI_WADIR3' && (
            <Button onClick={() => void verifikasi()} disabled={proses}>
              {proses ? 'Memproses…' : 'Verifikasi Rekap'}
            </Button>
          )}
          {status === 'TERVERIFIKASI_PPK' && (
            <Button varian="bahaya" onClick={() => setTampilFinal(true)}>Finalkan Rekap (Siap Bayar)</Button>
          )}
          {status === 'FINAL' && (
            <Link to={`/cetak/form-06/${bulan}`}>
              <Button varian="garis" className="w-full">🖨️ Cetak Form 06</Button>
            </Link>
          )}
        </div>
      )}

      {tampilFinal && (
        <ModalFinalisasi onClose={() => setTampilFinal(false)} onKonfirmasi={finalkan} proses={proses} />
      )}
    </div>
  );
}

function ModalFinalisasi({ onClose, onKonfirmasi, proses }: {
  onClose: () => void; onKonfirmasi: () => void; proses: boolean;
}) {
  const [paham, setPaham] = useState(false);
  return (
    <Modal judul="Finalkan Rekap?" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-red-700">
          ⚠️ Rekap akan dibekukan sebagai dasar SPM. Tindakan ini <strong>tidak bisa dibatalkan</strong>.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={paham} onChange={(e) => setPaham(e.target.checked)} />
          Saya paham dan yakin ingin memfinalkan rekap ini.
        </label>
        <Button varian="bahaya" disabled={!paham || proses} onClick={onKonfirmasi}>
          {proses ? 'Memproses…' : 'Ya, Finalkan Sekarang'}
        </Button>
      </div>
    </Modal>
  );
}
