// /cetak/form-10/:bulan (Admin, PPK) — Rencana Pengajuan SPM ke KPPN, DIPECAH
// PER SUPLIER. Tiap suplier = satu lembar SPM; di dalamnya penerima
// dikelompokkan per prodi+tingkat+angkatan (angkatan = 2 digit depan NIT).
// Menampilkan nomor rekening PENUH taruna → TIDAK di-cache Dexie (pola Form-07),
// setiap pemuatan tercatat di Log Audit oleh backend.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BulanPicker, bulanIni, labelBulan } from '../../components/bulan-picker';
import { BlokTtdTengah } from '../../components/cetak/blok-ttd';
import { KopSurat } from '../../components/cetak/kop-surat';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { api } from '../../lib/api';
import { terbilangRupiah } from '../../lib/terbilang';
import { formatRupiah } from '../tagihan/tipe';

interface Pejabat { nama: string; nip: string }
interface BarisF10 {
  nit: string; nama: string; bank: string; no_rekening_lengkap: string; nama_pemilik: string;
  hari_makan: number; nominal: number; rekening_lengkap_ada: boolean;
}
interface KelompokF10 {
  prodi: string; tingkat: string; jml_taruna: number; total_nominal: number; baris: BarisF10[];
}
interface SuplierF10 {
  penyedia_id: string; penyedia_nama: string; jml_taruna: number; total_nominal: number;
  total_terbilang: string; kelompok: KelompokF10[];
}
interface Form10Data {
  bulan: string;
  pembayaran: { bayar_id: string; nilai_total: number; no_spm: string; tgl_spm: string; no_sp2d: string; tgl_sp2d: string; status: string };
  per_suplier: SuplierF10[];
  total_nominal: number;
  nominal_terbilang: string;
  pejabat: { PPK: Pejabat; KPA: Pejabat; DIREKTUR: Pejabat; WADIR3: Pejabat };
}

/** Fetch langsung ke GAS — tanpa cache Dexie (memuat nomor rekening lengkap taruna). */
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
 * Unduh CSV format SPM SPAN (pipe-delimited) untuk satu suplier — SATU baris per
 * taruna penerima (LS langsung ke taruna). Header persis yang diminta SPAN:
 * NO|NAMA_SUPPLIER|NAMA_PEMILIK_REKENING|NO_REKENING|JUMLAH_UANG. Tanpa BOM/quote
 * (parser SPAN pipe polos). JUMLAH_UANG = integer rupiah tanpa pemisah ribuan.
 * Kembalikan jumlah taruna yang DILEWATI (rekening lengkap belum diisi).
 */
function unduhCsvSpm(suplier: SuplierF10, bulan: string): number {
  const sanit = (v: string) => String(v || '').replace(/[|\r\n]+/g, ' ').trim();
  const semua = (suplier.kelompok ?? []).flatMap((k) => k.baris ?? []);
  const dipakai = semua.filter((b) => b.rekening_lengkap_ada && b.no_rekening_lengkap);
  const header = 'NO|NAMA_SUPPLIER|NAMA_PEMILIK_REKENING|NO_REKENING|JUMLAH_UANG';
  const barisCsv = dipakai.map((b, i) =>
    `${i + 1}|${sanit(b.nama)}|${sanit(b.nama_pemilik || b.nama)}|${sanit(b.no_rekening_lengkap)}|${b.nominal}`);
  const teks = [header, ...barisCsv].join('\n') + '\n';
  const blob = new Blob([teks], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SPM-${suplier.penyedia_id || 'tanpa-suplier'}-${bulan}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return semua.length - dipakai.length;
}

/**
 * Satu lembar SPM per suplier (halaman cetak sendiri, break-before-page).
 * Kolom "Pisah" (checkbox, print:hidden) memberi PPK/Admin cara ad hoc untuk
 * menarik taruna TERTENTU keluar dari lembar ini dan menjadikannya SPM
 * tersendiri (mis. taruna yang datanya perlu diajukan terpisah dari
 * rombongan prodi/tingkatnya) — TIDAK ada NIT yang dikhususkan di kode,
 * berlaku untuk taruna manapun, bulan manapun, murni pilihan saat cetak.
 */
function LembarSuplier({ suplier, urutan, pejabat, bulan, terpisah, onToggleTerpisah, labelTambahan }: {
  suplier: SuplierF10; urutan: number; pejabat: Form10Data['pejabat']; bulan: string;
  terpisah: Set<string>; onToggleTerpisah: (nit: string) => void; labelTambahan?: string;
}) {
  const belumAdaSuplier = !suplier.penyedia_id;
  // Tampilkan nama suplier bila ada di master PENYEDIA; kalau tidak, tampilkan ID-nya.
  const labelSuplier = belumAdaSuplier
    ? '(BELUM DITENTUKAN)'
    : (suplier.penyedia_nama ? suplier.penyedia_nama.toUpperCase() : `ID ${suplier.penyedia_id}`);
  return (
    <div className={urutan > 0 ? 'break-before-page pt-4' : ''}>
      <div className="text-center">
        <h2 className="text-base font-bold">
          RENCANA PENGAJUAN SPM — SUPLIER: {labelSuplier}{labelTambahan ? ` ${labelTambahan}` : ''}
        </h2>
        <p className="text-sm">
          Bulan {labelBulan(bulan)} — {suplier.jml_taruna} taruna
          {suplier.penyedia_id ? <> · ID Suplier: <span className="font-mono">{suplier.penyedia_id}</span></> : null}
        </p>
      </div>

      {!belumAdaSuplier && (
        <div className="mt-2 flex flex-col items-center gap-1 print:hidden">
          <Button varian="garis" onClick={() => unduhCsvSpm(suplier, bulan)}>
            ⬇️ Unduh CSV SPM (format SPAN) — {suplier.penyedia_nama || `ID ${suplier.penyedia_id}`}
          </Button>
          {(suplier.kelompok ?? []).flatMap((k) => k.baris ?? []).some((b) => !b.rekening_lengkap_ada) && (
            <p className="text-xs text-amber-600">
              {(suplier.kelompok ?? []).flatMap((k) => k.baris ?? []).filter((b) => !b.rekening_lengkap_ada).length} taruna dilewati (rekening lengkap belum diisi).
            </p>
          )}
        </div>
      )}

      {belumAdaSuplier && (
        <p className="mt-2 text-xs text-red-600 print:hidden">
          ⚠️ Taruna berikut belum dipasangkan ke suplier mana pun. Tetapkan suplier lewat modal
          🔒 Rekening di halaman Taruna sebelum SPM diajukan.
        </p>
      )}

      {(suplier.kelompok ?? []).map((k) => (
        <Card key={`${k.prodi}|${k.tingkat}`} className="mt-3 overflow-x-auto print:border-0 print:p-0 print:shadow-none">
          <p className="mb-2 text-sm font-semibold text-gray-600 print:text-black">
            Prodi {k.prodi || '-'} · Tingkat {k.tingkat || '-'} ({k.jml_taruna} taruna)
          </p>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {['No', 'NIT', 'Nama', 'Bank', 'No. Rekening', 'Hari', 'Nominal (Rp)'].map((h) => (
                  <th key={h} className="border border-gray-400 bg-[#D9E2F3] px-2 py-1 text-left font-semibold">{h}</th>
                ))}
                <th className="border border-gray-400 bg-[#D9E2F3] px-2 py-1 text-left font-semibold print:hidden">Pisah</th>
              </tr>
            </thead>
            <tbody>
              {(k.baris ?? []).map((b, i) => (
                <tr key={b.nit}>
                  <td className="border border-gray-300 px-2 py-1 text-right">{i + 1}</td>
                  <td className="border border-gray-300 px-2 py-1">{b.nit}</td>
                  <td className="border border-gray-300 px-2 py-1">{b.nama}</td>
                  <td className="border border-gray-300 px-2 py-1">{b.rekening_lengkap_ada ? b.bank : '-'}</td>
                  <td className="border border-gray-300 px-2 py-1">{b.rekening_lengkap_ada ? b.no_rekening_lengkap : '…… (belum ada rekening)'}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right">{b.hari_makan}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right">{formatRupiah(b.nominal)}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center print:hidden">
                    <input type="checkbox" aria-label={`Pisahkan ${b.nama} jadi SPM sendiri`}
                      checked={terpisah.has(b.nit)} onChange={() => onToggleTerpisah(b.nit)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-1 flex justify-between text-xs font-semibold">
            <span>Subtotal {k.prodi} {k.tingkat}</span>
            <span>{formatRupiah(k.total_nominal)}</span>
          </div>
        </Card>
      ))}

      <div className="mt-3 flex justify-between text-sm font-bold">
        <span>TOTAL SPM SUPLIER {belumAdaSuplier ? '(BELUM DITENTUKAN)' : suplier.penyedia_nama.toUpperCase()}{labelTambahan ? ` ${labelTambahan}` : ''}</span>
        <span>{formatRupiah(suplier.total_nominal)}</span>
      </div>
      <p className="mt-1 text-xs italic">Terbilang: <strong>{suplier.total_terbilang}</strong></p>

      <div className="mt-6">
        <BlokTtdTengah
          pihak={{ label: 'Menyetujui,', jabatan: 'Pejabat Pembuat Komitmen (PPK)', nama: pejabat.PPK.nama, nip: pejabat.PPK.nip }}
        />
      </div>
    </div>
  );
}

export function HalamanCetakForm10() {
  const nav = useNavigate();
  const { bulan: bulanParam } = useParams<{ bulan?: string }>();
  const [bulan, setBulan] = useState(bulanParam || bulanIni());
  const { data, memuat, galat, refresh } = useTanpaCache<Form10Data>('cetak.form10', { bulan });

  // NIT taruna yang ditandai "pisahkan jadi SPM sendiri" — state layar saja
  // (tidak dikirim/disimpan ke server), berlaku untuk taruna manapun sesuai
  // pilihan PPK/Admin saat mencetak, di-reset tiap ganti bulan.
  const [terpisah, setTerpisah] = useState<Set<string>>(new Set());
  useEffect(() => { setTerpisah(new Set()); }, [bulan]);
  const toggleTerpisah = useCallback((nit: string) => {
    setTerpisah((prev) => {
      const next = new Set(prev);
      if (next.has(nit)) next.delete(nit); else next.add(nit);
      return next;
    });
  }, []);

  const { perSuplierUtama, lembarTerpisah } = useMemo(() => {
    const daftar = data?.per_suplier ?? [];
    if (terpisah.size === 0) return { perSuplierUtama: daftar, lembarTerpisah: [] as SuplierF10[] };

    const dipisah: { suplier: SuplierF10; prodi: string; tingkat: string; baris: BarisF10 }[] = [];

    const perSuplierUtama = daftar
      .map((s) => {
        const kelompokBaru = (s.kelompok ?? [])
          .map((k) => {
            const barisTetap: BarisF10[] = [];
            (k.baris ?? []).forEach((b) => {
              if (terpisah.has(b.nit)) dipisah.push({ suplier: s, prodi: k.prodi, tingkat: k.tingkat, baris: b });
              else barisTetap.push(b);
            });
            return { ...k, baris: barisTetap, jml_taruna: barisTetap.length, total_nominal: barisTetap.reduce((sum, b) => sum + b.nominal, 0) };
          })
          .filter((k) => k.baris.length > 0);
        const totalNominal = kelompokBaru.reduce((sum, k) => sum + k.total_nominal, 0);
        return {
          ...s,
          kelompok: kelompokBaru,
          jml_taruna: kelompokBaru.reduce((sum, k) => sum + k.jml_taruna, 0),
          total_nominal: totalNominal,
          total_terbilang: terbilangRupiah(totalNominal),
        };
      })
      .filter((s) => s.kelompok.length > 0);

    const lembarTerpisah: SuplierF10[] = dipisah.map(({ suplier, prodi, tingkat, baris }) => ({
      penyedia_id: suplier.penyedia_id,
      penyedia_nama: suplier.penyedia_nama,
      jml_taruna: 1,
      total_nominal: baris.nominal,
      total_terbilang: terbilangRupiah(baris.nominal),
      kelompok: [{ prodi, tingkat, jml_taruna: 1, total_nominal: baris.nominal, baris: [baris] }],
    }));

    return { perSuplierUtama, lembarTerpisah };
  }, [data, terpisah]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <button className="text-sm text-primary" onClick={() => nav(-1)}>← Kembali</button>
        {data && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak</Button>}
      </div>
      <h1 className="text-xl font-bold text-primary-dark print:hidden">Form 10 — Rencana Pengajuan SPM per Suplier</h1>

      {!bulanParam && (
        <div className="print:hidden"><BulanPicker bulan={bulan} onChange={setBulan} /></div>
      )}

      {memuat && !data && <LoadingSpinner label="Memuat data…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}

      {data && (
        <div className="flex flex-col gap-4">
          <KopSurat />
          <div className="text-center">
            <h2 className="text-base font-bold">RENCANA PENGAJUAN SPM KE KPPN</h2>
            <p className="text-sm">Bulan {labelBulan(data.bulan)} — dipecah per suplier katering</p>
          </div>

          <Card className="print:border-0 print:p-0 print:shadow-none">
            <p className="text-sm">
              Berikut rencana pengajuan Surat Perintah Membayar (SPM) bantuan biaya makan taruna
              bulan {labelBulan(data.bulan)}, <strong>dipecah per ID suplier</strong> (tiap suplier = satu
              SPM tersendiri) dan dikelompokkan per <strong>program studi dan tingkat</strong>.
              Pembayaran mekanisme LS langsung ke rekening masing-masing taruna. Total keseluruhan{' '}
              <strong>{formatRupiah(data.total_nominal)}</strong>.
            </p>
            <p className="mt-1 text-xs italic">Terbilang: <strong>{data.nominal_terbilang}</strong></p>
            <div className="mt-2 flex flex-col gap-1 text-xs">
              <div className="flex justify-between"><span>Jumlah suplier</span><span>{data.per_suplier.length}</span></div>
              <div className="flex justify-between"><span>No. SP2D (bila sudah terbit)</span><span>{data.pembayaran.no_sp2d || '-'}</span></div>
            </div>
            <p className="mt-2 text-xs text-gray-500 print:hidden">
              Centang kolom "Pisah" pada baris taruna untuk menjadikan taruna tersebut SPM
              tersendiri, terpisah dari kelompok prodi/tingkatnya (mis. taruna yang perlu
              diajukan lewat lembar sendiri) — pilihan ini hanya berlaku di layar/cetak saat ini.
            </p>
          </Card>

          {data.per_suplier.length === 0 && (
            <Card className="text-sm text-gray-500">Belum ada data rekap untuk bulan ini.</Card>
          )}

          {perSuplierUtama.map((s, i) => (
            <LembarSuplier key={s.penyedia_id || '__tanpa__'} suplier={s} urutan={i} pejabat={data.pejabat} bulan={data.bulan}
              terpisah={terpisah} onToggleTerpisah={toggleTerpisah} />
          ))}

          {lembarTerpisah.map((s, i) => (
            <LembarSuplier key={`terpisah-${s.kelompok?.[0]?.baris?.[0]?.nit ?? i}`} suplier={s} urutan={perSuplierUtama.length + i}
              pejabat={data.pejabat} bulan={data.bulan} terpisah={terpisah} onToggleTerpisah={toggleTerpisah}
              labelTambahan="(SPM Terpisah)" />
          ))}
        </div>
      )}
    </div>
  );
}
