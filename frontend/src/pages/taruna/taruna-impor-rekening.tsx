// /taruna/impor-rekening (ADMIN SAJA) — impor massal rekening lengkap. Dua
// format CSV didukung:
//  1) Sudah ada kolom "nit" (mis. hasil pencocokan eksternal Firdaus) → NIT
//     dipakai LANGSUNG, tidak ada tebakan.
//  2) Tanpa "nit", hanya "Nama di Bank" (mis. laporan Autotran mentah) — nama
//     di laporan bank biasanya TERPOTONG, jadi pencocokan otomatis HANYA
//     USULAN (prefix match); Admin WAJIB konfirmasi/pilih manual per baris.
// Kedua format tetap harus direview di tabel sebelum disimpan — tidak ada
// yang otomatis tersimpan tanpa tampil dulu. Satu-satunya pintu tulis
// TARUNA_REKENING tetap rekening.simpan_batch (sama seperti modal 🔒 Rekening).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useToast } from '../../components/ui/toast';
import { api } from '../../lib/api';
import { bacaFileTeks, parseCsv } from '../../lib/csv';
import { useListCache } from '../../lib/use-list-cache';
import { formatRupiah } from '../tagihan/tipe';
import type { Taruna } from './tipe';

const BANK = ['BNI', 'BSI'];

interface BarisImporRekening {
  rekening: string; nominal: number; status: string; namaBank: string;
  bankBaris: string; // kosong = pakai selector Bank global
  nitTerpilih: string; kandidat: { nit: string; nama: string }[]; sumberLangsung: boolean;
}

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

export function HalamanTarunaImporRekening() {
  const nav = useNavigate();
  const { toast } = useToast();
  const tarunaQ = useListCache<{ taruna: Taruna[] }>('taruna.list', {});
  const daftarTaruna = (tarunaQ.data?.taruna ?? []).slice().sort((a, b) => a.nama.localeCompare(b.nama));

  const [bank, setBank] = useState<'BNI' | 'BSI'>('BNI');
  const [baris, setBaris] = useState<BarisImporRekening[]>([]);
  const [proses, setProses] = useState(false);

  function cariKandidat(namaBank: string): { nit: string; nama: string }[] {
    const target = normalisasiNama(namaBank);
    if (!target) return [];
    return daftarTaruna
      .filter((t) => normalisasiNama(t.nama).startsWith(target))
      .map((t) => ({ nit: t.nit, nama: t.nama }));
  }

  async function pilihFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const teks = await bacaFileTeks(file);
    const semua = parseCsv(teks);
    if (semua.length < 2) { toast('File CSV kosong atau tidak valid.', 'galat'); return; }

    const header = semua[0].map((h) => h.trim());
    const iNit = cariIndeksKolom(header, 'nit');
    const iRek = cariIndeksKolom(header, 'rekening', 'rekening_banksp2d', 'no_rekening_lengkap');
    const iNom = cariIndeksKolom(header, 'nominal');
    const iStatus = cariIndeksKolom(header, 'status', 'status_lengkap');
    const iNama = cariIndeksKolom(header, 'nama di bank', 'nama');
    const iBank = cariIndeksKolom(header, 'bank');
    const namaByNit = new Map(daftarTaruna.map((t) => [t.nit, t.nama]));

    if (iRek < 0) {
      toast('Header CSV wajib memuat kolom Rekening (atau "Rekening_BankSP2D").', 'galat');
      return;
    }

    if (iNit >= 0) {
      // ── Format langsung: NIT sudah dicocokkan sebelumnya (mis. eksternal) ──
      const hasil = semua.slice(1).map((row) => {
        const nit = (row[iNit] ?? '').trim();
        const namaTaruna = namaByNit.get(nit) ?? (iNama >= 0 ? (row[iNama] ?? '').trim() : '');
        return {
          rekening: (row[iRek] ?? '').trim(),
          nominal: iNom >= 0 ? Number(row[iNom] ?? 0) : 0,
          status: iStatus >= 0 ? (row[iStatus] ?? '').trim() : '',
          namaBank: namaTaruna,
          bankBaris: iBank >= 0 ? (row[iBank] ?? '').trim() : '',
          nitTerpilih: nit,
          kandidat: nit ? [{ nit, nama: namaTaruna || nit }] : [],
          sumberLangsung: true
        };
      });
      setBaris(hasil);
      return;
    }

    if (iNama < 0) {
      toast('Header CSV wajib memuat kolom "nit" ATAU "Nama di Bank" untuk pencocokan.', 'galat');
      return;
    }

    // ── Format lama: hanya nama (mis. laporan Autotran mentah) — perlu pencocokan ──
    const hasil = semua.slice(1).map((row) => {
      const namaBank = (row[iNama] ?? '').trim();
      const kandidat = cariKandidat(namaBank);
      return {
        rekening: (row[iRek] ?? '').trim(),
        nominal: iNom >= 0 ? Number(row[iNom] ?? 0) : 0,
        status: iStatus >= 0 ? (row[iStatus] ?? '').trim() : '',
        namaBank,
        bankBaris: iBank >= 0 ? (row[iBank] ?? '').trim() : '',
        nitTerpilih: kandidat.length === 1 ? kandidat[0].nit : '',
        kandidat,
        sumberLangsung: false
      };
    });
    setBaris(hasil);
  }

  function setNit(i: number, nit: string) {
    setBaris((prev) => prev.map((b, idx) => (idx === i ? { ...b, nitTerpilih: nit } : b)));
  }

  const jmlTerpilih = baris.filter((b) => b.nitTerpilih).length;
  const jmlDobelNit = (() => {
    const hitung: Record<string, number> = {};
    baris.forEach((b) => { if (b.nitTerpilih) hitung[b.nitTerpilih] = (hitung[b.nitTerpilih] || 0) + 1; });
    return Object.values(hitung).some((n) => n > 1);
  })();

  async function simpanBatch() {
    if (jmlTerpilih === 0) { toast('Belum ada baris yang dicocokkan ke NIT.', 'galat'); return; }
    if (jmlDobelNit) { toast('Ada NIT yang dipilih untuk lebih dari satu baris — perbaiki dulu.', 'galat'); return; }
    const bankTidakValid = baris.find((b) => b.nitTerpilih && b.bankBaris && BANK.indexOf(b.bankBaris) < 0);
    if (bankTidakValid) { toast(`Nilai bank tidak valid: "${bankTidakValid.bankBaris}" (harus BNI/BSI).`, 'galat'); return; }
    setProses(true);
    try {
      const namaByNit = new Map(daftarTaruna.map((t) => [t.nit, t.nama]));
      const hasil = await api<{ disimpan: number }>('rekening.simpan_batch', {
        baris: baris.filter((b) => b.nitTerpilih).map((b) => ({
          nit: b.nitTerpilih, no_rekening_lengkap: b.rekening, bank: b.bankBaris || bank,
          nama_pemilik: namaByNit.get(b.nitTerpilih) ?? b.namaBank
        }))
      });
      toast(`${hasil.disimpan} rekening tersimpan.`, 'sukses');
      setBaris([]);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menyimpan.', 'galat');
    } finally {
      setProses(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button className="text-sm text-primary" onClick={() => nav('/taruna')}>← Kembali</button>
      <h1 className="text-xl font-bold text-primary-dark">Impor Rekening dari Laporan Bank</h1>
      <p className="text-xs text-amber-700">
        ⚠️ Data sensitif — kalau CSV punya kolom "nit", itu dipakai langsung tanpa tebakan.
        Kalau tidak, pencocokan nama HANYA usulan (nama di laporan bank biasanya terpotong) —
        periksa/tentukan NIT tiap baris sebelum menyimpan.
      </p>

      <Card className="flex flex-col gap-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Bank Bawaan (kalau CSV tidak punya kolom bank sendiri)</label>
          <select value={bank} onChange={(e) => setBank(e.target.value as 'BNI' | 'BSI')}
            className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5">
            {BANK.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <p className="text-xs text-gray-500">
          Unggah CSV — dua format didukung: (1) sudah ada kolom <code>nit</code> + <code>rekening</code>
          (+ <code>bank</code> opsional per baris), atau (2) hasil konversi laporan Autotran mentah
          (header: Rekening, Nominal, Status, Nama di Bank).
        </p>
        {tarunaQ.memuat && !tarunaQ.data ? (
          <LoadingSpinner label="Memuat daftar Taruna dulu (perlu untuk cocokkan nama)…" />
        ) : (
          <input type="file" accept=".csv,text/csv" onChange={(e) => void pilihFile(e)}
            className="min-h-tap rounded-xl border border-gray-300 px-3 py-2.5 text-sm" />
        )}
      </Card>

      {baris.length > 0 && (
        <Card className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-green-700">{jmlTerpilih} dari {baris.length} baris sudah dicocokkan</span>
          </div>
          {jmlDobelNit && (
            <p className="text-xs text-red-600">⚠️ Ada NIT yang sama dipilih untuk lebih dari satu baris.</p>
          )}
          <div className="max-h-[32rem] overflow-y-auto overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-1 pr-2">Nama</th><th className="py-1 pr-2">Rekening</th>
                  <th className="py-1 pr-2">Bank</th>
                  <th className="py-1 pr-2 text-right">Nominal</th><th className="py-1 pr-2">Status</th>
                  <th className="py-1">Cocokkan ke Taruna</th>
                </tr>
              </thead>
              <tbody>
                {baris.map((b, i) => (
                  <tr key={i} className={`border-b border-gray-100 ${!b.nitTerpilih ? 'bg-amber-50' : b.sumberLangsung ? 'bg-green-50' : ''}`}>
                    <td className="py-1 pr-2">{b.namaBank}</td>
                    <td className="py-1 pr-2">{b.rekening}</td>
                    <td className="py-1 pr-2">{b.bankBaris || bank}</td>
                    <td className="py-1 pr-2 text-right">{b.nominal ? formatRupiah(b.nominal) : '-'}</td>
                    <td className="py-1 pr-2">
                      {b.status ? (
                        <span className={/gagal/i.test(b.status) ? 'text-red-600' : 'text-green-700'}>{b.status}</span>
                      ) : '-'}
                    </td>
                    <td className="py-1">
                      <select value={b.nitTerpilih} onChange={(e) => setNit(i, e.target.value)}
                        className="w-full rounded border border-gray-300 px-1 py-1">
                        <option value="">— pilih taruna —</option>
                        {b.kandidat.length > 0 && (
                          <optgroup label={b.sumberLangsung ? 'Dari file (langsung)' : 'Usulan (cocok awalan nama)'}>
                            {b.kandidat.map((k) => <option key={k.nit} value={k.nit}>{k.nama} ({k.nit})</option>)}
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
          <Button onClick={() => void simpanBatch()} disabled={proses || jmlTerpilih === 0 || jmlDobelNit}>
            {proses ? 'Menyimpan…' : `Simpan ${jmlTerpilih} Rekening`}
          </Button>
        </Card>
      )}
    </div>
  );
}
