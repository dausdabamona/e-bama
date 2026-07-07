// /tagihan/:id — riwayat SP (unduh PDF) + form bukti setor (Senat).
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
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
  const [fotoNama, setFotoNama] = useState('');
  const [fotoBase64, setFotoBase64] = useState('');
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');
  const [tampilHapus, setTampilHapus] = useState(false);
  const [nilaiTransfer, setNilaiTransfer] = useState('');

  const bisaSetorVerifikasi = session?.role === 'SENAT' || session?.role === 'PEMBINA'
    || session?.role === 'ADMIN' || session?.role === 'PPK';

  if (tagihanQ.memuat && !tagihanQ.data) return <LoadingSpinner />;
  if (tagihanQ.galat && !tagihanQ.data) return <ErrorMessage pesan={tagihanQ.galat} onRetry={tagihanQ.refresh} />;
  const t = tagihanQ.data?.tagihan?.find((x) => x.tagihan_id === id);
  if (!t) return <ErrorMessage pesan="Tagihan tidak ditemukan." onRetry={tagihanQ.refresh} />;
  const namaTaruna = tarunaQ.data?.taruna?.find((x) => x.nit === t.nit)?.nama;
  const nilaiTransferNum = Number(nilaiTransfer !== '' ? nilaiTransfer : t.nominal);
  const toleransi = tagihanQ.data?.kebijakan?.toleransiSelisihTransfer ?? 20000;

  // Urutan sama seperti daftar /tagihan — "berikutnya" = baris setelah ini
  // di urutan yang sama, supaya alur kerja bisa lanjut tanpa balik ke daftar.
  const urutan = urutkanTagihan(tagihanQ.data?.tagihan ?? []);
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
      setFotoNama(file.name);
      setFotoBase64(await berkasKeBase64(file));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal membaca berkas.');
    }
  }

  async function kirimSetor() {
    if (!fotoBase64) { setGalat('Bukti setor wajib diunggah.'); return; }
    setProses(true); setGalat('');
    try {
      const r = await aksiTulis('tagihan.setor', {
        tagihan_id: t!.tagihan_id, tgl_setor: tglSetor,
        berkas: { base64: fotoBase64, nama_file: fotoNama || 'bukti-setor.jpg' }
      });
      toast(r.antri ? 'Disimpan lokal, akan dikirim otomatis.' : 'Bukti setor terkirim, menunggu verifikasi.', 'sukses');
      tagihanQ.refresh();
      setFotoNama(''); setFotoBase64('');
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button className="text-sm text-primary" onClick={() => nav('/tagihan')}>← Kembali</button>
        {berikutnya && (
          <button className="text-sm font-semibold text-primary" onClick={() => nav(`/tagihan/${berikutnya.tagihan_id}`)}>
            Transaksi Berikutnya →
          </button>
        )}
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary-dark">{namaTaruna ?? t.nit}</h1>
          <p className="text-xs text-gray-400">{t.nit} · {t.bulan}</p>
        </div>
        <Badge status={t.status} />
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
            {fotoNama ? `📎 ${fotoNama}` : '📎 Unggah Screenshot/Foto/PDF Bukti Transfer'}
          </Button>
          {galat && <p className="text-sm text-red-600">{galat}</p>}
          <Button onClick={() => void kirimSetor()} disabled={proses}>
            {proses ? 'Mengirim…' : 'Kirim Bukti Setor'}
          </Button>
        </Card>
      )}

      {t.status === 'TERTAGIH' && bisaSetorVerifikasi && t.tgl_setor && (
        <Card className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-600">
            Verifikasi Pelunasan {t.verif_1_oleh ? '(2/2 — memicu LUNAS)' : '(1/2)'}
          </p>
          {t.bukti_setor_drive_file_id && (
            <div className="flex flex-col gap-1">
              <img
                src={`https://drive.google.com/thumbnail?id=${t.bukti_setor_drive_file_id}&sz=w1000`}
                alt="Bukti Setor"
                className="max-h-96 w-full rounded-xl border border-gray-200 object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
              <a href={urlDrive(t.bukti_setor_drive_file_id)} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                🔍 Buka ukuran penuh
              </a>
            </div>
          )}
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

      {t.status === 'TERTAGIH' && session?.role === 'PPK' && (
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
