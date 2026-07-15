// /cetak/form-08 (Admin, PPK SAJA) — Usulan Pembayaran Luar Kampus
// (PKL/Magang/KPA/PTB). Menampilkan nomor rekening PENUH (TARUNA_REKENING via
// cetak.form08) — SENGAJA TIDAK memakai useListCache/Dexie seperti form-07,
// supaya data sensitif ini tidak pernah singgah di IndexedDB.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BulanPicker, bulanIni, labelBulan } from '../../components/bulan-picker';
import { BlokTtd2Kolom } from '../../components/cetak/blok-ttd';
import { KopSurat } from '../../components/cetak/kop-surat';
import { BarisCetak, SelCetak, TabelCetak } from '../../components/cetak/tabel-cetak';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ErrorMessage } from '../../components/ui/error-message';
import { Input } from '../../components/ui/input';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { api } from '../../lib/api';
import { useListCache } from '../../lib/use-list-cache';
import { formatRupiah } from '../tagihan/tipe';

interface BarisForm08 {
  nit: string; nama: string; kegiatan: string; periode: string; bank: string;
  no_rekening_lengkap: string; nama_pemilik: string; rekening_lengkap_ada: boolean;
  jml_hari: number; total_hari_impor: number; hari_cocok: boolean; nilai_per_hari: number; nominal: number;
}
interface Pejabat { nama: string; nip: string }
interface Form08Data {
  bulan: string; kegiatan: string; baris: BarisForm08[]; total_nominal: number;
  pejabat: { PPK: Pejabat; KPA: Pejabat };
}

/** Fetch langsung ke GAS — TIDAK ambilCache/simpanCache (tidak pernah masuk Dexie). */
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

export function HalamanCetakForm08() {
  const nav = useNavigate();
  const [bulan, setBulan] = useState(bulanIni());
  const [kegiatan, setKegiatan] = useState('');
  const { data, memuat, galat, refresh } = useTanpaCache<Form08Data>('cetak.form08', { bulan, kegiatan: kegiatan || undefined });

  // Daftar Prodi utk dropdown "Program Studi" — dari taruna.list (hanya kolom
  // prodi, bukan data rekening → boleh di-cache). Distinct + urut.
  const tarunaQ = useListCache<{ taruna: { prodi: string }[] }>('taruna.list', {});
  const daftarProdi = useMemo(
    () => Array.from(new Set((tarunaQ.data?.taruna ?? []).map((t) => t.prodi).filter(Boolean))).sort(),
    [tarunaQ.data],
  );

  // ── Identitas kegiatan diisi manual — belum dilacak sistem (state lokal, TIDAK dikirim ke server) ──
  const [lokasi, setLokasi] = useState('');
  const [noSuratTugas, setNoSuratTugas] = useState('');
  const [jangkaWaktu, setJangkaWaktu] = useState('');
  const [prodi, setProdi] = useState('');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <button className="text-sm text-primary" onClick={() => nav(-1)}>← Kembali</button>
        {data && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak</Button>}
      </div>
      <h1 className="text-xl font-bold text-primary-dark print:hidden">Form 08 — Usulan Pembayaran Luar Kampus</h1>
      <p className="text-xs text-amber-700 print:hidden">
        ⚠️ Halaman ini menampilkan nomor rekening LENGKAP taruna — akses ADMIN/PPK saja,
        setiap dibuka tercatat di Log Audit, dan TIDAK disimpan ke penyimpanan lokal perangkat.
      </p>

      <div className="flex flex-col gap-2 print:hidden">
        <BulanPicker bulan={bulan} onChange={setBulan} />
        <Input label="Kegiatan (opsional, mis. PKL2/PKL3/PTB/KPA)" value={kegiatan} onChange={(e) => setKegiatan(e.target.value)} />
      </div>

      {memuat && !data && <LoadingSpinner label="Memuat data…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}

      {data && (
        <div className="flex flex-col gap-4">
          <KopSurat />
          <div className="text-center">
            <h2 className="text-base font-bold">USULAN PEMBAYARAN BANTUAN BIAYA MAKAN LUAR KAMPUS</h2>
            <p className="text-sm">Bulan {labelBulan(data.bulan)}{data.kegiatan ? ` — ${data.kegiatan}` : ''}</p>
          </div>

          <Card className="flex flex-col gap-2 print:border-0 print:p-0 print:shadow-none">
            <p className="text-sm font-semibold text-gray-600 print:text-black">Identitas Kegiatan (diisi manual)</p>
            <Input label="Jenis Kegiatan / Lokasi Penempatan" value={lokasi} onChange={(e) => setLokasi(e.target.value)} />
            <Input label="Nomor Surat Tugas Direktur" value={noSuratTugas} onChange={(e) => setNoSuratTugas(e.target.value)} />
            <Input label="Jangka Waktu Kegiatan" value={jangkaWaktu} onChange={(e) => setJangkaWaktu(e.target.value)} placeholder="mis. 9 s/d 31 Maret 2026" />
            <div className="w-full">
              <label className="mb-1 block text-sm font-medium text-gray-700">Program Studi</label>
              <select value={prodi} onChange={(e) => setProdi(e.target.value)}
                className="min-h-tap w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-light">
                <option value="">— pilih program studi —</option>
                {daftarProdi.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </Card>

          <Card className="overflow-x-auto print:border-0 print:p-0 print:shadow-none">
            <TabelCetak headers={['No', 'NIT', 'Nama', 'No. Rekening', 'Jml Hari', 'Tarif/Hari', 'Jumlah']}>
              {data.baris.map((b, i) => (
                <BarisCetak key={b.nit}>
                  <SelCetak>{i + 1}</SelCetak>
                  <SelCetak>{b.nit}</SelCetak>
                  <SelCetak>{b.nama}</SelCetak>
                  <SelCetak>{b.rekening_lengkap_ada ? `${b.bank} ${b.no_rekening_lengkap}` : 'Belum diisi Admin'}</SelCetak>
                  <SelCetak className="text-right">{b.jml_hari}</SelCetak>
                  <SelCetak className="text-right">{formatRupiah(b.nilai_per_hari)}</SelCetak>
                  <SelCetak className="text-right">{formatRupiah(b.nominal)}</SelCetak>
                </BarisCetak>
              ))}
            </TabelCetak>
            <div className="mt-2 flex justify-between text-sm font-bold">
              <span>JUMLAH TOTAL</span>
              <span>{formatRupiah(data.total_nominal)}</span>
            </div>
            <p className="mt-2 text-xs text-gray-400 print:text-black">
              Jml Hari dihitung dari catatan Status Harian kegiatan luar kampus (PKL I/II/III, KPA,
              Magang, PTB, atau Kegiatan Luar Kampus lainnya) bulan berjalan — sumber kebenaran hari
              kegiatan (dikonfirmasi Firdaus), bukan angka hasil impor CSV.
            </p>
            {data.baris.some((b) => !b.hari_cocok) && (
              <p className="mt-1 text-xs text-red-600 print:hidden">
                ⚠️ Ada selisih antara Jml Hari (Status Harian) dan data hasil impor CSV — periksa ulang sebelum diajukan.
              </p>
            )}
            {data.baris.some((b) => !b.rekening_lengkap_ada) && (
              <p className="mt-1 text-xs text-red-600 print:hidden">
                ⚠️ Ada taruna yang rekening lengkapnya belum diisi Admin — lengkapi dulu di halaman Data Taruna.
              </p>
            )}
          </Card>

          <BlokTtd2Kolom
            kiri={{ label: 'Mengusulkan,', jabatan: 'Ketua Program Studi' }}
            kanan={{ label: 'Memverifikasi,', jabatan: 'Pejabat Pembuat Komitmen (PPK)', nama: data.pejabat.PPK.nama, nip: data.pejabat.PPK.nip }}
          />
        </div>
      )}
    </div>
  );
}
