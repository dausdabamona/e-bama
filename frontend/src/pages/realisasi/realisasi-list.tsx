// /realisasi (Senat + Pembina menandatangani; PPK/Staf PPK memantau read-only)
// — pesanan TERKIRIM menunggu realisasi + riwayat realisasi.
//
// Kartu "Menunggu Tanda Tangan Anda" (HANYA Pembina/Senat) memungkinkan tanda
// tangan BANYAK hari sekaligus lewat realisasi.ttd_massal — mengejar bulan yang
// tertunda tanpa membuka puluhan halaman. Tanggal dipilih EKSPLISIT & kata sandi
// tetap wajib: tanda tangan adalah bukti pertanggungjawaban, bukan formalitas.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { BulanPicker, bulanIni } from '../../components/bulan-picker';
import { PinConfirmModal } from '../../components/pin-confirm';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useToast } from '../../components/ui/toast';
import { api } from '../../lib/api';
import { useListCache } from '../../lib/use-list-cache';
import type { Pesanan } from '../pesanan/tipe';
import type { Realisasi } from './tipe';

/** Batas per panggilan — samakan dengan _TTD_MASSAL_MAKS_ di 13_realisasi.gs. */
const TTD_MASSAL_MAKS = 40;

function statusTtd(r: Realisasi): { label: string; status: string } {
  if (r.ttd_pembina_at && r.ttd_senat_at) return { label: 'Lengkap', status: 'SELESAI' };
  if (r.ttd_pembina_at) return { label: 'Menunggu TTD Senat', status: 'DIAJUKAN' };
  if (r.ttd_senat_at) return { label: 'Menunggu TTD Pembina', status: 'DIAJUKAN' };
  return { label: 'Belum ada TTD', status: 'DRAFT' };
}

export function HalamanRealisasiList() {
  const [bulan, setBulan] = useState(bulanIni());
  const { session } = useAuth();
  const { toast } = useToast();
  const pesananQ = useListCache<{ pesanan: Pesanan[] }>('pesanan.list', { bulan });
  const realisasiQ = useListCache<{ realisasi: Realisasi[] }>('realisasi.list', { bulan });

  const memuat = pesananQ.memuat || realisasiQ.memuat;
  const galat = pesananQ.galat || realisasiQ.galat;
  const data = pesananQ.data && realisasiQ.data ? { pesanan: pesananQ.data.pesanan, realisasi: realisasiQ.data.realisasi } : null;

  const punyaRealisasi = new Set(data?.realisasi?.map((r) => r.pesanan_id));
  const menunggu = data?.pesanan?.filter((p) => p.status === 'TERKIRIM' && !punyaRealisasi.has(p.pesanan_id)) ?? [];

  // ── Tanda tangan massal (Pembina/Senat) ──
  // Frontend hanya menyembunyikan; otorisasi sebenarnya di ACTION_MAP.
  const bisaTtd = session?.role === 'PEMBINA' || session?.role === 'SENAT';
  const perluTtdSaya = useMemo(() => {
    if (!bisaTtd) return [];
    return (data?.realisasi ?? [])
      .filter((r) => (session?.role === 'PEMBINA' ? !r.ttd_pembina_at : !r.ttd_senat_at))
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [data?.realisasi, bisaTtd, session?.role]);

  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [tampilPin, setTampilPin] = useState(false);
  const terpilih = perluTtdSaya.filter((r) => pilih.has(r.real_id));

  function toggle(id: string) {
    setPilih((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function pilihSemua() {
    // Batasi ke maksimum satu panggilan; sisanya bisa ditandatangani di batch berikutnya.
    setPilih(new Set(perluTtdSaya.slice(0, TTD_MASSAL_MAKS).map((r) => r.real_id)));
  }

  // ── Lengkapi realisasi otomatis basis Pesanan (PPK/KPA, kejar tenggat) ──
  // Aksi eksplisit + konfirmasi; backend menolak sebelum akhir bulan + 3 hari
  // kerja. TIDAK menandatangani apa pun — Pembina/Senat tetap ttd (massal).
  const bisaAuto = session?.role === 'PPK' || session?.role === 'KPA';
  const [prosesAuto, setProsesAuto] = useState(false);

  async function lengkapiOtomatis() {
    if (!window.confirm(
      `Isi otomatis realisasi bulan ${bulan} untuk ${menunggu.length} tanggal yang belum ada realisasinya?\n\n`
      + 'Nilainya DIASUMSIKAN sama dengan pesanan dan ditandai "Auto dari Pesanan" (jejak audit). '
      + 'Tanda tangan Pembina & Senat tetap diperlukan agar masuk rekap; foto/bukti bisa diisi menyusul.'
    )) return;
    setProsesAuto(true);
    try {
      const r = await api<{ dibuat: number; tanggal: string[] }>('realisasi.lengkapi_otomatis', { bulan });
      toast(r.dibuat > 0
        ? `${r.dibuat} realisasi dibuat otomatis (${r.tanggal[0]} s.d. ${r.tanggal[r.tanggal.length - 1]}). Minta Pembina & Senat tanda tangan massal.`
        : 'Tidak ada yang perlu dibuat — semua pesanan TERKIRIM sudah punya realisasi.', 'sukses');
      realisasiQ.refresh();
      pesananQ.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProsesAuto(false);
    }
  }

  async function ttdMassal(kataSandi: string) {
    const hasil = await api<{ ditandatangani: number; lengkap: number; dilewati: number }>(
      'realisasi.ttd_massal',
      { real_ids: terpilih.map((r) => r.real_id), pin: kataSandi }
    );
    toast(
      `${hasil.ditandatangani} hari ditandatangani`
      + (hasil.lengkap ? ` · ${hasil.lengkap} hari kini LENGKAP (masuk rekap)` : '')
      + (hasil.dilewati ? ` · ${hasil.dilewati} dilewati (sudah ada tanda tangan Anda)` : ''),
      'sukses'
    );
    setTampilPin(false);
    setPilih(new Set());
    realisasiQ.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary-dark">Realisasi</h1>
        <Link to="/menu-hari-ini" className="text-sm text-primary underline">🍽️ Menu Hari Ini</Link>
      </div>
      <BulanPicker bulan={bulan} onChange={setBulan} />

      {memuat && !data && <LoadingSpinner label="Memuat…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={() => { pesananQ.refresh(); realisasiQ.refresh(); }} />}

      {data && perluTtdSaya.length > 0 && (
        <Card className="flex flex-col gap-2 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              Menunggu Tanda Tangan Anda ({perluTtdSaya.length} hari)
            </p>
            <div className="flex gap-2">
              <Button varian="garis" className="px-3 text-xs" onClick={pilihSemua}>Pilih Semua</Button>
              <Button varian="polos" className="px-3 text-xs" onClick={() => setPilih(new Set())}>Kosongkan</Button>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Hari yang belum bertanda tangan <strong>Pembina dan Senat</strong> tidak
            dihitung sebagai hari makan sah di rekap bulanan.
          </p>
          <div className="max-h-64 overflow-y-auto rounded border border-gray-200">
            {perluTtdSaya.map((r) => (
              <label key={r.real_id} className="flex min-h-tap items-center gap-2 border-b border-gray-100 px-2 py-1 text-sm">
                <input type="checkbox" checked={pilih.has(r.real_id)} onChange={() => toggle(r.real_id)} className="h-5 w-5" />
                <span className="flex-1">
                  {r.tanggal}
                  <span className="text-gray-400"> · {r.jml_taruna_makan} taruna makan</span>
                </span>
                <Badge status={statusTtd(r).status}>{statusTtd(r).label}</Badge>
              </label>
            ))}
          </div>
          {perluTtdSaya.length > TTD_MASSAL_MAKS && (
            <p className="text-xs text-amber-700">
              ⓘ Maksimal {TTD_MASSAL_MAKS} hari sekali tanda tangan — sisanya bisa
              ditandatangani pada putaran berikutnya.
            </p>
          )}
          <Button onClick={() => setTampilPin(true)} disabled={!terpilih.length}>
            ✍️ Tanda Tangani {terpilih.length} Hari Sekaligus
          </Button>
        </Card>
      )}

      {tampilPin && terpilih.length > 0 && (
        <PinConfirmModal
          judul={`Tanda Tangan ${terpilih.length} Hari`}
          keterangan={
            `Anda akan menandatangani ${terpilih.length} hari realisasi `
            + `(${terpilih[0].tanggal}${terpilih.length > 1 ? ` s.d. ${terpilih[terpilih.length - 1].tanggal}` : ''}) `
            + `sebagai ${session?.role}. Masukkan kata sandi Anda untuk mengesahkan.`
          }
          onBatal={() => setTampilPin(false)}
          onKonfirmasi={ttdMassal}
        />
      )}

      {data && bisaAuto && menunggu.length > 0 && (
        <Card className="flex flex-col gap-2 border-l-4 border-l-primary">
          <p className="text-sm font-semibold text-primary-dark">⚡ Kejar Tenggat Pencairan</p>
          <p className="text-xs text-gray-600">
            {menunggu.length} tanggal bulan ini belum ada realisasinya. Isi otomatis memakai nilai{' '}
            <strong>sama dengan pesanan</strong> (ditandai "Auto dari Pesanan" — jejak audit), supaya Pembina &amp;
            Senat tinggal tanda tangan massal dan rekap bulanan bisa dibentuk. Foto/bukti tetap bisa diisi menyusul.
            Baru dibuka mulai <strong>akhir bulan + 3 hari kerja</strong>.
          </p>
          <Button varian="garis" onClick={() => void lengkapiOtomatis()} disabled={prosesAuto}>
            {prosesAuto ? 'Memproses…' : `⚡ Isi Otomatis ${menunggu.length} Realisasi dari Pesanan`}
          </Button>
        </Card>
      )}

      {data && (
        <>
          <h2 className="text-sm font-semibold text-gray-600">Menunggu Realisasi</h2>
          {menunggu.length === 0 && <EmptyState pesan="Tidak ada pesanan menunggu realisasi." />}
          {menunggu.map((p) => (
            <Link key={p.pesanan_id} to={`/realisasi/baru/${p.pesanan_id}`}>
              <Card className="flex items-center justify-between active:bg-primary-light/30">
                <div>
                  <p className="font-semibold">{p.tgl_makan}</p>
                  <p className="text-sm text-gray-500">{p.menu}</p>
                </div>
                <Badge status="TERKIRIM" />
              </Card>
            </Link>
          ))}

          <h2 className="mt-2 text-sm font-semibold text-gray-600">Riwayat Realisasi</h2>
          {(data.realisasi ?? []).length === 0 && <EmptyState pesan="Belum ada realisasi bulan ini." />}
          {(data.realisasi ?? [])
            .slice()
            .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
            .map((r) => {
              const st = statusTtd(r);
              return (
                <Link key={r.real_id} to={`/realisasi/${r.real_id}`}>
                  <Card className="flex items-center justify-between active:bg-primary-light/30">
                    <div>
                      <p className="font-semibold">{r.tanggal}</p>
                      <p className="text-sm text-gray-500">{r.jml_taruna_makan} taruna makan · {r.porsi_diterima} porsi</p>
                      {r.auto_dari_pesanan && (
                        <p className="text-xs text-amber-700">⚡ Auto dari Pesanan — asumsi, bukti bisa menyusul</p>
                      )}
                    </div>
                    <Badge status={st.status}>{st.label}</Badge>
                  </Card>
                </Link>
              );
            })}
        </>
      )}
    </div>
  );
}
