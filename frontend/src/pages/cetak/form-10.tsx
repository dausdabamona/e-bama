// /cetak/form-10/:bulan (Admin, PPK) — Rencana Pengajuan SPM ke KPPN, DIPECAH
// PER SUPLIER. Tiap suplier = satu lembar SPM; di dalamnya penerima
// dikelompokkan per prodi+tingkat+angkatan (angkatan = 2 digit depan NIT).
// Menampilkan nomor rekening PENUH taruna → TIDAK di-cache Dexie (pola Form-07),
// setiap pemuatan tercatat di Log Audit oleh backend.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BulanPicker, bulanIni, labelBulan } from '../../components/bulan-picker';
import { BlokTtd2Kolom } from '../../components/cetak/blok-ttd';
import { KopSurat } from '../../components/cetak/kop-surat';
import { BarisCetak, SelCetak, TabelCetak } from '../../components/cetak/tabel-cetak';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { api } from '../../lib/api';
import { formatRupiah } from '../tagihan/tipe';

interface Pejabat { nama: string; nip: string }
interface BarisF10 {
  nit: string; nama: string; bank: string; no_rekening_lengkap: string; nama_pemilik: string;
  hari_makan: number; nominal: number; rekening_lengkap_ada: boolean;
}
interface KelompokF10 {
  prodi: string; tingkat: string; angkatan: string; jml_taruna: number; total_nominal: number; baris: BarisF10[];
}
interface SuplierF10 {
  penyedia_id: string; penyedia_nama: string; jml_taruna: number; total_nominal: number;
  total_terbilang: string; kelompok: KelompokF10[];
}
interface Form10Data {
  bulan: string;
  pembayaran: { bayar_id: string; nilai_total: number; no_spm: string; tgl_spm: string; no_sp2d: string; tgl_sp2d: string; status: string };
  per_suplier: SuplierF10[];
  total_nominal: number;
  nominal_terbilang: string;
  pejabat: { PPK: Pejabat; KPA: Pejabat; DIREKTUR: Pejabat; WADIR3: Pejabat };
}

/** Fetch langsung ke GAS — tanpa cache Dexie (memuat nomor rekening lengkap taruna). */
function useTanpaCache<T>(action: string, payload?: unknown) {
  const [data, setData] = useState<T | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const payloadKey = JSON.stringify(payload ?? {});
  useEffect(() => {
    let aktif = true;
    setMemuat(true); setGalat('');
    (async () => {
      try {
        const hasil = await api<T>(action, payload);
        if (aktif) setData(hasil);
      } catch (e) {
        if (aktif) setGalat(e instanceof Error ? e.message : 'Gagal memuat.');
      } finally {
        if (aktif) setMemuat(false);
      }
    })();
    return () => { aktif = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, payloadKey, tick]);
  return { data, memuat, galat, refresh };
}

/** Satu lembar SPM per suplier (halaman cetak sendiri, break-before-page). */
function LembarSuplier({ suplier, urutan, pejabat, bulan }: {
  suplier: SuplierF10; urutan: number; pejabat: Form10Data['pejabat']; bulan: string;
}) {
  const belumAdaSuplier = !suplier.penyedia_id;
  return (
    <div className={urutan > 0 ? 'break-before-page pt-4' : ''}>
      <div className="text-center">
        <h2 className="text-base font-bold">
          RENCANA PENGAJUAN SPM — SUPLIER: {belumAdaSuplier ? '(BELUM DITENTUKAN)' : suplier.penyedia_nama.toUpperCase()}
        </h2>
        <p className="text-sm">Bulan {labelBulan(bulan)} — {suplier.jml_taruna} taruna</p>
      </div>

      {belumAdaSuplier && (
        <p className="mt-2 text-xs text-red-600 print:hidden">
          ⚠️ Taruna berikut belum dipasangkan ke suplier mana pun. Tetapkan suplier lewat modal
          🔒 Rekening di halaman Taruna sebelum SPM diajukan.
        </p>
      )}

      {suplier.kelompok.map((k) => (
        <Card key={`${k.prodi}|${k.tingkat}|${k.angkatan}`} className="mt-3 overflow-x-auto print:border-0 print:p-0 print:shadow-none">
          <p className="mb-2 text-sm font-semibold text-gray-600 print:text-black">
            Prodi {k.prodi || '-'} · Tingkat {k.tingkat || '-'} · Angkatan {k.angkatan || '-'} ({k.jml_taruna} taruna)
          </p>
          <TabelCetak headers={['No', 'NIT', 'Nama', 'Bank', 'No. Rekening', 'Hari', 'Nominal (Rp)']}>
            {k.baris.map((b, i) => (
              <BarisCetak key={b.nit}>
                <SelCetak className="text-right">{i + 1}</SelCetak>
                <SelCetak>{b.nit}</SelCetak>
                <SelCetak>{b.nama}</SelCetak>
                <SelCetak>{b.rekening_lengkap_ada ? b.bank : '-'}</SelCetak>
                <SelCetak>{b.rekening_lengkap_ada ? b.no_rekening_lengkap : '…… (belum ada rekening)'}</SelCetak>
                <SelCetak className="text-right">{b.hari_makan}</SelCetak>
                <SelCetak className="text-right">{formatRupiah(b.nominal)}</SelCetak>
              </BarisCetak>
            ))}
          </TabelCetak>
          <div className="mt-1 flex justify-between text-xs font-semibold">
            <span>Subtotal {k.prodi} {k.tingkat}/{k.angkatan}</span>
            <span>{formatRupiah(k.total_nominal)}</span>
          </div>
        </Card>
      ))}

      <div className="mt-3 flex justify-between text-sm font-bold">
        <span>TOTAL SPM SUPLIER {belumAdaSuplier ? '(BELUM DITENTUKAN)' : suplier.penyedia_nama.toUpperCase()}</span>
        <span>{formatRupiah(suplier.total_nominal)}</span>
      </div>
      <p className="mt-1 text-xs italic">Terbilang: <strong>{suplier.total_terbilang}</strong></p>

      <div className="mt-4">
        <BlokTtd2Kolom
          kiri={{ label: 'Mengajukan,', jabatan: 'Ketua Senat Taruna' }}
          kanan={{ label: 'Menyetujui,', jabatan: 'Pejabat Pembuat Komitmen (PPK)', nama: pejabat.PPK.nama, nip: pejabat.PPK.nip }}
        />
        <p className="mt-2 text-center text-xs font-semibold">Mengetahui,</p>
        <BlokTtd2Kolom
          kiri={{ label: 'Wakil Direktur III', jabatan: 'Bidang Kemahasiswaan', nama: pejabat.WADIR3.nama, nip: pejabat.WADIR3.nip }}
          kanan={{ label: 'Direktur', jabatan: 'Politeknik KP Sorong', nama: pejabat.DIREKTUR.nama, nip: pejabat.DIREKTUR.nip }}
        />
      </div>
    </div>
  );
}

export function HalamanCetakForm10() {
  const nav = useNavigate();
  const { bulan: bulanParam } = useParams<{ bulan?: string }>();
  const [bulan, setBulan] = useState(bulanParam || bulanIni());
  const { data, memuat, galat, refresh } = useTanpaCache<Form10Data>('cetak.form10', { bulan });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <button className="text-sm text-primary" onClick={() => nav(-1)}>← Kembali</button>
        {data && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak</Button>}
      </div>
      <h1 className="text-xl font-bold text-primary-dark print:hidden">Form 10 — Rencana Pengajuan SPM per Suplier</h1>

      {!bulanParam && (
        <div className="print:hidden"><BulanPicker bulan={bulan} onChange={setBulan} /></div>
      )}

      {memuat && !data && <LoadingSpinner label="Memuat data…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}

      {data && (
        <div className="flex flex-col gap-4">
          <KopSurat />
          <div className="text-center">
            <h2 className="text-base font-bold">RENCANA PENGAJUAN SPM KE KPPN</h2>
            <p className="text-sm">Bulan {labelBulan(data.bulan)} — dipecah per suplier katering</p>
          </div>

          <Card className="print:border-0 print:p-0 print:shadow-none">
            <p className="text-sm">
              Berikut rencana pengajuan Surat Perintah Membayar (SPM) bantuan biaya makan taruna
              bulan {labelBulan(data.bulan)}, <strong>dipecah per suplier</strong> (tiap suplier = satu
              SPM tersendiri) dan dikelompokkan per <strong>program studi, tingkat, dan angkatan</strong>.
              Pembayaran mekanisme LS langsung ke rekening masing-masing taruna. Total keseluruhan{' '}
              <strong>{formatRupiah(data.total_nominal)}</strong>.
            </p>
            <p className="mt-1 text-xs italic">Terbilang: <strong>{data.nominal_terbilang}</strong></p>
            <div className="mt-2 flex flex-col gap-1 text-xs">
              <div className="flex justify-between"><span>Jumlah suplier</span><span>{data.per_suplier.length}</span></div>
              <div className="flex justify-between"><span>No. SP2D (bila sudah terbit)</span><span>{data.pembayaran.no_sp2d || '-'}</span></div>
            </div>
          </Card>

          {data.per_suplier.length === 0 && (
            <Card className="text-sm text-gray-500">Belum ada data rekap untuk bulan ini.</Card>
          )}

          {data.per_suplier.map((s, i) => (
            <LembarSuplier key={s.penyedia_id || '__tanpa__'} suplier={s} urutan={i} pejabat={data.pejabat} bulan={data.bulan} />
          ))}
        </div>
      )}
    </div>
  );
}
