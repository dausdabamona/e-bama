// /cetak/form-07/:bulan (Admin, PPK SAJA) — Usulan Penahanan & Pendebetan
// Rekening ke Bank. Menampilkan nomor rekening PENUH (TARUNA_REKENING via
// cetak.form07 — lihat 21_cetak.gs/22_rekening.gs), jadi halaman ini SENGAJA
// TIDAK memakai useListCache/Dexie seperti daftar biasa — data sensitif ini
// tidak boleh singgah di IndexedDB. Dipakai hook lokal useTanpaCache di bawah
// yang cuma memanggil api() langsung, tanpa ambilCache/simpanCache.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BulanPicker, bulanIni, labelBulan } from '../../components/bulan-picker';
import { BlokTtd2Kolom, BlokTtdTengah } from '../../components/cetak/blok-ttd';
import { KopSurat } from '../../components/cetak/kop-surat';
import { SelCetak } from '../../components/cetak/tabel-cetak';
import { Button } from '../../components/ui/button';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { api } from '../../lib/api';
import { terbilangRupiah } from '../../lib/terbilang';
import { formatRupiah } from '../tagihan/tipe';

interface BarisForm07 {
  nit: string; nama: string; prodi: string; tingkat: string; bank: string; no_rekening_lengkap: string;
  nama_pemilik: string; nominal: number; nilai_debet: number; hari_makan: number; rekening_lengkap_ada: boolean;
}

const BULAN_ID_F07 = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
/** '2026-07-08' → '8 Juli 2026'. */
function tglIndoF07(s: string): string {
  const p = (s || '').split('-');
  if (p.length !== 3) return s || '';
  return `${Number(p[2])} ${BULAN_ID_F07[Number(p[1]) - 1]} ${p[0]}`;
}
/** Tambah n hari ke tanggal 'YYYY-MM-DD' → 'YYYY-MM-DD'. */
function tambahHariF07(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
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
/** Sub-kelompokkan baris (dalam satu bank) per Prodi/Tingkat — utk subtotal per grup. */
function kelompokProdiTingkat(rows: BarisForm07[]): { prodi: string; tingkat: string; rows: BarisForm07[] }[] {
  const map = new Map<string, BarisForm07[]>();
  rows.forEach((b) => {
    const k = `${b.tingkat}|${b.prodi}`;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(b);
  });
  return Array.from(map.entries())
    .map(([k, rs]) => {
      const [tingkat, prodi] = k.split('|');
      return { prodi, tingkat, rows: rs.slice().sort(urutBaris) };
    })
    .sort((a, b) => (URUT_TINGKAT[a.tingkat] ?? 9) - (URUT_TINGKAT[b.tingkat] ?? 9) || a.prodi.localeCompare(b.prodi));
}

interface PembayaranRingkas {
  bayar_id: string; nilai_total: number; no_spm: string; tgl_spm: string; no_sp2d: string; tgl_sp2d: string; status: string;
}
interface Pejabat { nama: string; nip: string }
interface Form07Data {
  bulan: string; pembayaran: PembayaranRingkas; baris: BarisForm07[]; total_nominal: number; biaya_admin_bank: number;
  pejabat: { PPK: Pejabat; KPA: Pejabat; DIREKTUR: Pejabat; WADIR3: Pejabat };
  rekening_senat?: { BNI?: string; BSI?: string };
  rekening_penyedia?: { BNI?: string; BSI?: string };
  rekening_senat_nama?: { BNI?: string; BSI?: string };
  rekening_penyedia_nama?: { BNI?: string; BSI?: string };
  kontrak?: { no_kontrak: string; tgl_kontrak: string; adendum: string };
}

/**
 * Blok TTD surat ke bank (pengirim surat): Ketua Senat (kiri) & Wakil Direktur III
 * (kanan) sejajar, Direktur di TENGAH bawah (jabatan tertinggi mengesahkan).
 */
function TtdSuratBank({ pejabat }: { pejabat: Form07Data['pejabat'] }) {
  return (
    <div className="mt-4">
      <BlokTtd2Kolom
        kiri={{ label: 'Ketua Senat Taruna,', jabatan: 'Politeknik KP Sorong' }}
        kanan={{ label: 'Wakil Direktur III,', jabatan: 'Bidang Kemahasiswaan', nama: pejabat.WADIR3.nama, nip: pejabat.WADIR3.nip }}
      />
      <BlokTtdTengah pihak={{ label: 'Direktur,', jabatan: 'Politeknik KP Sorong', nama: pejabat.DIREKTUR.nama, nip: pejabat.DIREKTUR.nip }} />
    </div>
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
function LampiranBlokirBank({ bank, rows, bulan, pejabat, rekSenat, rekPenyedia, rekSenatNama, rekPenyediaNama, lamaBlokir, tglMulaiBlokir, noSurat, pisahHalaman }: {
  bank: string; rows: BarisForm07[]; bulan: string; pejabat: Form07Data['pejabat'];
  rekSenat?: string; rekPenyedia?: string; rekSenatNama?: string; rekPenyediaNama?: string; lamaBlokir: string;
  tglMulaiBlokir?: string; noSurat?: string; pisahHalaman: boolean;
}) {
  const total = rows.reduce((s, b) => s + b.nilai_debet, 0);
  const labelBank = bank === 'TANPA_REKENING' ? 'BELUM ADA REKENING' : bank;
  const namaHari = lamaBlokir.trim() || '……';
  const hari = parseInt(lamaBlokir, 10);
  // Tanggal sampai = mulai + (N-1) hari (inklusif). Tampil hanya bila mulai diisi.
  const tglSampai = (tglMulaiBlokir && hari > 0) ? tambahHariF07(tglMulaiBlokir, hari - 1) : '';
  return (
    <div className={`${pisahHalaman ? 'break-before-page ' : ''}flex flex-col gap-2`}>
      <KopSurat />
      <div className="text-center">
        <h2 className="text-sm font-bold">PERMOHONAN PEMBLOKIRAN DAN PENDEBETAN REKENING TARUNA</h2>
        <p className="text-xs">Bank {labelBank} · Bulan {labelBulan(bulan)} · Nomor: {noSurat || 'B. ______ /POLTEK.SRG/KU.110/…/2026'}</p>
      </div>
      <p className="text-xs">Kepada Yth. Pimpinan Bank {labelBank} — di tempat.</p>
      <p className="text-xs">
        Setelah dana bantuan biaya makan taruna bulan {labelBulan(bulan)} cair ke rekening masing-masing
        taruna, dengan ini kami mengajukan permohonan kepada Bank {labelBank} untuk: <strong>(1)</strong> memblokir
        rekening taruna pada daftar di bawah selama <strong>{namaHari} hari</strong>
        {tglMulaiBlokir && tglSampai && <> (<strong>mulai {tglIndoF07(tglMulaiBlokir)} sampai {tglIndoF07(tglSampai)}</strong>)</>}; <strong>(2)</strong> mendebet dana sesuai nilai
        per orang ke <strong>Rekening Senat Taruna {bank}</strong> ({rekSenat || '…… belum diisi Admin'}
        {rekSenatNama ? ` a.n. ${rekSenatNama}` : ''});
        <strong> (3)</strong> meneruskan total dana yang berhasil didebet ke <strong>rekening penyedia jasa boga {bank}</strong>{' '}
        ({rekPenyedia || '…… belum diisi Admin'}{rekPenyediaNama ? ` a.n. ${rekPenyediaNama}` : ''}). Tanda tangan
        taruna pada kolom terakhir merupakan pemberian kuasa kepada bank untuk mendebet sesuai nilai tersebut.
      </p>
      <table className="w-full table-fixed border-collapse text-xs">
        {/* Kolom Tanda Tangan sengaja PALING LEBAR (memakai ruang kosong) supaya
            cukup untuk tanda tangan basah taruna. */}
        <colgroup>
          <col style={{ width: '5%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '15%' }} />
          <col style={{ width: '15%' }} />
          <col style={{ width: '32%' }} />
        </colgroup>
        <thead>
          <tr>
            {['No', 'NIT', 'Nama Taruna', 'No. Rekening', 'Nilai Debet (Rp)', 'Tanda Tangan Taruna (Kuasa Debet)'].map((h) => (
              <th key={h} className="border border-gray-400 bg-[#D9E2F3] px-2 py-1 text-left align-top font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        {kelompokProdiTingkat(rows).map((pt) => {
          const subtotalPt = pt.rows.reduce((s, b) => s + b.nilai_debet, 0);
          return (
            <tbody key={`${pt.prodi}|${pt.tingkat}`}>
              <tr className="bg-primary-light/30 print:bg-gray-100">
                <td colSpan={6} className="border border-gray-300 px-2 py-1 font-semibold text-primary-dark print:text-black">
                  {pt.prodi} / {pt.tingkat}
                </td>
              </tr>
              {pt.rows.map((b, i) => {
                const num = i + 1;
                // Baris disengaja lebih tinggi saat cetak (py-6) — ruang cukup utk
                // tanda tangan basah. Nomor di kolom ttd (sama dgn kolom No) —
                // penanda kecocokan ttd; ganjil rapat kiri, genap rata tengah,
                // supaya mudah dicek per baris walau baris rapat/berdekatan.
                return (
                  <tr key={b.nit}>
                    <SelCetak className="print:py-6">{num}</SelCetak>
                    <SelCetak className="print:py-6">{b.nit}</SelCetak>
                    <SelCetak className="print:py-6">{b.nama}</SelCetak>
                    <SelCetak className="print:py-6">{b.rekening_lengkap_ada ? b.no_rekening_lengkap : 'Belum diisi Admin'}</SelCetak>
                    <SelCetak className="text-right print:py-6">{formatRupiah(b.nilai_debet)}</SelCetak>
                    <SelCetak className={`print:py-6 ${num % 2 === 1 ? 'text-left' : 'text-center'}`}>{num}</SelCetak>
                  </tr>
                );
              })}
              <tr className="font-semibold">
                <td colSpan={4} className="border border-gray-300 px-2 py-1">Subtotal {pt.prodi} / {pt.tingkat} ({pt.rows.length} taruna)</td>
                <td className="border border-gray-300 px-2 py-1 text-right">{formatRupiah(subtotalPt)}</td>
                <td className="border border-gray-300 px-2 py-1" />
              </tr>
            </tbody>
          );
        })}
      </table>
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

  // ── Nomor surat diisi manual per bank (state lokal, TIDAK dikirim ke server) ──
  // Dua bank = dua surat terpisah = dua nomor surat.
  const [noSuratBNI, setNoSuratBNI] = useState('');
  const [noSuratBSI, setNoSuratBSI] = useState('');
  // Lama blokir (hari) + tanggal mulai diisi manual — tidak dikirim ke server.
  // Tanggal sampai dihitung otomatis (mulai + lama-1 hari) & muncul di surat.
  const [lamaBlokir, setLamaBlokir] = useState('7');
  const [tglMulaiBlokir, setTglMulaiBlokir] = useState('');

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
          Lama blokir (hari):
          <input type="number" min={1} value={lamaBlokir} onChange={(e) => setLamaBlokir(e.target.value)}
            className="w-20 rounded border border-gray-300 px-2 py-1 text-sm" />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span className="w-40">Tanggal mulai blokir:</span>
          <input type="date" value={tglMulaiBlokir} onChange={(e) => setTglMulaiBlokir(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm" />
          <span className="text-xs text-gray-400">(sampai dihitung otomatis)</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span className="w-40">No. Surat Bank BNI:</span>
          <input value={noSuratBNI} onChange={(e) => setNoSuratBNI(e.target.value)}
            placeholder="B. …/POLTEK.SRG/KU.110/…/2026"
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm" />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span className="w-40">No. Surat Bank BSI:</span>
          <input value={noSuratBSI} onChange={(e) => setNoSuratBSI(e.target.value)}
            placeholder="B. …/POLTEK.SRG/KU.110/…/2026"
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm" />
        </label>
      </div>

      {memuat && !data && <LoadingSpinner label="Memuat data…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}

      {data && (
        <div className="flex flex-col gap-4">
          {barisBayar.some((b) => !b.rekening_lengkap_ada) && (
            <p className="text-xs text-red-600 print:hidden">
              ⚠️ Ada taruna yang rekening lengkapnya belum diisi Admin — lengkapi dulu di
              halaman Data Taruna sebelum surat ini diajukan ke bank.
            </p>
          )}
          <p className="text-xs text-gray-500 print:hidden">
            Tiap bank dicetak sebagai <strong>surat TERPISAH</strong> (BSI &amp; BNI tidak digabung) —
            masing-masing surat lengkap sendiri: kop, daftar taruna, total, &amp; tanda tangan pejabat,
            mulai di halaman baru.
          </p>
          {/* Satu bank = satu surat utuh sendiri (kop + daftar taruna + subtotal +
              total + ttd), mulai halaman baru masing-masing. BSI & BNI TIDAK
              digabung dalam satu dokumen (dikonfirmasi Firdaus). Bank pertama
              tanpa break-before agar tak ada halaman kosong di depan. */}
          {kelompokBank(barisBayar).map((g, i) => (
            <LampiranBlokirBank key={g.bank} bank={g.bank} rows={g.rows} bulan={data.bulan} pejabat={data.pejabat}
              lamaBlokir={lamaBlokir} tglMulaiBlokir={tglMulaiBlokir} pisahHalaman={i > 0}
              rekSenat={g.bank === 'BNI' ? data.rekening_senat?.BNI : g.bank === 'BSI' ? data.rekening_senat?.BSI : ''}
              rekPenyedia={g.bank === 'BNI' ? data.rekening_penyedia?.BNI : g.bank === 'BSI' ? data.rekening_penyedia?.BSI : ''}
              rekSenatNama={g.bank === 'BNI' ? data.rekening_senat_nama?.BNI : g.bank === 'BSI' ? data.rekening_senat_nama?.BSI : ''}
              rekPenyediaNama={g.bank === 'BNI' ? data.rekening_penyedia_nama?.BNI : g.bank === 'BSI' ? data.rekening_penyedia_nama?.BSI : ''}
              noSurat={g.bank === 'BNI' ? noSuratBNI : g.bank === 'BSI' ? noSuratBSI : ''} />
          ))}
        </div>
      )}
    </div>
  );
}
