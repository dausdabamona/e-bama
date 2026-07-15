// /cetak/surat-pendebetan-bank/:bulan — Surat Pendebetan ke BANK (dokumen ke-1
// pemisahan tagih-ulang). HANYA nominal TOTAL per bulan, TANPA nama taruna —
// bank cukup: debit rekening Senat → rekening penyedia sejumlah Rp X. Rincian
// per-taruna ada di /cetak/laporan-penyaluran/:bulan. Non-sensitif (debit antar
// rekening INSTANSI), boleh di-cache.
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { labelBulan } from '../../components/bulan-picker';
import { BlokTtd2Kolom, BlokTtdTengah } from '../../components/cetak/blok-ttd';
import { KopSurat } from '../../components/cetak/kop-surat';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useListCache } from '../../lib/use-list-cache';
import { terbilangRupiah } from '../../lib/terbilang';
import { formatRupiah } from '../tagihan/tipe';

interface Pejabat { nama: string; nip: string }
interface RekBank { BNI?: string; BSI?: string }
interface BankData {
  bulan: string; total_nominal: number; jml_taruna: number;
  rekening_senat?: RekBank; rekening_senat_nama?: RekBank;
  rekening_penyedia?: RekBank; rekening_penyedia_nama?: RekBank;
  pejabat: { PPK: Pejabat; KPA: Pejabat; DIREKTUR: Pejabat; WADIR3: Pejabat };
}

export function HalamanCetakSuratPendebetanBank() {
  const nav = useNavigate();
  const { bulan = '' } = useParams();
  const { data, memuat, galat, refresh } = useListCache<BankData>('cetak.surat_pendebetan_bank', { bulan });
  const [bank, setBank] = useState<'BNI' | 'BSI'>('BNI');
  const [noSurat, setNoSurat] = useState('');

  const rekSenat = bank === 'BNI' ? data?.rekening_senat?.BNI : data?.rekening_senat?.BSI;
  const rekSenatNama = bank === 'BNI' ? data?.rekening_senat_nama?.BNI : data?.rekening_senat_nama?.BSI;
  const rekPenyedia = bank === 'BNI' ? data?.rekening_penyedia?.BNI : data?.rekening_penyedia?.BSI;
  const rekPenyediaNama = bank === 'BNI' ? data?.rekening_penyedia_nama?.BNI : data?.rekening_penyedia_nama?.BSI;
  const total = data?.total_nominal ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <button className="text-sm text-primary" onClick={() => nav(-1)}>← Kembali</button>
        {data && total > 0 && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak Surat</Button>}
      </div>
      <h1 className="text-xl font-bold text-primary-dark print:hidden">Surat Pendebetan ke Bank — {labelBulan(bulan)}</h1>
      <p className="text-xs text-gray-500 print:hidden">
        Instruksi ke bank: debit rekening Senat → rekening penyedia sejumlah total. <strong>Tanpa nama taruna</strong>{' '}
        (rincian ada di <em>Laporan Penyaluran ke Penyedia</em>).
      </p>

      <div className="flex flex-wrap gap-3 print:hidden">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span>Bank:</span>
          <select value={bank} onChange={(e) => setBank(e.target.value as 'BNI' | 'BSI')}
            className="min-h-tap rounded-xl border border-gray-300 px-3 py-1.5 text-sm">
            <option value="BNI">BNI</option><option value="BSI">BSI</option>
          </select>
        </label>
        <label className="flex flex-1 items-center gap-2 text-sm text-gray-700">
          <span className="w-24">No. Surat:</span>
          <input value={noSurat} onChange={(e) => setNoSurat(e.target.value)}
            placeholder="B. …/SENAT-TARUNA.POLTEK.KP.SRG/…/2026"
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm" />
        </label>
      </div>

      {memuat && !data && <LoadingSpinner label="Memuat data…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}
      {data && total === 0 && (
        <EmptyState pesan="Tidak ada tagihan LUNAS yang belum diteruskan untuk bulan ini." />
      )}

      {data && total > 0 && (
        <div className="flex flex-col gap-2">
          {(!rekSenat || !rekPenyedia) && (
            <p className="text-xs text-red-600 print:hidden">
              ⚠️ Rekening Senat/Penyedia {bank} belum diisi — Admin mengisinya lewat <code>setRekeningInstansi()</code> di editor Apps Script.
            </p>
          )}
          <KopSurat />
          <div className="text-center">
            <h2 className="text-sm font-bold">PERMOHONAN PENDEBETAN REKENING SENAT KE REKENING PENYEDIA</h2>
            <p className="text-xs">(Dana Tagih-Ulang Gagal Debet — Bulan {labelBulan(bulan)})</p>
            <p className="text-xs">Bank {bank} · Nomor: {noSurat || 'B. ______ /SENAT-TARUNA.POLTEK.KP.SRG/…/2026'}</p>
          </div>
          <p className="text-xs">Kepada Yth. Pimpinan Bank {bank} — di tempat.</p>
          <p className="text-xs leading-relaxed">
            Menindaklanjuti pengembalian dana Bantuan Uang Makan bulan <strong>{labelBulan(bulan)}</strong> yang gagal
            auto-debet dan telah disetorkan kembali oleh <strong>{data.jml_taruna} taruna</strong> ke rekening Senat
            Taruna, dengan ini kami mengajukan permohonan kepada Bank {bank} untuk <strong>mendebet Rekening Senat
            Taruna {bank}</strong> ({rekSenat || '…… belum diisi Admin'}{rekSenatNama ? ` a.n. ${rekSenatNama}` : ''})
            sejumlah <strong>{formatRupiah(total)}</strong> dan <strong>meneruskannya ke rekening penyedia jasa boga{' '}
            {bank}</strong> ({rekPenyedia || '…… belum diisi Admin'}{rekPenyediaNama ? ` a.n. ${rekPenyediaNama}` : ''}).
          </p>
          <p className="text-xs italic">Terbilang: <strong>{terbilangRupiah(total)}</strong></p>
          <p className="text-xs leading-relaxed">
            Rincian nama penerima terlampir dalam <strong>Laporan Penyaluran Dana Uang Makan</strong> bulan{' '}
            {labelBulan(bulan)}. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.
          </p>
          <div className="mt-6">
            <BlokTtd2Kolom
              kiri={{ label: 'Mengajukan,', jabatan: 'Ketua Senat Taruna' }}
              kanan={{ label: 'Menyetujui,', jabatan: 'Pejabat Pembuat Komitmen (PPK)', nama: data.pejabat.PPK.nama, nip: data.pejabat.PPK.nip }}
            />
            <BlokTtdTengah pihak={{ label: 'Mengetahui, Direktur', jabatan: 'Politeknik KP Sorong', nama: data.pejabat.DIREKTUR.nama, nip: data.pejabat.DIREKTUR.nip }} />
          </div>
        </div>
      )}
    </div>
  );
}
