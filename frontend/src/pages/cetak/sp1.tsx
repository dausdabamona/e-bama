// /cetak/sp1 (PPK, Staf PPK, Admin) — CETAK MASSAL Surat Peringatan ke-1 (SP-1).
// Merender setiap surat SP-1 taruna yang masih di level SP-1 (memakai NOMOR
// SURAT RESMI yang sudah terbit di SURAT_PERINGATAN), sekali klik Cetak. Filter
// layar default "belum setor ke Senat". Data SP tidak memuat rekening taruna
// (hanya nominal + rekening Senat), jadi boleh di-cache seperti daftar biasa.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { labelBulan } from '../../components/bulan-picker';
import { KopSurat } from '../../components/cetak/kop-surat';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useListCache } from '../../lib/use-list-cache';
import { terbilangRupiah } from '../../lib/terbilang';
import { formatRupiah } from '../tagihan/tipe';

interface BarisSp1 {
  nit: string; nama: string; prodi: string; tingkat: string; bulan: string; nominal: number;
  no_surat: string; tgl_terbit: string; tenggat: string; sudah_setor: boolean;
}
interface Sp1Data {
  bulan_filter: string; rek_senat: string; penandatangan: { nama: string; nip: string }; daftar: BarisSp1[];
}

const BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
/** '2026-07-08' → '8 Juli 2026'. */
function tglIndo(s: string): string {
  const p = (s || '').split('-');
  if (p.length !== 3) return s || '……';
  return `${Number(p[2])} ${BULAN_ID[Number(p[1]) - 1]} ${p[0]}`;
}

/** Satu surat SP-1 utuh untuk satu taruna. */
function SuratSp1({ b, rekSenat, pejabat, pisahHalaman }: {
  b: BarisSp1; rekSenat: string; pejabat: Sp1Data['penandatangan']; pisahHalaman: boolean;
}) {
  return (
    <div className={`${pisahHalaman ? 'break-before-page ' : ''}flex flex-col gap-2`}>
      <KopSurat />
      <div className="text-center">
        <h2 className="text-sm font-bold underline">SURAT PERINGATAN PERTAMA (SP-1)</h2>
        <p className="text-xs">Nomor: {b.no_surat || 'B. ______ /PKPS/SP1/…/2026'}</p>
      </div>
      <p className="text-right text-xs">Sorong, {tglIndo(b.tgl_terbit)}</p>
      <div className="text-xs">
        <p>Kepada Yth.</p>
        <p className="font-semibold">{b.nama || '(nama taruna)'}</p>
        <p>NIT {b.nit} — {b.prodi} Tingkat {b.tingkat}</p>
        <p>di tempat</p>
      </div>
      <p className="text-xs leading-relaxed">
        Berdasarkan hasil pemantauan pembayaran Bantuan Uang Makan (BAMA) bulan{' '}
        <strong>{labelBulan(b.bulan)}</strong>, tercatat kewajiban Saudara yang belum terselesaikan
        (gagal auto-debet) sebesar <strong>{formatRupiah(b.nominal)}</strong>{' '}
        (<em>{terbilangRupiah(b.nominal)}</em>). Sehubungan dengan hal tersebut, Saudara diminta
        segera menyetorkan dana dimaksud ke <strong>rekening Senat Taruna {rekSenat}</strong>{' '}
        selambat-lambatnya tanggal <strong>{tglIndo(b.tenggat)}</strong>. Apabila hingga batas waktu
        tersebut kewajiban belum diselesaikan, akan diterbitkan Surat Peringatan berikutnya sesuai
        ketentuan.
      </p>
      <p className="text-xs">Demikian surat peringatan ini disampaikan untuk dilaksanakan sebagaimana mestinya.</p>
      <div className="mt-4 flex justify-end">
        <div className="text-center text-xs">
          <p>Pejabat Pembuat Komitmen,</p>
          <div className="h-16" />
          <p className="font-semibold underline">{pejabat.nama}</p>
          <p>NIP {pejabat.nip}</p>
        </div>
      </div>
    </div>
  );
}

export function HalamanCetakSp1() {
  const nav = useNavigate();
  const { data, memuat, galat, refresh } = useListCache<Sp1Data>('sp.cetak_massal', {});
  const [filterSetor, setFilterSetor] = useState<'belum' | 'semua'>('belum');
  const [filterBulan, setFilterBulan] = useState('');

  const daftarBulan = useMemo(
    () => Array.from(new Set((data?.daftar ?? []).map((b) => b.bulan))).sort((a, b) => b.localeCompare(a)),
    [data],
  );
  const tampil = useMemo(() => {
    return (data?.daftar ?? [])
      .filter((b) => (filterSetor === 'belum' ? !b.sudah_setor : true))
      .filter((b) => !filterBulan || b.bulan === filterBulan);
  }, [data, filterSetor, filterBulan]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <button className="text-sm text-primary" onClick={() => nav(-1)}>← Kembali</button>
        {data && tampil.length > 0 && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak {tampil.length} SP-1</Button>}
      </div>
      <h1 className="text-xl font-bold text-primary-dark print:hidden">Cetak Massal Surat Peringatan ke-1 (SP-1)</h1>
      <p className="text-xs text-gray-500 print:hidden">
        Memakai nomor surat SP-1 yang <strong>sudah terbit</strong> di sistem — bukan menerbitkan nomor
        baru. Hanya taruna yang masih di level SP-1 (belum naik SP-2/3). Tiap surat dicetak di halaman sendiri.
      </p>

      <div className="flex flex-wrap gap-4 print:hidden">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span>Tampilkan:</span>
          <select value={filterSetor} onChange={(e) => setFilterSetor(e.target.value as 'belum' | 'semua')}
            className="min-h-tap rounded-xl border border-gray-300 px-3 py-1.5 text-sm">
            <option value="belum">Belum setor ke Senat</option>
            <option value="semua">Semua SP-1</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span>Bulan:</span>
          <select value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)}
            className="min-h-tap rounded-xl border border-gray-300 px-3 py-1.5 text-sm">
            <option value="">Semua bulan</option>
            {daftarBulan.map((b) => <option key={b} value={b}>{labelBulan(b)}</option>)}
          </select>
        </label>
      </div>

      {memuat && !data && <LoadingSpinner label="Memuat data SP-1…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}
      {data && tampil.length === 0 && (
        <EmptyState pesan={filterSetor === 'belum'
          ? 'Tidak ada taruna SP-1 yang belum menyetor untuk filter ini.'
          : 'Tidak ada surat SP-1 untuk filter ini.'} />
      )}

      {data && tampil.length > 0 && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-gray-500 print:hidden">{tampil.length} surat SP-1 siap dicetak.</p>
          {tampil.map((b, i) => (
            <SuratSp1 key={`${b.nit}|${b.no_surat}`} b={b} rekSenat={data.rek_senat}
              pejabat={data.penandatangan} pisahHalaman={i > 0} />
          ))}
        </div>
      )}
    </div>
  );
}
