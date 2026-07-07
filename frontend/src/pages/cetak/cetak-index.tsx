// /cetak — daftar 8 Form Manual SOP (docs/format-dokumen.md). Halaman
// placeholder: tombol per form belum ditautkan ke halaman isi (menyusul
// tahap berikutnya) — cukup daftar + status "Segera hadir".
// Bagian "Pratinjau Komponen Cetak" membuktikan KopSurat/BlokTtd/TabelCetak
// bisa diimpor & dirender tanpa error (KopSurat hanya tampak saat print).
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { BlokTtd2Kolom, BlokTtd3Berjenjang } from '../../components/cetak/blok-ttd';
import { KopSurat } from '../../components/cetak/kop-surat';
import { BarisCetak, SelCetak, TabelCetak } from '../../components/cetak/tabel-cetak';

interface DaftarForm {
  nomor: string;
  nama: string;
  rute?: string;
}

const DAFTAR_FORM: DaftarForm[] = [
  { nomor: '01', nama: 'Rencana & Persetujuan Pemesanan Makan Harian (H-1)', rute: '/cetak/form-01' },
  { nomor: '02', nama: 'Daftar Hadir / Tanda Terima Makan', rute: '/cetak/form-02' },
  { nomor: '03', nama: 'Rekap Taruna Tidak Menerima Makan (bulanan)', rute: '/cetak/form-03' },
  { nomor: '04', nama: 'Rekapitulasi Bulanan Porsi Makan', rute: '/cetak/form-04' },
  { nomor: '05', nama: 'BA Rekonsiliasi 3 Titik', rute: '/cetak/form-05' },
  { nomor: '06', nama: 'Verifikasi & Rencana Pembayaran PPK', rute: '/cetak/form-06' },
  { nomor: '07', nama: 'Usulan Penahanan & Pendebetan Bank', rute: '/cetak/form-07' },
  { nomor: '08', nama: 'Usulan Pembayaran Luar Kampus (PKL/Magang/KPA)', rute: '/cetak/form-08' },
  { nomor: '09', nama: 'Pendebetan Rekening Senat → Penyedia (per bank)', rute: '/cetak/form-09' },
  { nomor: '10', nama: 'Rencana Pengajuan SPM per Suplier (prodi/tingkat/angkatan)', rute: '/cetak/form-10' }
];

// OPERATOR_SAKTI hanya berwenang Form-06/09 (lihat 01_router.gs OPERATOR_SAKTI_ACTIONS)
// — role lain TIDAK difilter di sini (tetap lihat semua 10, ditolak per-route bila
// tak berwenang), supaya tidak mengubah perilaku yang sudah ada untuk role lain.
const RUTE_OPERATOR_SAKTI = new Set(['/cetak/form-06', '/cetak/form-09']);

export function HalamanCetakIndex() {
  const { session } = useAuth();
  const daftar = session?.role === 'OPERATOR_SAKTI'
    ? DAFTAR_FORM.filter((f) => f.rute && RUTE_OPERATOR_SAKTI.has(f.rute))
    : DAFTAR_FORM;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-primary-dark">Cetak Form Manual SOP</h1>
      <Card className="text-sm text-gray-600">
        10 form resmi sesuai <code>docs/format-dokumen.md</code>. Halaman ini
        adalah daftar tautan ke tiap form + infrastruktur komponen cetak bersama
        (kop surat, blok tanda tangan, tabel).
      </Card>

      <div className="flex flex-col gap-2">
        {daftar.map((f) => (
          <Card key={f.nomor} className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Form {f.nomor}</p>
              <p className="text-sm text-gray-500">{f.nama}</p>
            </div>
            {f.rute
              ? <Link to={f.rute}><Button varian="garis">Buka</Button></Link>
              : <Badge status="DRAFT">Segera hadir</Badge>}
          </Card>
        ))}
      </div>

      <Card className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-gray-600">Pratinjau Komponen Cetak</p>
        <p className="text-xs text-gray-400">
          Kop surat hanya tampak saat print (coba Cetak/Print Preview di browser).
        </p>
        <KopSurat />
        <TabelCetak headers={['NIT', 'Nama', 'Hari', 'Nominal']}>
          <BarisCetak>
            <SelCetak>2024001</SelCetak>
            <SelCetak>Contoh Taruna</SelCetak>
            <SelCetak>26</SelCetak>
            <SelCetak>Rp1.560.000</SelCetak>
          </BarisCetak>
        </TabelCetak>
        <BlokTtd2Kolom
          kiri={{ label: 'Mengetahui/Menyetujui,', jabatan: 'Direktur Poltek KP Sorong,', nama: 'Contoh Nama', nip: '123456789' }}
          kanan={{ label: 'Yang Melaporkan,', jabatan: 'Pejabat Pembuat Komitmen (PPK),' }}
        />
        <BlokTtd3Berjenjang
          pihak1={{ label: 'Diajukan oleh,', jabatan: 'Senat' }}
          pihak2={{ label: 'Diverifikasi oleh,', jabatan: 'Pembina' }}
          pihak3={{ label: 'Diketahui oleh,', jabatan: 'PPK' }}
        />
      </Card>
    </div>
  );
}
