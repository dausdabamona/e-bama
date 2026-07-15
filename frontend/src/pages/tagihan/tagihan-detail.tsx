// /tagihan/:id — riwayat SP (unduh PDF) + form bukti setor (Senat).
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { sepertiPpk, useAuth } from '../../auth/auth-context';
import { ambilBerkasInput, berkasKeBase64 } from '../../lib/berkas';
import { aksiTulis } from '../../lib/sync';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { useToast } from '../../components/ui/toast';
import { api } from '../../lib/api';
import { useListCache } from '../../lib/use-list-cache';
import { urlDrive } from '../pesanan/tipe';
import { formatRupiah, type KebijakanTagihan, type SuratPeringatan, type Tagihan } from './tipe';
import { urutkanTagihan } from './urutan';
import type { Taruna } from '../taruna/tipe';

function hariIni(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Format angka mentah → string berpemisah ribuan id-ID (mis. "1740000" → "1.740.000"). */
function formatRibuan(v: string): string {
  const digits = v.replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('id-ID') : '';
}

export function HalamanTagihanDetail() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const nav = useNavigate();
  const { toast } = useToast();

  const tagihanQ = useListCache<{ tagihan: Tagihan[]; kebijakan?: KebijakanTagihan }>('tagihan.list', {});
  const spQ = useListCache<{ sp: SuratPeringatan[] }>('sp.list', { tagihan_id: id });
  const tarunaQ = useListCache<{ taruna: Taruna[] }>('taruna.list', {});

  const [tglSetor, setTglSetor] = useState(hariIni());
  const [fotoList, setFotoList] = useState<{ nama: string; base64: string }[]>([]);
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');
  const [tampilHapus, setTampilHapus] = useState(false);
  const [nilaiTransfer, setNilaiTransfer] = useState('');

  const bisaSetorVerifikasi = session?.role === 'SENAT' || session?.role === 'PEMBINA'
    || session?.role === 'ADMIN' || sepertiPpk(session?.role);

  if (tagihanQ.memuat && !tagihanQ.data) return <LoadingSpinner />;
  if (tagihanQ.galat && !tagihanQ.data) return <ErrorMessage pesan={tagihanQ.galat} onRetry={tagihanQ.refresh} />;
  const t = tagihanQ.data?.tagihan?.find((x) => x.tagihan_id === id);
  if (!t) return <ErrorMessage pesan="Tagihan tidak ditemukan." onRetry={tagihanQ.refresh} />;
  const namaTaruna = tarunaQ.data?.taruna?.find((x) => x.nit === t.nit)?.nama;
  const nilaiTransferNum = Number(nilaiTransfer !== '' ? nilaiTransfer : t.nominal);
  const toleransi = tagihanQ.data?.kebijakan?.toleransiSelisihTransfer ?? 20000;

  // Urutan sama seperti daftar /tagihan — "berikutnya" = baris setelah ini
  // di urutan yang sama, supaya alur kerja bisa lanjut tanpa balik ke daftar.
  const urutan = urutkanTagihan(tagihanQ.data?.tagihan ?? [], session?.user_id);
  const idxSekarang = urutan.findIndex((x) => x.tagihan_id === t.tagihan_id);
  const berikutnya = idxSekarang >= 0 ? urutan[idxSekarang + 1] : undefined;

  async function pilihBerkas() {
    // Bukti setor boleh berupa foto/screenshot ATAU PDF (mis. bukti transfer
    // yang diunduh langsung dari aplikasi bank) — dibaca mentah tanpa
    // kompresi canvas (yang hanya berlaku utk gambar), sama seperti lampiran
    // kontrak (lib/berkas.ts).
    const file = await ambilBerkasInput();
    if (!file) return;
    try {
      const base64 = await berkasKeBase64(file);
      setFotoList((l) => [...l, { nama: file.name, base64 }]);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal membaca berkas.');
    }
  }

  async function kirimSetor() {
    if (fotoList.length === 0) { setGalat('Bukti setor wajib diunggah (minimal 1).'); return; }
    setProses(true); setGalat('');
    try {
      // Taruna bisa transfer beberapa kali → unggah tiap bukti (append lampiran).
      let antri = false;
      for (let i = 0; i < fotoList.length; i++) {
        const f = fotoList[i];
        const r = await aksiTulis('tagihan.setor', {
          tagihan_id: t!.tagihan_id, tgl_setor: tglSetor,
          berkas: { base64: f.base64, nama_file: f.nama || `bukti-setor-${i + 1}.jpg` }
        });
        if (r.antri) antri = true;
      }
      toast(antri ? 'Disimpan lokal, akan dikirim otomatis.'
        : `${fotoList.length} bukti setor terkirim, menunggu verifikasi.`, 'sukses');
      tagihanQ.refresh();
      setFotoList([]);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setProses(false);
    }
  }

  async function kirimVerifikasi() {
    const nilai = nilaiTransferNum;
    if (!Number.isFinite(nilai) || nilai <= 0) { setGalat('Nilai transferan harus lebih dari 0.'); return; }
    setProses(true); setGalat('');
    try {
      const r = await api<{ status: string }>('tagihan.verifikasi', { tagihan_id: t!.tagihan_id, nilai_transfer: nilai });
      toast(r.status === 'LUNAS' ? 'Verifikasi ke-2 berhasil — LUNAS.' : 'Verifikasi ke-1 tercatat, menunggu verifikator kedua (orang lain).', 'sukses');
      setNilaiTransfer('');
      tagihanQ.refresh();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setProses(false);
    }
  }

  async function terbitkanUlangSp() {
    setProses(true);
    try {
      await api('tagihan.regenerate_sp', { tagihan_id: t!.tagihan_id });
      toast('SP diterbitkan ulang.', 'sukses');
      spQ.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  // Header lokal (nama taruna + status) dibekukan tepat di bawah header app
  // (offset diukur dari tinggi <header> yang aktif — beda shell PPK desktop
  // vs shell umum, lihat komponen Layout/TopbarPpkDesktop) supaya tetap
  // terlihat saat men-scroll kartu-kartu panjang di bawahnya.
  const offsetHeader = sepertiPpk(session?.role) ? 'top-[68px] lg:top-[62px]' : 'top-[68px] lg:top-[77px]';

  return (
    <div className="flex flex-col gap-4">
      {/* Tombol Kembali/Berikutnya mengambang di kiri-kanan layar (mobile) —
          ikut posisi layar saat scroll, tidak perlu scroll ke atas dulu. */}
      <button
        className="fixed left-3 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xl text-primary shadow-lg ring-1 ring-gray-200 lg:hidden"
        onClick={() => nav('/tagihan')}
        aria-label="Kembali ke daftar tagihan"
      >
        ←
      </button>
      {berikutnya && (
        <button
          className="fixed right-3 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-xl text-white shadow-lg lg:hidden"
          onClick={() => nav(`/tagihan/${berikutnya.tagihan_id}`)}
          aria-label="Transaksi berikutnya"
        >
          →
        </button>
      )}

      <div className={`sticky z-30 -mx-4 flex items-center justify-between gap-3 bg-ivory px-4 py-3 lg:-mx-8 lg:px-8 ${offsetHeader}`}>
        <div className="flex items-center gap-3">
          <button className="hidden shrink-0 text-sm text-primary lg:inline" onClick={() => nav('/tagihan')}>← Kembali</button>
          <div>
            <h1 className="text-xl font-bold text-primary-dark">{namaTaruna ?? t.nit}</h1>
            <p className="text-xs text-gray-400">{t.nit} · {t.bulan}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {berikutnya && (
            <button className="hidden shrink-0 text-sm font-semibold text-primary lg:inline" onClick={() => nav(`/tagihan/${berikutnya.tagihan_id}`)}>
              Transaksi Berikutnya →
            </button>
          )}
          <Badge status={t.status} />
        </div>
      </div>

      <Card className="flex flex-col gap-2">
        <p className="text-sm text-gray-500">Nominal</p>
        <p className="text-lg font-bold">{formatRupiah(t.nominal)}</p>
        <p className="text-sm text-gray-500">Sebab</p>
        <p className="font-medium">{t.sebab.replace(/_/g, ' ')}</p>
        {t.tgl_setor && (
          <>
            <p className="text-sm text-gray-500">Tanggal Setor</p>
            <p className="font-medium">{t.tgl_setor}</p>
          </>
        )}
        {t.bukti_setor_drive_file_id && (
          <a href={urlDrive(t.bukti_setor_drive_file_id)} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
            📎 Lihat Bukti Setor
          </a>
        )}
        {t.status === 'LUNAS' && t.nilai_transfer > 0 && (
          <>
            <p className="text-sm text-gray-500">Nilai Transfer Diterima</p>
            <p className="font-medium">{formatRupiah(t.nilai_transfer)}</p>
          </>
        )}
        {t.status === 'LUNAS' && t.selisih_transfer > toleransi && (
          <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
            ⚠️ Piutang kurang bayar {formatRupiah(t.selisih_transfer)} — akan ditagihkan pada
            pendebetan bulan depan.
          </p>
        )}
        {t.status === 'LUNAS' && (
          t.tgl_diteruskan_penyedia ? (
            <p className="rounded-lg bg-green-50 p-2 text-sm text-green-800">
              ✅ <b>TUNTAS — tidak ada hutang.</b> Taruna sudah lunas (setor ke Senat) dan dana
              telah <b>diteruskan ke penyedia</b> pada {t.tgl_diteruskan_penyedia}. Senat pun tidak
              lagi berhutang.
            </p>
          ) : (
            <p className="rounded-lg bg-teal-50 p-2 text-sm text-teal-800">
              🎓 <b>Taruna sudah lunas — tidak berhutang.</b> Dana masih di rekening Senat, <b>belum
              diteruskan</b> ke penyedia. Setelah bank memproses penerusan, konfirmasi lewat{' '}
              <b>"Konfirmasi Bank Sudah Proses"</b> agar berstatus TUNTAS (Senat tidak berhutang).
            </p>
          )
        )}
      </Card>

      {t.status === 'TERTAGIH' && (
        <Card className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-gray-600">Alur Pembayaran → Rekening Senat</p>
          <p className="text-sm">
            {t.tgl_setor ? '✅' : '⏳'} Setor Bukti Transfer
            {t.tgl_setor ? ` — ${t.tgl_setor}` : ' — belum disetor'}
          </p>
          <p className="text-sm">
            {t.verif_1_oleh ? '✅' : '⏳'} Verifikasi 1/2
            {t.verif_1_oleh ? ` — ${t.verif_1_oleh}` : ' — menunggu'}
          </p>
          <p className="text-sm">
            {t.verif_2_oleh ? '✅' : '⏳'} Verifikasi 2/2
            {t.verif_2_oleh ? ` — ${t.verif_2_oleh}` : ' — menunggu, memicu LUNAS'}
          </p>
        </Card>
      )}

      <Card>
        <p className="mb-2 text-sm font-semibold text-gray-600">Riwayat Surat Peringatan</p>
        {spQ.memuat && !spQ.data && <LoadingSpinner />}
        {spQ.data?.sp?.length === 0 && <p className="text-sm text-gray-400">Belum ada SP terbit.</p>}
        {spQ.data?.sp?.map((s) => (
          <div key={s.sp_id} className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0">
            <div>
              <p className="font-medium">SP-{s.level}: {s.no_surat}</p>
              <p className="text-xs text-gray-400">Terbit {s.tgl_terbit} · Tenggat {s.tenggat}</p>
            </div>
            {s.drive_file_id && (
              <a href={urlDrive(s.drive_file_id)} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                Unduh PDF
              </a>
            )}
          </div>
        ))}
      </Card>

      {t.status === 'TERTAGIH' && bisaSetorVerifikasi && (
        <Card className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-600">Setor Bukti Transfer ke Rekening Senat</p>
          <label className="block text-sm font-medium text-gray-700">Tanggal Setor</label>
          <input type="date" value={tglSetor} onChange={(e) => setTglSetor(e.target.value)}
            className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5" />
          <Button varian="garis" onClick={() => void pilihBerkas()}>
            ➕ Tambah Bukti Transfer (bisa beberapa — transfer bertahap)
          </Button>
          {fotoList.length > 0 && (
            <ul className="flex flex-col gap-1">
              {fotoList.map((f, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg bg-gray-100 px-2 py-1 text-xs">
                  <span className="truncate">📎 {f.nama}</span>
                  <button className="ml-2 shrink-0 text-red-600" onClick={() => setFotoList((l) => l.filter((_, j) => j !== i))}>Hapus</button>
                </li>
              ))}
            </ul>
          )}
          {galat && <p className="text-sm text-red-600">{galat}</p>}
          <Button onClick={() => void kirimSetor()} disabled={proses}>
            {proses ? 'Mengirim…' : `Kirim Bukti Setor${fotoList.length > 1 ? ` (${fotoList.length})` : ''}`}
          </Button>
        </Card>
      )}

      {t.status === 'TERTAGIH' && bisaSetorVerifikasi && t.tgl_setor && (
        <Card className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-600">
            Verifikasi Pelunasan {t.verif_1_oleh ? '(2/2 — memicu LUNAS)' : '(1/2)'}
          </p>
          {(() => {
            const ids = (t.bukti_setor_ids && t.bukti_setor_ids.length > 0)
              ? t.bukti_setor_ids
              : (t.bukti_setor_drive_file_id ? [t.bukti_setor_drive_file_id] : []);
            if (ids.length === 0) return null;
            return (
              <div className="flex flex-col gap-2">
                {ids.length > 1 && <p className="text-xs font-medium text-gray-500">{ids.length} bukti transfer (transfer bertahap):</p>}
                {ids.map((id, i) => (
                  <div key={id} className="flex flex-col gap-1">
                    <img
                      src={`https://drive.google.com/thumbnail?id=${id}&sz=w1000`}
                      alt={`Bukti Setor ${i + 1}`}
                      className="max-h-96 w-full rounded-xl border border-gray-200 object-contain"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                    <a href={urlDrive(id)} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                      🔍 Buka ukuran penuh{ids.length > 1 ? ` (${i + 1})` : ''}
                    </a>
                  </div>
                ))}
              </div>
            );
          })()}
          <p className="text-xs text-gray-500">
            Cocokkan bukti di atas dengan mutasi rekening Senat, lalu masukkan nominal
            yang benar-benar masuk — boleh berbeda dari nominal tagihan (mis. potongan
            biaya transfer bank atau kurang bayar), inilah tanda sudah diverifikasi.
            Wajib oleh 2 orang berbeda (peran boleh sama).
          </p>
          {t.verif_1_oleh && t.verif_1_oleh === session?.user_id ? (
            <p className="text-sm text-amber-700">
              ⏳ Anda sudah verifikasi sebagai verifikator pertama. Menunggu verifikator
              kedua (orang lain).
            </p>
          ) : (
            <>
              <Input
                label="Nilai Transferan (Rp)"
                type="text"
                inputMode="numeric"
                value={formatRibuan(String(nilaiTransferNum))}
                onChange={(e) => setNilaiTransfer(e.target.value.replace(/\D/g, ''))}
              />
              {nilaiTransferNum !== t.nominal && (
                <p className="text-xs text-amber-700">
                  {t.nominal - nilaiTransferNum > toleransi
                    ? `⚠️ Kurang ${formatRupiah(t.nominal - nilaiTransferNum)} dari nominal tagihan (${formatRupiah(t.nominal)}) — di atas toleransi ${formatRupiah(toleransi)}, akan dicatat sebagai piutang untuk ditagihkan pada pendebetan bulan depan.`
                    : `⚠️ Selisih ${formatRupiah(Math.abs(nilaiTransferNum - t.nominal))} dari nominal tagihan (${formatRupiah(t.nominal)}) — masih dalam toleransi, pastikan sudah dicek dengan mutasi rekening.`}
                </p>
              )}
              {galat && <p className="text-sm text-red-600">{galat}</p>}
              <Button onClick={() => void kirimVerifikasi()} disabled={proses}>
                {proses ? 'Memproses…' : t.verif_1_oleh ? '✅ Verifikasi (2/2) → LUNAS' : '✅ Verifikasi (1/2)'}
              </Button>
            </>
          )}
        </Card>
      )}

      {t.status === 'TERTAGIH' && sepertiPpk(session?.role) && (
        <Card className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-gray-600">Tindakan PPK</p>
          {spQ.data && spQ.data.sp.length > 0 && (
            <Button varian="garis" onClick={() => void terbitkanUlangSp()} disabled={proses}>
              Terbitkan Ulang SP Level Aktif
            </Button>
          )}
          <Button varian="bahaya" onClick={() => setTampilHapus(true)} disabled={proses}>
            Hapuskan Tagihan
          </Button>
        </Card>
      )}

      {tampilHapus && (
        <ModalHapus
          onClose={() => setTampilHapus(false)}
          onSukses={() => { setTampilHapus(false); tagihanQ.refresh(); }}
          tagihanId={t.tagihan_id}
        />
      )}
    </div>
  );
}

function ModalHapus({ tagihanId, onClose, onSukses }: {
  tagihanId: string; onClose: () => void; onSukses: () => void;
}) {
  const { toast } = useToast();
  const [catatan, setCatatan] = useState('');
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');

  async function kirim() {
    if (!catatan.trim()) { setGalat('Catatan penghapusan wajib diisi.'); return; }
    setProses(true); setGalat('');
    try {
      await api('tagihan.waive', { tagihan_id: tagihanId, catatan_hapus: catatan.trim() });
      toast('Tagihan dihapuskan.', 'sukses');
      onSukses();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setProses(false);
    }
  }

  return (
    <Modal judul="Hapuskan Tagihan" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Input label="Catatan Penghapusan (wajib)" value={catatan} onChange={(e) => setCatatan(e.target.value)} autoFocus />
        {galat && <p className="text-sm text-red-600">{galat}</p>}
        <Button varian="bahaya" onClick={() => void kirim()} disabled={proses}>
          {proses ? 'Memproses…' : 'Hapuskan Tagihan'}
        </Button>
      </div>
    </Modal>
  );
}
