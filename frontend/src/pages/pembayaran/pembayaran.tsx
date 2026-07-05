// /pembayaran — PPK: buat & kelola SPM/SP2D; mesin status disederhanakan
// (dikonfirmasi Firdaus): DIAJUKAN → SELESAI langsung begitu No. SP2D diisi
// (SP2D = dana SUDAH cair ke rekening taruna). Tidak ada lagi konfirmasi
// Senat/tutup manual di alur normal — pendebetan taruna→Senat→Penyedia
// berjalan lewat dokumen cetak terpisah (Form-07 lalu Form-09).
import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { BulanPicker, bulanIni } from '../../components/bulan-picker';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { Input } from '../../components/ui/input';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useToast } from '../../components/ui/toast';
import { api } from '../../lib/api';
import { ambilFotoInput, kompresFotoBase64 } from '../../lib/foto';
import { useListCache } from '../../lib/use-list-cache';
import { formatRupiah } from '../tagihan/tipe';
import type { Pembayaran } from './tipe';

const URUTAN_STATUS: Pembayaran['status'][] = ['DIAJUKAN', 'SELESAI'];

export function HalamanPembayaran() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [bulan, setBulan] = useState(bulanIni());
  const { data, memuat, galat, refresh } = useListCache<{ pembayaran: Pembayaran[] }>('bayar.list', { bulan });
  const [proses, setProses] = useState(false);

  const b = data?.pembayaran?.find((x) => x.bulan === bulan);
  const [noSpm, setNoSpm] = useState('');
  const [tglSpm, setTglSpm] = useState('');
  const [noSp2d, setNoSp2d] = useState('');
  const [tglSp2d, setTglSp2d] = useState('');

  async function buat() {
    setProses(true);
    try {
      await api('bayar.create', { bulan });
      toast('Pembayaran dibuat.', 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  async function simpanSpm() {
    if (!noSpm || !tglSpm) { toast('No. SPM dan tanggal wajib diisi.', 'galat'); return; }
    setProses(true);
    try {
      await api('bayar.update', { bayar_id: b!.bayar_id, no_spm: noSpm, tgl_spm: tglSpm });
      toast('SPM tersimpan.', 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  async function simpanSp2d() {
    if (!noSp2d || !tglSp2d) { toast('No. SP2D dan tanggal wajib diisi.', 'galat'); return; }
    setProses(true);
    try {
      await api('bayar.update', { bayar_id: b!.bayar_id, no_sp2d: noSp2d, tgl_sp2d: tglSp2d });
      toast('SP2D tersimpan — dana sudah cair ke taruna, pembayaran SELESAI. Segera cetak Form 07!', 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  async function unggahLampiran(jenis: string) {
    const file = await ambilFotoInput();
    if (!file) return;
    const base64 = await kompresFotoBase64(file);
    setProses(true);
    try {
      await api('bayar.update', { bayar_id: b!.bayar_id, berkas: { base64, nama_file: file.name, jenis } });
      toast('Lampiran terunggah.', 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  /** Sinkronkan status dari kelengkapan SP2D_MONITORING (relasi 1 bulan : N SP2D). */
  async function sinkronkan() {
    setProses(true);
    try {
      await api('bayar.sync', { bulan });
      toast('Tersinkron — semua SP2D lengkap, pembayaran SELESAI.', 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  /** Fallback: baris historis yang kadung berstatus lama (sebelum penyederhanaan). */
  async function tutupManual() {
    setProses(true);
    try {
      await api('bayar.close', { bayar_id: b!.bayar_id });
      toast('Ditutup manual — SELESAI.', 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  const idx = b ? URUTAN_STATUS.indexOf(b.status) : -1;
  const statusLegacy = b && idx < 0; // status lama (SP2D_TERBIT/DITRANSFER/DIKONFIRMASI) dari sebelum disederhanakan

  // Rincian SP2D LIVE dari SP2D_MONITORING (relasi 1 bulan : N SP2D). sp2dSudahAda
  // = ada minimal satu SP2D terunggah (lewat rincian) ATAU No. SP2D "wakil" manual.
  const rincianSp2d = b?.sp2d_rincian ?? [];
  const sp2dLengkap = !!b?.sp2d_lengkap;
  const kelompokBersistem = rincianSp2d.filter((k) => k.sistem > 0);
  const kelompokCocok = kelompokBersistem.filter((k) => k.cocok).length;
  const kelompokBelum = kelompokBersistem.length - kelompokCocok;
  const adaSp2dTerunggah = rincianSp2d.some((k) => k.sp2d > 0);
  const sp2dSudahAda = b ? (!!b.no_sp2d || adaSp2dTerunggah) : false;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-primary-dark">Pembayaran</h1>
      <BulanPicker bulan={bulan} onChange={setBulan} />

      {memuat && !data && <LoadingSpinner label="Memuat…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}

      {data && !b && session?.role === 'PPK' && (
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-gray-500">Belum ada pembayaran untuk bulan ini.</p>
          <Button onClick={() => void buat()} disabled={proses}>
            {proses ? 'Memproses…' : 'Buat Pembayaran (dari Rekap FINAL)'}
          </Button>
        </Card>
      )}
      {data && !b && session?.role !== 'PPK' && <EmptyState pesan="Belum ada pembayaran bulan ini." />}

      {b && (
        <>
          <Card className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-lg font-bold">{formatRupiah(b.nilai_total)}</p>
              <Badge status={b.status} />
            </div>
            {!statusLegacy && (
              <ol className="mt-2 flex flex-col gap-1 text-sm">
                {URUTAN_STATUS.map((s, i) => (
                  <li key={s} className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${i <= idx ? 'bg-primary' : 'bg-gray-200'}`} />
                    <span className={i <= idx ? 'font-medium' : 'text-gray-400'}>{s.replace(/_/g, ' ')}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {/* Rincian SP2D LIVE dari SP2D_MONITORING — 1 bulan pembayaran = N SP2D
              (KPPN terbitkan 1 SP2D per kelompok Prodi+Tingkat). Read-only; angka
              diturunkan dari menu Laporan (impor Monitoring SP2D), bukan diketik di sini. */}
          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-600">📋 Rincian SP2D dari SP2D_MONITORING</p>
              {rincianSp2d.length > 0 && (
                sp2dLengkap
                  ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">✅ Semua {kelompokBersistem.length} kelompok cocok</span>
                  : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">⏳ Menunggu {kelompokBelum} dari {kelompokBersistem.length} kelompok</span>
              )}
            </div>

            {rincianSp2d.length === 0 ? (
              <p className="text-xs text-gray-500">
                Belum ada SP2D terunggah untuk bulan ini. Unggah file Monitoring SP2D lewat menu{' '}
                <Link to="/laporan" className="text-primary underline">Laporan</Link> — rincian per No. SP2D
                akan muncul di sini otomatis.
              </p>
            ) : (
              <>
                <p className="text-xs text-gray-500">
                  Satu bulan pembayaran terdiri dari <strong>banyak SP2D</strong> — KPPN menerbitkan satu SP2D
                  per kelompok Prodi+Tingkat. Angka di bawah diturunkan langsung dari data Monitoring SP2D
                  (menu Laporan), bukan diketik manual.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500">
                        <th className="py-1 pr-2">Prodi/Tingkat</th>
                        <th className="py-1 pr-2 text-right">Sistem</th>
                        <th className="py-1 pr-2 text-right">SP2D</th>
                        <th className="py-1">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rincianSp2d.map((k) => (
                        <Fragment key={`${k.prodi}|${k.tingkat}`}>
                          <tr className={`border-b border-gray-100 ${k.cocok ? '' : k.sistem > 0 ? 'bg-amber-50' : 'bg-red-50'}`}>
                            <td className="py-1 pr-2 font-medium">{k.prodi} / {k.tingkat}</td>
                            <td className="py-1 pr-2 text-right">{formatRupiah(k.sistem)}</td>
                            <td className="py-1 pr-2 text-right">{formatRupiah(k.sp2d)}</td>
                            <td className="py-1">
                              {k.cocok
                                ? <span className="text-green-700">✓ cocok</span>
                                : k.sistem > 0
                                  ? <span className="text-amber-700">kurang {formatRupiah(k.selisih)}</span>
                                  : <span className="text-red-600">SP2D nyasar</span>}
                            </td>
                          </tr>
                          {k.rincian.length > 0 && (
                            <tr>
                              <td colSpan={4} className="px-2 pb-2">
                                <ul className="ml-1 list-disc pl-4 text-[11px] text-gray-500">
                                  {k.rincian.map((sp, i) => (
                                    <li key={sp.no_sp2d || `${sp.no_spm}-${i}`}>
                                      No. SP2D <span className="font-mono">{sp.no_sp2d || '(belum terbit)'}</span>
                                      {' — '}{formatRupiah(sp.jumlah_pembayaran)}
                                      {sp.tgl_sp2d ? ` • ${sp.tgl_sp2d}` : ''}
                                      {sp.status_sp2d ? ` • ${sp.status_sp2d}` : ''}
                                    </li>
                                  ))}
                                </ul>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                {b.sp2d_perlu_cek_manual ? (
                  <p className="text-xs text-amber-700">
                    ⚠️ {b.sp2d_perlu_cek_manual} baris SP2D bulan ini gagal terbaca otomatis (perlu cek manual di
                    menu Laporan) — belum ikut dihitung.
                  </p>
                ) : null}

                {session?.role === 'PPK' && b.status === 'DIAJUKAN' && sp2dLengkap && (
                  <Button onClick={() => void sinkronkan()} disabled={proses}>
                    🔄 Sinkronkan Sekarang → SELESAI
                  </Button>
                )}
              </>
            )}
          </Card>

          {session?.role === 'PPK' && statusLegacy && (
            <Card className="flex flex-col gap-2 border-l-4 border-l-amber-500 bg-amber-50">
              <p className="text-sm font-semibold text-amber-800">⚠️ Status lama: {b.status.replace(/_/g, ' ')}</p>
              <p className="text-xs text-amber-700">
                Mesin status pembayaran sudah disederhanakan (DIAJUKAN → SELESAI langsung).
                Baris ini masih dari sebelum perubahan — tutup manual ke SELESAI.
              </p>
              <Button varian="bahaya" onClick={() => void tutupManual()} disabled={proses}>
                Tutup Manual ke SELESAI
              </Button>
            </Card>
          )}

          {session?.role === 'PPK' && b.status === 'DIAJUKAN' && !sp2dSudahAda && (
            <Card className="flex flex-col gap-2 border-l-4 border-l-primary">
              <p className="text-sm font-semibold text-gray-600">📄 Dokumen: Blokir &amp; Pendebetan Bank</p>
              <p className="text-xs text-gray-500">
                Bisa disiapkan dari sekarang — tidak perlu menunggu SP2D terbit. Cetak &amp; kirimkan
                surat permohonan blokir dan pendebetan massal rekening taruna ke rekening Senat —
                <strong> terpisah untuk Bank BSI dan BNI</strong>.
              </p>
              <Link to={`/cetak/form-07/${bulan}`}>
                <Button varian="garis" className="w-full">🖨️ Cetak Form 07 — Usulan Penahanan &amp; Pendebetan Bank</Button>
              </Link>
            </Card>
          )}

          {session?.role === 'PPK' && sp2dSudahAda && (
            <Card className="flex flex-col gap-2 border-l-4 border-l-red-500 bg-red-50">
              <p className="text-sm font-semibold text-red-800">🚨 MENDESAK — Cetak &amp; Kirim Surat Blokir ke Bank</p>
              <p className="text-xs text-red-700">
                No. SP2D sudah terbit — dana <strong>SUDAH cair ke rekening taruna</strong>. Segera cetak
                dan kirimkan surat blokir &amp; pendebetan massal ke Bank BSI dan BNI sebelum dana ditarik.
              </p>
              <Link to={`/cetak/form-07/${bulan}`}>
                <Button className="w-full">🖨️ Cetak Form 07 — Usulan Penahanan &amp; Pendebetan Bank</Button>
              </Link>
            </Card>
          )}

          {(session?.role === 'PPK' || session?.role === 'SENAT') && sp2dSudahAda && (
            <Card className="flex flex-col gap-2 border-l-4 border-l-primary">
              <p className="text-sm font-semibold text-gray-600">📄 Dokumen: Pendebetan Senat → Penyedia</p>
              <p className="text-xs text-gray-500">
                Setelah rekening taruna diblokir &amp; didebet ke rekening Senat, lanjutkan pengajuan
                pendebetan rekening Senat ke rekening penyedia — <strong>per bank (BSI &amp; BNI)</strong>.
              </p>
              <Link to={`/cetak/form-09/${bulan}`}>
                <Button varian="garis" className="w-full">🖨️ Cetak Form 09 — Pendebetan Rekening Senat → Penyedia</Button>
              </Link>
            </Card>
          )}

          {session?.role === 'PPK' && b.status === 'DIAJUKAN' && (
            <Card className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-gray-600">Input Manual (fallback/opsional)</p>
              <p className="text-xs text-gray-500">
                Cara utama menuju SELESAI adalah lewat impor Monitoring SP2D di menu Laporan lalu
                <strong> Sinkronkan</strong> di atas. Kolom di bawah hanya "wakil" manual — untuk kasus
                khusus (mis. SP2D belum terekam di Monitoring). Mengisi No. SP2D di sini langsung menandai
                pembayaran SELESAI.
              </p>
              <Input label="No. SPM (wakil)" value={noSpm} onChange={(e) => setNoSpm(e.target.value)} />
              <Input label="Tanggal SPM" type="date" value={tglSpm} onChange={(e) => setTglSpm(e.target.value)} />
              <Button varian="garis" onClick={() => void simpanSpm()} disabled={proses}>Simpan SPM</Button>

              <p className="mt-2 text-sm font-semibold text-gray-600">Input SP2D manual (langsung SELESAI)</p>
              <Input label="No. SP2D (wakil)" value={noSp2d} onChange={(e) => setNoSp2d(e.target.value)} />
              <Input label="Tanggal SP2D" type="date" value={tglSp2d} onChange={(e) => setTglSp2d(e.target.value)} />
              <Button varian="garis" onClick={() => void simpanSp2d()} disabled={proses}>Simpan SP2D</Button>
            </Card>
          )}

          {session?.role === 'PPK' && (
            <Card className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-gray-600">Unggah Lampiran</p>
              <div className="flex flex-wrap gap-2">
                <Button varian="garis" onClick={() => void unggahLampiran('SURAT')}>📄 Surat Blokir</Button>
                <Button varian="garis" onClick={() => void unggahLampiran('BUKTI_DEBET')}>📄 Bukti Debet</Button>
                <Button varian="garis" onClick={() => void unggahLampiran('INVOICE')}>📄 Invoice</Button>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
