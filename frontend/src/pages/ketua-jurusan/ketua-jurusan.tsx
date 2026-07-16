// /luar-kampus-kajur (KETUA_JURUSAN) — input absen luar kampus taruna prodinya
// (boleh tanggal lampau), lihat REKAP (tanpa rekening), dan setujui rekap bulan
// (BANTUAN_LUAR_KAMPUS DRAFT→DISETUJUI_KAJUR). Semua di-scope ke prodi akun oleh
// backend (25_ketua_jurusan.gs); frontend hanya menyajikan.
import { useCallback, useEffect, useState } from 'react';
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
import { urutTingkat } from '../../lib/kelompok-prodi-tingkat';
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

interface TanggalTaruna { tanggal: { tanggal: string; status: string }[]; hari: number; min: string; max: string }

function pad2(n: number): string { return String(n).padStart(2, '0'); }

/**
 * Editor kalender per taruna: lihat tanggal mana saja "di luar kampus" pada bulan
 * itu, ketuk untuk tambah/hapus satu hari, atau potong satu RENTANG sekaligus
 * (mis. taruna berhenti KPA lebih awal). Menyimpan tetap per-tanggal (robust),
 * tapi pengguna melihatnya sebagai satu periode.
 */
function ModalKalenderTaruna({ baris, bulan, onClose, onChanged }: {
  baris: BarisRekap; bulan: string; onClose: () => void; onChanged: () => void;
}) {
  const { toast } = useToast();
  const [data, setData] = useState<TanggalTaruna | null>(null);
  const [status, setStatus] = useState(STATUS_LUAR_KAMPUS[0]);
  const [dari, setDari] = useState('');
  const [sampai, setSampai] = useState('');
  const [proses, setProses] = useState(false);

  const muat = useCallback(async () => {
    try {
      const r = await api<TanggalTaruna>('kajur.tanggal_taruna', { nit: baris.nit, bulan });
      setData(r);
      if (r.tanggal.length) setStatus(r.tanggal[0].status);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal memuat.', 'galat');
    }
  }, [baris.nit, bulan, toast]);
  useEffect(() => { void muat(); }, [muat]);

  const statusByTgl = new Map((data?.tanggal ?? []).map((t) => [t.tanggal, t.status]));
  const [y, m] = bulan.split('-').map(Number);
  const jmlHariBulan = new Date(y, m, 0).getDate();
  const offset = new Date(y, m - 1, 1).getDay();
  const sel: (number | null)[] = [];
  for (let i = 0; i < offset; i++) sel.push(null);
  for (let d = 1; d <= jmlHariBulan; d++) sel.push(d);

  async function toggleHari(d: number) {
    const tgl = `${bulan}-${pad2(d)}`;
    setProses(true);
    try {
      if (statusByTgl.has(tgl)) {
        await api('kajur.hapus_absen', { nit: baris.nit, bulan, tanggal: tgl });
      } else {
        await api('kajur.status_batch', { tanggal: tgl, status, nit: [baris.nit] });
      }
      await muat(); onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  async function potongRentang() {
    if (!dari || !sampai) { toast('Isi tanggal dari & sampai.', 'galat'); return; }
    if (sampai < dari) { toast('Sampai tidak boleh sebelum dari.', 'galat'); return; }
    setProses(true);
    try {
      const r = await api<{ jml_dihapus: number }>('kajur.hapus_absen', { nit: baris.nit, dari, sampai });
      toast(`${r.jml_dihapus} hari luar kampus dihapus (${dari} s.d ${sampai}).`, 'sukses');
      setDari(''); setSampai(''); await muat(); onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  return (
    <Modal judul={`Kalender Luar Kampus — ${baris.nama || baris.nit}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-xs text-gray-500">
          {labelBulan(bulan)} · <b>{data?.hari ?? 0} hari</b>
          {data && data.min ? ` · periode ${data.min} s.d ${data.max}` : ''}. Ketuk tanggal untuk
          tambah/hapus satu hari.
        </p>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">Kegiatan (untuk tambah):</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="min-h-tap flex-1 rounded-xl border border-gray-300 px-2 py-1.5 text-sm">
            {STATUS_LUAR_KAMPUS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {['M', 'S', 'S', 'R', 'K', 'J', 'S'].map((h, i) => (
            <div key={i} className="py-1 font-semibold text-gray-400">{h}</div>
          ))}
          {sel.map((d, i) => {
            if (d === null) return <div key={`e${i}`} />;
            const tgl = `${bulan}-${pad2(d)}`;
            const ada = statusByTgl.has(tgl);
            return (
              <button key={tgl} disabled={proses} onClick={() => void toggleHari(d)}
                title={ada ? `${statusByTgl.get(tgl)} — ketuk untuk hapus` : 'ketuk untuk tambah'}
                className={`min-h-tap rounded-lg border py-1.5 text-sm disabled:opacity-50 ${
                  ada ? 'border-teal-500 bg-teal-500 font-bold text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                {d}
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
          <p className="text-sm font-medium text-amber-800">Potong periode (berhenti lebih awal)</p>
          <p className="mb-2 text-xs text-gray-500">
            Hapus semua hari luar kampus dalam rentang sekaligus — mis. taruna berhenti KPA lebih awal.
            Boleh lintas bulan.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <Input label="Dari" type="date" value={dari} onChange={(e) => setDari(e.target.value)} />
            <Input label="Sampai" type="date" value={sampai} min={dari} onChange={(e) => setSampai(e.target.value)} />
            <Button varian="garis" onClick={() => void potongRentang()} disabled={proses || !dari || !sampai}>
              Hapus Rentang
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function HalamanKetuaJurusan() {
  const { toast } = useToast();
  const [bulan, setBulan] = useState(bulanIni());
  const rekapQ = useListCache<{ bulan: string; prodi: string; baris: BarisRekap[]; total_nominal: number }>('kajur.rekap', { bulan });
  const tarunaQ = useListCache<{ taruna: TarunaKajur[]; prodi: string }>('kajur.taruna_list', {});
  const [tampilKonfirmasi, setTampilKonfirmasi] = useState(false);
  const [kalenderBaris, setKalenderBaris] = useState<BarisRekap | null>(null);
  const [proses, setProses] = useState(false);

  // ── Form input absen ──
  const [tanggal, setTanggal] = useState(hariIni());
  const [tglAkhir, setTglAkhir] = useState('');
  const [status, setStatus] = useState(STATUS_LUAR_KAMPUS[0]);
  const [terpilih, setTerpilih] = useState<Record<string, boolean>>({});
  const [filterKelas, setFilterKelas] = useState(''); // '' = semua kelas
  // ── Form harga satuan (tarif per hari) ──
  const [tarifKegiatan, setTarifKegiatan] = useState(STATUS_LUAR_KAMPUS[0]);
  const [tarifNilai, setTarifNilai] = useState('');
  const [tarifRow, setTarifRow] = useState<Record<string, string>>({}); // tarif edit per taruna

  const prodi = rekapQ.data?.prodi || tarunaQ.data?.prodi || '';
  const baris = rekapQ.data?.baris ?? [];
  // Sudah di-scope ke SATU prodi (akun Kajur) — kelompokkan per Tingkat saja.
  const kelompokTingkat = (() => {
    const map = new Map<string, BarisRekap[]>();
    baris.forEach((b) => {
      const t = b.tingkat || '?';
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(b);
    });
    return Array.from(map.entries())
      .map(([tingkat, rows]) => ({ tingkat, rows }))
      .sort((a, b) => urutTingkat(a.tingkat) - urutTingkat(b.tingkat));
  })();
  const daftarTaruna = tarunaQ.data?.taruna ?? [];
  const nitTerpilih = Object.keys(terpilih).filter((n) => terpilih[n]);

  // ── Kelas = Tingkat (+ kelas bila ada), untuk filter & input per-kelas ──
  const kelasKey = (t: TarunaKajur) => `${t.tingkat || '?'}${t.kelas ? '/' + t.kelas : ''}`;
  const urutKelas = (a: string, b: string) =>
    urutTingkat(a.split('/')[0]) - urutTingkat(b.split('/')[0]) || a.localeCompare(b, 'id');
  const daftarKelas = Array.from(new Set(daftarTaruna.map(kelasKey))).sort(urutKelas);
  const tarunaTampil = daftarTaruna.filter((t) => !filterKelas || kelasKey(t) === filterKelas);
  const grupKelas = (() => {
    const map = new Map<string, TarunaKajur[]>();
    tarunaTampil.forEach((t) => {
      const k = kelasKey(t);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    });
    return Array.from(map.entries())
      .map(([kelas, rows]) => ({
        kelas,
        // urutkan taruna per abjad nama (fallback NIT bila nama kosong)
        rows: rows.slice().sort((a, b) => (a.nama || a.nit).localeCompare(b.nama || b.nit, 'id')),
      }))
      .sort((a, b) => urutKelas(a.kelas, b.kelas));
  })();
  const kelasSemuaTerpilih = (rows: TarunaKajur[]) => rows.length > 0 && rows.every((t) => terpilih[t.nit]);
  function pilihKelas(rows: TarunaKajur[], pilih: boolean) {
    setTerpilih((prev) => {
      const n = { ...prev };
      rows.forEach((t) => { n[t.nit] = pilih; });
      return n;
    });
  }

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

  async function terapkanTarif() {
    if (nitTerpilih.length === 0) { toast('Centang taruna di daftar atas dulu.', 'galat'); return; }
    const nilai = Math.round(Number(tarifNilai) || 0);
    if (nilai <= 0) { toast('Isi harga satuan (lebih dari 0).', 'galat'); return; }
    setProses(true);
    try {
      const r = await api<{ jml: number }>('kajur.set_tarif', {
        bulan, kegiatan: tarifKegiatan, nilai_per_hari: nilai, nit_list: nitTerpilih,
      });
      toast(`Harga satuan ${formatRupiah(nilai)}/hari diterapkan ke ${r.jml} taruna.`, 'sukses');
      setTarifNilai('');
      rekapQ.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  // Tarif per baris (per orang): nilai yang sedang diedit, atau nilai tersimpan.
  const tarifRowVal = (b: BarisRekap) =>
    tarifRow[b.nit] !== undefined ? Math.round(Number(tarifRow[b.nit]) || 0) : b.nilai_per_hari;
  const nominalRow = (b: BarisRekap) => Math.round(b.hari_luar_kampus * tarifRowVal(b));
  const totalHidup = baris.reduce((s, b) => s + nominalRow(b), 0);

  async function simpanTarifRow(b: BarisRekap) {
    const nilai = tarifRowVal(b);
    if (nilai <= 0) { toast('Isi tarif (lebih dari 0).', 'galat'); return; }
    // kegiatan: pakai milik taruna bila tunggal & ada; jika kosong/gabungan, pakai pilihan kartu di atas.
    const kegiatan = b.kegiatan && !b.kegiatan.includes(',') ? b.kegiatan : tarifKegiatan;
    setProses(true);
    try {
      await api('kajur.set_tarif', { bulan, kegiatan, nilai_per_hari: nilai, nit_list: [b.nit] });
      toast(`Tarif ${b.nama || b.nit}: ${formatRupiah(nilai)}/hari tersimpan.`, 'sukses');
      setTarifRow((prev) => { const n = { ...prev }; delete n[b.nit]; return n; });
      rekapQ.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  async function hapusAbsenTaruna(b: BarisRekap) {
    if (!window.confirm(
      `Hapus SEMUA absen luar kampus ${b.nama || b.nit} untuk ${labelBulan(bulan)} (${b.hari_luar_kampus} hari)?\n\n` +
      'Dipakai bila absen salah input. Riwayat hari luar kampus taruna ini pada bulan itu akan dihapus.'
    )) return;
    setProses(true);
    try {
      const r = await api<{ jml_dihapus: number }>('kajur.hapus_absen', { nit: b.nit, bulan });
      toast(`${r.jml_dihapus} hari absen ${b.nama || b.nit} dihapus.`, 'sukses');
      rekapQ.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menghapus.', 'galat');
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

        {daftarTaruna.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Kelas:</label>
            <select value={filterKelas} onChange={(e) => setFilterKelas(e.target.value)}
              className="min-h-tap flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm">
              <option value="">Semua kelas ({daftarTaruna.length} taruna)</option>
              {daftarKelas.map((k) => (
                <option key={k} value={k}>Tingkat {k} ({daftarTaruna.filter((t) => kelasKey(t) === k).length})</option>
              ))}
            </select>
          </div>
        )}

        {tarunaQ.memuat && !tarunaQ.data && <LoadingSpinner label="Memuat taruna…" />}
        {tarunaQ.data && daftarTaruna.length === 0 && <EmptyState pesan="Belum ada taruna di prodi ini." />}
        {daftarTaruna.length > 0 && (
          <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100">
            {grupKelas.map((g) => (
              <div key={g.kelas}>
                {/* Header kelas — centang untuk pilih SATU KELAS sekaligus */}
                <label className="sticky top-0 flex items-center gap-2 border-b border-gray-200 bg-primary-light/40 px-3 py-2 text-sm font-semibold text-primary-dark">
                  <input type="checkbox" className="h-5 w-5"
                    checked={kelasSemuaTerpilih(g.rows)}
                    onChange={(e) => pilihKelas(g.rows, e.target.checked)} />
                  <span className="flex-1">Tingkat {g.kelas}</span>
                  <span className="text-xs font-normal text-gray-500">
                    {g.rows.filter((t) => terpilih[t.nit]).length}/{g.rows.length} dipilih
                  </span>
                </label>
                {g.rows.map((t) => (
                  <label key={t.nit} className="flex items-center gap-2 border-b border-gray-50 px-3 py-2 pl-6 text-sm">
                    <input type="checkbox" className="h-5 w-5" checked={!!terpilih[t.nit]}
                      onChange={(e) => setTerpilih((prev) => ({ ...prev, [t.nit]: e.target.checked }))} />
                    <span className="flex-1">{t.nama || t.nit}</span>
                    <span className="text-xs text-gray-400">{t.tingkat}{t.kelas ? `/${t.kelas}` : ''}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}
        <Button onClick={() => void simpanAbsen()} disabled={proses || nitTerpilih.length === 0}>
          {proses ? 'Menyimpan…' : `Simpan Absen (${nitTerpilih.length} taruna)`}
        </Button>
      </Card>

      {/* ── Isi harga satuan (tarif per hari) ── */}
      <Card className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-gray-700">Isi Harga Satuan (Tarif per Hari)</p>
        <p className="text-xs text-gray-500">
          <b>Centang taruna di daftar atas</b>, pilih kegiatan &amp; isi harga daerah setempat, lalu terapkan.
          Nominal dihitung otomatis = jumlah hari (dari absen) × tarif. Mengubah tarif membuat rekap
          <b> perlu disetujui ulang</b>.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">Kegiatan</label>
            <select value={tarifKegiatan} onChange={(e) => setTarifKegiatan(e.target.value)}
              className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5">
              {STATUS_LUAR_KAMPUS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <Input label="Harga / Hari (Rp)" type="number" inputMode="numeric" min={0}
            value={tarifNilai} onChange={(e) => setTarifNilai(e.target.value)} />
        </div>
        <Button varian="garis" onClick={() => void terapkanTarif()} disabled={proses || nitTerpilih.length === 0}>
          {proses ? 'Menyimpan…' : `Terapkan Tarif ke ${nitTerpilih.length} Taruna`}
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
                <th className="py-1 pr-2 text-right">Tarif/Hari</th>
                <th className="py-1 pr-2 text-right">Nominal</th><th className="py-1">Status</th>
              </tr>
            </thead>
            {kelompokTingkat.map((kt) => {
              const subtotal = kt.rows.reduce((s, b) => s + nominalRow(b), 0);
              return (
                <tbody key={kt.tingkat}>
                  <tr className="bg-primary-light/30">
                    <td colSpan={7} className="py-1 pr-2 font-semibold text-primary-dark">Tingkat {kt.tingkat}</td>
                  </tr>
                  {kt.rows.map((b) => {
                    const berubah = tarifRow[b.nit] !== undefined && tarifRowVal(b) !== b.nilai_per_hari;
                    return (
                      <tr key={b.nit} className="border-b border-gray-100">
                        <td className="py-1 pr-2">{b.nama || b.nit}</td>
                        <td className="py-1 pr-2">{b.tingkat}</td>
                        <td className="py-1 pr-2">{b.kegiatan || '-'}</td>
                        <td className="py-1 pr-2 text-right">{b.hari_luar_kampus}</td>
                        <td className="py-1 pr-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <input type="number" inputMode="numeric" min={0}
                              className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-right text-sm"
                              value={tarifRow[b.nit] ?? String(b.nilai_per_hari || '')}
                              onChange={(e) => setTarifRow((prev) => ({ ...prev, [b.nit]: e.target.value }))} />
                            {berubah && (
                              <button title="Simpan tarif" disabled={proses}
                                className="rounded-lg bg-primary px-2 py-1 text-xs font-bold text-white disabled:opacity-50"
                                onClick={() => void simpanTarifRow(b)}>✓</button>
                            )}
                          </div>
                        </td>
                        <td className="py-1 pr-2 text-right">{formatRupiah(nominalRow(b))}</td>
                        <td className="py-1">
                          <div className="flex items-center gap-2">
                            <span className="flex-1">
                              {!b.ada_blk
                                ? <span className="text-gray-400">belum ada tarif</span>
                                : b.disetujui_kajur
                                  ? <span className="text-green-700">Disetujui</span>
                                  : <span className="text-amber-600">Belum disetujui</span>}
                            </span>
                            <button title="Kalender: atur tanggal / potong periode" disabled={proses}
                              className="rounded-lg px-1.5 py-0.5 text-primary hover:bg-primary-light/30 disabled:opacity-50"
                              onClick={() => setKalenderBaris(b)}>📅</button>
                            {b.hari_luar_kampus > 0 && (
                              <button title="Hapus absen luar kampus taruna ini (koreksi)" disabled={proses}
                                className="rounded-lg px-1.5 py-0.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                                onClick={() => void hapusAbsenTaruna(b)}>🗑</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-b-2 border-gray-300 font-semibold">
                    <td className="py-1 pr-2" colSpan={5}>Subtotal ({kt.rows.length} taruna)</td>
                    <td className="py-1 pr-2 text-right">{formatRupiah(subtotal)}</td>
                    <td className="py-1" />
                  </tr>
                </tbody>
              );
            })}
            <tfoot>
              <tr className="font-bold">
                <td className="pt-2" colSpan={5}>Total</td>
                <td className="pt-2 pr-2 text-right">{formatRupiah(totalHidup)}</td>
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

      {kalenderBaris && (
        <ModalKalenderTaruna baris={kalenderBaris} bulan={bulan}
          onClose={() => setKalenderBaris(null)} onChanged={() => rekapQ.refresh()} />
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
