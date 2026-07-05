// /cetak/form-07/:bulan (Admin, PPK SAJA) — Usulan Penahanan & Pendebetan
// Rekening ke Bank. Menampilkan nomor rekening PENUH (TARUNA_REKENING via
// cetak.form07 — lihat 21_cetak.gs/22_rekening.gs), jadi halaman ini SENGAJA
// TIDAK memakai useListCache/Dexie seperti daftar biasa — data sensitif ini
// tidak boleh singgah di IndexedDB. Dipakai hook lokal useTanpaCache di bawah
// yang cuma memanggil api() langsung, tanpa ambilCache/simpanCache.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BulanPicker, bulanIni, labelBulan } from '../../components/bulan-picker';
import { BlokTtd3Berjenjang } from '../../components/cetak/blok-ttd';
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
  rekening_penyedia?: { BNI?: string; BSI?: string };
  rekening_senat_nama?: { BNI?: string; BSI?: string };
  rekening_penyedia_nama?: { BNI?: string; BSI?: string };
}

/** Blok TTD surat ke bank: Ketua Senat → Wakil Direktur III → Direktur (pengirim surat). */
function TtdSuratBank({ pejabat }: { pejabat: Form07Data['pejabat'] }) {
  return (
    <BlokTtd3Berjenjang
      pihak1={{ label: 'Ketua Senat Taruna,', jabatan: 'Politeknik KP Sorong' }}
      pihak2={{ label: 'Wakil Direktur III,', jabatan: 'Bidang Kemahasiswaan', nama: pejabat.WADIR3.nama, nip: pejabat.WADIR3.nip }}
      pihak3={{ label: 'Direktur,', jabatan: 'Politeknik KP Sorong', nama: pejabat.DIREKTUR.nama, nip: pejabat.DIREKTUR.nip }}
    />
  );
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


/**
 * Surat permohonan blokir & pendebetan untuk SATU bank tujuan (BNI atau BSI).
 * Karena dana taruna ada di 2 bank berbeda, tiap bank menerima surat sendiri
 * dengan TOTAL sesuai bank itu saja (tidak ada total gabungan lintas bank).
 * Alur yang diminta ke bank: (1) blokir rekening taruna N hari, (2) debet nilai
 * SPM per orang ke Rekening Senat, (3) teruskan total ke rekening penyedia.
 * Kolom Tanda Tangan taruna = pemberian kuasa mendebet.
 */
function LampiranBlokirBank({ bank, rows, bulan, pejabat, rekSenat, rekPenyedia, rekSenatNama, rekPenyediaNama, lamaBlokir }: {
  bank: string; rows: BarisForm07[]; bulan: string; pejabat: Form07Data['pejabat'];
  rekSenat?: string; rekPenyedia?: string; rekSenatNama?: string; rekPenyediaNama?: string; lamaBlokir: string;
}) {
  const total = rows.reduce((s, b) => s + b.nominal, 0);
  const labelBank = bank === 'TANPA_REKENING' ? 'BELUM ADA REKENING' : bank;
  const namaHari = lamaBlokir.trim() || '……';
  return (
    <div className="break-before-page flex flex-col gap-2">
      <KopSurat />
      <div className="text-center">
        <h2 className="text-sm font-bold">PERMOHONAN PEMBLOKIRAN DAN PENDEBETAN REKENING TARUNA</h2>
        <p className="text-xs">Bank {labelBank} · Bulan {labelBulan(bulan)} · Nomor: B. ______ /POLTEK.SRG/KU.110/…/20…</p>
      </div>
      <p className="text-xs">Kepada Yth. Pimpinan Bank {labelBank} — di tempat.</p>
      <p className="text-xs">
        Setelah dana bantuan biaya makan taruna bulan {labelBulan(bulan)} cair ke rekening masing-masing
        taruna, kami memohon Bank {labelBank} berkenan: <strong>(1)</strong> memblokir rekening taruna pada
        daftar di bawah selama <strong>{namaHari} hari</strong>; <strong>(2)</strong> mendebet dana sesuai nilai
        per orang ke <strong>Rekening Senat Taruna {bank}</strong> ({rekSenat || '…… belum diisi Admin'}
        {rekSenatNama ? ` a.n. ${rekSenatNama}` : ''});
        <strong> (3)</strong> meneruskan total dana yang berhasil didebet ke <strong>rekening penyedia jasa boga {bank}</strong>{' '}
        ({rekPenyedia || '…… belum diisi Admin'}{rekPenyediaNama ? ` a.n. ${rekPenyediaNama}` : ''}). Tanda tangan
        taruna pada kolom terakhir merupakan pemberian kuasa kepada bank untuk mendebet sesuai nilai tersebut.
      </p>
      <TabelCetak headers={['No', 'NIT', 'Nama Taruna', 'No. Rekening', 'Nilai Debet (Rp)', 'Tanda Tangan Taruna (Kuasa Debet)']}>
        {rows.map((b, i) => (
          <BarisCetak key={b.nit}>
            <SelCetak>{i + 1}</SelCetak>
            <SelCetak>{b.nit}</SelCetak>
            <SelCetak>{b.nama}</SelCetak>
            <SelCetak>{b.rekening_lengkap_ada ? b.no_rekening_lengkap : 'Belum diisi Admin'}</SelCetak>
            <SelCetak className="text-right">{formatRupiah(b.nominal)}</SelCetak>
            <SelCetak />
          </BarisCetak>
        ))}
      </TabelCetak>
      <div className="flex justify-between text-sm font-bold">
        <span>TOTAL BANK {labelBank} ({rows.length} taruna)</span>
        <span>{formatRupiah(total)}</span>
      </div>
      <p className="text-xs italic">Terbilang: <strong>{terbilangRupiah(total)}</strong></p>
      <TtdSuratBank pejabat={pejabat} />
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
  // Surat blokir & pendebetan per bank (BSI/BNI dipisah) — tiap bank surat sendiri.
  const [lampiranBank, setLampiranBank] = useState(true);
  // Lama blokir (hari) diisi manual — tidak dikirim ke server.
  const [lamaBlokir, setLamaBlokir] = useState('7');

  // Abaikan taruna bernilai Rp0 (backend juga memfilter; ini jaga-jaga bila GAS
  // belum di-deploy ulang).
  const barisBayar = (data?.baris ?? []).filter((b) => b.nominal > 0);

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
      <div className="flex flex-col gap-2 print:hidden">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={lampiranBank} onChange={(e) => setLampiranBank(e.target.checked)} />
          Sertakan surat blokir &amp; pendebetan per bank (BSI/BNI dipisah)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          Lama blokir (hari):
          <input type="number" min={1} value={lamaBlokir} onChange={(e) => setLamaBlokir(e.target.value)}
            className="w-20 rounded border border-gray-300 px-2 py-1 text-sm" />
        </label>
      </div>

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
              Setelah dana bantuan biaya makan taruna Politeknik Kelautan dan Perikanan Sorong
              bulan {labelBulan(data.bulan)} <strong>cair ke rekening masing-masing taruna</strong>
              {' '}(mekanisme LS), Direktur Politeknik KP Sorong bersama Ketua Senat Taruna dan
              Wakil Direktur III memohon kepada bank penyalur untuk: <strong>(1)</strong> memblokir
              rekening taruna penerima sebagaimana daftar terlampir selama{' '}
              <strong>{(lamaBlokir.trim() || '……')} hari</strong>; <strong>(2)</strong> mendebet dana
              sesuai nilai per orang ke <strong>Rekening Senat Taruna</strong>; lalu <strong>(3)</strong>{' '}
              meneruskan total dana yang berhasil didebet ke <strong>rekening penyedia jasa boga</strong>{' '}
              sesuai kontrak (SOP PR/PKU/KU-001/2025). Karena dana taruna tersebar di{' '}
              <strong>2 bank (BNI &amp; BSI)</strong>, permohonan dan totalnya dibuat{' '}
              <strong>terpisah per bank</strong> (rincian &amp; tanda tangan taruna sebagai kuasa debet terlampir).
            </p>
            <div className="mt-2 flex flex-col gap-1 text-xs">
              <div className="flex justify-between"><span>No. SPM</span><span>{data.pembayaran.no_spm || '-'}</span></div>
              <div className="flex justify-between"><span>No. SP2D</span><span>{data.pembayaran.no_sp2d || '-'}</span></div>
              <div className="flex justify-between"><span>Tanggal SP2D</span><span>{data.pembayaran.tgl_sp2d || '-'}</span></div>
            </div>
          </Card>

          <Card className="overflow-x-auto print:border-0 print:p-0 print:shadow-none">
            <p className="mb-2 text-sm font-semibold text-gray-600 print:text-black">
              Lampiran: Daftar Taruna Penerima — <strong>dipisah per bank (BSI &amp; BNI)</strong>
            </p>
            {kelompokBank(barisBayar).map((g) => {
              const labelBank = g.bank === 'TANPA_REKENING' ? 'BELUM ADA REKENING' : g.bank;
              const subtotal = g.rows.reduce((s, b) => s + b.nominal, 0);
              return (
                <div key={g.bank} className="mb-3">
                  <p className="mb-1 text-xs font-semibold print:text-black">Bank {labelBank} — {g.rows.length} taruna</p>
                  <TabelCetak headers={['No', 'NIT', 'Nama', 'No. Rekening', 'Jumlah']}>
                    {g.rows.map((b, i) => (
                      <BarisCetak key={b.nit}>
                        <SelCetak>{i + 1}</SelCetak>
                        <SelCetak>{b.nit}</SelCetak>
                        <SelCetak>{b.nama}</SelCetak>
                        <SelCetak>{b.rekening_lengkap_ada ? b.no_rekening_lengkap : 'Belum diisi Admin'}</SelCetak>
                        <SelCetak className="text-right">{formatRupiah(b.nominal)}</SelCetak>
                      </BarisCetak>
                    ))}
                  </TabelCetak>
                  <div className="mt-1 flex justify-between text-xs font-semibold">
                    <span>Subtotal {labelBank}</span>
                    <span>{formatRupiah(subtotal)}</span>
                  </div>
                </div>
              );
            })}
            <p className="mt-1 text-xs text-gray-500 print:text-black">
              Total dibuat <strong>per bank</strong> (lihat surat blokir &amp; pendebetan masing-masing
              bank di bawah) — tidak ada total gabungan lintas bank.
            </p>
            {barisBayar.some((b) => !b.rekening_lengkap_ada) && (
              <p className="mt-2 text-xs text-red-600 print:hidden">
                ⚠️ Ada taruna yang rekening lengkapnya belum diisi Admin — lengkapi dulu di
                halaman Data Taruna sebelum surat ini diajukan ke bank.
              </p>
            )}
          </Card>

          <TtdSuratBank pejabat={data.pejabat} />

          {/* Surat blokir & pendebetan per bank — masing-masing halaman cetak sendiri, diajukan ke bank terkait */}
          {lampiranBank && kelompokBank(barisBayar).map((g) => (
            <LampiranBlokirBank key={g.bank} bank={g.bank} rows={g.rows} bulan={data.bulan} pejabat={data.pejabat}
              lamaBlokir={lamaBlokir}
              rekSenat={g.bank === 'BNI' ? data.rekening_senat?.BNI : g.bank === 'BSI' ? data.rekening_senat?.BSI : ''}
              rekPenyedia={g.bank === 'BNI' ? data.rekening_penyedia?.BNI : g.bank === 'BSI' ? data.rekening_penyedia?.BSI : ''}
              rekSenatNama={g.bank === 'BNI' ? data.rekening_senat_nama?.BNI : g.bank === 'BSI' ? data.rekening_senat_nama?.BSI : ''}
              rekPenyediaNama={g.bank === 'BNI' ? data.rekening_penyedia_nama?.BNI : g.bank === 'BSI' ? data.rekening_penyedia_nama?.BSI : ''} />
          ))}
        </div>
      )}
    </div>
  );
}
