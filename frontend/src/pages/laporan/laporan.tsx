// /laporan (PPK, KPA) — laporan bulanan SOP 17-19: rekap+realisasi+pembayaran+piutang.
// + Rekonsiliasi SP2D (impor "Monitoring SP2D" OM-SPAN, dibandingkan per kelompok
// Prodi+Tingkat+Bulan[+Kegiatan] — lihat docs/skema-sheet.md §17 untuk alasannya).
// Cetak via window.print() dengan CSS print rapi (lihat index.css @media print).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { BulanPicker, bulanIni, labelBulan } from '../../components/bulan-picker';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useToast } from '../../components/ui/toast';
import { api } from '../../lib/api';
import { bacaFileTeks, parseCsv } from '../../lib/csv';
import { useListCache } from '../../lib/use-list-cache';
import type { Taruna } from '../taruna/tipe';
import { formatRupiah } from '../tagihan/tipe';

interface Laporan {
  bulan: string;
  rekap: { jml_taruna: number; total_hari_makan: number; total_nominal: number; status: string };
  realisasi: { jml_hari_sah: number; jml_ketidaksesuaian: number; jml_catatan: number };
  pembayaran: { bayar_id: string; status: string; nilai_total: number; no_spm: string; no_sp2d: string } | null;
  tagihan: { jumlah: number; per_status: Record<string, number>; total_outstanding: number };
}

interface BarisRekon { prodi: string; tingkat: string; sistem: number; sp2d: number; selisih: number; cocok: boolean }
interface BarisRekonLuar extends BarisRekon { kegiatan: string }
interface BarisRekonPerTaruna { nit: string; nama: string; prodi: string; tingkat: string; sistem: number; sp2d: number; selisih: number; cocok: boolean }
interface BarisRekonLuarPerTaruna extends BarisRekonPerTaruna { kegiatan: string }
interface PerluCekManual { no_spm: string; kategori: string; jumlah_pembayaran: number; uraian_asli: string }
interface Rekonsiliasi {
  bulan: string; dalam_kampus: BarisRekon[]; luar_kampus: BarisRekonLuar[];
  dalam_kampus_per_taruna: BarisRekonPerTaruna[]; luar_kampus_per_taruna: BarisRekonLuarPerTaruna[];
  perlu_cek_manual: PerluCekManual[];
}

// Header PERSIS file ekspor "Monitoring SP2D" OM-SPAN klasik — format AGREGAT
// (satu baris = satu kelompok Prodi+Tingkat+Bulan[+Kegiatan], lihat skema §17).
const PETA_KOLOM_SP2D: Record<string, string> = {
  'no. spp/spm': 'no_spm',
  'tanggal spm': 'tgl_spm',
  'no. sp2d': 'no_sp2d',
  'tanggal sp2d': 'tgl_sp2d',
  'jumlah pembayaran': 'jumlah_pembayaran',
  'status sp2d': 'status_sp2d',
  'uraian spp/spm': 'uraian_asli'
};

interface BarisPreviewSp2d {
  no_spm: string; tgl_spm: string; no_sp2d: string; tgl_sp2d: string;
  jumlah_pembayaran: string; status_sp2d: string; uraian_asli: string;
  valid: boolean; pesan: string;
}

// ── Format PER-TARUNA ("SPANExt") — satu baris = satu taruna penerima ──
// Berbeda granularitas dari format agregat: bulan diambil dari tanggal SP2D
// (bukan diparse dari teks), dan nit dicocokkan dari "Nama Penerima" di sini
// (frontend) sebelum dikirim — backend TIDAK menebak, hanya menyimpan apa
// yang sudah dikonfirmasi (lihat docs/skema-sheet.md §17).

/** Cari indeks kolom header, cocokkan longgar (tanpa spasi/titik/underscore, case-insensitive). */
function cariIndeksKolomSp2d(header: string[], ...kandidat: string[]): number {
  const rapikan = (s: string) => s.toLowerCase().replace(/[\s._]/g, '');
  const target = kandidat.map(rapikan);
  return header.findIndex((h) => target.includes(rapikan(h)));
}

/** Normalisasi nama untuk pencocokan: kapital, hapus titik/koma/kutip/strip, rapikan spasi. */
function normalisasiNamaSp2d(s: string): string {
  return s.toUpperCase().replace(/[.,'’-]/g, '').replace(/\s+/g, ' ').trim();
}

/** Cocok BIDIREKSIONAL: nama SPANExt bisa terpotong ATAU punya noise di belakang. */
function cocokBidireksionalSp2d(a: string, b: string): boolean {
  return !!a && !!b && (a.startsWith(b) || b.startsWith(a));
}

/** "31-05-2026" → "2026-05-31"; "-" atau format tak dikenal → ''. */
function parseTglDDMMYYYYSp2d(s: string): string {
  const m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(s.trim());
  if (!m) return '';
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** "Rp. 1.144.000" → "1144000"; kosong bila tak ada digit. */
function parseRupiahSp2d(s: string): string {
  return s.replace(/[^\d]/g, '');
}

interface BarisPreviewPerTaruna {
  noSpm: string; noSp2d: string; tglSp2d: string; jumlahPembayaran: string;
  namaPenerima: string; uraianAsli: string; statusSp2d: string;
  nitTerpilih: string; kandidat: { nit: string; nama: string }[];
  valid: boolean; pesan: string;
}

function validasiBarisPerTaruna(kolomIdx: Record<string, number>, row: string[], daftarTaruna: Taruna[]): BarisPreviewPerTaruna {
  const ambil = (k: string) => (kolomIdx[k] !== undefined ? (row[kolomIdx[k]] ?? '').trim() : '');
  const namaPenerima = ambil('nama_penerima').replace(/^penerima\s*:\s*/i, '').trim();
  const noSp2d = ambil('no_sp2d');
  const noPenerima = ambil('no_penerima');
  const nomorReferensi = ambil('nomor_referensi');
  const tglSp2d = parseTglDDMMYYYYSp2d(ambil('tgl_sp2d'));
  const jumlahPembayaran = parseRupiahSp2d(ambil('jumlah_pembayaran'));
  const uraianAsli = ambil('uraian_asli');
  const statusSp2d = ambil('status_sp2d');
  const noSpm = nomorReferensi || `${noSp2d}-${noPenerima}`;

  let pesan = '';
  if (!noSpm.trim() || noSpm === '-') pesan = 'Nomor Referensi / No SP2D+No Penerima kosong.';
  else if (!tglSp2d) pesan = 'Tanggal SP2D tidak terbaca (harus DD-MM-YYYY).';
  else if (!jumlahPembayaran) pesan = 'Jumlah tidak terbaca sebagai angka.';
  else if (!namaPenerima) pesan = 'Nama Penerima kosong.';

  const target = normalisasiNamaSp2d(namaPenerima);
  const kandidat = target
    ? daftarTaruna
        .filter((t) => cocokBidireksionalSp2d(normalisasiNamaSp2d(t.nama), target))
        .map((t) => ({ nit: t.nit, nama: t.nama }))
    : [];

  return {
    noSpm, noSp2d, tglSp2d, jumlahPembayaran, namaPenerima, uraianAsli, statusSp2d,
    nitTerpilih: kandidat.length === 1 ? kandidat[0].nit : '', kandidat,
    valid: !pesan, pesan
  };
}

export function HalamanLaporan() {
  const { session } = useAuth();
  const { toast } = useToast();
  const bisaImporSp2d = session?.role === 'PPK' || session?.role === 'ADMIN';

  const [bulan, setBulan] = useState(bulanIni());
  const { data, memuat, galat, refresh } = useListCache<Laporan>('laporan.bulanan', { bulan });
  const rekonQ = useListCache<Rekonsiliasi>('sp2d.rekonsiliasi', { bulan });
  const tarunaQ = useListCache<{ taruna: Taruna[] }>('taruna.list', {});
  const daftarTaruna = (tarunaQ.data?.taruna ?? []).slice().sort((a, b) => a.nama.localeCompare(b.nama));

  const [kategori, setKategori] = useState<'DALAM_KAMPUS' | 'LUAR_KAMPUS'>('DALAM_KAMPUS');
  const [barisSp2d, setBarisSp2d] = useState<BarisPreviewSp2d[]>([]);
  const [barisPerTaruna, setBarisPerTaruna] = useState<BarisPreviewPerTaruna[]>([]);
  const [prosesImpor, setProsesImpor] = useState(false);

  function validasiBarisSp2d(kolomIdx: Record<string, number>, row: string[]): BarisPreviewSp2d {
    const ambil = (k: string) => (kolomIdx[k] !== undefined ? (row[kolomIdx[k]] ?? '').trim() : '');
    const noSpm = ambil('no_spm');
    const jumlah = ambil('jumlah_pembayaran');
    const uraian = ambil('uraian_asli');

    let pesan = '';
    if (!noSpm) pesan = 'No. SPP/SPM kosong.';
    else if (!/^\d+$/.test(jumlah)) pesan = 'Jumlah Pembayaran harus angka bulat.';
    else if (!uraian) pesan = 'Uraian SPP/SPM kosong.';

    return {
      no_spm: noSpm, tgl_spm: ambil('tgl_spm'), no_sp2d: ambil('no_sp2d'), tgl_sp2d: ambil('tgl_sp2d'),
      jumlah_pembayaran: jumlah, status_sp2d: ambil('status_sp2d'), uraian_asli: uraian,
      valid: !pesan, pesan
    };
  }

  async function pilihFileSp2d(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const teks = await bacaFileTeks(file);
    const semua = parseCsv(teks);
    if (semua.length < 2) { toast('File CSV kosong atau tidak valid.', 'galat'); return; }

    const header = semua[0].map((h) => h.trim().toLowerCase());
    const iNamaPenerima = cariIndeksKolomSp2d(header, 'nama penerima');

    if (iNamaPenerima >= 0) {
      // ── Format per-taruna (SPANExt) — satu baris = satu taruna penerima ──
      const kolomIdx: Record<string, number> = { nama_penerima: iNamaPenerima };
      const tambah = (k: string, ...kandidat: string[]) => {
        const idx = cariIndeksKolomSp2d(header, ...kandidat);
        if (idx >= 0) kolomIdx[k] = idx;
      };
      tambah('no_sp2d', 'no sp2d');
      tambah('no_penerima', 'no penerima');
      tambah('nomor_referensi', 'nomor referensi');
      tambah('tgl_sp2d', 'tanggal sp2d');
      tambah('jumlah_pembayaran', 'jumlah');
      tambah('uraian_asli', 'deskripsi');
      tambah('status_sp2d', 'status');
      setBarisSp2d([]);
      setBarisPerTaruna(semua.slice(1).map((row) => validasiBarisPerTaruna(kolomIdx, row, daftarTaruna)));
      return;
    }

    // ── Format agregat (lama, satu baris = satu kelompok Prodi+Tingkat+Bulan) ──
    const kolomIdx: Record<string, number> = {};
    header.forEach((h, i) => { const k = PETA_KOLOM_SP2D[h]; if (k) kolomIdx[k] = i; });
    if (kolomIdx.no_spm === undefined || kolomIdx.jumlah_pembayaran === undefined || kolomIdx.uraian_asli === undefined) {
      toast('Header CSV tidak dikenali — wajib "Nama Penerima" (format per-taruna/SPANExt) atau No. SPP/SPM + Jumlah Pembayaran + Uraian SPP/SPM (format agregat lama).', 'galat');
      return;
    }
    setBarisPerTaruna([]);
    setBarisSp2d(semua.slice(1).map((row) => validasiBarisSp2d(kolomIdx, row)));
  }

  const jmlValidSp2d = barisSp2d.filter((b) => b.valid).length;
  const jmlErrorSp2d = barisSp2d.length - jmlValidSp2d;

  async function imporSp2d() {
    if (jmlValidSp2d === 0) { toast('Tidak ada baris valid untuk diimpor.', 'galat'); return; }
    setProsesImpor(true);
    try {
      const hasil = await api<{ ditambah: number; dilewati: number }>('sp2d.import', {
        kategori,
        baris: barisSp2d.filter((b) => b.valid).map((b) => ({
          no_spm: b.no_spm, tgl_spm: b.tgl_spm, no_sp2d: b.no_sp2d, tgl_sp2d: b.tgl_sp2d,
          jumlah_pembayaran: Number(b.jumlah_pembayaran), status_sp2d: b.status_sp2d, uraian_asli: b.uraian_asli
        }))
      });
      toast(`${hasil.ditambah} baris baru ditambah, ${hasil.dilewati} baris dilewati (sudah ada).`, 'sukses');
      setBarisSp2d([]);
      rekonQ.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProsesImpor(false);
    }
  }

  function setNitBarisPerTaruna(i: number, nit: string) {
    setBarisPerTaruna((prev) => prev.map((b, idx) => (idx === i ? { ...b, nitTerpilih: nit } : b)));
  }

  const jmlSiapImporPerTaruna = barisPerTaruna.filter((b) => b.valid && b.nitTerpilih).length;

  async function imporPerTaruna() {
    const siap = barisPerTaruna.filter((b) => b.valid && b.nitTerpilih);
    if (siap.length === 0) { toast('Belum ada baris valid & tercocokkan ke taruna.', 'galat'); return; }
    setProsesImpor(true);
    try {
      const hasil = await api<{ ditambah: number; dilewati: number }>('sp2d.import', {
        kategori,
        baris: siap.map((b) => ({
          no_spm: b.noSpm, nit: b.nitTerpilih, no_sp2d: b.noSp2d, tgl_sp2d: b.tglSp2d,
          jumlah_pembayaran: Number(b.jumlahPembayaran), status_sp2d: b.statusSp2d, uraian_asli: b.uraianAsli
        }))
      });
      toast(`${hasil.ditambah} baris baru ditambah, ${hasil.dilewati} baris dilewati (sudah ada).`, 'sukses');
      setBarisPerTaruna([]);
      rekonQ.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProsesImpor(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-bold text-primary-dark">Laporan Bulanan</h1>
        {data && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak</Button>}
      </div>
      <div className="print:hidden"><BulanPicker bulan={bulan} onChange={setBulan} /></div>
      <Link to="/laporan/resmi" className="text-sm text-primary underline print:hidden">
        📋 Laporan Bulanan Resmi (format Itjen/KKP)
      </Link>

      {memuat && !data && <LoadingSpinner label="Memuat laporan…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}

      {data && (
        <div id="area-cetak" className="flex flex-col gap-4">
          <div className="hidden text-center print:block">
            <h1 className="text-lg font-bold">Laporan Bulanan Bantuan Uang Makan Taruna</h1>
            <p className="text-sm">Politeknik Kelautan dan Perikanan Sorong — {labelBulan(data.bulan)}</p>
          </div>

          <Card>
            <p className="mb-2 font-semibold text-primary-dark">1. Rekapitulasi</p>
            <Baris label="Jumlah Taruna" nilai={String(data.rekap.jml_taruna)} />
            <Baris label="Total Hari Makan" nilai={String(data.rekap.total_hari_makan)} />
            <Baris label="Total Nominal" nilai={formatRupiah(data.rekap.total_nominal)} />
            <Baris label="Status Rekap" nilai={data.rekap.status || '-'} />
          </Card>

          <Card>
            <p className="mb-2 font-semibold text-primary-dark">2. Realisasi</p>
            <Baris label="Hari Realisasi Sah (2 TTD)" nilai={String(data.realisasi.jml_hari_sah)} />
            <Baris label="Jumlah Ketidaksesuaian" nilai={String(data.realisasi.jml_ketidaksesuaian)} />
            <Baris label="Total Baris Realisasi" nilai={String(data.realisasi.jml_catatan)} />
          </Card>

          <Card>
            <p className="mb-2 font-semibold text-primary-dark">3. Pembayaran</p>
            {data.pembayaran ? (
              <>
                <Baris label="No. Pembayaran" nilai={data.pembayaran.bayar_id} />
                <Baris label="Status" nilai={data.pembayaran.status.replace(/_/g, ' ')} />
                <Baris label="Nilai Total" nilai={formatRupiah(data.pembayaran.nilai_total)} />
                <Baris label="No. SPM" nilai={data.pembayaran.no_spm || '-'} />
                <Baris label="No. SP2D" nilai={data.pembayaran.no_sp2d || '-'} />
              </>
            ) : <p className="text-sm text-gray-400">Belum ada pembayaran bulan ini.</p>}
          </Card>

          <Card>
            <p className="mb-2 font-semibold text-primary-dark">4. Piutang (Tagihan Gagal Debet)</p>
            <Baris label="Jumlah Tagihan" nilai={String(data.tagihan.jumlah)} />
            {Object.entries(data.tagihan.per_status).map(([status, n]) => (
              <Baris key={status} label={status.replace(/_/g, ' ')} nilai={String(n)} />
            ))}
            <Baris label="Total Outstanding" nilai={formatRupiah(data.tagihan.total_outstanding)} />
          </Card>

          <Card>
            <p className="mb-2 font-semibold text-primary-dark">5. Rekonsiliasi SP2D</p>
            <p className="mb-2 text-xs text-gray-500 print:hidden">
              Perbandingan nominal tercatat sistem vs SP2D yang benar-benar cair (Monitoring SP2D
              OM-SPAN), dikelompokkan per Prodi+Tingkat (Dalam Kampus) atau
              Kegiatan+Prodi+Tingkat (Luar Kampus) — bukan tautan per baris (lihat catatan skema).
            </p>

            {rekonQ.memuat && !rekonQ.data && <LoadingSpinner label="Memuat rekonsiliasi…" />}
            {rekonQ.galat && !rekonQ.data && <ErrorMessage pesan={rekonQ.galat} onRetry={rekonQ.refresh} />}

            {rekonQ.data && (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="mb-1 text-xs font-semibold text-gray-500">Dalam Kampus</p>
                  {rekonQ.data.dalam_kampus.length === 0 ? (
                    <p className="text-xs text-gray-400">Belum ada data SP2D/rekap bulan ini.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500">
                          <th className="py-1 pr-2">Prodi</th><th className="py-1 pr-2">Tingkat</th>
                          <th className="py-1 pr-2 text-right">Sistem</th><th className="py-1 pr-2 text-right">SP2D</th>
                          <th className="py-1 pr-2 text-right">Selisih</th><th className="py-1">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rekonQ.data.dalam_kampus.map((r, i) => (
                          <tr key={i} className={`border-b border-gray-100 ${r.cocok ? '' : 'bg-red-50'}`}>
                            <td className="py-1 pr-2">{r.prodi}</td><td className="py-1 pr-2">{r.tingkat}</td>
                            <td className="py-1 pr-2 text-right">{formatRupiah(r.sistem)}</td>
                            <td className="py-1 pr-2 text-right">{formatRupiah(r.sp2d)}</td>
                            <td className="py-1 pr-2 text-right">{formatRupiah(r.selisih)}</td>
                            <td className="py-1">{r.cocok ? <span className="text-green-700">Cocok</span> : <span className="text-red-600">Selisih</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold text-gray-500">Luar Kampus</p>
                  {rekonQ.data.luar_kampus.length === 0 ? (
                    <p className="text-xs text-gray-400">Belum ada data SP2D/bantuan luar kampus bulan ini.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500">
                          <th className="py-1 pr-2">Kegiatan</th><th className="py-1 pr-2">Prodi</th><th className="py-1 pr-2">Tingkat</th>
                          <th className="py-1 pr-2 text-right">Sistem</th><th className="py-1 pr-2 text-right">SP2D</th>
                          <th className="py-1 pr-2 text-right">Selisih</th><th className="py-1">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rekonQ.data.luar_kampus.map((r, i) => (
                          <tr key={i} className={`border-b border-gray-100 ${r.cocok ? '' : 'bg-red-50'}`}>
                            <td className="py-1 pr-2">{r.kegiatan}</td><td className="py-1 pr-2">{r.prodi}</td><td className="py-1 pr-2">{r.tingkat}</td>
                            <td className="py-1 pr-2 text-right">{formatRupiah(r.sistem)}</td>
                            <td className="py-1 pr-2 text-right">{formatRupiah(r.sp2d)}</td>
                            <td className="py-1 pr-2 text-right">{formatRupiah(r.selisih)}</td>
                            <td className="py-1">{r.cocok ? <span className="text-green-700">Cocok</span> : <span className="text-red-600">Selisih</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {rekonQ.data.dalam_kampus_per_taruna.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold text-gray-500">Dalam Kampus — per Taruna (SPANExt)</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500">
                          <th className="py-1 pr-2">Nama</th><th className="py-1 pr-2">Prodi/Tingkat</th>
                          <th className="py-1 pr-2 text-right">Sistem</th><th className="py-1 pr-2 text-right">SP2D</th>
                          <th className="py-1 pr-2 text-right">Selisih</th><th className="py-1">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rekonQ.data.dalam_kampus_per_taruna.map((r) => (
                          <tr key={r.nit} className={`border-b border-gray-100 ${r.cocok ? '' : 'bg-red-50'}`}>
                            <td className="py-1 pr-2">{r.nama || r.nit}</td>
                            <td className="py-1 pr-2">{r.prodi || '?'}/{r.tingkat || '?'}</td>
                            <td className="py-1 pr-2 text-right">{formatRupiah(r.sistem)}</td>
                            <td className="py-1 pr-2 text-right">{formatRupiah(r.sp2d)}</td>
                            <td className="py-1 pr-2 text-right">{formatRupiah(r.selisih)}</td>
                            <td className="py-1">{r.cocok ? <span className="text-green-700">Cocok</span> : <span className="text-red-600">Selisih</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {rekonQ.data.luar_kampus_per_taruna.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold text-gray-500">Luar Kampus — per Taruna (SPANExt)</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500">
                          <th className="py-1 pr-2">Nama</th><th className="py-1 pr-2">Kegiatan</th><th className="py-1 pr-2">Prodi/Tingkat</th>
                          <th className="py-1 pr-2 text-right">Sistem</th><th className="py-1 pr-2 text-right">SP2D</th>
                          <th className="py-1 pr-2 text-right">Selisih</th><th className="py-1">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rekonQ.data.luar_kampus_per_taruna.map((r, i) => (
                          <tr key={`${r.nit}-${r.kegiatan}-${i}`} className={`border-b border-gray-100 ${r.cocok ? '' : 'bg-red-50'}`}>
                            <td className="py-1 pr-2">{r.nama || r.nit}</td>
                            <td className="py-1 pr-2">{r.kegiatan}</td>
                            <td className="py-1 pr-2">{r.prodi || '?'}/{r.tingkat || '?'}</td>
                            <td className="py-1 pr-2 text-right">{formatRupiah(r.sistem)}</td>
                            <td className="py-1 pr-2 text-right">{formatRupiah(r.sp2d)}</td>
                            <td className="py-1 pr-2 text-right">{formatRupiah(r.selisih)}</td>
                            <td className="py-1">{r.cocok ? <span className="text-green-700">Cocok</span> : <span className="text-red-600">Selisih</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {rekonQ.data.perlu_cek_manual.length > 0 && (
                  <div className="print:hidden">
                    <p className="mb-1 text-xs font-semibold text-amber-700">
                      ⚠️ {rekonQ.data.perlu_cek_manual.length} baris SP2D bulan ini gagal diparse otomatis — perlu dicek manual:
                    </p>
                    <ul className="flex flex-col gap-1">
                      {rekonQ.data.perlu_cek_manual.map((r) => (
                        <li key={r.no_spm} className="text-xs text-gray-600">
                          <strong>{r.no_spm}</strong> ({r.kategori.replace('_', ' ')}, {formatRupiah(r.jumlah_pembayaran)}): {r.uraian_asli}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>

          {bisaImporSp2d && (
            <Card className="flex flex-col gap-2 print:hidden">
              <p className="text-sm font-semibold text-gray-600">Impor Monitoring SP2D</p>
              <p className="text-xs text-gray-500">
                Unggah CSV — dua format didukung: (1) "Monitoring SP2D" OM-SPAN klasik (agregat, header
                No. SPP/SPM dst.), atau (2) "SPANExt" per-taruna (header memuat "Nama Penerima") — dicocokkan
                ke NIT di bawah sebelum disimpan. Hanya baris yang BELUM pernah masuk yang ditambah.
              </p>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Kategori Sumber</label>
                <select value={kategori} onChange={(e) => setKategori(e.target.value as 'DALAM_KAMPUS' | 'LUAR_KAMPUS')}
                  className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5">
                  <option value="DALAM_KAMPUS">Dalam Kampus</option>
                  <option value="LUAR_KAMPUS">Luar Kampus (PKL/KPA/PTB)</option>
                </select>
              </div>
              {tarunaQ.memuat && !tarunaQ.data ? (
                <LoadingSpinner label="Memuat daftar Taruna dulu (perlu untuk cocokkan nama SPANExt)…" />
              ) : (
                <input type="file" accept=".csv,text/csv" onChange={(e) => void pilihFileSp2d(e)}
                  className="min-h-tap rounded-xl border border-gray-300 px-3 py-2.5 text-sm" />
              )}

              {barisSp2d.length > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-700">{jmlValidSp2d} baris valid</span>
                    <span className="text-red-600">{jmlErrorSp2d} baris bermasalah</span>
                  </div>
                  <div className="max-h-96 overflow-y-auto overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500">
                          <th className="py-1 pr-2">No. SPM</th><th className="py-1 pr-2 text-right">Jumlah</th>
                          <th className="py-1">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {barisSp2d.map((b, i) => (
                          <tr key={i} className={`border-b border-gray-100 ${b.valid ? '' : 'bg-red-50'}`}>
                            <td className="py-1 pr-2">{b.no_spm}</td>
                            <td className="py-1 pr-2 text-right">{b.valid ? formatRupiah(Number(b.jumlah_pembayaran)) : '-'}</td>
                            <td className="py-1">{b.valid ? <span className="text-green-700">OK</span> : <span className="text-red-600">{b.pesan}</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button onClick={() => void imporSp2d()} disabled={prosesImpor || jmlValidSp2d === 0}>
                    {prosesImpor ? 'Mengimpor…' : `Impor ${jmlValidSp2d} Baris`}
                  </Button>
                </>
              )}

              {barisPerTaruna.length > 0 && (
                <>
                  <p className="text-xs text-amber-700">
                    ⚠️ Nama di file SPANExt bisa terpotong/ber-noise — pencocokan di bawah HANYA usulan,
                    periksa/tentukan NIT tiap baris sebelum menyimpan.
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-700">{jmlSiapImporPerTaruna} dari {barisPerTaruna.length} baris siap diimpor (valid &amp; tercocokkan)</span>
                  </div>
                  <div className="max-h-[32rem] overflow-y-auto overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500">
                          <th className="py-1 pr-2">Nama Penerima</th><th className="py-1 pr-2">Tgl SP2D</th>
                          <th className="py-1 pr-2 text-right">Jumlah</th><th className="py-1">Validasi</th>
                          <th className="py-1">Cocokkan ke Taruna</th>
                        </tr>
                      </thead>
                      <tbody>
                        {barisPerTaruna.map((b, i) => (
                          <tr key={i} className={`border-b border-gray-100 ${!b.valid ? 'bg-red-50' : !b.nitTerpilih ? 'bg-amber-50' : ''}`}>
                            <td className="py-1 pr-2">{b.namaPenerima}</td>
                            <td className="py-1 pr-2">{b.tglSp2d || '-'}</td>
                            <td className="py-1 pr-2 text-right">{b.jumlahPembayaran ? formatRupiah(Number(b.jumlahPembayaran)) : '-'}</td>
                            <td className="py-1">{b.valid ? <span className="text-green-700">OK</span> : <span className="text-red-600">{b.pesan}</span>}</td>
                            <td className="py-1">
                              <select value={b.nitTerpilih} onChange={(e) => setNitBarisPerTaruna(i, e.target.value)}
                                className="w-full rounded border border-gray-300 px-1 py-1">
                                <option value="">— pilih taruna —</option>
                                {b.kandidat.length > 0 && (
                                  <optgroup label="Usulan (cocok nama)">
                                    {b.kandidat.map((k) => <option key={k.nit} value={k.nit}>{k.nama} ({k.nit})</option>)}
                                  </optgroup>
                                )}
                                <optgroup label="Semua Taruna">
                                  {daftarTaruna.map((t) => <option key={t.nit} value={t.nit}>{t.nama} ({t.nit})</option>)}
                                </optgroup>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button onClick={() => void imporPerTaruna()} disabled={prosesImpor || jmlSiapImporPerTaruna === 0}>
                    {prosesImpor ? 'Mengimpor…' : `Impor ${jmlSiapImporPerTaruna} Baris`}
                  </Button>
                </>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Baris({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="flex justify-between border-b border-gray-100 py-1 text-sm last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{nilai}</span>
    </div>
  );
}
