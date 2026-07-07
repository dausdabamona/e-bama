// /persetujuan-wadir3 (Wadir 3) — persetujuan PALING AWAL rekap: DRAFT → DISETUJUI_WADIR3.
// Wadir 3 menyetujui substansi rekap lebih dulu, lalu diteruskan ke PPK untuk
// verifikasi & finalisasi (siap bayar). Angka (termasuk nominal — usulan, BELUM
// beku, baru beku saat PPK finalkan) ditampilkan supaya Wadir 3 paham substansi
// penuh sebelum menyetujui (dikonfirmasi Firdaus).
import { useState } from 'react';
import { BulanPicker, bulanIni } from '../../components/bulan-picker';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { KartuStat } from '../../components/ui/kartu-stat';
import { Modal } from '../../components/ui/modal';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useToast } from '../../components/ui/toast';
import { api } from '../../lib/api';
import { useListCache } from '../../lib/use-list-cache';
import { formatRupiah } from '../tagihan/tipe';

interface BarisRekap {
  nit: string; status: string; nominal: number;
  hari_makan: number; hari_tidak_makan: number;
}
interface Taruna { nit: string; nama: string; prodi: string; tingkat: string }

interface Kelompok {
  prodi: string; tingkat: string;
  jml_taruna: number; hari_makan: number; hari_tidak_makan: number; nominal: number;
}

export function HalamanPersetujuanWadir3() {
  const [bulan, setBulan] = useState(bulanIni());
  const { toast } = useToast();
  const rekapQ = useListCache<{ rekap: BarisRekap[]; total: number }>('rekap.get', { bulan });
  const tarunaQ = useListCache<{ taruna: Taruna[] }>('taruna.list', {});
  const [tampilKonfirmasi, setTampilKonfirmasi] = useState(false);
  const [tampilKonfirmasiBatal, setTampilKonfirmasiBatal] = useState(false);
  const [tampilRincian, setTampilRincian] = useState(false);
  const [proses, setProses] = useState(false);

  const memuat = rekapQ.memuat || tarunaQ.memuat;
  const galat = rekapQ.galat || tarunaQ.galat;
  const data = rekapQ.data;
  const baris = data?.rekap ?? [];
  const status = baris[0]?.status ?? '';
  const jmlTaruna = baris.length;
  const totalHariMakan = baris.reduce((s, r) => s + (r.hari_makan || 0), 0);
  const totalNominal = baris.reduce((s, r) => s + (r.nominal || 0), 0);

  const tarunaByNit = new Map((tarunaQ.data?.taruna ?? []).map((t) => [t.nit, t]));

  // Kelompokkan per Prodi + Tingkat (taruna tanpa data TARUNA → grup "Lainnya/?").
  const kelompok: Kelompok[] = (() => {
    const peta = new Map<string, Kelompok>();
    baris.forEach((r) => {
      const t = tarunaByNit.get(r.nit);
      const prodi = t?.prodi || 'Lainnya';
      const tingkat = t?.tingkat || '?';
      const kunci = `${prodi}|${tingkat}`;
      let k = peta.get(kunci);
      if (!k) { k = { prodi, tingkat, jml_taruna: 0, hari_makan: 0, hari_tidak_makan: 0, nominal: 0 }; peta.set(kunci, k); }
      k.jml_taruna += 1;
      k.hari_makan += r.hari_makan || 0;
      k.hari_tidak_makan += r.hari_tidak_makan || 0;
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

  function anggotaKelompok(k: Kelompok): BarisRekap[] {
    return rincian.filter((r) => {
      const t = tarunaByNit.get(r.nit);
      return (t?.prodi || 'Lainnya') === k.prodi && (t?.tingkat || '?') === k.tingkat;
    });
  }

  async function setujui() {
    setProses(true);
    try {
      await api('rekap.approve_wadir3', { bulan });
      toast('Rekap disetujui — diteruskan ke PPK untuk verifikasi & finalisasi.', 'sukses');
      setTampilKonfirmasi(false);
      rekapQ.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  async function batalkanPersetujuan() {
    setProses(true);
    try {
      await api('rekap.batal_wadir3', { bulan });
      toast('Persetujuan dibatalkan — rekap kembali ke DRAFT.', 'sukses');
      setTampilKonfirmasiBatal(false);
      rekapQ.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-primary-dark">Persetujuan Rekap (Wadir 3)</h1>
      <BulanPicker bulan={bulan} onChange={setBulan} />

      {memuat && !data && <LoadingSpinner label="Memuat rekap…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={() => { rekapQ.refresh(); tarunaQ.refresh(); }} />}
      {data && baris.length === 0 && <EmptyState pesan="Belum ada rekap bulan ini." />}

      {baris.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Status Rekap</span>
            <Badge status={status} />
          </div>

          {/* Ringkasan — hari makan & nominal usulan (belum beku) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KartuStat label="Jumlah Taruna" nilai={String(jmlTaruna)} satuan="taruna" />
            <KartuStat label="Total Hari Makan" nilai={totalHariMakan.toLocaleString('id-ID')} satuan="hari" />
            <KartuStat label="Total Nominal" nilai={formatRupiah(totalNominal)} tekankan />
          </div>

          <p className="text-xs text-gray-500">
            Angka di atas adalah <strong>usulan</strong> bantuan uang makan bulan ini (hari
            makan sah × tarif kontrak). Belum dikunci — angka baru dibekukan saat PPK
            memfinalkan setelah persetujuan Anda.
          </p>

          {/* Rekap per Prodi + Tingkat */}
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
                  <td className="pt-2 pr-2 text-right">{jmlTaruna}</td>
                  <td className="pt-2 pr-2 text-right">{totalHariMakan.toLocaleString('id-ID')}</td>
                  <td className="pt-2 text-right">{formatRupiah(totalNominal)}</td>
                </tr>
              </tfoot>
            </table>
          </Card>

          {/* Rincian per taruna — bisa dibuka/tutup */}
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
                      <th className="py-1 pr-2 text-right">Tidak Makan</th>
                      <th className="py-1 text-right">Nominal</th>
                    </tr>
                  </thead>
                  {kelompok.map((k) => (
                    <tbody key={`${k.prodi}|${k.tingkat}`}>
                      <tr className="bg-primary-light/30">
                        <td colSpan={6} className="py-1 pr-2 font-semibold text-primary-dark">
                          {k.prodi} / {k.tingkat}
                        </td>
                      </tr>
                      {anggotaKelompok(k).map((r) => {
                        const t = tarunaByNit.get(r.nit);
                        return (
                          <tr key={r.nit} className="border-b border-gray-100">
                            <td className="py-1 pr-2">{r.nit}</td>
                            <td className="py-1 pr-2">{t?.nama || '-'}</td>
                            <td className="py-1 pr-2">{(t?.prodi || 'Lainnya')} / {(t?.tingkat || '?')}</td>
                            <td className="py-1 pr-2 text-right">{r.hari_makan}</td>
                            <td className="py-1 pr-2 text-right">{r.hari_tidak_makan}</td>
                            <td className="py-1 text-right">{formatRupiah(r.nominal)}</td>
                          </tr>
                        );
                      })}
                      <tr className="border-b-2 border-gray-300 font-semibold">
                        <td className="py-1 pr-2" colSpan={3}>Subtotal ({k.jml_taruna} taruna)</td>
                        <td className="py-1 pr-2 text-right">{k.hari_makan.toLocaleString('id-ID')}</td>
                        <td className="py-1 pr-2 text-right">{k.hari_tidak_makan.toLocaleString('id-ID')}</td>
                        <td className="py-1 text-right">{formatRupiah(k.nominal)}</td>
                      </tr>
                    </tbody>
                  ))}
                  <tfoot>
                    <tr className="font-bold">
                      <td className="pt-2 pr-2" colSpan={3}>Total</td>
                      <td className="pt-2 pr-2 text-right">{totalHariMakan.toLocaleString('id-ID')}</td>
                      <td className="pt-2 pr-2 text-right"></td>
                      <td className="pt-2 text-right">{formatRupiah(totalNominal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </Card>
            )}
          </div>

          {/* Aksi persetujuan */}
          {status === 'DRAFT' && (
            <Button onClick={() => setTampilKonfirmasi(true)}>Setujui Rekap</Button>
          )}
          {status === 'DISETUJUI_WADIR3' && (
            <>
              <Card className="bg-green-50 text-center text-sm text-green-800">
                ✅ Sudah disetujui — menunggu PPK memverifikasi &amp; memfinalkan (siap bayar).
              </Card>
              <Button varian="bahaya" onClick={() => setTampilKonfirmasiBatal(true)}>
                Batal Setuju
              </Button>
            </>
          )}
          {(status === 'TERVERIFIKASI_PPK' || status === 'FINAL') && (
            <Card className="bg-green-50 text-center text-sm text-green-800">
              ✅ Sudah disetujui — PPK sedang/menyelesaikan proses finalisasi &amp; pembayaran.
            </Card>
          )}
        </>
      )}

      {tampilKonfirmasi && (
        <Modal judul="Setujui Rekap?" onClose={() => setTampilKonfirmasi(false)}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-600">
              Anda akan menyetujui rekap bulan ini untuk <strong>{jmlTaruna} taruna</strong>{' '}
              ({totalHariMakan.toLocaleString('id-ID')} hari makan, usulan{' '}
              {formatRupiah(totalNominal)}). Setelah disetujui, rekap diteruskan ke{' '}
              <strong>PPK</strong> untuk diverifikasi dan difinalkan (termasuk mengunci
              nominal saat finalisasi) sebelum pembayaran dibuat.
            </p>
            <Button onClick={() => void setujui()} disabled={proses}>
              {proses ? 'Memproses…' : 'Ya, Setujui Rekap'}
            </Button>
          </div>
        </Modal>
      )}

      {tampilKonfirmasiBatal && (
        <Modal judul="Batalkan Persetujuan?" onClose={() => setTampilKonfirmasiBatal(false)}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-600">
              Rekap bulan ini akan kembali ke status <strong>DRAFT</strong> — dipakai kalau
              ternyata ada koreksi hari makan yang perlu diperbaiki dulu sebelum disetujui
              ulang. PPK belum bisa memverifikasi selama masih DRAFT.
            </p>
            <Button varian="bahaya" onClick={() => void batalkanPersetujuan()} disabled={proses}>
              {proses ? 'Memproses…' : 'Ya, Batalkan Persetujuan'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
