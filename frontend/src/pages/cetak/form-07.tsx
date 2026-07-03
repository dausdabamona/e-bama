// /cetak/form-07/:bulan (Admin, PPK SAJA) — Usulan Penahanan & Pendebetan
// Rekening ke Bank. Menampilkan nomor rekening PENUH (TARUNA_REKENING via
// cetak.form07 — lihat 21_cetak.gs/22_rekening.gs), jadi halaman ini SENGAJA
// TIDAK memakai useListCache/Dexie seperti daftar biasa — data sensitif ini
// tidak boleh singgah di IndexedDB. Dipakai hook lokal useTanpaCache di bawah
// yang cuma memanggil api() langsung, tanpa ambilCache/simpanCache.
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

interface BarisForm07 {
  nit: string; nama: string; bank: string; no_rekening_lengkap: string;
  nama_pemilik: string; nominal: number; rekening_lengkap_ada: boolean;
}
interface PembayaranRingkas {
  bayar_id: string; nilai_total: number; no_spm: string; tgl_spm: string; no_sp2d: string; tgl_sp2d: string; status: string;
}
interface Pejabat { nama: string; nip: string }
interface Form07Data {
  bulan: string; pembayaran: PembayaranRingkas; baris: BarisForm07[]; total_nominal: number;
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

export function HalamanCetakForm07() {
  const nav = useNavigate();
  const { bulan: bulanParam } = useParams<{ bulan?: string }>();
  const [bulan, setBulan] = useState(bulanParam || bulanIni());
  const { data, memuat, galat, refresh } = useTanpaCache<Form07Data>('cetak.form07', { bulan });

  // ── Nomor surat diisi manual (state lokal, TIDAK dikirim ke server) ──
  const [noSurat, setNoSurat] = useState('');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <button className="text-sm text-primary" onClick={() => nav(-1)}>← Kembali</button>
        {data && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak</Button>}
      </div>
      <h1 className="text-xl font-bold text-primary-dark print:hidden">Form 07 — Usulan Penahanan &amp; Pendebetan Bank</h1>
      <p className="text-xs text-amber-700 print:hidden">
        ⚠️ Halaman ini menampilkan nomor rekening LENGKAP taruna — akses ADMIN/PPK saja,
        setiap dibuka tercatat di Log Audit, dan TIDAK disimpan ke penyimpanan lokal perangkat.
      </p>

      {!bulanParam && (
        <div className="print:hidden"><BulanPicker bulan={bulan} onChange={setBulan} /></div>
      )}

      {memuat && !data && <LoadingSpinner label="Memuat data…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}

      {data && (
        <div className="flex flex-col gap-4">
          <KopSurat />
          <div className="text-right text-xs print:block">
            <label className="mb-1 block font-medium text-gray-700 print:hidden">Nomor Surat</label>
            <input value={noSurat} onChange={(e) => setNoSurat(e.target.value)}
              placeholder="…/SENAT-TARUNA.POLTEK.KP.SRG/…/20…"
              className="w-full rounded border border-gray-300 px-2 py-1 text-right text-xs print:border-0" />
          </div>
          <div className="text-center">
            <h2 className="text-base font-bold">USULAN PENAHANAN DAN PENDEBETAN REKENING KE BANK</h2>
            <p className="text-sm">Bulan {labelBulan(data.bulan)}</p>
          </div>

          <Card className="print:border-0 print:p-0 print:shadow-none">
            <p className="text-sm">
              Sehubungan dengan pelaksanaan bantuan biaya makan taruna Politeknik Kelautan dan
              Perikanan Sorong bulan {labelBulan(data.bulan)}, dengan ini Ketua Senat Taruna
              mengajukan usulan penahanan dan pendebetan otomatis rekening taruna penerima
              bantuan (daftar terlampir) sejumlah <strong>{formatRupiah(data.total_nominal)}</strong>,
              untuk selanjutnya diteruskan sebagai pembayaran ke rekening Senat Taruna dan
              disalurkan kepada penyedia jasa boga sesuai kontrak (SOP PR/PKU/KU-001/2025).
            </p>
            <div className="mt-2 flex flex-col gap-1 text-xs">
              <div className="flex justify-between"><span>No. SPM</span><span>{data.pembayaran.no_spm || '-'}</span></div>
              <div className="flex justify-between"><span>No. SP2D</span><span>{data.pembayaran.no_sp2d || '-'}</span></div>
              <div className="flex justify-between"><span>Tanggal SP2D</span><span>{data.pembayaran.tgl_sp2d || '-'}</span></div>
            </div>
          </Card>

          <Card className="overflow-x-auto print:border-0 print:p-0 print:shadow-none">
            <p className="mb-2 text-sm font-semibold text-gray-600 print:text-black">Lampiran: Daftar Taruna Penerima</p>
            <TabelCetak headers={['No', 'NIT', 'Nama', 'Bank', 'No. Rekening', 'Jumlah']}>
              {data.baris.map((b, i) => (
                <BarisCetak key={b.nit}>
                  <SelCetak>{i + 1}</SelCetak>
                  <SelCetak>{b.nit}</SelCetak>
                  <SelCetak>{b.nama}</SelCetak>
                  <SelCetak>{b.rekening_lengkap_ada ? b.bank : '—'}</SelCetak>
                  <SelCetak>{b.rekening_lengkap_ada ? b.no_rekening_lengkap : 'Belum diisi Admin'}</SelCetak>
                  <SelCetak className="text-right">{formatRupiah(b.nominal)}</SelCetak>
                </BarisCetak>
              ))}
            </TabelCetak>
            <div className="mt-2 flex justify-between text-sm font-bold">
              <span>TOTAL</span>
              <span>{formatRupiah(data.total_nominal)}</span>
            </div>
            {data.baris.some((b) => !b.rekening_lengkap_ada) && (
              <p className="mt-2 text-xs text-red-600 print:hidden">
                ⚠️ Ada taruna yang rekening lengkapnya belum diisi Admin — lengkapi dulu di
                halaman Data Taruna sebelum surat ini diajukan ke bank.
              </p>
            )}
          </Card>

          <BlokTtd2Kolom
            kiri={{ label: 'Mengajukan,', jabatan: 'Ketua Senat Taruna' }}
            kanan={{ label: 'Mengetahui,', jabatan: 'Pejabat Pembuat Komitmen (PPK)', nama: data.pejabat.PPK.nama, nip: data.pejabat.PPK.nip }}
          />
        </div>
      )}
    </div>
  );
}
