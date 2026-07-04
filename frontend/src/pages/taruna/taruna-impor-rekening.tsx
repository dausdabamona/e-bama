// /taruna/impor-rekening (ADMIN SAJA) — impor massal rekening lengkap dari
// laporan Autotran bank (mis. BNI), dicocokkan ke NIT taruna. Nama di laporan
// bank biasanya TERPOTONG (~16-17 karakter) — pencocokan otomatis hanya
// sebagai USULAN (prefix match), Admin WAJIB konfirmasi/pilih manual per
// baris sebelum disimpan. Data yang tersimpan HANYA rekening.simpan_batch
// (satu-satunya pintu tulis TARUNA_REKENING, sama seperti modal 🔒 Rekening).
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
  nitTerpilih: string; kandidat: { nit: string; nama: string }[];
}

/** Normalisasi nama untuk pencocokan: kapital, hapus titik/koma/kutip/strip, rapikan spasi. */
function normalisasiNama(s: string): string {
  return s.toUpperCase().replace(/[.,'’-]/g, '').replace(/\s+/g, ' ').trim();
}

export function HalamanTarunaImporRekening() {
  const nav = useNavigate();
  const { toast } = useToast();
  const tarunaQ = useListCache<{ taruna: Taruna[] }>('taruna.list', {});
  const daftarTaruna = tarunaQ.data?.taruna ?? [];

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

    const header = semua[0].map((h) => h.trim().toLowerCase());
    const iRek = header.indexOf('rekening');
    const iNom = header.indexOf('nominal');
    const iStatus = header.indexOf('status');
    const iNama = header.indexOf('nama di bank');
    if (iRek < 0 || iNom < 0 || iNama < 0) {
      toast('Header CSV wajib memuat: Rekening, Nominal, Status, Nama di Bank.', 'galat');
      return;
    }

    const hasil = semua.slice(1).map((row) => {
      const namaBank = (row[iNama] ?? '').trim();
      const kandidat = cariKandidat(namaBank);
      return {
        rekening: (row[iRek] ?? '').trim(),
        nominal: Number(row[iNom] ?? 0),
        status: iStatus >= 0 ? (row[iStatus] ?? '').trim() : '',
        namaBank,
        nitTerpilih: kandidat.length === 1 ? kandidat[0].nit : '',
        kandidat
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
    setProses(true);
    try {
      const namaByNit = new Map(daftarTaruna.map((t) => [t.nit, t.nama]));
      const hasil = await api<{ disimpan: number }>('rekening.simpan_batch', {
        baris: baris.filter((b) => b.nitTerpilih).map((b) => ({
          nit: b.nitTerpilih, no_rekening_lengkap: b.rekening, bank,
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
        ⚠️ Data sensitif — nama di laporan bank biasanya terpotong, jadi pencocokan otomatis
        HANYA usulan. Periksa/tentukan NIT tiap baris sebelum menyimpan.
      </p>

      <Card className="flex flex-col gap-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Bank Sumber Laporan</label>
          <select value={bank} onChange={(e) => setBank(e.target.value as 'BNI' | 'BSI')}
            className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5">
            {BANK.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <p className="text-xs text-gray-500">
          Unggah CSV hasil konversi laporan Autotran bank — header: Rekening, Nominal, Status, Nama di Bank.
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
                  <th className="py-1 pr-2">Nama di Bank</th><th className="py-1 pr-2">Rekening</th>
                  <th className="py-1 pr-2 text-right">Nominal</th><th className="py-1 pr-2">Status</th>
                  <th className="py-1">Cocokkan ke Taruna</th>
                </tr>
              </thead>
              <tbody>
                {baris.map((b, i) => (
                  <tr key={i} className={`border-b border-gray-100 ${b.nitTerpilih ? '' : 'bg-amber-50'}`}>
                    <td className="py-1 pr-2">{b.namaBank}</td>
                    <td className="py-1 pr-2">{b.rekening}</td>
                    <td className="py-1 pr-2 text-right">{formatRupiah(b.nominal)}</td>
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
                          <optgroup label="Usulan (cocok awalan nama)">
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
