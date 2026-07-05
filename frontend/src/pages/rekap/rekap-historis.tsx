// /rekap/historis (PPK, Admin) — migrasi rekap bulan PRA-APLIKASI (mis. Jan–Jun
// sebelum e-BAMA aktif) lewat impor CSV, TANPA Pesanan/Realisasi harian palsu.
// Setelah masuk (status DRAFT), lanjut alur normal: Persetujuan Wadir 3 → Verifikasi PPK → Finalkan (siap bayar).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BulanPicker, bulanIni } from '../../components/bulan-picker';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useToast } from '../../components/ui/toast';
import { api } from '../../lib/api';
import { bacaFileTeks, deteksiPemisah, parseCsv } from '../../lib/csv';
import { useListCache } from '../../lib/use-list-cache';

interface Taruna { nit: string; nama: string; status: string }

interface BarisPreview {
  nit: string; nama: string; hariMakan: string; hariTidakMakan: string; nominalDokumen: string;
  valid: boolean; pesan: string; peringatan: string;
}

const KOLOM = ['nit', 'hari_makan', 'hari_tidak_makan', 'nominal'];

export function HalamanRekapHistoris() {
  const nav = useNavigate();
  const { toast } = useToast();
  const tarunaQ = useListCache<{ taruna: Taruna[] }>('taruna.list', {});
  const [bulan, setBulan] = useState(bulanIni());
  const [biayaPerHari, setBiayaPerHari] = useState('');
  const [baris, setBaris] = useState<BarisPreview[]>([]);
  const [proses, setProses] = useState(false);

  const namaByNit = new Map((tarunaQ.data?.taruna ?? []).map((t) => [t.nit, t.nama]));
  const biayaValid = /^\d+$/.test(biayaPerHari) && Number(biayaPerHari) > 0;

  function validasiBaris(kolomIdx: Record<string, number>, row: string[]): BarisPreview {
    const ambil = (k: string) => (kolomIdx[k] !== undefined ? (row[kolomIdx[k]] ?? '').trim() : '');
    const nit = ambil('nit');
    const hariMakan = ambil('hari_makan');
    const hariTidakMakan = ambil('hari_tidak_makan') || '0';
    const nominalDokumen = ambil('nominal');
    const nama = namaByNit.get(nit) ?? '';

    let pesan = '';
    if (!nit) pesan = 'NIT kosong.';
    else if (!nama) pesan = 'NIT tidak ditemukan di data Taruna.';
    else if (hariMakan === '' || !/^\d+$/.test(hariMakan)) pesan = 'hari_makan harus angka bulat.';
    else if (!/^\d+$/.test(hariTidakMakan)) pesan = 'hari_tidak_makan harus angka bulat.';

    // Validasi silang opsional: kalau CSV menyertakan kolom nominal (dari dokumen
    // kertas), cocokkan dengan hari_makan x biaya_per_hari yang diisi di atas.
    let peringatan = '';
    if (!pesan && nominalDokumen && biayaValid) {
      const hitung = Math.round(Number(hariMakan) * Number(biayaPerHari));
      const dariDokumen = Number(nominalDokumen.replace(/[^\d]/g, ''));
      if (isFinite(dariDokumen) && dariDokumen !== hitung) {
        peringatan = `Beda dari dokumen: hitung ${hitung}, dokumen ${dariDokumen}.`;
      }
    }

    return { nit, nama, hariMakan, hariTidakMakan, nominalDokumen, valid: !pesan, pesan, peringatan };
  }

  async function pilihFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const teks = await bacaFileTeks(file);
    const semua = parseCsv(teks, deteksiPemisah(teks));
    if (semua.length < 2) { toast('File CSV kosong atau tidak valid.', 'galat'); return; }

    const header = semua[0].map((h) => h.trim().toLowerCase());
    const kolomIdx: Record<string, number> = {};
    KOLOM.forEach((k) => { const i = header.indexOf(k); if (i >= 0) kolomIdx[k] = i; });
    if (kolomIdx.nit === undefined || kolomIdx.hari_makan === undefined) {
      toast('Header CSV wajib memuat kolom: nit, hari_makan (opsional: hari_tidak_makan, nominal).', 'galat');
      return;
    }
    setBaris(semua.slice(1).map((row) => validasiBaris(kolomIdx, row)));
  }

  const jmlValid = baris.filter((b) => b.valid).length;
  const jmlError = baris.length - jmlValid;
  const jmlPeringatan = baris.filter((b) => b.valid && b.peringatan).length;

  async function impor() {
    if (!biayaValid) { toast('Biaya per hari wajib diisi (angka rupiah bulat).', 'galat'); return; }
    if (jmlValid === 0) { toast('Tidak ada baris valid untuk diimpor.', 'galat'); return; }
    setProses(true);
    try {
      const hasil = await api<{ bulan: string; baris: number }>('rekap.input_historis', {
        bulan,
        biaya_per_hari: Number(biayaPerHari),
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
        alur normal: Persetujuan Wadir 3 → Verifikasi PPK → Finalkan (siap bayar).
      </Card>

      <Card className="flex flex-col gap-3">
        <label className="block text-sm font-medium text-gray-700">Bulan</label>
        <BulanPicker bulan={bulan} onChange={setBulan} />
        <Input label="Biaya per Hari (Rp/orang/hari)" type="number" value={biayaPerHari} onChange={(e) => setBiayaPerHari(e.target.value)} />
        <p className="text-xs text-gray-400">
          Satu angka Rp/hari per taruna (bukan harga per porsi × porsi) — kalau rate
          beda per kelompok (mis. tingkat 3 beda dari tingkat 1–2), impor terpisah
          per kelompok dengan biaya masing-masing; boleh diimpor berkali-kali untuk
          bulan yang sama selama masih DRAFT.
        </p>
      </Card>

      <Card className="flex flex-col gap-2">
        <p className="text-sm text-gray-500">
          Kolom wajib: <code>nit, hari_makan</code>. Opsional: <code>hari_tidak_makan</code> (default 0),{' '}
          <code>nominal</code> (dari dokumen kertas — dipakai validasi silang saja, tidak dikirim ke server).
        </p>
        <input type="file" accept=".csv,text/csv" onChange={(e) => void pilihFile(e)}
          className="min-h-tap rounded-xl border border-gray-300 px-3 py-2.5 text-sm" />
      </Card>

      {baris.length > 0 && (
        <>
          <Card className="flex flex-col gap-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-green-700">{jmlValid} baris valid</span>
              <span className="text-red-600">{jmlError} baris bermasalah</span>
            </div>
            {jmlPeringatan > 0 && (
              <span className="text-amber-700">⚠️ {jmlPeringatan} baris nominal beda dari dokumen — periksa Biaya per Hari.</span>
            )}
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
                  <tr key={i} className={`border-b border-gray-100 ${!b.valid ? 'bg-red-50' : b.peringatan ? 'bg-amber-50' : ''}`}>
                    <td className="py-1 pr-2">{b.nit}</td>
                    <td className="py-1 pr-2">{b.nama || '-'}</td>
                    <td className="py-1 pr-2 text-right">{b.hariMakan}</td>
                    <td className="py-1">
                      {!b.valid
                        ? <span className="text-red-600">{b.pesan}</span>
                        : b.peringatan
                          ? <span className="text-amber-700">{b.peringatan}</span>
                          : <span className="text-green-700">OK</span>}
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
