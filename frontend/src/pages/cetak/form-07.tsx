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
  nit: string; nama: string; prodi: string; tingkat: string; bank: string; no_rekening_lengkap: string;
  nama_pemilik: string; nominal: number; hari_makan: number; rekening_lengkap_ada: boolean;
}

const URUT_TINGKAT: Record<string, number> = { I: 1, II: 2, III: 3, '1': 1, '2': 2, '3': 3 };
function urutBaris(a: BarisForm07, b: BarisForm07): number {
  return (URUT_TINGKAT[a.tingkat] ?? 9) - (URUT_TINGKAT[b.tingkat] ?? 9)
    || a.prodi.localeCompare(b.prodi) || a.nama.localeCompare(b.nama);
}
/** Kelompokkan baris per bank (urut BSI dulu, lalu BNI, lalu lainnya). */
function kelompokBank(baris: BarisForm07[]): { bank: string; rows: BarisForm07[] }[] {
  const map = new Map<string, BarisForm07[]>();
  baris.forEach((b) => {
    const k = b.rekening_lengkap_ada ? b.bank : 'TANPA_REKENING';
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(b);
  });
  const urutBank = (k: string) => (k === 'BSI' ? 0 : k === 'BNI' ? 1 : k === 'TANPA_REKENING' ? 9 : 5);
  return Array.from(map.entries())
    .sort((x, y) => urutBank(x[0]) - urutBank(y[0]))
    .map(([bank, rows]) => ({ bank, rows: rows.slice().sort(urutBaris) }));
}

const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
function terbilang(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n < 12) return SATUAN[n];
  if (n < 20) return terbilang(n - 10) + ' belas';
  if (n < 100) return terbilang(Math.floor(n / 10)) + ' puluh' + (n % 10 ? ' ' + terbilang(n % 10) : '');
  if (n < 200) return 'seratus' + (n - 100 ? ' ' + terbilang(n - 100) : '');
  if (n < 1000) return terbilang(Math.floor(n / 100)) + ' ratus' + (n % 100 ? ' ' + terbilang(n % 100) : '');
  if (n < 2000) return 'seribu' + (n - 1000 ? ' ' + terbilang(n - 1000) : '');
  if (n < 1e6) return terbilang(Math.floor(n / 1000)) + ' ribu' + (n % 1000 ? ' ' + terbilang(n % 1000) : '');
  if (n < 1e9) return terbilang(Math.floor(n / 1e6)) + ' juta' + (n % 1e6 ? ' ' + terbilang(n % 1e6) : '');
  return terbilang(Math.floor(n / 1e9)) + ' miliar' + (n % 1e9 ? ' ' + terbilang(n % 1e9) : '');
}
function terbilangRupiah(n: number): string {
  const t = (terbilang(n).trim() || 'nol') + ' rupiah';
  return t.charAt(0).toUpperCase() + t.slice(1);
}
interface PembayaranRingkas {
  bayar_id: string; nilai_total: number; no_spm: string; tgl_spm: string; no_sp2d: string; tgl_sp2d: string; status: string;
}
interface Pejabat { nama: string; nip: string }
interface Form07Data {
  bulan: string; pembayaran: PembayaranRingkas; baris: BarisForm07[]; total_nominal: number;
  pejabat: { PPK: Pejabat; KPA: Pejabat; DIREKTUR: Pejabat; WADIR3: Pejabat };
  rekening_senat?: { BNI?: string; BSI?: string };
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

function labelTkProdi(b: BarisForm07): string {
  return `Tk. ${b.tingkat || '?'} / ${b.prodi || '?'}`;
}

/** Lampiran Permohonan Pembukaan Blokir & Pendebetan Massal untuk SATU bank (dengan kolom Tanda Tangan). */
function LampiranBlokirBank({ bank, rows, bulan, pejabat, rekSenat }: {
  bank: string; rows: BarisForm07[]; bulan: string; pejabat: Form07Data['pejabat']; rekSenat?: string;
}) {
  const total = rows.reduce((s, b) => s + b.nominal, 0);
  const totalHari = rows.reduce((s, b) => s + b.hari_makan, 0);
  const labelBank = bank === 'TANPA_REKENING' ? 'BELUM ADA REKENING' : bank;
  return (
    <div className="break-before-page flex flex-col gap-2">
      <KopSurat />
      <div className="text-center">
        <h2 className="text-sm font-bold">LAMPIRAN PERMOHONAN PEMBUKAAN BLOKIR DAN PENDEBETAN MASSAL REKENING</h2>
        <p className="text-xs">Bank {labelBank} · Bulan {labelBulan(bulan)} · Nomor: B. ______ /POLTEK.SRG/KU.110/…/20…</p>
      </div>
      {bank !== 'TANPA_REKENING' && (
        <p className="text-xs">
          Didebet ke <strong>Rekening Senat Taruna {bank}</strong>: {rekSenat || '……………………………… (belum diisi Admin)'}
        </p>
      )}
      <TabelCetak headers={['No', 'NIT', 'Nama Taruna', 'No. Rekening', 'Nilai Blokir (Rp)', 'Hari', 'Bantuan/Org ke Penyedia (Rp)', 'Besaran Bersih (Rp)', 'Tanda Tangan']}>
        {rows.map((b, i) => {
          const rate = b.hari_makan > 0 ? Math.round(b.nominal / b.hari_makan) : 0;
          return (
            <BarisCetak key={b.nit}>
              <SelCetak>{i + 1}</SelCetak>
              <SelCetak>{b.nit}</SelCetak>
              <SelCetak>{b.nama}</SelCetak>
              <SelCetak>{b.rekening_lengkap_ada ? b.no_rekening_lengkap : 'Belum diisi Admin'}</SelCetak>
              <SelCetak className="text-right">{formatRupiah(b.nominal)}</SelCetak>
              <SelCetak className="text-right">{b.hari_makan}</SelCetak>
              <SelCetak className="text-right">{rate ? formatRupiah(rate) : '-'}</SelCetak>
              <SelCetak className="text-right">{formatRupiah(b.nominal)}</SelCetak>
              <SelCetak />
            </BarisCetak>
          );
        })}
      </TabelCetak>
      <div className="flex justify-between text-sm font-bold">
        <span>JUMLAH ({rows.length} taruna, {totalHari} hari)</span>
        <span>{formatRupiah(total)}</span>
      </div>
      <p className="text-xs italic">Terbilang: <strong>{terbilangRupiah(total)}</strong></p>
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
  );
}

/** Lampiran Kuasa Blokir untuk SATU bank (No, NIT, Nama, Prodi/Tingkat, Rekening, TTD). */
function LampiranKuasaBank({ bank, rows, bulan, pejabat }: {
  bank: string; rows: BarisForm07[]; bulan: string; pejabat: Form07Data['pejabat'];
}) {
  const labelBank = bank === 'TANPA_REKENING' ? 'BELUM ADA REKENING' : bank;
  return (
    <div className="break-before-page flex flex-col gap-2">
      <KopSurat />
      <div className="text-center">
        <h2 className="text-sm font-bold">LAMPIRAN KUASA BLOKIR</h2>
        <p className="text-xs">Bank {labelBank} · Bulan {labelBulan(bulan)} · Nomor: B. ______ /POLTEK.SRG/KU.110/…/20…</p>
      </div>
      <TabelCetak headers={['No', 'NIT', 'Nama Penerima', 'Prodi / Tingkat', 'No. Rekening', 'Tanda Tangan']}>
        {rows.map((b, i) => (
          <BarisCetak key={b.nit}>
            <SelCetak>{i + 1}</SelCetak>
            <SelCetak>{b.nit}</SelCetak>
            <SelCetak>{b.nama}</SelCetak>
            <SelCetak>{labelTkProdi(b)}</SelCetak>
            <SelCetak>{b.rekening_lengkap_ada ? b.no_rekening_lengkap : 'Belum diisi Admin'}</SelCetak>
            <SelCetak />
          </BarisCetak>
        ))}
      </TabelCetak>
      <BlokTtd2Kolom
        kiri={{ label: 'Mengetahui,', jabatan: 'Kuasa Pengguna Anggaran (KPA)', nama: pejabat.KPA.nama, nip: pejabat.KPA.nip }}
        kanan={{ label: 'Mengajukan,', jabatan: 'Pejabat Pembuat Komitmen (PPK)', nama: pejabat.PPK.nama, nip: pejabat.PPK.nip }}
      />
    </div>
  );
}

export function HalamanCetakForm07() {
  const nav = useNavigate();
  const { bulan: bulanParam } = useParams<{ bulan?: string }>();
  const [bulan, setBulan] = useState(bulanParam || bulanIni());
  const { data, memuat, galat, refresh } = useTanpaCache<Form07Data>('cetak.form07', { bulan });

  // ── Nomor surat diisi manual (state lokal, TIDAK dikirim ke server) ──
  const [noSurat, setNoSurat] = useState('');
  // Lampiran blokir per bank (BSI/BNI dipisah) — untuk diajukan ke masing-masing bank.
  const [lampiranBank, setLampiranBank] = useState(true);

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
      <label className="flex items-center gap-2 text-sm text-gray-700 print:hidden">
        <input type="checkbox" checked={lampiranBank} onChange={(e) => setLampiranBank(e.target.checked)} />
        Sertakan lampiran blokir per bank (BSI/BNI dipisah + Kuasa Blokir)
      </label>

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

          {/* Lampiran blokir per bank — masing-masing halaman cetak sendiri, diajukan ke bank terkait */}
          {lampiranBank && kelompokBank(data.baris).map((g) => (
            <div key={g.bank} className="flex flex-col gap-6">
              <LampiranBlokirBank bank={g.bank} rows={g.rows} bulan={data.bulan} pejabat={data.pejabat}
                rekSenat={g.bank === 'BNI' ? data.rekening_senat?.BNI : g.bank === 'BSI' ? data.rekening_senat?.BSI : ''} />
              <LampiranKuasaBank bank={g.bank} rows={g.rows} bulan={data.bulan} pejabat={data.pejabat} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
