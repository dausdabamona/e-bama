// /laporan/resmi (PPK, KPA, Wadir3) — Laporan Bulanan Pemantauan & Evaluasi
// Bantuan Biaya Makan (format resmi acuan Itjen/KKP). Bagian yang datanya
// sudah dilacak e-BAMA (Dalam Kampus) terisi OTOMATIS; sisanya (DIPA/SK,
// rencana anggaran, Luar Kampus, Pengusulan, narasi) diisi MANUAL di sini,
// TIDAK tersimpan ke server — isi lagi tiap kali sebelum cetak.
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BulanPicker, bulanIni, labelBulan } from '../../components/bulan-picker';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useListCache } from '../../lib/use-list-cache';
import { formatRupiah } from '../tagihan/tipe';

interface Penerima {
  nit: string; nama: string; prodi: string; status: string; rek_mask: string;
  hari_makan: number; nominal: number; per_hari: number;
}
interface Ketidaksesuaian { tanggal: string; catatan: string; tindak_lanjut: string }
interface Pembayaran {
  bayar_id: string; status: string; nilai_total: number;
  no_spm: string; tgl_spm: string; no_sp2d: string; tgl_sp2d: string;
}
interface Pejabat { nama: string; nip: string }
interface LaporanResmi {
  bulan: string;
  jml_taruna_aktif: number;
  kontrak: { kontrak_id: string; harga_per_porsi: number; porsi_per_hari: number; harga_per_hari_efektif: number } | null;
  penerima: Penerima[];
  total_hari_makan: number;
  total_nominal: number;
  jml_hari_efektif: number;
  porsi_dipesan: number;
  porsi_terealisasi: number;
  ketidaksesuaian: Ketidaksesuaian[];
  pembayaran: Pembayaran | null;
  jml_gagal_transfer: number;
  pejabat: { PPK: Pejabat; KPA: Pejabat };
}

/** Input teks kecil bergaya sel tabel — untuk bagian yang diisi manual. */
function Isi({ value, onChange, placeholder, className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? '…'}
      className={`w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs print:border-0 print:border-b print:border-dotted ${className}`}
    />
  );
}

export function HalamanLaporanResmi() {
  const nav = useNavigate();
  const [bulan, setBulan] = useState(bulanIni());
  const { data, memuat, galat, refresh } = useListCache<LaporanResmi>('laporan.resmi', { bulan });

  // ── Field manual (TIDAK tersimpan — hanya state lokal untuk sesi cetak ini) ──
  const [tglSusun, setTglSusun] = useState('');
  const [ringkasan, setRingkasan] = useState('');
  const [dipaNo, setDipaNo] = useState('');
  const [paguTahun, setPaguTahun] = useState('');
  const [alokasiBulan, setAlokasiBulan] = useState('');
  const [sbm, setSbm] = useState('');
  const [skKaban, setSkKaban] = useState('');
  const [skKpa, setSkKpa] = useState('');
  const [skPpk, setSkPpk] = useState('');
  const [rencanaHariEfektif, setRencanaHariEfektif] = useState('');
  const [rencanaPenerima, setRencanaPenerima] = useState('');
  const [rencanaBiayaOrangHari, setRencanaBiayaOrangHari] = useState('');
  const [rencanaLuarKampus, setRencanaLuarKampus] = useState('');
  const [ajukanPermohonan, setAjukanPermohonan] = useState('');
  const [memenuhiSyarat, setMemenuhiSyarat] = useState('');
  const [tidakMemenuhiSyarat, setTidakMemenuhiSyarat] = useState('');
  const [diverifikasiLengkap, setDiverifikasiLengkap] = useState('');
  const [uraianGagalTransfer, setUraianGagalTransfer] = useState('');
  const [dampakGagalTransfer, setDampakGagalTransfer] = useState('');
  const [uraianKetidaksesuaian, setUraianKetidaksesuaian] = useState('');
  const [dampakKetidaksesuaian, setDampakKetidaksesuaian] = useState('');
  const [rekomendasi1, setRekomendasi1] = useState('');
  const [rekomendasi2, setRekomendasi2] = useState('');
  const [rekomendasi3, setRekomendasi3] = useState('');

  const kontrak = data?.kontrak ?? null;
  const rencanaBiaya = rencanaBiayaOrangHari
    ? Number(rencanaBiayaOrangHari)
    : (kontrak ? (kontrak.harga_per_hari_efektif ?? 0) : 0);
  const totalRencana = rencanaHariEfektif && rencanaPenerima
    ? Math.round(Number(rencanaHariEfektif) * Number(rencanaPenerima) * rencanaBiaya) : 0;

  const kontenRef = useRef<HTMLDivElement>(null);

  /**
   * Ekspor laporan yang sedang tampil ke file .doc yang dibuka MS Word.
   * Pendekatan HTML-as-.doc (tanpa library): klon DOM laporan, ganti <input>
   * dengan nilai ketikan, buang elemen hanya-layar, tampilkan kop cetak, lalu
   * bungkus HTML kompatibel Word (baris label/nilai flex → sel tabel di Word).
   */
  function unduhWord() {
    const el = kontenRef.current;
    if (!el) return;
    const klon = el.cloneNode(true) as HTMLElement;
    klon.querySelectorAll('input').forEach((inp) => {
      const span = document.createElement('span');
      span.textContent = (inp as HTMLInputElement).value || '……';
      inp.replaceWith(span);
    });
    klon.querySelectorAll('.print\\:hidden').forEach((n) => n.remove());   // hilangkan elemen hanya-layar
    klon.querySelectorAll('.hidden').forEach((n) => (n as HTMLElement).classList.remove('hidden')); // tampilkan kop cetak
    const html = `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Laporan Resmi ${labelBulan(bulan)}</title>
<style>
  body{font-family:'Times New Roman',serif;font-size:11pt;color:#000;margin:0}
  h1,h2{margin:4px 0;text-align:center}
  p{margin:2px 0}
  table{border-collapse:collapse;width:100%}
  td,th{border:1px solid #000;padding:3px 6px;font-size:10pt;vertical-align:top}
  /* Baris label/nilai (flex justify-between) → 2 kolom tabel supaya sejajar di Word */
  div[class*="justify-between"]{display:table;width:100%;border-bottom:1px solid #ccc}
  div[class*="justify-between"]>*{display:table-cell;padding:2px 0;vertical-align:top}
  div[class*="justify-between"]>*:last-child{text-align:right;font-weight:bold}
</style></head><body>${klon.innerHTML}</body></html>`;
    const blob = new Blob(['﻿' + html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan-Resmi-${bulan}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <button className="text-sm text-primary" onClick={() => nav('/laporan')}>← Kembali</button>
        {data && (
          <div className="flex gap-2">
            <Button varian="garis" onClick={unduhWord}>⬇️ Word</Button>
            <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak</Button>
          </div>
        )}
      </div>
      <h1 className="text-xl font-bold text-primary-dark print:hidden">Laporan Bulanan Resmi</h1>
      <div className="print:hidden"><BulanPicker bulan={bulan} onChange={setBulan} /></div>

      {memuat && !data && <LoadingSpinner label="Memuat data laporan…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}

      {data && (
        <div className="flex flex-col gap-4 text-sm">
          <div className="hidden text-center print:block">
            <p className="text-xs">KEMENTERIAN KELAUTAN DAN PERIKANAN</p>
            <p className="text-xs">BADAN PENYULUHAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA KP</p>
            <h1 className="mt-2 text-base font-bold">LAPORAN BULANAN</h1>
            <h2 className="text-sm font-bold">PEMANTAUAN DAN EVALUASI BANTUAN BIAYA MAKAN PESERTA DIDIK</h2>
            <p className="text-sm font-semibold">POLITEKNIK KELAUTAN DAN PERIKANAN SORONG</p>
          </div>

          {/* I. Informasi Umum */}
          <Card className="print:border-0 print:p-0 print:shadow-none">
            <p className="mb-2 font-bold text-primary-dark print:text-black">I. INFORMASI UMUM</p>
            <TabelInfo label="Nama Satuan Pendidikan" nilai="Politeknik Kelautan dan Perikanan Sorong" />
            <TabelInfo label="Alamat" nilai="Jl. Kapitan Pattimura, Tanjung Kasuari - Suprau, Kota Sorong, Papua Barat Daya 98411" />
            <TabelInfo label="Nama Pimpinan" nilai={data.pejabat.KPA.nama} />
            <TabelInfo label="NIP" nilai={data.pejabat.KPA.nip} />
            <TabelInfo label="Email" nilai="polteksorong@kkp.go.id" />
            <TabelInfo label="Periode Laporan" nilai={`Bulan ${labelBulan(data.bulan)}`} />
            <div className="flex items-center justify-between border-b border-gray-100 py-1 text-sm">
              <span className="text-gray-500 print:text-black">Tanggal Penyusunan Laporan</span>
              <span className="w-40 print:hidden"><Isi value={tglSusun} onChange={setTglSusun} placeholder="YYYY-MM-DD" /></span>
              <span className="hidden print:inline">{tglSusun || '…'}</span>
            </div>
          </Card>

          {/* II. Ringkasan Eksekutif */}
          <Card className="print:border-0 print:p-0 print:shadow-none">
            <p className="mb-2 font-bold text-primary-dark print:text-black">II. RINGKASAN EKSEKUTIF</p>
            <textarea rows={3} value={ringkasan} onChange={(e) => setRingkasan(e.target.value)}
              placeholder="Ringkasan singkat pelaksanaan bantuan biaya makan bulan ini — capaian, permasalahan, langkah perbaikan (maks. 1 paragraf)."
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs print:border-0" />
          </Card>

          {/* III. Proses Perencanaan */}
          <Card className="print:border-0 print:p-0 print:shadow-none">
            <p className="mb-2 font-bold text-primary-dark print:text-black">III. PROSES PERENCANAAN BANTUAN BIAYA</p>
            <p className="mb-1 text-xs font-semibold text-gray-500 print:text-black">A. Dasar Perencanaan (diisi manual)</p>
            <TabelManual label="DIPA Satuan Kerja Nomor" value={dipaNo} onChange={setDipaNo} />
            <TabelManual label="Pagu Anggaran Bantuan Biaya Makan Tahun Berjalan" value={paguTahun} onChange={setPaguTahun} />
            <TabelManual label="Alokasi Anggaran Bulan Ini" value={alokasiBulan} onChange={setAlokasiBulan} />
            <TabelManual label="Standar Biaya Masukan (SBM/SBK)" value={sbm} onChange={setSbm} />
            <TabelManual label="SK Kepala Badan tentang Penetapan Penerima" value={skKaban} onChange={setSkKaban} />
            <TabelManual label="SK KPA tentang Penetapan Nama Penerima" value={skKpa} onChange={setSkKpa} />
            <TabelManual label="SK PPK tentang Nomor Rekening & Nilai Dibayarkan" value={skPpk} onChange={setSkPpk} />

            <p className="mb-1 mt-3 text-xs font-semibold text-gray-500 print:text-black">B. Rencana Kebutuhan Bulanan</p>
            <TabelManual label="Jumlah Peserta Didik Penerima Bantuan (rencana)" value={rencanaPenerima}
              onChange={setRencanaPenerima} placeholder={String(data.jml_taruna_aktif)} keterangan={`Auto: ${data.jml_taruna_aktif} taruna AKTIF`} />
            <TabelManual label="Rencana Hari Efektif Pemberian Makan" value={rencanaHariEfektif} onChange={setRencanaHariEfektif} />
            <TabelManual label="Rencana Biaya per Orang per Hari (Rp)" value={rencanaBiayaOrangHari} onChange={setRencanaBiayaOrangHari}
              placeholder={kontrak ? String(kontrak.harga_per_hari_efektif ?? 0) : ''}
              keterangan={kontrak ? `Auto dari kontrak: ${formatRupiah(kontrak.harga_per_hari_efektif ?? 0)}/hari` : 'Belum ada kontrak aktif'} />
            <div className="flex justify-between border-b border-gray-100 py-1 text-xs">
              <span className="text-gray-500 print:text-black">Total Rencana Kebutuhan Bulanan</span>
              <span className="font-semibold">{totalRencana ? formatRupiah(totalRencana) : '…'}</span>
            </div>
            <TabelManual label="Rencana Penyaluran ke Luar Kampus (Rp)" value={rencanaLuarKampus} onChange={setRencanaLuarKampus} />
            <p className="mt-2 text-xs text-gray-400 print:hidden">
              Bagian "Kegiatan di Luar Kampus" (PKL/Magang) belum dilacak e-BAMA — lampirkan daftar terpisah bila ada.
            </p>
          </Card>

          {/* IV. Pengusulan */}
          <Card className="print:border-0 print:p-0 print:shadow-none">
            <p className="mb-2 font-bold text-primary-dark print:text-black">IV. PROSES PENGUSULAN BANTUAN BIAYA (diisi manual)</p>
            <TabelManual label="Jumlah Peserta Didik yang Mengajukan Permohonan" value={ajukanPermohonan} onChange={setAjukanPermohonan} />
            <TabelManual label="Jumlah yang Memenuhi Syarat" value={memenuhiSyarat} onChange={setMemenuhiSyarat} />
            <TabelManual label="Jumlah yang Tidak Memenuhi Syarat" value={tidakMemenuhiSyarat} onChange={setTidakMemenuhiSyarat} />
            <TabelManual label="Jumlah Usulan Diverifikasi & Dinyatakan Lengkap" value={diverifikasiLengkap} onChange={setDiverifikasiLengkap} />
          </Card>

          {/* V. Pelaksanaan */}
          <Card className="overflow-x-auto print:border-0 print:p-0 print:shadow-none">
            <p className="mb-2 font-bold text-primary-dark print:text-black">V. PROSES PELAKSANAAN BANTUAN BIAYA</p>
            <p className="mb-1 text-xs font-semibold text-gray-500 print:text-black">A. Data Penerima Bantuan Bulan Ini (otomatis)</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-300 text-left">
                  <th className="py-1 pr-2">NIT</th><th className="py-1 pr-2">Nama</th><th className="py-1 pr-2">Prodi</th>
                  <th className="py-1 pr-2">No. Rek</th><th className="py-1 pr-2 text-right">Jml Hari</th>
                  <th className="py-1 pr-2 text-right">Per Hari</th><th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.penerima.map((p) => (
                  <tr key={p.nit} className="border-b border-gray-100">
                    <td className="py-1 pr-2">{p.nit}</td><td className="py-1 pr-2">{p.nama}</td>
                    <td className="py-1 pr-2">{p.prodi}</td><td className="py-1 pr-2">{p.rek_mask}</td>
                    <td className="py-1 pr-2 text-right">{p.hari_makan}</td>
                    <td className="py-1 pr-2 text-right">{formatRupiah(p.per_hari)}</td>
                    <td className="py-1 text-right">{formatRupiah(p.nominal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <td colSpan={4} className="pt-1">Jumlah ({data.penerima.length} orang)</td>
                  <td className="pt-1 text-right">{data.total_hari_makan}</td>
                  <td className="pt-1"></td>
                  <td className="pt-1 text-right">{formatRupiah(data.total_nominal)}</td>
                </tr>
              </tfoot>
            </table>

            <p className="mb-1 mt-3 text-xs font-semibold text-gray-500 print:text-black">B.1 Realisasi Penyaluran Bulan Ini</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-300 text-left">
                  <th className="py-1 pr-2">Uraian</th><th className="py-1 pr-2 text-right">Dalam Kampus (auto)</th>
                  <th className="py-1 text-right">Luar Kampus (manual)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-1 pr-2">Jumlah Penerima</td>
                  <td className="py-1 pr-2 text-right">{data.penerima.length} Orang</td>
                  <td className="py-1 text-right">…</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-1 pr-2">Jumlah Hari Efektif</td>
                  <td className="py-1 pr-2 text-right">{data.jml_hari_efektif} Hari</td>
                  <td className="py-1 text-right">…</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-1 pr-2">Total Hari Penerimaan (Orang×Hari)</td>
                  <td className="py-1 pr-2 text-right">{data.total_hari_makan} OH</td>
                  <td className="py-1 text-right">…</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-1 pr-2">Standar Biaya per Hari</td>
                  <td className="py-1 pr-2 text-right">{kontrak ? formatRupiah(kontrak.harga_per_hari_efektif ?? 0) : '-'}</td>
                  <td className="py-1 text-right">…</td>
                </tr>
                <tr className="font-bold">
                  <td className="py-1 pr-2">Total Realisasi Penyaluran</td>
                  <td className="py-1 pr-2 text-right">{formatRupiah(data.total_nominal)}</td>
                  <td className="py-1 text-right">…</td>
                </tr>
              </tbody>
            </table>

            <p className="mb-1 mt-3 text-xs font-semibold text-gray-500 print:text-black">B.2 Rincian Penyaluran ke Dalam Kampus (otomatis)</p>
            {data.pembayaran ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-300 text-left">
                    <th className="py-1 pr-2">Tgl SP2D</th><th className="py-1 pr-2">No. SPM</th>
                    <th className="py-1 pr-2">No. SP2D</th><th className="py-1 text-right">Besaran Transfer</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1 pr-2">{data.pembayaran.tgl_sp2d || '-'}</td>
                    <td className="py-1 pr-2">{data.pembayaran.no_spm || '-'}</td>
                    <td className="py-1 pr-2">{data.pembayaran.no_sp2d || '-'}</td>
                    <td className="py-1 text-right">{formatRupiah(data.pembayaran.nilai_total)}</td>
                  </tr>
                </tbody>
              </table>
            ) : <p className="text-xs text-gray-400">Belum ada pembayaran bulan ini.</p>}

            <p className="mb-1 mt-3 text-xs font-semibold text-gray-500 print:text-black">C.1 Penggunaan Bantuan di Dalam Kampus (otomatis)</p>
            <TabelAuto label="Jumlah taruna yang didebit" nilai={`${data.penerima.length} Orang`} />
            <TabelAuto label="Jumlah hari pendebetan" nilai={`${data.jml_hari_efektif} Hari`} />
            <TabelAuto label="Besaran pendebetan per hari" nilai={kontrak ? formatRupiah(kontrak.harga_per_hari_efektif ?? 0) : '-'} />
            <TabelAuto label="Total dana masuk ke rekening Senat Taruna" nilai={formatRupiah(data.total_nominal)} />
            <TabelAuto label="Jumlah porsi makan yang dipesan" nilai={`${data.porsi_dipesan} Porsi`} />
            <TabelAuto label="Jumlah porsi makan yang terealisasi" nilai={`${data.porsi_terealisasi} Porsi`} />
            <TabelAuto label="Total pembayaran ke penyedia" nilai={data.pembayaran ? formatRupiah(data.pembayaran.nilai_total) : '-'} />
          </Card>

          {/* VI. Permasalahan */}
          <Card className="print:border-0 print:p-0 print:shadow-none">
            <p className="mb-2 font-bold text-primary-dark print:text-black">VI. PERMASALAHAN DAN TINDAK LANJUT</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-300 text-left">
                  <th className="py-1 pr-2">Jenis</th><th className="py-1 pr-2">Uraian (manual)</th>
                  <th className="py-1 pr-2">Dampak (manual)</th><th className="py-1 text-right">Frekuensi</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-1 pr-2">Gagal Transfer</td>
                  <td className="py-1 pr-2"><Isi value={uraianGagalTransfer} onChange={setUraianGagalTransfer} /></td>
                  <td className="py-1 pr-2"><Isi value={dampakGagalTransfer} onChange={setDampakGagalTransfer} /></td>
                  <td className="py-1 text-right">{data.jml_gagal_transfer} Kali</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-1 pr-2">Ketidaksesuaian Kontrak</td>
                  <td className="py-1 pr-2"><Isi value={uraianKetidaksesuaian} onChange={setUraianKetidaksesuaian} /></td>
                  <td className="py-1 pr-2"><Isi value={dampakKetidaksesuaian} onChange={setDampakKetidaksesuaian} /></td>
                  <td className="py-1 text-right">{data.ketidaksesuaian.length} Kali</td>
                </tr>
              </tbody>
            </table>
            {data.ketidaksesuaian.length > 0 && (
              <div className="mt-2 text-xs text-gray-500">
                {data.ketidaksesuaian.map((k, i) => (
                  <p key={i}>{k.tanggal}: {k.catatan} {k.tindak_lanjut ? `→ ${k.tindak_lanjut}` : ''}</p>
                ))}
              </div>
            )}
          </Card>

          {/* VII. Evaluasi */}
          <Card className="print:border-0 print:p-0 print:shadow-none">
            <p className="mb-2 font-bold text-primary-dark print:text-black">VII. EVALUASI</p>
            <p className="mb-1 text-xs font-semibold text-gray-500 print:text-black">A. Realisasi Keuangan</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-300 text-left">
                  <th className="py-1 pr-2">Uraian</th><th className="py-1 pr-2 text-right">Rencana</th>
                  <th className="py-1 pr-2 text-right">Realisasi</th><th className="py-1 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1 pr-2">Bantuan Dalam Kampus</td>
                  <td className="py-1 pr-2 text-right">{totalRencana ? formatRupiah(totalRencana) : '…'}</td>
                  <td className="py-1 pr-2 text-right">{formatRupiah(data.total_nominal)}</td>
                  <td className="py-1 text-right">{totalRencana ? `${Math.round((data.total_nominal / totalRencana) * 100)}%` : '-'}</td>
                </tr>
              </tbody>
            </table>
            <p className="mb-1 mt-3 text-xs font-semibold text-gray-500 print:text-black">B. Realisasi Fisik (Jumlah Penerima)</p>
            <TabelAuto label="Realisasi Penerima Dalam Kampus" nilai={`${data.penerima.length} Orang`}
              keterangan={rencanaPenerima ? `Rencana ${rencanaPenerima} Orang` : undefined} />
            <p className="mt-2 text-xs text-gray-400 print:hidden">
              C. Pengendalian Risiko — lampirkan matriks Manajemen Risiko terpisah bila ada.
            </p>
          </Card>

          {/* VIII. Rekomendasi */}
          <Card className="print:border-0 print:p-0 print:shadow-none">
            <p className="mb-2 font-bold text-primary-dark print:text-black">VIII. REKOMENDASI (diisi manual)</p>
            <div className="flex flex-col gap-1">
              <Isi value={rekomendasi1} onChange={setRekomendasi1} placeholder="1. …" />
              <Isi value={rekomendasi2} onChange={setRekomendasi2} placeholder="2. …" />
              <Isi value={rekomendasi3} onChange={setRekomendasi3} placeholder="3. …" />
            </div>
          </Card>

          {/* IX. Penutup */}
          <Card className="print:border-0 print:p-0 print:shadow-none">
            <p className="mb-2 font-bold text-primary-dark print:text-black">IX. PENUTUP</p>
            <p className="text-xs text-gray-600 print:text-black">
              Demikian laporan bulanan ini dibuat dengan sebenarnya sebagai bentuk pertanggungjawaban
              pelaksanaan bantuan biaya makan peserta didik di lingkungan Politeknik Kelautan dan
              Perikanan Sorong.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 text-center text-xs">
              <div>
                <p>Mengetahui/Menyetujui,</p>
                <p>Direktur Poltek KP Sorong,</p>
                <div className="mt-12 font-semibold">{data.pejabat.KPA.nama}</div>
                <p>NIP {data.pejabat.KPA.nip}</p>
              </div>
              <div>
                <p>Yang Melaporkan,</p>
                <p>Pejabat Pembuat Komitmen (PPK),</p>
                <div className="mt-12 font-semibold">{data.pejabat.PPK.nama}</div>
                <p>NIP {data.pejabat.PPK.nip}</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function TabelInfo({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="flex justify-between border-b border-gray-100 py-1 text-sm">
      <span className="text-gray-500 print:text-black">{label}</span>
      <span className="font-medium">{nilai}</span>
    </div>
  );
}

function TabelAuto({ label, nilai, keterangan }: { label: string; nilai: string; keterangan?: string }) {
  return (
    <div className="flex justify-between border-b border-gray-100 py-1 text-xs">
      <span className="text-gray-500 print:text-black">{label}{keterangan ? <span className="ml-1 text-gray-400 print:hidden">({keterangan})</span> : null}</span>
      <span className="font-semibold">{nilai}</span>
    </div>
  );
}

function TabelManual({ label, value, onChange, placeholder, keterangan }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; keterangan?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-gray-100 py-1 text-xs">
      <span className="text-gray-500 print:text-black">
        {label}{keterangan ? <span className="ml-1 text-gray-400 print:hidden">({keterangan})</span> : null}
      </span>
      <span className="w-40 shrink-0">
        <Isi value={value} onChange={onChange} placeholder={placeholder} />
      </span>
    </div>
  );
}
