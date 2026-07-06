// /tagihan/impor-debet (PPK) — impor CSV hasil pendebetan bank (mis. laporan
// Autotran BNI/BSI) lalu tandai gagal debet massal, tanpa isi ulang manual.
// Pencocokan UTAMA: nomor REKENING PENUH di CSV → TARUNA_REKENING.no_rekening_lengkap
// (rekening.cocokkan, EXACT match) — bukan tebak nama, karena nama di laporan
// bank sering terpotong ("Muhamad Ilham Sa"). Kalau CSV tidak punya kolom
// rekening, jatuh ke pencocokan nama (prefix) TAPI wajib konfirmasi manual tiap
// baris (NIT tidak pernah diisi otomatis). Sebab tagihan diusulkan otomatis per
// baris dari kode/teks error bank, tetap bisa diubah manual.
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
  nama: string; rekening: string; nominal: number; statusMentah: string; keterangan: string;
  nitTerpilih: string; kandidat: { nit: string; nama: string }[];
  dipilih: boolean; sebab: string;
  cocokRekening: boolean; // true = ditemukan exact match via rekening.cocokkan
  perluKonfirmasi: boolean; // true = rekening ada tapi tak ketemu, ATAU mode fallback nama
}

interface Kelompok { bank: string; prodi: string; baris: { idx: number; b: BarisImporDebet; t?: Taruna }[] }

/** Normalisasi nama untuk pencocokan fallback: kapital, hapus titik/koma/kutip/strip, rapikan spasi. */
function normalisasiNama(s: string): string {
  return s.toUpperCase().replace(/[.,'’-]/g, '').replace(/\s+/g, ' ').trim();
}

/** Cari indeks kolom header, cocokkan longgar (tanpa spasi/underscore, case-insensitive). */
function cariIndeksKolom(header: string[], ...kandidatNama: string[]): number {
  const rapikan = (s: string) => s.toLowerCase().replace(/[\s_]/g, '');
  const target = kandidatNama.map(rapikan);
  return header.findIndex((h) => target.includes(rapikan(h)));
}

/** Status/keterangan bank yang menandakan debet gagal ("0 PROCESSED"/"BERHASIL" = sukses). */
function terlihatGagal(status: string, keterangan: string): boolean {
  const s = `${status} ${keterangan}`.toLowerCase().trim();
  if (!s) return false;
  const sukses = /(^|\s)(0\s*)?processed\b/.test(s) || /berhasil/.test(s);
  return !sukses;
}

/** Petakan teks/kode error bank → sebab TAGIHAN yang paling mendekati. */
function petakanSebab(status: string, keterangan: string): string {
  const s = `${status} ${keterangan}`.toLowerCase();
  if (/tidak cukup|saldo|\b266\b/.test(s)) return 'SALDO_KURANG';
  if (/rekening|blokir|tutup|invalid|tidak ditemukan/.test(s)) return 'REKENING_BERMASALAH';
  return 'GAGAL_DEBET';
}

export function HalamanTagihanImporDebet() {
  const nav = useNavigate();
  const { toast } = useToast();
  const [bulan, setBulan] = useState(bulanIni());
  const [bank, setBank] = useState<'BNI' | 'BSI'>('BNI');
  const rekapQ = useListCache<{ rekap: { nit: string; status: string }[] }>('rekap.get', { bulan });
  const tarunaQ = useListCache<{ taruna: Taruna[] }>('taruna.list', {});
  const daftarTaruna = tarunaQ.data?.taruna ?? [];
  const tarunaByNit = new Map(daftarTaruna.map((t) => [t.nit, t]));

  const [baris, setBaris] = useState<BarisImporDebet[]>([]);
  const [modeRekening, setModeRekening] = useState(true);
  const [proses, setProses] = useState(false);
  const [mencocokkan, setMencocokkan] = useState(false);
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
    const iRek = cariIndeksKolom(header, 'rekening', 'no_rekening', 'no_rekening_lengkap', 'rekening_lengkap');
    const iNama = cariIndeksKolom(header, 'nama', 'nama di bank');
    const iNom = cariIndeksKolom(header, 'nominal');
    const iStatus = cariIndeksKolom(header, 'status', 'tran');
    const iKet = cariIndeksKolom(header, 'keterangan', 'err message', 'errmessage', 'error');

    if (iRek < 0 && iNama < 0) {
      toast('Header CSV wajib memuat kolom "rekening" (disarankan) atau "nama".', 'galat');
      return;
    }
    const pakaiRekening = iRek >= 0;
    setModeRekening(pakaiRekening);

    const mentah = semua.slice(1).map((row) => ({
      nama: iNama >= 0 ? (row[iNama] ?? '').trim() : '',
      rekening: iRek >= 0 ? (row[iRek] ?? '').trim() : '',
      nominal: iNom >= 0 ? Number(row[iNom] ?? 0) : 0,
      statusMentah: iStatus >= 0 ? (row[iStatus] ?? '').trim() : '',
      keterangan: iKet >= 0 ? (row[iKet] ?? '').trim() : ''
    }));

    let cocokByRekening = new Map<string, { nit: string; nama_pemilik: string }>();
    if (pakaiRekening) {
      const daftarRekening = Array.from(new Set(mentah.map((m) => m.rekening).filter(Boolean)));
      if (daftarRekening.length > 0) {
        setMencocokkan(true);
        try {
          const r = await api<{ hasil: { no_rekening: string; ditemukan: boolean; nit?: string; nama_pemilik?: string }[] }>(
            'rekening.cocokkan', { no_rekening_list: daftarRekening, bulan, bank }
          );
          r.hasil.forEach((h) => { if (h.ditemukan && h.nit) cocokByRekening.set(h.no_rekening, { nit: h.nit, nama_pemilik: h.nama_pemilik ?? '' }); });
        } catch (e) {
          toast(e instanceof Error ? e.message : 'Gagal mencocokkan rekening.', 'galat');
        } finally {
          setMencocokkan(false);
        }
      }
    }

    const hasil: BarisImporDebet[] = mentah.map((m) => {
      const gagal = terlihatGagal(m.statusMentah, m.keterangan);
      const sebab = petakanSebab(m.statusMentah, m.keterangan);
      if (pakaiRekening) {
        const cocok = m.rekening ? cocokByRekening.get(m.rekening) : undefined;
        if (cocok) {
          return {
            ...m, nitTerpilih: cocok.nit, kandidat: [{ nit: cocok.nit, nama: cocok.nama_pemilik || cocok.nit }],
            dipilih: gagal, sebab, cocokRekening: true, perluKonfirmasi: false
          };
        }
        // Rekening tak ketemu exact → tetap tawarkan usulan dari nama (bila ada) sbg bantuan, wajib konfirmasi manual.
        return {
          ...m, nitTerpilih: '', kandidat: cariKandidat(m.nama), dipilih: gagal, sebab,
          cocokRekening: false, perluKonfirmasi: true
        };
      }
      // Mode fallback (tak ada kolom rekening di CSV) — NIT TIDAK PERNAH diisi otomatis,
      // walau kandidat cuma satu; admin wajib memilih sendiri sbg konfirmasi eksplisit.
      return {
        ...m, nitTerpilih: '', kandidat: cariKandidat(m.nama), dipilih: gagal, sebab,
        cocokRekening: false, perluKonfirmasi: true
      };
    });
    setBaris(hasil);
  }

  function setNit(i: number, nit: string) {
    setBaris((prev) => prev.map((b, idx) => (idx === i ? { ...b, nitTerpilih: nit } : b)));
  }
  function setSebabBaris(i: number, sebab: string) {
    setBaris((prev) => prev.map((b, idx) => (idx === i ? { ...b, sebab } : b)));
  }
  function toggleDipilih(i: number) {
    setBaris((prev) => prev.map((b, idx) => (idx === i ? { ...b, dipilih: !b.dipilih } : b)));
  }

  const kelompok: Kelompok[] = (() => {
    const map = new Map<string, Kelompok>();
    baris.forEach((b, idx) => {
      const t = b.nitTerpilih ? tarunaByNit.get(b.nitTerpilih) : undefined;
      const bankGrup = t?.bank || 'Tanpa Bank';
      const prodi = t?.prodi || 'Tanpa Prodi';
      const key = `${bankGrup}||${prodi}`;
      if (!map.has(key)) map.set(key, { bank: bankGrup, prodi, baris: [] });
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
      const perSebab = new Map<string, string[]>();
      terpilih.forEach((b) => {
        const list = perSebab.get(b.sebab) ?? [];
        list.push(b.nitTerpilih);
        perSebab.set(b.sebab, list);
      });
      let total = 0;
      for (const [sebab, nitList] of perSebab) {
        const r = await api<{ tagihan: { tagihan_id: string }[] }>('tagihan.create', { bulan, nit: nitList, sebab });
        total += r.tagihan.length;
      }
      toast(`${total} tagihan dicatat, SP-1 terbit otomatis.`, 'sukses');
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
      {modeRekening ? (
        <p className="text-xs text-gray-500">
          Pencocokan via nomor rekening PENUH (exact match) — baris hijau sudah pasti,
          baris kuning tak ketemu & perlu konfirmasi manual.
        </p>
      ) : (
        <p className="text-xs text-amber-700">
          ⚠️ CSV tidak punya kolom rekening — pencocokan HANYA usulan dari nama (sering
          terpotong di laporan bank). NIT TIDAK diisi otomatis; setiap baris WAJIB
          dikonfirmasi manual sebelum kirim.
        </p>
      )}
      <BulanPicker bulan={bulan} onChange={setBulan} />
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Bank Laporan Ini</label>
        <select value={bank} onChange={(e) => setBank(e.target.value as 'BNI' | 'BSI')}
          className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5">
          <option value="BNI">BNI</option>
          <option value="BSI">BSI</option>
        </select>
      </div>
      {rekapQ.galat && <ErrorMessage pesan={rekapQ.galat} onRetry={rekapQ.refresh} />}
      {belumFinal && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          ⚠️ Rekap bulan ini belum FINAL — finalkan dulu di menu Rekap sebelum menandai gagal debet.
        </p>
      )}

      <Card className="flex flex-col gap-2">
        <p className="text-xs text-gray-500">
          Unggah CSV — kolom <code>rekening</code> (nomor penuh, disarankan) atau <code>nama</code>,
          opsional <code>nominal</code>, <code>status</code>, <code>keterangan</code> (format hasil
          konversi laporan Autotran bank).
        </p>
        {tarunaQ.memuat && !tarunaQ.data ? (
          <LoadingSpinner label="Memuat daftar Taruna dulu…" />
        ) : (
          <input type="file" accept=".csv,text/csv" onChange={(e) => void pilihFile(e)}
            className="min-h-tap rounded-xl border border-gray-300 px-3 py-2.5 text-sm" />
        )}
        {mencocokkan && <LoadingSpinner label="Mencocokkan nomor rekening ke NIT…" />}
      </Card>

      {baris.length > 0 && !belumFinal && (
        <Card className="flex flex-col gap-3">
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
                        <th className="py-1 pr-2">Cocokkan ke Taruna</th>
                        <th className="py-1">Sebab</th>
                      </tr>
                    </thead>
                    <tbody>
                      {k.baris.map(({ idx, b }) => (
                        <tr key={idx} className={`border-b border-gray-100 ${b.cocokRekening ? 'bg-green-50' : b.perluKonfirmasi ? 'bg-amber-50' : ''}`}>
                          <td className="py-1">
                            <input type="checkbox" className="h-4 w-4" checked={b.dipilih} onChange={() => toggleDipilih(idx)} />
                          </td>
                          <td className="py-1 pr-2">{b.nama || <span className="text-gray-400">—</span>}</td>
                          <td className="py-1 pr-2 text-right">{b.nominal ? formatRupiah(b.nominal) : '-'}</td>
                          <td className="py-1 pr-2">
                            {b.statusMentah || b.keterangan ? (
                              <span className={terlihatGagal(b.statusMentah, b.keterangan) ? 'text-red-600' : 'text-green-700'}>
                                {b.keterangan || b.statusMentah}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-1 pr-2">
                            <select value={b.nitTerpilih} onChange={(e) => setNit(idx, e.target.value)}
                              className="w-full rounded border border-gray-300 px-1 py-1">
                              <option value="">— pilih taruna —</option>
                              {b.kandidat.length > 0 && (
                                <optgroup label={b.cocokRekening ? 'Cocok rekening (pasti)' : 'Usulan (cocok awalan nama)'}>
                                  {b.kandidat.map((kd) => <option key={kd.nit} value={kd.nit}>{kd.nama} ({kd.nit})</option>)}
                                </optgroup>
                              )}
                              <optgroup label="Semua Taruna">
                                {daftarTaruna.map((t) => <option key={t.nit} value={t.nit}>{t.nama} ({t.nit})</option>)}
                              </optgroup>
                            </select>
                          </td>
                          <td className="py-1">
                            <select value={b.sebab} onChange={(e) => setSebabBaris(idx, e.target.value)}
                              className="w-full rounded border border-gray-300 px-1 py-1">
                              {SEBAB.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
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
