// /luar-kampus (PPK, Admin impor; KPA/Wadir3 lihat) — Bantuan Luar Kampus
// (PKL/Magang/KPA/PTB): transfer tunai langsung, rate per individu per
// wilayah — BUKAN lewat kontrak penyedia seperti Dalam Kampus.
// Impor CSV memakai header PERSIS file "Gabungan" yang sudah biasa dipakai
// Ketua Jurusan/panitia — nomor rekening (kalau ada di file) SENGAJA diabaikan.
import { useState } from 'react';
import { useAuth } from '../../auth/auth-context';
import { BulanPicker, bulanIni } from '../../components/bulan-picker';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useToast } from '../../components/ui/toast';
import { api } from '../../lib/api';
import { bacaFileTeks, deteksiPemisah, parseCsv } from '../../lib/csv';
import { useListCache } from '../../lib/use-list-cache';
import { formatRupiah } from '../tagihan/tipe';
import { parsePeriodeBulan, type BantuanLuarKampus } from './tipe';

interface Taruna { nit: string; nama: string }

interface BarisPreview {
  nit: string; nama: string; kegiatan: string; bulan: string; periode: string;
  totalHari: string; nilaiPerHari: string; pembayaranKe: string; keterangan: string;
  nominal: number; valid: boolean; pesan: string;
}

// Header PERSIS file sumber (case-insensitive) → kunci internal.
const PETA_KOLOM: Record<string, string> = {
  'nit': 'nit',
  'kegiatan': 'kegiatan',
  'bulan': 'bulan',
  'periode pembayaran': 'periode',
  'periode_berkas': 'periode_fallback',
  'total hari': 'total_hari',
  'nilai/hari': 'nilai_per_hari',
  'pembayaran_ke': 'pembayaran_ke',
  'sumber_file': 'keterangan'
};

export function HalamanBantuanLuarKampus() {
  const { session } = useAuth();
  const { toast } = useToast();
  const bisaImpor = session?.role === 'PPK' || session?.role === 'ADMIN';

  const [bulanFilter, setBulanFilter] = useState(bulanIni());
  const listQ = useListCache<{ bantuan: BantuanLuarKampus[]; total: number }>('blk.list', { bulan: bulanFilter });
  const tarunaQ = useListCache<{ taruna: Taruna[] }>('taruna.list', {});
  const namaByNit = new Map((tarunaQ.data?.taruna ?? []).map((t) => [t.nit, t.nama]));

  const [baris, setBaris] = useState<BarisPreview[]>([]);
  const [proses, setProses] = useState(false);

  function validasiBaris(kolomIdx: Record<string, number>, row: string[]): BarisPreview {
    const ambil = (k: string) => (kolomIdx[k] !== undefined ? (row[kolomIdx[k]] ?? '').trim() : '');
    const nit = ambil('nit');
    const kegiatan = ambil('kegiatan');
    const periode = ambil('periode') || ambil('periode_fallback');
    const bulanEksplisit = ambil('bulan');
    const totalHari = ambil('total_hari');
    const nilaiPerHari = ambil('nilai_per_hari');
    const pembayaranKe = ambil('pembayaran_ke') || '1';
    const keterangan = ambil('keterangan');
    const nama = namaByNit.get(nit) ?? '';
    const bulan = /^\d{4}-\d{2}$/.test(bulanEksplisit) ? bulanEksplisit : (parsePeriodeBulan(periode) ?? '');

    let pesan = '';
    if (!nit) pesan = 'NIT kosong.';
    else if (!nama) pesan = 'NIT tidak ditemukan di data Taruna.';
    else if (!kegiatan) pesan = 'Kegiatan kosong.';
    else if (!bulan) pesan = 'Bulan tidak terdeteksi dari periode — sertakan kolom bulan (YYYY-MM).';
    else if (!/^\d+$/.test(totalHari)) pesan = 'Total Hari harus angka bulat.';
    else if (!/^\d+$/.test(nilaiPerHari)) pesan = 'Nilai/Hari harus angka bulat.';
    else if (!/^\d+$/.test(pembayaranKe)) pesan = 'Pembayaran_ke harus angka bulat.';

    const nominal = (!pesan) ? Math.round(Number(totalHari) * Number(nilaiPerHari)) : 0;
    return { nit, nama, kegiatan, bulan, periode, totalHari, nilaiPerHari, pembayaranKe, keterangan, nominal, valid: !pesan, pesan };
  }

  async function pilihFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const teks = await bacaFileTeks(file);
    const semua = parseCsv(teks, deteksiPemisah(teks));
    if (semua.length < 2) { toast('File CSV kosong atau tidak valid.', 'galat'); return; }

    const header = semua[0].map((h) => h.trim().toLowerCase());
    const kolomIdx: Record<string, number> = {};
    header.forEach((h, i) => { const k = PETA_KOLOM[h]; if (k) kolomIdx[k] = i; });
    if (kolomIdx.nit === undefined || kolomIdx.kegiatan === undefined || kolomIdx.total_hari === undefined || kolomIdx.nilai_per_hari === undefined) {
      toast('Header CSV wajib memuat: NIT, Kegiatan, Total Hari, Nilai/Hari (format persis file Gabungan).', 'galat');
      return;
    }
    setBaris(semua.slice(1).map((row) => validasiBaris(kolomIdx, row)));
  }

  const jmlValid = baris.filter((b) => b.valid).length;
  const jmlError = baris.length - jmlValid;

  async function impor() {
    if (jmlValid === 0) { toast('Tidak ada baris valid untuk diimpor.', 'galat'); return; }
    setProses(true);
    try {
      const hasil = await api<{ baris: number }>('blk.import', {
        baris: baris.filter((b) => b.valid).map((b) => ({
          nit: b.nit, kegiatan: b.kegiatan, bulan: b.bulan, periode: b.periode,
          total_hari: Number(b.totalHari), nilai_per_hari: Number(b.nilaiPerHari),
          pembayaran_ke: Number(b.pembayaranKe), keterangan: b.keterangan
        }))
      });
      toast(`${hasil.baris} baris Bantuan Luar Kampus berhasil diimpor.`, 'sukses');
      setBaris([]);
      listQ.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-primary-dark">Bantuan Luar Kampus</h1>
      <Card className="text-sm text-gray-600">
        Bantuan biaya makan tunai untuk taruna PKL/Magang/KPA/PTB — rate per hari
        BISA beda per individu sesuai wilayah penempatan. Ketua Jurusan & panitia
        menyusun rekapnya di luar sistem; diajukan ke PPK untuk diinput di sini.
      </Card>

      {bisaImpor && (
        <Card className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-gray-600">Impor CSV</p>
          <p className="text-xs text-gray-500">
            Unggah langsung file "Gabungan" yang sudah biasa dipakai (header:
            NIT, Kegiatan, Periode Pembayaran, Total Hari, Nilai/Hari, Pembayaran_ke).
            Nomor rekening di file (kalau ada) <strong>diabaikan</strong>, tidak diimpor.
            Bulan otomatis dideteksi dari periode — kalau gagal, tambah kolom
            <code> bulan</code> (YYYY-MM) di CSV.
          </p>
          {tarunaQ.memuat && !tarunaQ.data ? (
            <LoadingSpinner label="Memuat daftar Taruna dulu (perlu untuk cocokkan NIT)…" />
          ) : (
            <input type="file" accept=".csv,text/csv" onChange={(e) => void pilihFile(e)}
              className="min-h-tap rounded-xl border border-gray-300 px-3 py-2.5 text-sm" />
          )}

          {baris.length > 0 && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-700">{jmlValid} baris valid</span>
                <span className="text-red-600">{jmlError} baris bermasalah</span>
              </div>
              <div className="max-h-96 overflow-y-auto overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="py-1 pr-2">NIT</th><th className="py-1 pr-2">Nama</th>
                      <th className="py-1 pr-2">Kegiatan</th><th className="py-1 pr-2">Bulan</th>
                      <th className="py-1 pr-2 text-right">Hari</th><th className="py-1 pr-2 text-right">Nominal</th>
                      <th className="py-1">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {baris.map((b, i) => (
                      <tr key={i} className={`border-b border-gray-100 ${b.valid ? '' : 'bg-red-50'}`}>
                        <td className="py-1 pr-2">{b.nit}</td>
                        <td className="py-1 pr-2">{b.nama || '-'}</td>
                        <td className="py-1 pr-2">{b.kegiatan}</td>
                        <td className="py-1 pr-2">{b.bulan || '-'}</td>
                        <td className="py-1 pr-2 text-right">{b.totalHari}</td>
                        <td className="py-1 pr-2 text-right">{b.valid ? formatRupiah(b.nominal) : '-'}</td>
                        <td className="py-1">
                          {b.valid ? <span className="text-green-700">OK</span> : <span className="text-red-600">{b.pesan}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button onClick={() => void impor()} disabled={proses || jmlValid === 0}>
                {proses ? 'Mengimpor…' : `Impor ${jmlValid} Baris`}
              </Button>
            </>
          )}
        </Card>
      )}

      <div className="mt-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-600">Riwayat</p>
      </div>
      <BulanPicker bulan={bulanFilter} onChange={setBulanFilter} />

      {listQ.memuat && !listQ.data && <LoadingSpinner label="Memuat…" />}
      {listQ.galat && !listQ.data && <ErrorMessage pesan={listQ.galat} onRetry={listQ.refresh} />}
      {listQ.data && (listQ.data.bantuan ?? []).length === 0 && <EmptyState pesan="Belum ada data bulan ini." />}

      {listQ.data && (listQ.data.bantuan ?? []).length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-1 pr-2">NIT</th><th className="py-1 pr-2">Kegiatan</th>
                <th className="py-1 pr-2">Ke</th><th className="py-1 pr-2 text-right">Hari</th>
                <th className="py-1 text-right">Nominal</th>
              </tr>
            </thead>
            <tbody>
              {(listQ.data.bantuan ?? []).map((b) => (
                <tr key={b.bantuan_id} className="border-b border-gray-100">
                  <td className="py-1 pr-2">{namaByNit.get(b.nit) ?? b.nit}</td>
                  <td className="py-1 pr-2">{b.kegiatan}</td>
                  <td className="py-1 pr-2">{b.pembayaran_ke}</td>
                  <td className="py-1 pr-2 text-right">{b.total_hari}</td>
                  <td className="py-1 text-right">{formatRupiah(b.nominal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td colSpan={4} className="pt-2">Total</td>
                <td className="pt-2 text-right">{formatRupiah(listQ.data.total)}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
    </div>
  );
}
