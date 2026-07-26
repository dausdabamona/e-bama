// /cetak/taruna-keluar (ADMIN, PPK, STAF_PPK) — Menu "Taruna Keluar Kampus".
// Dokumen KUASA DEBET rekening taruna yang keluar di tengah bulan (wisuda/magang/
// pindah), ditandatangani tiap taruna, nominal bulan berjalan. Menampilkan nomor
// rekening PENUH (cetak.kuasa_debet_keluar) → TIDAK di-cache Dexie (pola form-07).
// Sekaligus menandai keluar: PERMANEN (tgl_keluar) / SEMENTARA (PERIODE_LUAR auto-
// kembali) lewat taruna.tandai_keluar.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { BulanPicker, bulanIni, labelBulan } from '../../components/bulan-picker';
import { BlokTtd2Kolom, BlokTtdTengah } from '../../components/cetak/blok-ttd';
import { KopSurat } from '../../components/cetak/kop-surat';
import { SelCetak } from '../../components/cetak/tabel-cetak';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useToast } from '../../components/ui/toast';
import { api } from '../../lib/api';
import { useListCache } from '../../lib/use-list-cache';
import { terbilangRupiah } from '../../lib/terbilang';
import { formatRupiah } from '../tagihan/tipe';
import type { Taruna } from '../taruna/tipe';
import {
  type BarisKuasaDebet, kelompokBank, kelompokProdiTingkat, unduhExcelBank
} from './kuasa-debet-bersama';

interface Pejabat { nama: string; nip: string }
interface DokKeluar {
  bulan: string; basis?: 'REKAP' | 'PESANAN'; baris: BarisKuasaDebet[]; total_nominal: number; biaya_admin_bank: number;
  pejabat: { PPK: Pejabat; KPA: Pejabat; DIREKTUR: Pejabat; WADIR3: Pejabat };
  rekening_senat?: { BNI?: string; BSI?: string };
  rekening_senat_nama?: { BNI?: string; BSI?: string };
}

const STATUS_KEGIATAN = ['MAGANG', 'PKL_1', 'PKL_2', 'PKL_3', 'KPA', 'PTB'];
const ALASAN = ['LULUS', 'PINDAH', 'DO'];

/** Satu surat kuasa debet untuk SATU bank (BNI/BSI/tanpa rekening). */
function SuratKuasaBank({ bank, rows, bulan, keperluan, pejabat, rekSenat, rekSenatNama, pisahHalaman, basis }: {
  bank: string; rows: BarisKuasaDebet[]; bulan: string; keperluan: string; pejabat: DokKeluar['pejabat'];
  rekSenat?: string; rekSenatNama?: string; pisahHalaman: boolean; basis?: 'REKAP' | 'PESANAN';
}) {
  const total = rows.reduce((s, b) => s + b.nilai_debet, 0);
  const labelBank = bank === 'TANPA_REKENING' ? 'BELUM ADA REKENING' : bank;
  return (
    <div className={`${pisahHalaman ? 'break-before-page ' : ''}flex flex-col gap-2`}>
      <KopSurat />
      <div className="text-center">
        <h2 className="text-sm font-bold">SURAT KUASA DEBET REKENING TARUNA (KELUAR KAMPUS)</h2>
        <p className="text-xs">Bank {labelBank} · Bulan {labelBulan(bulan)}{keperluan ? ` · Keperluan: ${keperluan}` : ''}</p>
      </div>
      <p className="text-xs">
        Yang bertanda tangan pada kolom terakhir adalah taruna yang <strong>keluar kampus</strong>
        {keperluan ? ` (${keperluan})` : ''} dan dengan ini memberi <strong>kuasa kepada Bank {labelBank}</strong> untuk
        mendebet dana bantuan biaya makan bulan {labelBulan(bulan)} sesuai nilai per orang di bawah ini ke
        <strong> Rekening Senat Taruna {bank}</strong> ({rekSenat || '…… belum diisi Admin'}
        {rekSenatNama ? ` a.n. ${rekSenatNama}` : ''}).
      </p>
      {basis === 'PESANAN' && (
        <p className="text-xs">
          <strong>Dasar nilai: PESANAN (proyeksi).</strong> Nilai di bawah dihitung dari pesanan makan
          harian yang sudah final bulan {labelBulan(bulan)} karena rekap realisasi bulan berjalan belum
          disahkan. <strong>Nilai final yang didebet mengikuti rekap bulan {labelBulan(bulan)} yang
          disahkan</strong> (permohonan pendebetan resmi ke bank / Form-07); bila nilai final lebih kecil,
          yang didebet nilai final.
        </p>
      )}
      <table className="w-full table-fixed border-collapse text-xs">
        <colgroup>
          <col style={{ width: '5%' }} /><col style={{ width: '13%' }} /><col style={{ width: '20%' }} />
          <col style={{ width: '15%' }} /><col style={{ width: '15%' }} /><col style={{ width: '32%' }} />
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
          let no = 0;
          return (
            <tbody key={`${pt.prodi}|${pt.tingkat}`}>
              <tr className="bg-primary-light/30 print:bg-gray-100">
                <td colSpan={6} className="border border-gray-300 px-2 py-1 font-semibold text-primary-dark print:text-black">
                  {pt.prodi} / {pt.tingkat}
                </td>
              </tr>
              {pt.rows.map((b) => {
                no += 1;
                return (
                  <tr key={b.nit}>
                    <SelCetak>{no}</SelCetak>
                    <SelCetak>{b.nit}</SelCetak>
                    <SelCetak>{b.nama}</SelCetak>
                    <SelCetak>{b.rekening_lengkap_ada ? b.no_rekening_lengkap : <span className="text-red-600">BELUM DIISI ADMIN</span>}</SelCetak>
                    <SelCetak className="text-right">{formatRupiah(b.nilai_debet)}</SelCetak>
                    <td className="border border-gray-400 px-2 py-6" />
                  </tr>
                );
              })}
              <tr>
                <td colSpan={4} className="border border-gray-400 px-2 py-1 text-right font-semibold">Subtotal {pt.prodi}/{pt.tingkat} ({pt.rows.length})</td>
                <td className="border border-gray-400 px-2 py-1 text-right font-semibold">{formatRupiah(subtotalPt)}</td>
                <td className="border border-gray-400" />
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
      <div className="mt-4">
        <BlokTtd2Kolom
          kiri={{ label: 'Ketua Senat Taruna,', jabatan: 'Politeknik KP Sorong' }}
          kanan={{ label: 'Wakil Direktur III,', jabatan: 'Bidang Kemahasiswaan', nama: pejabat.WADIR3.nama, nip: pejabat.WADIR3.nip }}
        />
        <BlokTtdTengah pihak={{ label: 'Direktur,', jabatan: 'Politeknik KP Sorong', nama: pejabat.DIREKTUR.nama, nip: pejabat.DIREKTUR.nip }} />
      </div>
    </div>
  );
}

export function HalamanTarunaKeluar() {
  const nav = useNavigate();
  const { session } = useAuth();
  const { toast } = useToast();
  const bisaTandai = session?.role === 'ADMIN' || session?.role === 'PPK';

  const [bulan, setBulan] = useState(bulanIni());
  const tarunaQ = useListCache<{ taruna: Taruna[] }>('taruna.list', { status: 'AKTIF' });
  const semua = useMemo(() => (tarunaQ.data?.taruna ?? []).filter((t) => !t.tgl_keluar), [tarunaQ.data]);

  const [fTingkat, setFTingkat] = useState('');
  const [fProdi, setFProdi] = useState('');
  const [fKelas, setFKelas] = useState('');
  const [cari, setCari] = useState('');
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [keperluan, setKeperluan] = useState('');

  const tingkatOpsi = useMemo(() => Array.from(new Set(semua.map((t) => t.tingkat).filter(Boolean))).sort(), [semua]);
  const prodiOpsi = useMemo(() => Array.from(new Set(semua.map((t) => t.prodi).filter(Boolean))).sort(), [semua]);
  const kelasOpsi = useMemo(() => Array.from(new Set(semua.map((t) => t.kelas).filter(Boolean))).sort(), [semua]);

  const terfilter = useMemo(() => semua.filter((t) => {
    if (fTingkat && t.tingkat !== fTingkat) return false;
    if (fProdi && t.prodi !== fProdi) return false;
    if (fKelas && t.kelas !== fKelas) return false;
    if (cari) { const q = cari.toLowerCase(); if (!t.nama.toLowerCase().includes(q) && !t.nit.includes(q)) return false; }
    return true;
  }).sort((a, b) => a.nama.localeCompare(b.nama, 'id')), [semua, fTingkat, fProdi, fKelas, cari]);

  function toggle(nit: string) {
    setPilih((s) => { const n = new Set(s); if (n.has(nit)) n.delete(nit); else n.add(nit); return n; });
  }
  function pilihSemua() { setPilih((s) => { const n = new Set(s); terfilter.forEach((t) => n.add(t.nit)); return n; }); }
  function kosongkan() { setPilih(new Set()); }

  // ── Dokumen (sensitif — dipanggil manual saat tombol, tidak auto/cache) ──
  const [dok, setDok] = useState<DokKeluar | null>(null);
  const [prosesDok, setProsesDok] = useState(false);
  // Dasar nilai: REKAP (realisasi sah — default) atau PESANAN (proyeksi, utk
  // wisuda saat rekap bulan berjalan belum terbentuk; dokumen diberi label).
  const [basis, setBasis] = useState<'REKAP' | 'PESANAN'>('REKAP');
  async function buatDokumen() {
    if (!pilih.size) { toast('Pilih taruna dulu.', 'galat'); return; }
    setProsesDok(true); setDok(null);
    try {
      const r = await api<DokKeluar>('cetak.kuasa_debet_keluar', { bulan, nit_list: Array.from(pilih), basis });
      setDok(r);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal membuat dokumen.', 'galat');
    } finally { setProsesDok(false); }
  }

  // ── Tandai keluar ──
  const [jenis, setJenis] = useState<'PERMANEN' | 'SEMENTARA'>('PERMANEN');
  const [alasan, setAlasan] = useState('LULUS');
  const [statusKeg, setStatusKeg] = useState('MAGANG');
  const [tglKeluar, setTglKeluar] = useState('');
  const [tglKembali, setTglKembali] = useState('');
  const [prosesTandai, setProsesTandai] = useState(false);

  async function tandaiKeluar() {
    if (!pilih.size) { toast('Pilih taruna dulu.', 'galat'); return; }
    if (!tglKeluar) { toast('Isi tanggal keluar.', 'galat'); return; }
    if (jenis === 'SEMENTARA' && !tglKembali) { toast('Isi tanggal kembali (keluar sementara).', 'galat'); return; }
    const label = jenis === 'PERMANEN' ? `keluar PERMANEN (${alasan})` : `${statusKeg} s.d ${tglKembali}`;
    if (!window.confirm(`Tandai ${pilih.size} taruna ${label}?\nPermanen: tak ikut rekap bulan berikutnya. Sementara: otomatis kembali setelah tanggal kembali.`)) return;
    setProsesTandai(true);
    try {
      const payload: Record<string, unknown> = { jenis, nit_list: Array.from(pilih), tgl_keluar: tglKeluar };
      if (jenis === 'PERMANEN') payload.alasan = alasan;
      else { payload.status_kegiatan = statusKeg; payload.tgl_kembali = tglKembali; }
      const r = await api<{ jumlah: number }>('taruna.tandai_keluar', payload);
      toast(`${r.jumlah ?? pilih.size} taruna ditandai keluar.`, 'sukses');
      tarunaQ.refresh?.();
      setPilih(new Set());
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menandai.', 'galat');
    } finally { setProsesTandai(false); }
  }

  const adaTanpaRek = (dok?.baris ?? []).some((b) => !b.rekening_lengkap_ada);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <button className="text-sm text-primary" onClick={() => nav(-1)}>← Kembali</button>
        {dok && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak</Button>}
      </div>
      <h1 className="text-xl font-bold text-primary-dark print:hidden">Taruna Keluar Kampus (Wisuda / Magang / Pindah)</h1>
      <p className="text-xs text-amber-700 print:hidden">
        ⚠️ Dokumen menampilkan nomor rekening LENGKAP — akses ADMIN/PPK, tercatat di Log Audit, tidak disimpan di perangkat.
      </p>

      {/* Pemilihan taruna */}
      <Card className="flex flex-col gap-3 print:hidden">
        <BulanPicker bulan={bulan} onChange={setBulan} />
        <div className="grid grid-cols-3 gap-2">
          <select value={fTingkat} onChange={(e) => setFTingkat(e.target.value)} className="rounded border border-gray-300 px-2 py-2 text-sm">
            <option value="">Semua Tingkat</option>
            {tingkatOpsi.map((t) => <option key={t} value={t}>Tk.{t}</option>)}
          </select>
          <select value={fProdi} onChange={(e) => setFProdi(e.target.value)} className="rounded border border-gray-300 px-2 py-2 text-sm">
            <option value="">Semua Prodi</option>
            {prodiOpsi.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={fKelas} onChange={(e) => setFKelas(e.target.value)} className="rounded border border-gray-300 px-2 py-2 text-sm">
            <option value="">Semua Kelas</option>
            {kelasOpsi.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <Input label="Cari nama/NIT" value={cari} onChange={(e) => setCari(e.target.value)} />
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">{pilih.size} dipilih · {terfilter.length} tampil</span>
          <div className="flex gap-2">
            <Button varian="garis" className="px-3 text-xs" onClick={pilihSemua}>Pilih Semua (terfilter)</Button>
            <Button varian="polos" className="px-3 text-xs" onClick={kosongkan}>Kosongkan</Button>
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto rounded border border-gray-200">
          {terfilter.map((t) => (
            <label key={t.nit} className="flex min-h-tap items-center gap-2 border-b border-gray-100 px-2 py-1 text-sm">
              <input type="checkbox" checked={pilih.has(t.nit)} onChange={() => toggle(t.nit)} className="h-5 w-5" />
              <span className="flex-1">{t.nama} <span className="text-gray-400">· {t.nit} · Tk.{t.tingkat} {t.kelas}</span></span>
            </label>
          ))}
          {!terfilter.length && <p className="p-3 text-sm text-gray-400">Tak ada taruna cocok filter.</p>}
        </div>
        <Input label="Keperluan (tampil di dokumen, mis. Wisuda / Magang)" value={keperluan} onChange={(e) => setKeperluan(e.target.value)} />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Dasar Nilai</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" varian={basis === 'REKAP' ? 'utama' : 'garis'} className="flex-1"
              onClick={() => { setBasis('REKAP'); setDok(null); }}>
              Rekap (realisasi sah)
            </Button>
            <Button type="button" varian={basis === 'PESANAN' ? 'utama' : 'garis'} className="flex-1"
              onClick={() => { setBasis('PESANAN'); setDok(null); }}>
              Pesanan (proyeksi)
            </Button>
          </div>
          {basis === 'PESANAN' && (
            <p className="mt-1 text-xs text-amber-700">
              ⚠️ Nilai proyeksi dari pesanan final — dipakai bila rekap bulan berjalan belum
              disahkan (mis. wisuda sebelum tutup bulan). Dokumen diberi label; nilai final
              yang didebet tetap mengikuti rekap yang disahkan.
            </p>
          )}
        </div>
        <Button onClick={() => void buatDokumen()} disabled={prosesDok || !pilih.size}>
          {prosesDok ? 'Memproses…' : `📄 Buat Dokumen Kuasa Debet (${pilih.size})`}
        </Button>
      </Card>

      {/* Panel Tandai keluar */}
      {bisaTandai && (
        <Card className="flex flex-col gap-3 print:hidden">
          <p className="text-sm font-semibold text-gray-700">Tandai Keluar ({pilih.size} taruna terpilih)</p>
          <div className="flex gap-2">
            {(['PERMANEN', 'SEMENTARA'] as const).map((j) => (
              <Button key={j} type="button" varian={jenis === j ? 'utama' : 'garis'} className="flex-1"
                onClick={() => setJenis(j)}>
                {j === 'PERMANEN' ? 'Permanen (Lulus/Pindah/DO)' : 'Sementara (Magang/PKL)'}
              </Button>
            ))}
          </div>
          {jenis === 'PERMANEN' ? (
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-2 text-sm">Alasan:
                <select value={alasan} onChange={(e) => setAlasan(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm">
                  {ALASAN.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">Tgl keluar:
                <input type="date" value={tglKeluar} onChange={(e) => setTglKeluar(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm" />
              </label>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-2 text-sm">Kegiatan:
                <select value={statusKeg} onChange={(e) => setStatusKeg(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm">
                  {STATUS_KEGIATAN.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">Tgl keluar:
                <input type="date" value={tglKeluar} onChange={(e) => setTglKeluar(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm" />
              </label>
              <label className="flex items-center gap-2 text-sm">Tgl kembali:
                <input type="date" value={tglKembali} onChange={(e) => setTglKembali(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm" />
              </label>
            </div>
          )}
          <p className="text-xs text-gray-500">
            {jenis === 'PERMANEN'
              ? 'Bulan keluar tetap terhitung; otomatis TIDAK ikut rekap bulan berikutnya.'
              : 'Dibuatkan periode luar kampus — otomatis kembali (ikut rekap lagi) setelah tanggal kembali.'}
          </p>
          <Button onClick={() => void tandaiKeluar()} disabled={prosesTandai || !pilih.size}>
            {prosesTandai ? 'Menandai…' : `✅ Tandai ${pilih.size} Taruna Keluar`}
          </Button>
        </Card>
      )}

      {/* Dokumen */}
      {dok && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 print:hidden">
            <p className="text-xs font-semibold text-gray-600">Data untuk Bank (buka di Excel):</p>
            <div className="flex flex-wrap gap-2">
              {kelompokBank(dok.baris).map((g) => (
                <Button key={g.bank} varian="garis"
                  onClick={() => unduhExcelBank(g.bank, g.rows, dok.bulan,
                    g.bank === 'BNI' ? dok.rekening_senat?.BNI : g.bank === 'BSI' ? dok.rekening_senat?.BSI : '',
                    g.bank === 'BNI' ? dok.rekening_senat_nama?.BNI : g.bank === 'BSI' ? dok.rekening_senat_nama?.BSI : '',
                    'KuasaDebet-Keluar')}>
                  ⬇️ Excel Bank {g.bank === 'TANPA_REKENING' ? '(Tanpa Rekening)' : g.bank} ({g.rows.length})
                </Button>
              ))}
            </div>
          </div>
          {adaTanpaRek && (
            <p className="text-xs text-red-600 print:hidden">
              ⚠️ Ada taruna terpilih yang rekening lengkapnya belum diisi Admin — lengkapi dulu di Data Taruna (🔒 Rekening).
            </p>
          )}
          {kelompokBank(dok.baris).map((g, i) => (
            <SuratKuasaBank key={g.bank} bank={g.bank} rows={g.rows} bulan={dok.bulan} keperluan={keperluan}
              pejabat={dok.pejabat} pisahHalaman={i > 0} basis={dok.basis}
              rekSenat={g.bank === 'BNI' ? dok.rekening_senat?.BNI : g.bank === 'BSI' ? dok.rekening_senat?.BSI : ''}
              rekSenatNama={g.bank === 'BNI' ? dok.rekening_senat_nama?.BNI : g.bank === 'BSI' ? dok.rekening_senat_nama?.BSI : ''} />
          ))}
        </div>
      )}
    </div>
  );
}
