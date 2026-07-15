// /cetak/pendebetan-penyedia (Senat, PPK, Staf PPK, Admin) — Surat Permohonan
// Pendebetan Rekening SENAT → PENYEDIA untuk dana tagih-ulang GAGAL DEBET yang
// sudah LUNAS (masuk rekening Senat) & akan diteruskan ke penyedia. Rincian per
// taruna (nama, prodi/tingkat, nilai) — TIDAK memuat rekening taruna (debit
// antar rekening instansi), jadi boleh di-cache. DIPISAH PER BULAN.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { labelBulan } from '../../components/bulan-picker';
import { BlokTtd2Kolom, BlokTtdTengah } from '../../components/cetak/blok-ttd';
import { KopSurat } from '../../components/cetak/kop-surat';
import { SelCetak } from '../../components/cetak/tabel-cetak';
import { ambilBerkasInput, berkasKeBase64 } from '../../lib/berkas';
import { aksiTulis } from '../../lib/sync';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useToast } from '../../components/ui/toast';
import { useListCache } from '../../lib/use-list-cache';
import { terbilangRupiah } from '../../lib/terbilang';
import { formatRupiah } from '../tagihan/tipe';

interface Pejabat { nama: string; nip: string }
interface Baris { tagihan_id: string; nit: string; nama: string; prodi: string; tingkat: string; bulan: string; nominal: number }
interface RekBank { BNI?: string; BSI?: string }
interface PendebetanData {
  bulan_filter: string; baris: Baris[]; total_nominal: number;
  rekening_senat?: RekBank; rekening_senat_nama?: RekBank;
  rekening_penyedia?: RekBank; rekening_penyedia_nama?: RekBank;
  pejabat: { PPK: Pejabat; KPA: Pejabat; DIREKTUR: Pejabat; WADIR3: Pejabat };
}

const URUT_TK: Record<string, number> = { I: 1, II: 2, III: 3, '1': 1, '2': 2, '3': 3 };
function urut(a: Baris, b: Baris): number {
  return a.prodi.localeCompare(b.prodi) || (URUT_TK[a.tingkat] ?? 9) - (URUT_TK[b.tingkat] ?? 9) || a.nama.localeCompare(b.nama, 'id');
}

/** Satu surat pendebetan Senat→Penyedia untuk SATU bulan. */
function SuratPendebetan({ bulan, rows, bank, rekSenat, rekSenatNama, rekPenyedia, rekPenyediaNama, pejabat, noSurat, pisahHalaman }: {
  bulan: string; rows: Baris[]; bank: string;
  rekSenat?: string; rekSenatNama?: string; rekPenyedia?: string; rekPenyediaNama?: string;
  pejabat: PendebetanData['pejabat']; noSurat?: string; pisahHalaman: boolean;
}) {
  const total = rows.reduce((s, b) => s + b.nominal, 0);
  return (
    <div className={`${pisahHalaman ? 'break-before-page ' : ''}flex flex-col gap-2`}>
      <KopSurat />
      <div className="text-center">
        <h2 className="text-sm font-bold">PERMOHONAN PENDEBETAN REKENING SENAT KE REKENING PENYEDIA</h2>
        <p className="text-xs">(Dana Tagih-Ulang Gagal Debet — Bulan {labelBulan(bulan)})</p>
        <p className="text-xs">Bank {bank} · Nomor: {noSurat || 'B. ______ /SENAT-TARUNA.POLTEK.KP.SRG/…/2026'}</p>
      </div>
      <p className="text-xs">Kepada Yth. Pimpinan Bank {bank} — di tempat.</p>
      <p className="text-xs leading-relaxed">
        Menindaklanjuti pengembalian dana Bantuan Uang Makan bulan <strong>{labelBulan(bulan)}</strong> yang
        gagal auto-debet dan telah disetorkan kembali oleh taruna ke rekening Senat Taruna, dengan ini kami
        mengajukan permohonan kepada Bank {bank} untuk <strong>mendebet Rekening Senat Taruna {bank}</strong>{' '}
        ({rekSenat || '…… belum diisi Admin'}{rekSenatNama ? ` a.n. ${rekSenatNama}` : ''}) sejumlah{' '}
        <strong>{formatRupiah(total)}</strong> dan <strong>meneruskannya ke rekening penyedia jasa boga {bank}</strong>{' '}
        ({rekPenyedia || '…… belum diisi Admin'}{rekPenyediaNama ? ` a.n. ${rekPenyediaNama}` : ''}), dengan rincian
        penerima sebagai berikut:
      </p>
      <table className="w-full table-fixed border-collapse text-xs">
        <colgroup>
          <col style={{ width: '6%' }} /><col style={{ width: '20%' }} /><col style={{ width: '40%' }} />
          <col style={{ width: '14%' }} /><col style={{ width: '20%' }} />
        </colgroup>
        <thead>
          <tr>
            {['No', 'NIT', 'Nama Taruna', 'Prodi/Tk', 'Nilai (Rp)'].map((h) => (
              <th key={h} className="border border-gray-400 bg-[#D9E2F3] px-2 py-1 text-left align-top font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice().sort(urut).map((b, i) => (
            <tr key={`${b.nit}|${b.bulan}`}>
              <SelCetak>{i + 1}</SelCetak>
              <SelCetak>{b.nit}</SelCetak>
              <SelCetak>{b.nama}</SelCetak>
              <SelCetak>{b.prodi}/{b.tingkat}</SelCetak>
              <SelCetak className="text-right">{formatRupiah(b.nominal)}</SelCetak>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between text-sm font-bold">
        <span>TOTAL ({rows.length} taruna)</span>
        <span>{formatRupiah(total)}</span>
      </div>
      <p className="text-xs italic">Terbilang: <strong>{terbilangRupiah(total)}</strong></p>
      <div className="mt-4">
        <BlokTtd2Kolom
          kiri={{ label: 'Mengajukan,', jabatan: 'Ketua Senat Taruna' }}
          kanan={{ label: 'Menyetujui,', jabatan: 'Pejabat Pembuat Komitmen (PPK)', nama: pejabat.PPK.nama, nip: pejabat.PPK.nip }}
        />
        <BlokTtdTengah pihak={{ label: 'Mengetahui, Direktur', jabatan: 'Politeknik KP Sorong', nama: pejabat.DIREKTUR.nama, nip: pejabat.DIREKTUR.nip }} />
      </div>
    </div>
  );
}

/**
 * Panel "Konfirmasi Bank Sudah Proses" untuk SATU bulan (print:hidden). Setelah
 * bank mendebet Senat → transfer ke Penyedia dan mengirim notifikasi, PPK/Senat
 * mencentang taruna yang benar-benar sudah diproses (default semua), mengunggah
 * notifikasi bank sebagai bukti, lalu menandainya lewat tagihan.teruskan_penyedia.
 * Taruna itu langsung pindah ke "Lunas, sudah diteruskan" dan HILANG dari daftar
 * tagihan aktif maupun dari surat ini. Mendukung konfirmasi sebagian (bila bank
 * hanya memproses sebagian, mirip kasus gagal debet) — sisanya tetap di daftar.
 */
function PanelKonfirmasiBank({ bulan, rows, onSelesai }: {
  bulan: string; rows: Baris[]; onSelesai: () => void;
}) {
  const { toast } = useToast();
  const [terpilih, setTerpilih] = useState<Set<string>>(() => new Set(rows.map((r) => r.tagihan_id)));
  const [fotoNama, setFotoNama] = useState('');
  const [fotoBase64, setFotoBase64] = useState('');
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');

  const totalTerpilih = rows.filter((r) => terpilih.has(r.tagihan_id)).reduce((s, r) => s + r.nominal, 0);

  function toggle(id: string) {
    setTerpilih((s) => {
      const baru = new Set(s);
      if (baru.has(id)) baru.delete(id); else baru.add(id);
      return baru;
    });
  }

  async function pilihBerkas() {
    const file = await ambilBerkasInput();
    if (!file) return;
    try {
      setFotoNama(file.name);
      setFotoBase64(await berkasKeBase64(file));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal membaca berkas.');
    }
  }

  async function kirim() {
    if (terpilih.size === 0) { setGalat('Pilih minimal satu taruna.'); return; }
    if (!fotoBase64) { setGalat('Unggah notifikasi/bukti dari bank dulu.'); return; }
    setProses(true); setGalat('');
    try {
      const r = await aksiTulis('tagihan.teruskan_penyedia', {
        tagihan_id_list: Array.from(terpilih),
        berkas: { base64: fotoBase64, nama_file: fotoNama || `bukti-bank-${bulan}.jpg` },
      });
      toast(
        r.antri
          ? 'Disimpan lokal, akan dikirim otomatis saat online.'
          : `${terpilih.size} taruna ditandai selesai — hilang dari daftar tagihan.`,
        'sukses',
      );
      if (!r.antri) onSelesai();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menandai selesai.');
    } finally {
      setProses(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 border-teal-200 bg-teal-50/40 print:hidden">
      <p className="text-sm font-semibold text-primary-dark">
        ✅ Konfirmasi Bank Sudah Proses — {labelBulan(bulan)}
      </p>
      <p className="text-xs text-gray-500">
        Centang taruna yang <b>sudah diproses bank</b> (default semua), lalu unggah notifikasi/bukti dari bank.
        Taruna yang ditandai akan pindah ke <b>Lunas, sudah diteruskan</b> dan hilang dari daftar tagihan aktif.
      </p>
      <div className="flex items-center justify-between text-xs">
        <button className="text-primary" onClick={() => setTerpilih(new Set(rows.map((r) => r.tagihan_id)))}>Pilih semua</button>
        <button className="text-gray-500" onClick={() => setTerpilih(new Set())}>Kosongkan</button>
      </div>
      <div className="flex max-h-52 flex-col gap-1 overflow-y-auto rounded-xl border border-gray-200 p-2">
        {rows.slice().sort(urut).map((r) => (
          <label key={r.tagihan_id} className="flex min-h-tap items-center gap-2 pl-1 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={terpilih.has(r.tagihan_id)} onChange={() => toggle(r.tagihan_id)} />
            <span className="flex-1">{r.nama} · {r.prodi}/{r.tingkat}</span>
            <span className="text-gray-500">{formatRupiah(r.nominal)}</span>
          </label>
        ))}
      </div>
      <p className="text-sm">Total dipilih: <span className="font-bold">{formatRupiah(totalTerpilih)}</span> ({terpilih.size} taruna)</p>
      <Button varian="garis" onClick={() => void pilihBerkas()}>
        {fotoNama ? `📎 ${fotoNama}` : '📎 Unggah Notifikasi/Bukti Bank'}
      </Button>
      {galat && <p className="text-sm text-red-600">{galat}</p>}
      <Button onClick={() => void kirim()} disabled={proses}>
        {proses ? 'Memproses…' : `Tandai ${terpilih.size} Taruna Selesai`}
      </Button>
    </Card>
  );
}

export function HalamanCetakPendebetanPenyedia() {
  const nav = useNavigate();
  const { data, memuat, galat, refresh } = useListCache<PendebetanData>('cetak.pendebetan_penyedia', {});
  const [bank, setBank] = useState<'BNI' | 'BSI'>('BNI');
  const [filterBulan, setFilterBulan] = useState('');
  const [noSurat, setNoSurat] = useState('');

  const baris = data?.baris ?? [];
  const daftarBulan = useMemo(
    () => Array.from(new Set(baris.map((b) => b.bulan))).sort((a, b) => b.localeCompare(a)),
    [baris],
  );
  const grup = useMemo(() => {
    const m = new Map<string, Baris[]>();
    baris.filter((b) => !filterBulan || b.bulan === filterBulan)
      .forEach((b) => { if (!m.has(b.bulan)) m.set(b.bulan, []); m.get(b.bulan)!.push(b); });
    return Array.from(m.entries()).sort((a, c) => a[0].localeCompare(c[0])).map(([bulan, rows]) => ({ bulan, rows }));
  }, [baris, filterBulan]);

  const rekSenat = bank === 'BNI' ? data?.rekening_senat?.BNI : data?.rekening_senat?.BSI;
  const rekSenatNama = bank === 'BNI' ? data?.rekening_senat_nama?.BNI : data?.rekening_senat_nama?.BSI;
  const rekPenyedia = bank === 'BNI' ? data?.rekening_penyedia?.BNI : data?.rekening_penyedia?.BSI;
  const rekPenyediaNama = bank === 'BNI' ? data?.rekening_penyedia_nama?.BNI : data?.rekening_penyedia_nama?.BSI;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <button className="text-sm text-primary" onClick={() => nav(-1)}>← Kembali</button>
        {grup.length > 0 && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak {grup.length} surat</Button>}
      </div>
      <h1 className="text-xl font-bold text-primary-dark print:hidden">Surat Pendebetan Senat → Penyedia (Tagih-Ulang Gagal Debet)</h1>
      <p className="text-xs text-gray-500 print:hidden">
        Dana taruna gagal-debet yang sudah LUNAS (masuk rekening Senat) dan <strong>belum diteruskan</strong> ke penyedia —
        surat ke bank untuk mendebet Senat → Penyedia. Hasil <strong>dibagi per bulan</strong> (tiap bulan surat sendiri).
      </p>

      <div className="flex flex-wrap gap-3 print:hidden">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span>Bank:</span>
          <select value={bank} onChange={(e) => setBank(e.target.value as 'BNI' | 'BSI')}
            className="min-h-tap rounded-xl border border-gray-300 px-3 py-1.5 text-sm">
            <option value="BNI">BNI</option><option value="BSI">BSI</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span>Bulan:</span>
          <select value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)}
            className="min-h-tap rounded-xl border border-gray-300 px-3 py-1.5 text-sm">
            <option value="">Semua bulan (dibagi per bulan)</option>
            {daftarBulan.map((b) => <option key={b} value={b}>{labelBulan(b)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span className="w-24">No. Surat:</span>
          <input value={noSurat} onChange={(e) => setNoSurat(e.target.value)}
            placeholder="B. …/SENAT-TARUNA.POLTEK.KP.SRG/…/2026"
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm" />
        </label>
      </div>

      {memuat && !data && <LoadingSpinner label="Memuat data…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}
      {data && grup.length === 0 && (
        <EmptyState pesan="Tidak ada tagihan LUNAS yang belum diteruskan ke penyedia." />
      )}

      {data && grup.length > 0 && (
        <div className="flex flex-col gap-4">
          {(!rekSenat || !rekPenyedia) && (
            <p className="text-xs text-red-600 print:hidden">
              ⚠️ Rekening Senat/Penyedia {bank} belum diisi — Admin mengisinya lewat <code>setRekeningInstansi()</code> di editor Apps Script.
            </p>
          )}
          {grup.map((g, i) => (
            <div key={g.bulan} className="flex flex-col gap-3">
              <SuratPendebetan bulan={g.bulan} rows={g.rows} bank={bank}
                rekSenat={rekSenat} rekSenatNama={rekSenatNama} rekPenyedia={rekPenyedia} rekPenyediaNama={rekPenyediaNama}
                pejabat={data.pejabat} noSurat={noSurat} pisahHalaman={i > 0} />
              <PanelKonfirmasiBank bulan={g.bulan} rows={g.rows} onSelesai={refresh} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
