// /luar-kampus-kajur/cetak/:bulan (KETUA_JURUSAN) — cetak Nota Dinas permohonan
// pembayaran Bantuan Uang Makan Luar Kampus prodinya (Kajur → PPK) + Lampiran
// daftar per taruna. TANPA nomor rekening (data kajur.rekap memang tak memuatnya)
// → boleh di-cache, aman dicetak Kajur. Nomor/tanggal/dasar SK = isian manual
// (state lokal saja, TIDAK dikirim/disimpan ke server — pola form manual SOP).
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { labelBulan } from '../../components/bulan-picker';
import { BlokTtdTengah } from '../../components/cetak/blok-ttd';
import { KopSurat } from '../../components/cetak/kop-surat';
import { SelCetak } from '../../components/cetak/tabel-cetak';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useListCache } from '../../lib/use-list-cache';
import { urutTingkat } from '../../lib/kelompok-prodi-tingkat';
import { terbilangRupiah } from '../../lib/terbilang';
import { formatRupiah } from '../tagihan/tipe';

interface BarisRekap {
  nit: string; nama: string; tingkat: string; kelas: string; kegiatan: string;
  hari_luar_kampus: number; nilai_per_hari: number; nominal: number; ada_blk: boolean; disetujui_kajur: boolean;
}
interface RekapData { bulan: string; prodi: string; baris: BarisRekap[]; total_nominal: number }

export function HalamanCetakRekapKajur() {
  const nav = useNavigate();
  const { session } = useAuth();
  const { bulan = '' } = useParams();
  const { data, memuat, galat, refresh } = useListCache<RekapData>('kajur.rekap', { bulan });

  // ── Field manual Nota Dinas (TIDAK tersimpan — state lokal sesi cetak ini) ──
  const [nomorNd, setNomorNd] = useState('');
  const [tglNd, setTglNd] = useState('');
  const [dasarSk, setDasarSk] = useState('');

  const baris = data?.baris ?? [];
  const totalHari = baris.reduce((s, b) => s + (b.hari_luar_kampus || 0), 0);
  const kelompok = (() => {
    const map = new Map<string, BarisRekap[]>();
    baris.forEach((b) => {
      const t = b.tingkat || '?';
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(b);
    });
    return Array.from(map.entries())
      .map(([tingkat, rows]) => ({
        tingkat,
        rows: rows.slice().sort((a, c) => (a.nama || a.nit).localeCompare(c.nama || c.nit, 'id')),
      }))
      .sort((a, c) => urutTingkat(a.tingkat) - urutTingkat(c.tingkat));
  })();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <button className="text-sm text-primary" onClick={() => nav(-1)}>← Kembali</button>
        {baris.length > 0 && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak</Button>}
      </div>

      {memuat && !data && <LoadingSpinner label="Memuat rekap…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}
      {data && baris.length === 0 && (
        <EmptyState pesan="Belum ada aktivitas luar kampus bulan ini." />
      )}

      {data && baris.length > 0 && (
        <>
          {/* ── Isian manual (hanya layar, tidak ikut tercetak) ── */}
          <div className="flex flex-col gap-2 rounded-xl border border-teal-200 bg-teal-50/40 p-3 print:hidden">
            <p className="text-sm font-semibold text-primary-dark">Isian Nota Dinas (tidak tersimpan — hanya untuk cetakan ini)</p>
            <label className="text-xs text-gray-600">Nomor Nota Dinas
              <input className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                placeholder="mis. ND-045/POLTEK.KP.SRG/KU.100/II/2026"
                value={nomorNd} onChange={(e) => setNomorNd(e.target.value)} />
            </label>
            <label className="text-xs text-gray-600">Tanggal (tulis lengkap)
              <input className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                placeholder="mis. 12 Februari 2026"
                value={tglNd} onChange={(e) => setTglNd(e.target.value)} />
            </label>
            <label className="text-xs text-gray-600">Dasar penugasan / Nomor SK (opsional)
              <input className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                placeholder="mis. B.091/KPA.PKPS/KU.110/I/2026 (PKL III)"
                value={dasarSk} onChange={(e) => setDasarSk(e.target.value)} />
            </label>
          </div>

          {/* ══════════════ NOTA DINAS (halaman 1) ══════════════ */}
          <div className="flex flex-col gap-2">
            <KopSurat />
            <div className="text-center">
              <h2 className="text-sm font-bold underline">NOTA DINAS</h2>
              <p className="text-xs">Nomor: {nomorNd || '……………………………………'}</p>
            </div>

            <table className="mt-2 text-xs">
              <tbody>
                <tr><td className="align-top pr-2">Yth.</td><td className="pr-2">:</td><td>Pejabat Pembuat Komitmen</td></tr>
                <tr><td className="align-top pr-2">Dari</td><td className="pr-2">:</td><td>Ketua Jurusan / Program Studi {data.prodi}</td></tr>
                <tr><td className="align-top pr-2">Hal</td><td className="pr-2">:</td><td>Permohonan Pembayaran Bantuan Uang Makan Taruna Kegiatan Luar Kampus — Bulan {labelBulan(bulan)}</td></tr>
                <tr><td className="align-top pr-2">Tanggal</td><td className="pr-2">:</td><td>{tglNd || '……………………………'}</td></tr>
              </tbody>
            </table>

            <div className="mt-2 flex flex-col gap-2 text-justify text-xs leading-relaxed">
              <div className="flex gap-2">
                <span>1.</span>
                <div>
                  Dasar:
                  <div className="ml-3">a. SOP PR/PKU/KU-001/2025 tentang Bantuan Uang Makan Taruna;</div>
                  <div className="ml-3">b. {dasarSk || 'Surat penugasan kegiatan luar kampus (PKL/KPA/PTB) ……………………………'};</div>
                  <div className="ml-3">c. Rekapitulasi kehadiran (absen) taruna luar kampus yang telah diverifikasi dan disetujui Ketua Jurusan.</div>
                </div>
              </div>
              <div className="flex gap-2">
                <span>2.</span>
                <div>
                  Sehubungan dengan hal tersebut, dimohon Bapak memproses pembayaran uang makan bagi taruna
                  Jurusan/Program Studi {data.prodi} yang melaksanakan kegiatan di luar kampus pada bulan {labelBulan(bulan)},
                  dengan jumlah hari <span className="font-semibold">sesuai kehadiran</span> sebagaimana daftar terlampir:
                  <div className="ml-3 mt-1">
                    <div>Jumlah taruna&nbsp;&nbsp;: {baris.length} orang</div>
                    <div>Total hari makan : {totalHari} hari</div>
                    <div>Jumlah keseluruhan : <span className="font-semibold">{formatRupiah(data.total_nominal)}</span></div>
                    <div className="italic">Terbilang: {terbilangRupiah(data.total_nominal)}</div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <span>3.</span>
                <div>Data kehadiran pada daftar terlampir adalah benar sesuai keadaan yang sebenarnya dan menjadi tanggung jawab kami.</div>
              </div>
              <p>Demikian disampaikan, atas perhatian dan kerja samanya diucapkan terima kasih.</p>
            </div>

            <div className="mt-6 flex justify-end">
              <BlokTtdTengah pihak={{ label: 'Ketua Jurusan / Program Studi', jabatan: data.prodi, nama: session?.nama || '' }} />
            </div>

            <div className="mt-4 text-xs">
              <p>Tembusan:</p>
              <p>Wakil Direktur III (Kemahasiswaan)</p>
            </div>
          </div>

          {/* ══════════════ LAMPIRAN (halaman baru) ══════════════ */}
          <div className="flex flex-col gap-2 break-before-page">
            <div className="text-center">
              <p className="text-xs">Lampiran Nota Dinas</p>
              <p className="text-xs">Nomor: {nomorNd || '……………………………………'}</p>
              <p className="text-xs">Tanggal: {tglNd || '……………………………'}</p>
              <h2 className="mt-1 text-sm font-bold">DAFTAR PERMOHONAN PEMBAYARAN UANG MAKAN TARUNA LUAR KAMPUS</h2>
              <p className="text-xs">Program Studi {data.prodi} · Bulan {labelBulan(bulan)}</p>
            </div>
            <table className="w-full table-fixed border-collapse text-xs">
              <colgroup>
                <col style={{ width: '5%' }} /><col style={{ width: '33%' }} /><col style={{ width: '9%' }} />
                <col style={{ width: '17%' }} /><col style={{ width: '8%' }} /><col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
              </colgroup>
              <thead>
                <tr>
                  {['No', 'Nama Taruna', 'Tk', 'Kegiatan', 'Hari', 'Tarif/Hari', 'Nominal (Rp)'].map((h) => (
                    <th key={h} className="border border-gray-400 bg-[#D9E2F3] px-2 py-1 text-left align-top font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              {kelompok.map((kt) => {
                const subtotal = kt.rows.reduce((s, b) => s + b.nominal, 0);
                return (
                  <tbody key={kt.tingkat}>
                    <tr>
                      <td colSpan={7} className="border border-gray-400 bg-gray-100 px-2 py-1 font-semibold">Tingkat {kt.tingkat}</td>
                    </tr>
                    {kt.rows.map((b, i) => (
                      <tr key={b.nit}>
                        <SelCetak>{i + 1}</SelCetak>
                        <SelCetak>{b.nama || b.nit}</SelCetak>
                        <SelCetak>{b.tingkat}</SelCetak>
                        <SelCetak>{b.kegiatan || '-'}</SelCetak>
                        <SelCetak className="text-right">{b.hari_luar_kampus}</SelCetak>
                        <SelCetak className="text-right">{b.nilai_per_hari ? formatRupiah(b.nilai_per_hari) : '-'}</SelCetak>
                        <SelCetak className="text-right">{formatRupiah(b.nominal)}</SelCetak>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={6} className="border border-gray-400 px-2 py-1 text-right font-semibold">Subtotal Tingkat {kt.tingkat} ({kt.rows.length} taruna)</td>
                      <td className="border border-gray-400 px-2 py-1 text-right font-semibold">{formatRupiah(subtotal)}</td>
                    </tr>
                  </tbody>
                );
              })}
              <tfoot>
                <tr>
                  <td colSpan={4} className="border border-gray-400 bg-[#D9E2F3] px-2 py-1 text-right font-bold">TOTAL ({baris.length} taruna)</td>
                  <td className="border border-gray-400 bg-[#D9E2F3] px-2 py-1 text-right font-bold">{totalHari}</td>
                  <td className="border border-gray-400 bg-[#D9E2F3]" />
                  <td className="border border-gray-400 bg-[#D9E2F3] px-2 py-1 text-right font-bold">{formatRupiah(data.total_nominal)}</td>
                </tr>
              </tfoot>
            </table>
            <div className="mt-6 flex justify-end">
              <BlokTtdTengah pihak={{ label: 'Ketua Jurusan / Program Studi', jabatan: data.prodi, nama: session?.nama || '' }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
