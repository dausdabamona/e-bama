// /rekap/historis (PPK, Admin) — migrasi rekap bulan PRA-APLIKASI (mis. Jan–Jun
// sebelum e-BAMA aktif) lewat impor CSV, TANPA Pesanan/Realisasi harian palsu.
// Setelah masuk (status DRAFT), lanjut alur normal: Verifikasi → Final → Wadir3.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BulanPicker, bulanIni } from '../../components/bulan-picker';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useToast } from '../../components/ui/toast';
import { api } from '../../lib/api';
import { bacaFileTeks, parseCsv } from '../../lib/csv';
import { useListCache } from '../../lib/use-list-cache';

interface Taruna { nit: string; nama: string; status: string }

interface BarisPreview {
  nit: string; nama: string; hariMakan: string; hariTidakMakan: string;
  valid: boolean; pesan: string;
}

const KOLOM = ['nit', 'hari_makan', 'hari_tidak_makan'];

export function HalamanRekapHistoris() {
  const nav = useNavigate();
  const { toast } = useToast();
  const tarunaQ = useListCache<{ taruna: Taruna[] }>('taruna.list', {});
  const [bulan, setBulan] = useState(bulanIni());
  const [harga, setHarga] = useState('');
  const [porsi, setPorsi] = useState('3');
  const [baris, setBaris] = useState<BarisPreview[]>([]);
  const [proses, setProses] = useState(false);

  const namaByNit = new Map((tarunaQ.data?.taruna ?? []).map((t) => [t.nit, t.nama]));

  function validasiBaris(kolomIdx: Record<string, number>, row: string[]): BarisPreview {
    const ambil = (k: string) => (kolomIdx[k] !== undefined ? (row[kolomIdx[k]] ?? '').trim() : '');
    const nit = ambil('nit');
    const hariMakan = ambil('hari_makan');
    const hariTidakMakan = ambil('hari_tidak_makan') || '0';
    const nama = namaByNit.get(nit) ?? '';

    let pesan = '';
    if (!nit) pesan = 'NIT kosong.';
    else if (!nama) pesan = 'NIT tidak ditemukan di data Taruna.';
    else if (hariMakan === '' || !/^\d+$/.test(hariMakan)) pesan = 'hari_makan harus angka bulat.';
    else if (!/^\d+$/.test(hariTidakMakan)) pesan = 'hari_tidak_makan harus angka bulat.';

    return { nit, nama, hariMakan, hariTidakMakan, valid: !pesan, pesan };
  }

  async function pilihFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const teks = await bacaFileTeks(file);
    const semua = parseCsv(teks);
    if (semua.length < 2) { toast('File CSV kosong atau tidak valid.', 'galat'); return; }

    const header = semua[0].map((h) => h.trim().toLowerCase());
    const kolomIdx: Record<string, number> = {};
    KOLOM.forEach((k) => { const i = header.indexOf(k); if (i >= 0) kolomIdx[k] = i; });
    if (kolomIdx.nit === undefined || kolomIdx.hari_makan === undefined) {
      toast('Header CSV wajib memuat kolom: nit, hari_makan (opsional: hari_tidak_makan).', 'galat');
      return;
    }
    setBaris(semua.slice(1).map((row) => validasiBaris(kolomIdx, row)));
  }

  const jmlValid = baris.filter((b) => b.valid).length;
  const jmlError = baris.length - jmlValid;
  const hargaValid = /^\d+$/.test(harga) && Number(harga) > 0;
  const porsiValid = /^\d+$/.test(porsi) && Number(porsi) > 0;

  async function impor() {
    if (!hargaValid) { toast('Harga per porsi wajib diisi (angka rupiah bulat).', 'galat'); return; }
    if (!porsiValid) { toast('Porsi per hari wajib diisi (angka bulat).', 'galat'); return; }
    if (jmlValid === 0) { toast('Tidak ada baris valid untuk diimpor.', 'galat'); return; }
    setProses(true);
    try {
      const hasil = await api<{ bulan: string; baris: number }>('rekap.input_historis', {
        bulan,
        harga_per_porsi: Number(harga),
        porsi_per_hari: Number(porsi),
        baris: baris.filter((b) => b.valid).map((b) => ({
          nit: b.nit, hari_makan: Number(b.hariMakan), hari_tidak_makan: Number(b.hariTidakMakan)
        }))
      });
      toast(`${hasil.baris} baris rekap bulan ${bulan} berhasil diimpor (status DRAFT).`, 'sukses');
      setBaris([]);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button className="text-left text-sm text-primary" onClick={() => nav('/akun')}>← Kembali</button>
      <h1 className="text-xl font-bold text-primary-dark">Input Rekap Historis (Migrasi)</h1>
      <Card className="text-sm text-gray-600">
        Untuk bulan yang <strong>sudah berjalan manual sebelum e-BAMA aktif</strong>
        (mis. Januari–Juni). Cukup total <strong>hari makan per taruna per bulan</strong> —
        bukan Pesanan/Realisasi harian satu-satu. Setelah masuk, bulan ini lanjut
        alur normal: Verifikasi → Finalkan → Persetujuan Wadir 3.
      </Card>

      <Card className="flex flex-col gap-3">
        <label className="block text-sm font-medium text-gray-700">Bulan</label>
        <BulanPicker bulan={bulan} onChange={setBulan} />
        <div className="flex gap-2">
          <Input label="Harga per Porsi (Rp)" type="number" value={harga} onChange={(e) => setHarga(e.target.value)} />
          <Input label="Porsi per Hari" type="number" value={porsi} onChange={(e) => setPorsi(e.target.value)} />
        </div>
      </Card>

      <Card className="flex flex-col gap-2">
        <p className="text-sm text-gray-500">
          Kolom wajib: <code>nit, hari_makan</code>. Opsional: <code>hari_tidak_makan</code> (default 0).
        </p>
        <input type="file" accept=".csv,text/csv" onChange={(e) => void pilihFile(e)}
          className="min-h-tap rounded-xl border border-gray-300 px-3 py-2.5 text-sm" />
      </Card>

      {baris.length > 0 && (
        <>
          <Card className="flex items-center justify-between text-sm">
            <span className="text-green-700">{jmlValid} baris valid</span>
            <span className="text-red-600">{jmlError} baris bermasalah</span>
          </Card>

          <Card className="max-h-96 overflow-y-auto overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-1 pr-2">NIT</th>
                  <th className="py-1 pr-2">Nama</th>
                  <th className="py-1 pr-2 text-right">Hari Makan</th>
                  <th className="py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {baris.map((b, i) => (
                  <tr key={i} className={`border-b border-gray-100 ${b.valid ? '' : 'bg-red-50'}`}>
                    <td className="py-1 pr-2">{b.nit}</td>
                    <td className="py-1 pr-2">{b.nama || '-'}</td>
                    <td className="py-1 pr-2 text-right">{b.hariMakan}</td>
                    <td className="py-1">
                      {b.valid ? <span className="text-green-700">OK</span> : <span className="text-red-600">{b.pesan}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Button onClick={() => void impor()} disabled={proses || jmlValid === 0}>
            {proses ? 'Mengimpor…' : `Impor ${jmlValid} Baris Rekap ${bulan}`}
          </Button>
        </>
      )}
    </div>
  );
}
