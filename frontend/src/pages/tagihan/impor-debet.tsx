// /tagihan/impor-debet (PPK) — impor CSV hasil pendebetan bank (mis. laporan
// Autotran BNI/BSI) lalu tandai gagal debet massal, tanpa isi ulang manual.
// Nama di bank dicocokkan ke NIT via prefix match (pola sama dengan
// taruna-impor-rekening.tsx) — Admin/PPK WAJIB konfirmasi/pilih tiap baris
// sebelum kirim. Baris yang statusnya terbaca "gagal" otomatis dicentang.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BulanPicker, bulanIni } from '../../components/bulan-picker';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useToast } from '../../components/ui/toast';
import { api } from '../../lib/api';
import { bacaFileTeks, deteksiPemisah, parseCsv } from '../../lib/csv';
import { useListCache } from '../../lib/use-list-cache';
import { formatRupiah } from './tipe';
import type { Taruna } from '../taruna/tipe';

const SEBAB = ['SALDO_KURANG', 'GAGAL_DEBET', 'REKENING_BERMASALAH'];

interface BarisImporDebet {
  nama: string; nominal: number; statusMentah: string; keterangan: string;
  nitTerpilih: string; kandidat: { nit: string; nama: string }[];
  dipilih: boolean;
}

interface Kelompok { bank: string; prodi: string; baris: { idx: number; b: BarisImporDebet; t?: Taruna }[] }

/** Normalisasi nama untuk pencocokan: kapital, hapus titik/koma/kutip/strip, rapikan spasi. */
function normalisasiNama(s: string): string {
  return s.toUpperCase().replace(/[.,'’-]/g, '').replace(/\s+/g, ' ').trim();
}

/** Cari indeks kolom header, cocokkan longgar (tanpa spasi/underscore, case-insensitive). */
function cariIndeksKolom(header: string[], ...kandidatNama: string[]): number {
  const rapikan = (s: string) => s.toLowerCase().replace(/[\s_]/g, '');
  const target = kandidatNama.map(rapikan);
  return header.findIndex((h) => target.includes(rapikan(h)));
}

/** Status/keterangan bank yang menandakan debet gagal (mis. "0 PROCESSED" = sukses). */
function terlihatGagal(status: string, keterangan: string): boolean {
  const s = `${status} ${keterangan}`.toLowerCase();
  if (!s.trim()) return false;
  if (/processed/.test(s) && !/(gagal|reject|tidak cukup|tolak)/.test(s)) return false;
  return /(gagal|reject|tidak cukup|tolak|error|err)/.test(s);
}

export function HalamanTagihanImporDebet() {
  const nav = useNavigate();
  const { toast } = useToast();
  const [bulan, setBulan] = useState(bulanIni());
  const rekapQ = useListCache<{ rekap: { nit: string; status: string }[] }>('rekap.get', { bulan });
  const tarunaQ = useListCache<{ taruna: Taruna[] }>('taruna.list', {});
  const daftarTaruna = tarunaQ.data?.taruna ?? [];
  const tarunaByNit = new Map(daftarTaruna.map((t) => [t.nit, t]));

  const [baris, setBaris] = useState<BarisImporDebet[]>([]);
  const [sebab, setSebab] = useState(SEBAB[0]);
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');

  const rekap = rekapQ.data?.rekap ?? [];
  const belumFinal = rekap.length > 0 && rekap[0].status !== 'FINAL';

  function cariKandidat(nama: string): { nit: string; nama: string }[] {
    const target = normalisasiNama(nama);
    if (!target) return [];
    return daftarTaruna
      .filter((t) => normalisasiNama(t.nama).startsWith(target))
      .map((t) => ({ nit: t.nit, nama: t.nama }));
  }

  async function pilihFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const teks = await bacaFileTeks(file);
    const semua = parseCsv(teks, deteksiPemisah(teks));
    if (semua.length < 2) { toast('File CSV kosong atau tidak valid.', 'galat'); return; }

    const header = semua[0].map((h) => h.trim());
    const iNama = cariIndeksKolom(header, 'nama', 'nama di bank');
    const iNom = cariIndeksKolom(header, 'nominal');
    const iStatus = cariIndeksKolom(header, 'status');
    const iKet = cariIndeksKolom(header, 'keterangan', 'err message', 'errmessage');

    if (iNama < 0) {
      toast('Header CSV wajib memuat kolom "nama".', 'galat');
      return;
    }

    const hasil = semua.slice(1).map((row) => {
      const nama = (row[iNama] ?? '').trim();
      const statusMentah = iStatus >= 0 ? (row[iStatus] ?? '').trim() : '';
      const keterangan = iKet >= 0 ? (row[iKet] ?? '').trim() : '';
      const kandidat = cariKandidat(nama);
      const gagal = terlihatGagal(statusMentah, keterangan);
      return {
        nama, nominal: iNom >= 0 ? Number(row[iNom] ?? 0) : 0, statusMentah, keterangan,
        nitTerpilih: kandidat.length === 1 ? kandidat[0].nit : '',
        kandidat, dipilih: gagal
      };
    });
    setBaris(hasil);
  }

  function setNit(i: number, nit: string) {
    setBaris((prev) => prev.map((b, idx) => (idx === i ? { ...b, nitTerpilih: nit } : b)));
  }
  function toggleDipilih(i: number) {
    setBaris((prev) => prev.map((b, idx) => (idx === i ? { ...b, dipilih: !b.dipilih } : b)));
  }

  const kelompok: Kelompok[] = (() => {
    const map = new Map<string, Kelompok>();
    baris.forEach((b, idx) => {
      const t = b.nitTerpilih ? tarunaByNit.get(b.nitTerpilih) : undefined;
      const bank = t?.bank || 'Tanpa Bank';
      const prodi = t?.prodi || 'Tanpa Prodi';
      const key = `${bank}||${prodi}`;
      if (!map.has(key)) map.set(key, { bank, prodi, baris: [] });
      map.get(key)!.baris.push({ idx, b, t });
    });
    const arr = Array.from(map.values());
    arr.forEach((k) => k.baris.sort((a, c) => (a.t?.nama ?? a.b.nama).localeCompare(c.t?.nama ?? c.b.nama, 'id')));
    arr.sort((a, c) => a.bank.localeCompare(c.bank, 'id') || a.prodi.localeCompare(c.prodi, 'id'));
    return arr;
  })();

  const terpilih = baris.filter((b) => b.dipilih && b.nitTerpilih);
  const jmlDobelNit = (() => {
    const hitung: Record<string, number> = {};
    terpilih.forEach((b) => { hitung[b.nitTerpilih] = (hitung[b.nitTerpilih] || 0) + 1; });
    return Object.values(hitung).some((n) => n > 1);
  })();

  async function kirim() {
    if (terpilih.length === 0) { setGalat('Pilih & cocokkan minimal satu baris gagal debet.'); return; }
    if (jmlDobelNit) { setGalat('Ada NIT yang dipilih untuk lebih dari satu baris — perbaiki dulu.'); return; }
    setProses(true); setGalat('');
    try {
      const r = await api<{ tagihan: { tagihan_id: string }[] }>('tagihan.create', {
        bulan, nit: terpilih.map((b) => b.nitTerpilih), sebab
      });
      toast(`${r.tagihan.length} tagihan dicatat, SP-1 terbit otomatis.`, 'sukses');
      nav('/tagihan');
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setProses(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button className="text-sm text-primary" onClick={() => nav('/tagihan')}>← Kembali</button>
      <h1 className="text-xl font-bold text-primary-dark">Impor CSV Hasil Pendebetan</h1>
      <p className="text-xs text-amber-700">
        ⚠️ Nama di laporan bank kadang terpotong/beda ejaan — pencocokan otomatis HANYA usulan
        (awalan nama cocok). Periksa/tentukan NIT tiap baris sebelum kirim. Baris berstatus
        "gagal/tidak cukup/tolak" otomatis dicentang, boleh diubah manual.
      </p>
      <BulanPicker bulan={bulan} onChange={setBulan} />
      {rekapQ.galat && <ErrorMessage pesan={rekapQ.galat} onRetry={rekapQ.refresh} />}
      {belumFinal && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          ⚠️ Rekap bulan ini belum FINAL — finalkan dulu di menu Rekap sebelum menandai gagal debet.
        </p>
      )}

      <Card className="flex flex-col gap-2">
        <p className="text-xs text-gray-500">
          Unggah CSV dengan kolom minimal <code>nama</code> — opsional <code>nominal</code>,{' '}
          <code>status</code>, <code>keterangan</code> (format hasil konversi laporan Autotran bank).
        </p>
        {tarunaQ.memuat && !tarunaQ.data ? (
          <LoadingSpinner label="Memuat daftar Taruna dulu (perlu untuk cocokkan nama)…" />
        ) : (
          <input type="file" accept=".csv,text/csv" onChange={(e) => void pilihFile(e)}
            className="min-h-tap rounded-xl border border-gray-300 px-3 py-2.5 text-sm" />
        )}
      </Card>

      {baris.length > 0 && !belumFinal && (
        <Card className="flex flex-col gap-3">
          <label className="block text-sm font-medium text-gray-700">Sebab (dipakai untuk semua yang dicentang)</label>
          <select value={sebab} onChange={(e) => setSebab(e.target.value)}
            className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5">
            {SEBAB.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>

          <div className="flex items-center justify-between text-sm">
            <span className="text-green-700">{terpilih.length} dari {baris.length} baris akan ditandai gagal debet</span>
          </div>
          {jmlDobelNit && <p className="text-xs text-red-600">⚠️ Ada NIT yang sama dipilih untuk lebih dari satu baris.</p>}

          <div className="flex max-h-[32rem] flex-col gap-3 overflow-y-auto rounded-xl border border-gray-200 p-2">
            {kelompok.map((k) => (
              <div key={`${k.bank}||${k.prodi}`} className="flex flex-col gap-1">
                <p className="rounded-lg bg-primary-light px-2 py-1 text-xs font-semibold text-primary-dark">
                  {k.bank} · {k.prodi}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500">
                        <th className="w-6 py-1"></th>
                        <th className="py-1 pr-2">Nama di Bank</th>
                        <th className="py-1 pr-2 text-right">Nominal</th>
                        <th className="py-1 pr-2">Status</th>
                        <th className="py-1">Cocokkan ke Taruna</th>
                      </tr>
                    </thead>
                    <tbody>
                      {k.baris.map(({ idx, b }) => (
                        <tr key={idx} className={`border-b border-gray-100 ${!b.nitTerpilih ? 'bg-amber-50' : ''}`}>
                          <td className="py-1">
                            <input type="checkbox" className="h-4 w-4" checked={b.dipilih} onChange={() => toggleDipilih(idx)} />
                          </td>
                          <td className="py-1 pr-2">{b.nama}</td>
                          <td className="py-1 pr-2 text-right">{b.nominal ? formatRupiah(b.nominal) : '-'}</td>
                          <td className="py-1 pr-2">
                            {b.statusMentah || b.keterangan ? (
                              <span className={terlihatGagal(b.statusMentah, b.keterangan) ? 'text-red-600' : 'text-green-700'}>
                                {b.keterangan || b.statusMentah}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-1">
                            <select value={b.nitTerpilih} onChange={(e) => setNit(idx, e.target.value)}
                              className="w-full rounded border border-gray-300 px-1 py-1">
                              <option value="">— pilih taruna —</option>
                              {b.kandidat.length > 0 && (
                                <optgroup label="Usulan (cocok awalan nama)">
                                  {b.kandidat.map((kd) => <option key={kd.nit} value={kd.nit}>{kd.nama} ({kd.nit})</option>)}
                                </optgroup>
                              )}
                              <optgroup label="Semua Taruna">
                                {daftarTaruna.map((t) => <option key={t.nit} value={t.nit}>{t.nama} ({t.nit})</option>)}
                              </optgroup>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {galat && <p className="text-sm text-red-600">{galat}</p>}
          <Button varian="bahaya" onClick={() => void kirim()} disabled={proses || terpilih.length === 0 || jmlDobelNit}>
            {proses ? 'Memproses…' : `Tandai ${terpilih.length} Taruna Gagal Debet`}
          </Button>
        </Card>
      )}
    </div>
  );
}
