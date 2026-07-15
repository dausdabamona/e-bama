// /cetak/blokir-gagal-debet (Admin, PPK, Staf PPK) — Surat Permohonan Pemblokiran
// & Pendebetan ke bank untuk taruna GAGAL DEBET yang BELUM MENYETOR ke Senat
// (jalur TAGIHAN, terpisah dari Form-07/SP2D). Menampilkan nomor rekening PENUH
// (cetak.blokir_gagal_debet — _hanyaAdminPPK_ + AUDIT_LOG), jadi TIDAK di-cache
// Dexie (useTanpaCache). Dipisah per bank: BSI & BNI jadi surat terpisah.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

interface Pejabat { nama: string; nip: string }
interface BarisBlokir {
  nit: string; nama: string; prodi: string; tingkat: string; bulan: string; sebab: string;
  bank: string; no_rekening_lengkap: string; nama_pemilik: string; nominal: number; nilai_debet: number;
  rekening_lengkap_ada: boolean;
}
interface BlokirData {
  bulan_filter: string; baris: BarisBlokir[]; total_nominal: number;
  pejabat: { PPK: Pejabat; KPA: Pejabat; DIREKTUR: Pejabat; WADIR3: Pejabat };
  rekening_senat?: { BNI?: string; BSI?: string };
  rekening_senat_nama?: { BNI?: string; BSI?: string };
}

const URUT_TINGKAT: Record<string, number> = { I: 1, II: 2, III: 3, '1': 1, '2': 2, '3': 3 };
function urutBaris(a: BarisBlokir, b: BarisBlokir): number {
  return a.bulan.localeCompare(b.bulan)
    || (URUT_TINGKAT[a.tingkat] ?? 9) - (URUT_TINGKAT[b.tingkat] ?? 9)
    || a.prodi.localeCompare(b.prodi) || a.nama.localeCompare(b.nama);
}
function kelompokBank(baris: BarisBlokir[]): { bank: string; rows: BarisBlokir[] }[] {
  const map = new Map<string, BarisBlokir[]>();
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

/** Fetch langsung ke GAS — TIDAK ambilCache/simpanCache (data rekening penuh). */
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
      try { const hasil = await api<T>(action, payload); if (aktif) setData(hasil); }
      catch (e) { if (aktif) setGalat(e instanceof Error ? e.message : 'Gagal memuat.'); }
      finally { if (aktif) setMemuat(false); }
    })();
    return () => { aktif = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, payloadKey, tick]);
  return { data, memuat, galat, refresh };
}

function TtdSuratBank({ pejabat }: { pejabat: BlokirData['pejabat'] }) {
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

/** Surat blokir & pendebetan tunggakan untuk SATU bank. */
function SuratBlokirBank({ bank, rows, pejabat, rekSenat, rekSenatNama, lamaBlokir, noSurat, pisahHalaman }: {
  bank: string; rows: BarisBlokir[]; pejabat: BlokirData['pejabat'];
  rekSenat?: string; rekSenatNama?: string; lamaBlokir: string; noSurat?: string; pisahHalaman: boolean;
}) {
  const total = rows.reduce((s, b) => s + b.nilai_debet, 0);
  const labelBank = bank === 'TANPA_REKENING' ? 'BELUM ADA REKENING' : bank;
  const namaHari = lamaBlokir.trim() || '……';
  return (
    <div className={`${pisahHalaman ? 'break-before-page ' : ''}flex flex-col gap-2`}>
      <KopSurat />
      <div className="text-center">
        <h2 className="text-sm font-bold">PERMOHONAN PEMBLOKIRAN DAN PENDEBETAN REKENING TARUNA</h2>
        <p className="text-xs">(Tunggakan Bantuan Uang Makan — Gagal Auto-Debet, Belum Disetor)</p>
        <p className="text-xs">Bank {labelBank} · Nomor: {noSurat || 'B. ______ /POLTEK.SRG/KU.110/…/2026'}</p>
      </div>
      <p className="text-xs">Kepada Yth. Pimpinan Bank {labelBank} — di tempat.</p>
      <p className="text-xs">
        Sehubungan dengan taruna pada daftar di bawah yang <strong>belum menyelesaikan kewajiban</strong>{' '}
        pengembalian dana Bantuan Uang Makan (auto-debet gagal dan belum disetorkan kembali ke Senat),
        dengan ini kami mengajukan permohonan kepada Bank {labelBank} untuk: <strong>(1)</strong> memblokir
        rekening taruna tersebut selama <strong>{namaHari} hari</strong>; dan <strong>(2)</strong> mendebet dana
        sesuai nilai per orang ke <strong>Rekening Senat Taruna {bank}</strong>{' '}
        ({rekSenat || '…… belum diisi Admin'}{rekSenatNama ? ` a.n. ${rekSenatNama}` : ''}). Tanda tangan
        taruna pada kolom terakhir merupakan pemberian kuasa kepada bank untuk mendebet sesuai nilai tersebut.
      </p>
      <table className="w-full table-fixed border-collapse text-xs">
        {/* Kolom Tanda Tangan sengaja PALING LEBAR (memanfaatkan ruang kertas)
            supaya cukup untuk tanda tangan basah taruna. */}
        <colgroup>
          <col style={{ width: '4%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '19%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '28%' }} />
        </colgroup>
        <thead>
          <tr>
            {['No', 'NIT', 'Nama Taruna', 'Bulan', 'No. Rekening', 'Nilai Debet (Rp)', 'Tanda Tangan Taruna (Kuasa Debet)'].map((h) => (
              <th key={h} className="border border-gray-400 bg-[#D9E2F3] px-2 py-1 text-left align-top font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((b, i) => {
            const num = i + 1;
            return (
              <tr key={`${b.nit}|${b.bulan}`}>
                <SelCetak className="print:py-6">{num}</SelCetak>
                <SelCetak className="print:py-6">{b.nit}</SelCetak>
                <SelCetak className="print:py-6">{b.nama}</SelCetak>
                <SelCetak className="print:py-6">{labelBulan(b.bulan)}</SelCetak>
                <SelCetak className="print:py-6">{b.rekening_lengkap_ada ? b.no_rekening_lengkap : 'Belum diisi Admin'}</SelCetak>
                <SelCetak className="text-right print:py-6">{formatRupiah(b.nilai_debet)}</SelCetak>
                <SelCetak className={`print:py-6 ${num % 2 === 1 ? 'text-left' : 'text-center'}`}>{num}</SelCetak>
              </tr>
            );
          })}
        </tbody>
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

export function HalamanCetakBlokirGagalDebet() {
  const nav = useNavigate();
  const [bulan, setBulan] = useState('');   // kosong = semua tunggakan belum-setor
  const { data, memuat, galat, refresh } = useTanpaCache<BlokirData>('cetak.blokir_gagal_debet', bulan ? { bulan } : {});
  const [lamaBlokir, setLamaBlokir] = useState('7');
  const [noSuratBNI, setNoSuratBNI] = useState('');
  const [noSuratBSI, setNoSuratBSI] = useState('');

  const grup = data ? kelompokBank(data.baris) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <button className="text-sm text-primary" onClick={() => nav(-1)}>← Kembali</button>
        {data && grup.length > 0 && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak</Button>}
      </div>
      <h1 className="text-xl font-bold text-primary-dark print:hidden">Surat Blokir &amp; Pendebetan — Tunggakan Gagal Debet (Belum Disetor)</h1>
      <p className="text-xs text-amber-700 print:hidden">
        ⚠️ Menampilkan nomor rekening LENGKAP taruna — akses ADMIN/PPK/Staf PPK saja, tercatat di Log Audit,
        dan TIDAK disimpan ke perangkat. Hanya taruna berstatus TERTAGIH yang BELUM menyetor ke Senat.
      </p>

      <div className="flex flex-col gap-2 print:hidden">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={!bulan} onChange={(e) => setBulan(e.target.checked ? '' : bulanIni())} />
          Semua bulan (kalau dimatikan, pilih satu bulan)
        </label>
        {!!bulan && <BulanPicker bulan={bulan} onChange={setBulan} />}
        <label className="flex items-center gap-2 text-sm text-gray-700">
          Lama blokir (hari):
          <input type="number" min={1} value={lamaBlokir} onChange={(e) => setLamaBlokir(e.target.value)}
            className="w-20 rounded border border-gray-300 px-2 py-1 text-sm" />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span className="w-40">No. Surat Bank BSI:</span>
          <input value={noSuratBSI} onChange={(e) => setNoSuratBSI(e.target.value)}
            placeholder="B. …/POLTEK.SRG/KU.110/…/2026" className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm" />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span className="w-40">No. Surat Bank BNI:</span>
          <input value={noSuratBNI} onChange={(e) => setNoSuratBNI(e.target.value)}
            placeholder="B. …/POLTEK.SRG/KU.110/…/2026" className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm" />
        </label>
      </div>

      {memuat && !data && <LoadingSpinner label="Memuat data…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}

      {data && grup.length > 0 && (
        <div className="flex flex-col gap-4">
          {data.baris.some((b) => !b.rekening_lengkap_ada) && (
            <p className="text-xs text-red-600 print:hidden">
              ⚠️ Ada taruna yang rekening lengkapnya belum diisi Admin — lengkapi dulu di halaman Data Taruna.
            </p>
          )}
          <p className="text-xs text-gray-500 print:hidden">
            Tiap bank dicetak sebagai <strong>surat TERPISAH</strong> (BSI &amp; BNI tidak digabung), mulai halaman baru.
          </p>
          {grup.map((g, i) => (
            <SuratBlokirBank key={g.bank} bank={g.bank} rows={g.rows} pejabat={data.pejabat}
              lamaBlokir={lamaBlokir} pisahHalaman={i > 0}
              rekSenat={g.bank === 'BNI' ? data.rekening_senat?.BNI : g.bank === 'BSI' ? data.rekening_senat?.BSI : ''}
              rekSenatNama={g.bank === 'BNI' ? data.rekening_senat_nama?.BNI : g.bank === 'BSI' ? data.rekening_senat_nama?.BSI : ''}
              noSurat={g.bank === 'BNI' ? noSuratBNI : g.bank === 'BSI' ? noSuratBSI : ''} />
          ))}
        </div>
      )}
    </div>
  );
}
