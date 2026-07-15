// /cetak/pendebetan-penyedia — RINGKASAN penerusan tagih-ulang gagal debet per
// bulan (TAGIHAN LUNAS yang belum diteruskan ke penyedia). Dokumen dipisah dua
// audiens, masing-masing halaman cetak sendiri:
//   • Surat ke BANK       → /cetak/surat-pendebetan-bank/:bulan (nominal saja)
//   • Laporan ke PENYEDIA → /cetak/laporan-penyaluran/:bulan   (rincian nama)
// Halaman ini TIDAK lagi mencetak dokumen campuran — hanya daftar per bulan +
// dua tombol + panel "Konfirmasi Bank Sudah Proses" (tagihan.teruskan_penyedia).
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { labelBulan } from '../../components/bulan-picker';
import { ambilBerkasInput, berkasKeBase64 } from '../../lib/berkas';
import { aksiTulis } from '../../lib/sync';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useToast } from '../../components/ui/toast';
import { useListCache } from '../../lib/use-list-cache';
import { formatRupiah } from '../tagihan/tipe';

interface Baris { tagihan_id: string; nit: string; nama: string; prodi: string; tingkat: string; bulan: string; nominal: number }
interface PendebetanData { baris: Baris[] }

const URUT_TK: Record<string, number> = { I: 1, II: 2, III: 3, '1': 1, '2': 2, '3': 3 };
function urut(a: Baris, b: Baris): number {
  return a.prodi.localeCompare(b.prodi) || (URUT_TK[a.tingkat] ?? 9) - (URUT_TK[b.tingkat] ?? 9) || a.nama.localeCompare(b.nama, 'id');
}

/**
 * Panel "Konfirmasi Bank Sudah Proses" untuk SATU bulan. Setelah bank mendebet
 * Senat → transfer ke Penyedia dan mengirim notifikasi, PPK/Senat mencentang
 * taruna yang benar-benar sudah diproses (default semua), mengunggah notifikasi
 * bank sebagai bukti, lalu menandainya lewat tagihan.teruskan_penyedia. Taruna
 * itu langsung pindah ke "Lunas, sudah diteruskan" dan HILANG dari daftar
 * tagihan aktif maupun dari dokumen surat/laporan bulan itu. Mendukung
 * konfirmasi sebagian (bila bank hanya memproses sebagian).
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
  const [buka, setBuka] = useState(false);

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

  if (!buka) {
    return (
      <Button varian="garis" onClick={() => setBuka(true)}>✅ Konfirmasi Bank Sudah Proses</Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-teal-200 bg-teal-50/40 p-3">
      <p className="text-sm font-semibold text-primary-dark">✅ Konfirmasi Bank Sudah Proses — {labelBulan(bulan)}</p>
      <p className="text-xs text-gray-500">
        Centang taruna yang <b>sudah diproses bank</b> (default semua), lalu unggah notifikasi/bukti dari bank.
        Taruna yang ditandai akan pindah ke <b>Lunas, sudah diteruskan</b> dan hilang dari daftar tagihan aktif.
      </p>
      <div className="flex items-center justify-between text-xs">
        <button className="text-primary" onClick={() => setTerpilih(new Set(rows.map((r) => r.tagihan_id)))}>Pilih semua</button>
        <button className="text-gray-500" onClick={() => setTerpilih(new Set())}>Kosongkan</button>
      </div>
      <div className="flex max-h-52 flex-col gap-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2">
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
    </div>
  );
}

export function HalamanCetakPendebetanPenyedia() {
  const nav = useNavigate();
  const { data, memuat, galat, refresh } = useListCache<PendebetanData>('cetak.pendebetan_penyedia', {});

  const baris = data?.baris ?? [];
  const grup = useMemo(() => {
    const m = new Map<string, Baris[]>();
    baris.forEach((b) => { if (!m.has(b.bulan)) m.set(b.bulan, []); m.get(b.bulan)!.push(b); });
    return Array.from(m.entries())
      .sort((a, c) => c[0].localeCompare(a[0]))
      .map(([bulan, rows]) => ({ bulan, rows, total: rows.reduce((s, r) => s + r.nominal, 0) }));
  }, [baris]);

  return (
    <div className="flex flex-col gap-4">
      <button className="text-left text-sm text-primary" onClick={() => nav(-1)}>← Kembali</button>
      <h1 className="text-xl font-bold text-primary-dark">Penerusan Dana ke Penyedia (Tagih-Ulang Gagal Debet)</h1>
      <p className="text-sm text-gray-500">
        Dana taruna gagal-debet yang sudah <b>LUNAS</b> (masuk rekening Senat) dan <b>belum diteruskan</b> ke penyedia,
        dikelompokkan per bulan. Tiap bulan punya <b>dua dokumen terpisah</b>: <b>Surat ke Bank</b> (nominal saja, untuk
        instruksi debit) dan <b>Laporan ke Penyedia</b> (rincian nama, untuk pertanggungjawaban). Alur: cetak surat bank →
        cetak laporan penyedia → kirim ke bank → setelah bank proses, tandai selesai.
      </p>

      {memuat && !data && <LoadingSpinner label="Memuat data…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}
      {data && grup.length === 0 && (
        <EmptyState pesan="Tidak ada tagihan LUNAS yang belum diteruskan ke penyedia." />
      )}

      {grup.map((g) => (
        <Card key={g.bulan} className="flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-base font-bold text-primary-dark">{labelBulan(g.bulan)}</p>
              <p className="text-xs text-gray-500">{g.rows.length} taruna · {formatRupiah(g.total)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => nav(`/cetak/surat-pendebetan-bank/${g.bulan}`)}>🏦 Surat ke Bank</Button>
            <Button varian="garis" onClick={() => nav(`/cetak/laporan-penyaluran/${g.bulan}`)}>📋 Laporan ke Penyedia</Button>
          </div>
          <PanelKonfirmasiBank bulan={g.bulan} rows={g.rows} onSelesai={refresh} />
        </Card>
      ))}
    </div>
  );
}
