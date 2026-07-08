// Kartu "SPM Dalam Kampus" (halaman Pembayaran, PPK) — pengganti kartu "Rincian
// SP2D" berbasis perkiraan (sp2d.rekonsiliasi) UNTUK BULAN YANG SUDAH PUNYA baris
// SPM tersimpan (sheet SPM, dibuat otomatis oleh bayar.create sejak Tahap 3).
// Beda dari kartu lama: angka di sini PERSIS (baris SPM asli per prodi+tingkat+
// suplier), bukan estimasi dibagi proporsional — dan bisa diedit langsung
// (isi No. SPM/tanggal, lalu No. SP2D/tanggal) tanpa lewat menu Laporan.
//
// Bulan yang BELUM punya baris SPM (dibuat sebelum Tahap 3 ada) tetap pakai
// kartu lama — lihat pembayaran.tsx (dipilih berdasar panjang array `spm`).
import { useEffect, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Modal } from '../../components/ui/modal';
import { useToast } from '../../components/ui/toast';
import { api } from '../../lib/api';
import { useListCache } from '../../lib/use-list-cache';
import { formatRupiah } from '../tagihan/tipe';

export interface SpmBaris {
  spm_id: string;
  bayar_id: string;
  kategori: string;
  bulan: string;
  prodi: string;
  tingkat: string;
  penyedia_id: string;
  penyedia_nama?: string;
  nominal: number;
  no_spm: string;
  tgl_spm: string;
  no_sp2d: string;
  tgl_sp2d: string;
  status: 'DRAFT' | 'DIAJUKAN' | 'SP2D_TERBIT';
  nit_anggota?: string;
  induk_spm_id?: string;
}

interface AnggotaSpm { nit: string; nama: string; nominal: number }

/** Kunci grup SPM (dipakai cari pasangan hasil split utk digabungkan lagi). */
function kunciGrup(s: SpmBaris): string {
  return [s.kategori, s.bayar_id, s.prodi, s.tingkat, s.penyedia_id].join('|');
}

/**
 * Modal "Pisahkan Taruna" — checklist anggota (dari spm.anggota) dgn checkbox,
 * total nominal terpilih real-time, kirim spm.split saat disetujui.
 */
function ModalPisahTaruna({ spmId, onClose, onSukses }: {
  spmId: string; onClose: () => void; onSukses: () => void;
}) {
  const { toast } = useToast();
  const [memuat, setMemuat] = useState(true);
  const [anggota, setAnggota] = useState<AnggotaSpm[]>([]);
  const [pilih, setPilih] = useState<Record<string, boolean>>({});
  const [proses, setProses] = useState(false);

  useEffect(() => {
    let aktif = true;
    (async () => {
      try {
        const hasil = await api<{ anggota: AnggotaSpm[] }>('spm.anggota', { spm_id: spmId });
        if (aktif) setAnggota(hasil.anggota);
      } catch (e) {
        if (aktif) { toast(e instanceof Error ? e.message : 'Gagal memuat anggota.', 'galat'); onClose(); }
      } finally {
        if (aktif) setMemuat(false);
      }
    })();
    return () => { aktif = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spmId]);

  const terpilih = anggota.filter((a) => pilih[a.nit]);
  const totalTerpilih = terpilih.reduce((s, a) => s + a.nominal, 0);
  const semuaTerpilih = anggota.length > 0 && terpilih.length === anggota.length;

  async function pisahkan() {
    if (!terpilih.length || semuaTerpilih) return;
    setProses(true);
    try {
      await api('spm.split', { spm_id: spmId, nit_list: terpilih.map((a) => a.nit) });
      toast(`${terpilih.length} taruna dipisahkan jadi SPM tersendiri.`, 'sukses');
      onSukses();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  return (
    <Modal judul="✂️ Pisahkan Taruna jadi SPM Tersendiri" onClose={onClose}>
      {memuat ? (
        <p className="text-sm text-gray-500">Memuat anggota…</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-500">
            Centang taruna yang mau dikeluarkan jadi SPM tersendiri — minimal 1 taruna harus tersisa di SPM asal.
          </p>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200">
            {anggota.map((a) => (
              <label key={a.nit} className="flex min-h-tap items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 text-sm last:border-b-0">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={!!pilih[a.nit]}
                    onChange={(e) => setPilih((p) => ({ ...p, [a.nit]: e.target.checked }))} />
                  <span>
                    <span className="block font-medium">{a.nama || a.nit}</span>
                    <span className="block text-xs text-gray-400">{a.nit}</span>
                  </span>
                </span>
                <span className="text-gray-600">{formatRupiah(a.nominal)}</span>
              </label>
            ))}
          </div>
          {semuaTerpilih && (
            <p className="text-xs text-red-600">
              Tidak bisa memisahkan SELURUH anggota — minimal 1 taruna harus tersisa di SPM asal.
            </p>
          )}
          <Button onClick={() => void pisahkan()} disabled={proses || !terpilih.length || semuaTerpilih}>
            Pisahkan ({terpilih.length} taruna · {formatRupiah(totalTerpilih)})
          </Button>
        </div>
      )}
    </Modal>
  );
}

export function useSpmDalamKampus(bulan: string) {
  return useListCache<{ spm: SpmBaris[] }>('spm.list', { bulan, kategori: 'DALAM_KAMPUS' });
}

/**
 * Kartu "Belum ada Rancangan SPM" — tampil kalau PEMBAYARAN bulan ini SUDAH
 * ada tapi baris SPM-nya belum pernah dibuat (mis. dibuat sebelum Tahap 3 ada,
 * atau proses awal gagal separuh jalan). `spm.regenerate` aman dipanggil di
 * sini walau belum ada baris SPM sama sekali (bukan cuma "buat ulang") — ia
 * cuma menolak kalau ada baris yang SUDAH DIAJUKAN/SP2D_TERBIT, yang mustahil
 * terjadi kalau memang belum ada baris sama sekali.
 */
export function KartuBuatRancanganSpm({ bayarId, refresh }: { bayarId: string; refresh: () => void }) {
  const { toast } = useToast();
  const [proses, setProses] = useState(false);

  async function buat() {
    setProses(true);
    try {
      const hasil = await api<{ dibuat: number }>('spm.regenerate', { bayar_id: bayarId });
      toast(`Rancangan SPM dibuat (${hasil.dibuat} kelompok prodi+tingkat+suplier).`, 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  return (
    <Card className="flex flex-col gap-2 border-l-4 border-l-primary">
      <p className="text-sm font-semibold text-gray-600">📋 Rancangan SPM belum dibuat untuk bulan ini</p>
      <p className="text-xs text-gray-500">
        Pembayaran bulan ini dibuat sebelum fitur rancangan SPM tersimpan ada (atau baris SPM-nya belum sempat
        terbentuk). Buat sekarang dari data Rekap saat ini — satu baris per prodi+tingkat+suplier, bisa diisi
        No. SPM/No. SP2D langsung setelah dibuat.
      </p>
      <Button onClick={() => void buat()} disabled={proses}>
        📝 Buat Rancangan SPM dari Rekap
      </Button>
    </Card>
  );
}

function BarisSpm({ s, semuaSpm, proses, onSimpanSpm, onSimpanSp2d, onPisahkan, onGabungkan }: {
  s: SpmBaris; semuaSpm: SpmBaris[]; proses: boolean;
  onSimpanSpm: (spmId: string, noSpm: string, tglSpm: string) => void;
  onSimpanSp2d: (spmId: string, noSp2d: string, tglSp2d: string) => void;
  onPisahkan: (spmId: string) => void;
  onGabungkan: (spmIdA: string, spmIdB: string) => void;
}) {
  const [noSpm, setNoSpm] = useState(s.no_spm);
  const [tglSpm, setTglSpm] = useState(s.tgl_spm);
  const [noSp2d, setNoSp2d] = useState(s.no_sp2d);
  const [tglSp2d, setTglSp2d] = useState(s.tgl_sp2d);

  // Baris hasil split ditandai dgn nit_anggota ATAU induk_spm_id terisi.
  // Pasangan utk digabungkan lagi = baris LAIN berbagi kunci grup yang sama,
  // masih DRAFT (spm.gabung mensyaratkan keduanya DRAFT).
  const sudahDisplit = !!(s.induk_spm_id || s.nit_anggota);
  const pasangan = sudahDisplit
    ? semuaSpm.filter((x) => x.spm_id !== s.spm_id && x.status === 'DRAFT' && kunciGrup(x) === kunciGrup(s))
    : [];

  return (
    <tr className="border-b border-gray-100 align-top">
      <td className="py-2 pr-2">
        <div className="font-medium">{s.prodi} / {s.tingkat}</div>
        <div className="text-gray-500">{s.penyedia_nama || s.penyedia_id || '(belum ditentukan)'}</div>
        {sudahDisplit && (
          <div className="mt-1 flex flex-col items-start gap-0.5 text-[11px] text-purple-700">
            <span>{s.induk_spm_id ? `Pecahan dari ${s.induk_spm_id}` : 'Sisa induk (sudah dipecah)'}</span>
            {pasangan.map((p) => (
              <button key={p.spm_id} className="text-primary underline disabled:opacity-50" disabled={proses}
                onClick={() => onGabungkan(s.spm_id, p.spm_id)}>
                ↩️ Gabungkan kembali{pasangan.length > 1 ? ` (${p.spm_id})` : ''}
              </button>
            ))}
          </div>
        )}
        {s.status === 'DRAFT' && (
          <button className="mt-1 block text-primary underline disabled:opacity-50" disabled={proses}
            onClick={() => onPisahkan(s.spm_id)}>
            ✂️ Pisahkan Taruna
          </button>
        )}
      </td>
      <td className="py-2 pr-2 text-right">{formatRupiah(s.nominal)}</td>
      <td className="py-2 pr-2"><Badge status={s.status} /></td>
      <td className="py-2 pr-2">
        {s.status === 'DRAFT' ? (
          <div className="flex flex-wrap items-center gap-1">
            <input value={noSpm} onChange={(e) => setNoSpm(e.target.value)} placeholder="No. SPM"
              className="w-24 rounded border border-gray-300 px-1.5 py-1 text-xs" />
            <input type="date" value={tglSpm} onChange={(e) => setTglSpm(e.target.value)}
              className="rounded border border-gray-300 px-1.5 py-1 text-xs" />
            <button className="text-primary underline disabled:opacity-50" disabled={proses || !noSpm || !tglSpm}
              onClick={() => onSimpanSpm(s.spm_id, noSpm, tglSpm)}>
              Simpan
            </button>
          </div>
        ) : (
          <span>{s.no_spm || '-'}{s.tgl_spm ? ` (${s.tgl_spm})` : ''}</span>
        )}
      </td>
      <td className="py-2">
        {s.status === 'DIAJUKAN' ? (
          <div className="flex flex-wrap items-center gap-1">
            <input value={noSp2d} onChange={(e) => setNoSp2d(e.target.value)} placeholder="No. SP2D"
              className="w-24 rounded border border-gray-300 px-1.5 py-1 text-xs" />
            <input type="date" value={tglSp2d} onChange={(e) => setTglSp2d(e.target.value)}
              className="rounded border border-gray-300 px-1.5 py-1 text-xs" />
            <button className="text-primary underline disabled:opacity-50" disabled={proses || !noSp2d || !tglSp2d}
              onClick={() => onSimpanSp2d(s.spm_id, noSp2d, tglSp2d)}>
              Simpan
            </button>
          </div>
        ) : s.status === 'SP2D_TERBIT' ? (
          <span>{s.no_sp2d || '-'}{s.tgl_sp2d ? ` (${s.tgl_sp2d})` : ''}</span>
        ) : (
          <span className="text-gray-400">— (ajukan SPM dulu)</span>
        )}
      </td>
    </tr>
  );
}

export function KartuSpmDalamKampus({ bulan, bayarId, spm, refresh }: {
  bulan: string; bayarId: string; spm: SpmBaris[]; refresh: () => void;
}) {
  const { toast } = useToast();
  const [proses, setProses] = useState(false);
  const [pisahSpmId, setPisahSpmId] = useState<string | null>(null);

  const semuaDraft = spm.length > 0 && spm.every((s) => s.status === 'DRAFT');
  const total = spm.reduce((s, x) => s + x.nominal, 0);
  const jmlSp2dTerbit = spm.filter((s) => s.status === 'SP2D_TERBIT').length;

  // Urutkan agar baris SATU kelompok (termasuk pecahan hasil spm.split) BERSEBELAHAN:
  // prodi → tingkat → penyedia → induk (tanpa induk_spm_id) dulu, lalu pecahannya.
  // Tanpa ini, baris pecahan (di-append di akhir sheet) muncul jauh dari induknya
  // sehingga tampak "hilang" (padahal ada) — lihat keluhan Firdaus.
  const spmUrut = [...spm].sort((a, b) =>
    (a.prodi || '').localeCompare(b.prodi || '') ||
    (a.tingkat || '').localeCompare(b.tingkat || '') ||
    String(a.penyedia_id || '').localeCompare(String(b.penyedia_id || '')) ||
    (a.induk_spm_id ? 1 : 0) - (b.induk_spm_id ? 1 : 0) ||
    String(a.spm_id).localeCompare(String(b.spm_id)),
  );

  async function simpanSpm(spmId: string, noSpm: string, tglSpm: string) {
    setProses(true);
    try {
      const baris = spm.find((s) => s.spm_id === spmId);
      await api('spm.update', {
        spm_id: spmId, no_spm: noSpm, tgl_spm: tglSpm,
        status: baris?.status === 'DRAFT' ? 'DIAJUKAN' : undefined
      });
      toast('No. SPM tersimpan.', 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  async function simpanSp2d(spmId: string, noSp2d: string, tglSp2d: string) {
    setProses(true);
    try {
      await api('spm.set_sp2d', { spm_id: spmId, no_sp2d: noSp2d, tgl_sp2d: tglSp2d });
      toast('No. SP2D tersimpan.', 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  async function regenerate() {
    setProses(true);
    try {
      const hasil = await api<{ dihapus: number; dibuat: number }>('spm.regenerate', { bayar_id: bayarId });
      toast(`SPM dibuat ulang dari rekap terbaru (${hasil.dibuat} kelompok).`, 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  async function gabungkan(spmIdA: string, spmIdB: string) {
    setProses(true);
    try {
      await api('spm.gabung', { spm_id_a: spmIdA, spm_id_b: spmIdB });
      toast('SPM digabungkan kembali.', 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-600">📋 SPM Dalam Kampus — per Prodi+Tingkat+Suplier</p>
        <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary-dark">
          {jmlSp2dTerbit}/{spm.length} SP2D terbit
        </span>
      </div>
      <p className="text-xs text-gray-500">
        Baris di bawah <strong>tersimpan</strong> (bukan perkiraan) — dibuat otomatis dari rekap saat
        pembayaran ini dibuat, satu baris per suplier. Isi No. SPM begitu diajukan ke KPPN, lalu No. SP2D
        begitu terbit.
      </p>

      {semuaDraft && (
        <div>
          <Button varian="garis" onClick={() => void regenerate()} disabled={proses}>
            🔄 Buat ulang dari Rekap terbaru
          </Button>
          <p className="mt-1 text-xs text-gray-400">
            Hanya bisa selama SEMUA baris masih DRAFT — dipakai kalau Rekap dikoreksi setelah pembayaran dibuat.
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-1 pr-2">Prodi/Tingkat · Suplier</th>
              <th className="py-1 pr-2 text-right">Nominal</th>
              <th className="py-1 pr-2">Status</th>
              <th className="py-1 pr-2">No. SPM</th>
              <th className="py-1">No. SP2D</th>
            </tr>
          </thead>
          <tbody>
            {spmUrut.map((s) => (
              <BarisSpm key={s.spm_id} s={s} semuaSpm={spm} proses={proses} onSimpanSpm={simpanSpm} onSimpanSp2d={simpanSp2d}
                onPisahkan={setPisahSpmId} onGabungkan={(a, b) => void gabungkan(a, b)} />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-300 font-bold">
              <td className="py-1 pr-2">TOTAL</td>
              <td className="py-1 pr-2 text-right">{formatRupiah(total)}</td>
              <td colSpan={3} className="py-1 text-gray-500">{bulan}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {pisahSpmId && (
        <ModalPisahTaruna spmId={pisahSpmId} onClose={() => setPisahSpmId(null)} onSukses={refresh} />
      )}
    </Card>
  );
}
