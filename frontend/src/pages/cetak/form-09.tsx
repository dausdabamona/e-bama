// /cetak/form-09/:bulan (Senat, PPK, Admin) — Permohonan Pendebetan Rekening
// Senat → Rekening Penyedia (tahap-2 setelah Form-07 mendebet taruna → Senat).
// Menampilkan nomor rekening INSTANSI (Senat & Penyedia) per bank — bukan
// rekening taruna — jadi tetap tidak di-cache Dexie (pola sama Form-07).
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BulanPicker, bulanIni, labelBulan } from '../../components/bulan-picker';
import { BlokTtd2Kolom } from '../../components/cetak/blok-ttd';
import { KopSurat } from '../../components/cetak/kop-surat';
import { BarisCetak, SelCetak, TabelCetak } from '../../components/cetak/tabel-cetak';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { api } from '../../lib/api';
import { berkasKeBase64 } from '../../lib/berkas';
import { formatRupiah } from '../tagihan/tipe';

interface Pejabat { nama: string; nip: string }
interface BuktiForm09 { lamp_id: string; nama_file: string; drive_file_id: string; timestamp: string }
interface PerBank {
  bank: string; jml_taruna: number; total: number; rek_senat_sumber: string; rek_penyedia_tujuan: string;
  rek_senat_nama?: string; rek_penyedia_nama?: string;
}
interface Form09Data {
  bulan: string; bayar_id?: string; penyedia_nama: string; per_bank: PerBank[]; total_nominal: number; nominal_terbilang: string;
  biaya_admin_bank: number; bukti?: BuktiForm09[];
  pembayaran: { no_spm: string; tgl_spm: string; no_sp2d: string; tgl_sp2d: string; status: string };
  kontrak?: { no_kontrak: string; tgl_kontrak: string; adendum: string };
  pejabat: { PPK: Pejabat; KPA: Pejabat; DIREKTUR: Pejabat; WADIR3: Pejabat };
}

/** Fetch langsung ke GAS — tanpa cache Dexie (memuat nomor rekening instansi). */
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

export function HalamanCetakForm09() {
  const nav = useNavigate();
  const { bulan: bulanParam } = useParams<{ bulan?: string }>();
  const [bulan, setBulan] = useState(bulanParam || bulanIni());
  const { data, memuat, galat, refresh } = useTanpaCache<Form09Data>('cetak.form09', { bulan });
  const [noSurat, setNoSurat] = useState('');
  const [mengunggah, setMengunggah] = useState(false);
  const [pesanBukti, setPesanBukti] = useState('');

  async function unggahBukti(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMengunggah(true); setPesanBukti('');
    try {
      const base64 = await berkasKeBase64(file);
      await api('form09.simpan_bukti', { bulan, berkas: { base64, nama_file: file.name } });
      setPesanBukti('✓ Bukti berhasil diunggah & tersimpan sebagai arsip.');
      refresh();
    } catch (err) {
      setPesanBukti(err instanceof Error ? err.message : 'Gagal mengunggah bukti.');
    } finally {
      setMengunggah(false);
      e.target.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <button className="text-sm text-primary" onClick={() => nav(-1)}>← Kembali</button>
        {data && <Button varian="garis" onClick={() => window.print()}>🖨️ Cetak</Button>}
      </div>
      <h1 className="text-xl font-bold text-primary-dark print:hidden">Form 09 — Pendebetan Rekening Senat → Penyedia</h1>

      {!bulanParam && (
        <div className="print:hidden"><BulanPicker bulan={bulan} onChange={setBulan} /></div>
      )}

      {memuat && !data && <LoadingSpinner label="Memuat data…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}

      {data && (
        <Card className="flex flex-col gap-2 print:hidden">
          <p className="text-sm font-semibold text-gray-700">📎 Bukti Surat Bertanda Tangan</p>
          <p className="text-xs text-gray-500">
            Unggah scan/foto surat Form-09 yang sudah <strong>ditandatangani &amp; dicap</strong> (PDF/JPG/PNG, maks 5 MB)
            sebagai arsip bulan {labelBulan(data.bulan)}. Dokumen-only — tidak mengubah status pembayaran.
          </p>
          <input type="file" accept="image/*,application/pdf" disabled={mengunggah}
            onChange={(e) => void unggahBukti(e)}
            className="min-h-tap rounded-xl border border-gray-300 px-3 py-2 text-sm" />
          {mengunggah && <LoadingSpinner label="Mengunggah bukti…" />}
          {pesanBukti && <p className="text-xs text-gray-600">{pesanBukti}</p>}
          {(data.bukti ?? []).length > 0 ? (
            <ul className="flex flex-col gap-1">
              {(data.bukti ?? []).map((bk) => (
                <li key={bk.lamp_id} className="text-xs">
                  <a className="text-primary underline" href={`https://drive.google.com/file/d/${bk.drive_file_id}/view`}
                    target="_blank" rel="noreferrer">📎 {bk.nama_file || bk.lamp_id}</a>
                  {bk.timestamp && <span className="text-gray-400"> · {bk.timestamp}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-400">Belum ada bukti diunggah untuk bulan ini.</p>
          )}
        </Card>
      )}

      {data && (
        <div className="flex flex-col gap-4">
          <KopSurat />
          <div className="text-right text-xs print:block">
            <label className="mb-1 block font-medium text-gray-700 print:hidden">Nomor Surat</label>
            <input value={noSurat} onChange={(e) => setNoSurat(e.target.value)}
              placeholder="…/SENAT-TARUNA.POLTEK.KP.SRG/…/20…"
              className="w-full rounded border border-gray-300 px-2 py-1 text-right text-xs print:border-0" />
          </div>
          <div className="text-center">
            <h2 className="text-base font-bold">PERMOHONAN PENDEBETAN REKENING SENAT KE REKENING PENYEDIA</h2>
            <p className="text-sm">Bulan {labelBulan(data.bulan)}</p>
          </div>

          <Card className="print:border-0 print:p-0 print:shadow-none">
            <p className="text-sm">
              Menindaklanjuti pendebetan bantuan biaya makan taruna bulan {labelBulan(data.bulan)} yang
              telah masuk ke rekening Senat Taruna, dengan ini Ketua Senat Taruna mengajukan permohonan
              pendebetan rekening Senat Taruna untuk diteruskan ke rekening penyedia jasa boga
              {data.penyedia_nama ? <> <strong>{data.penyedia_nama}</strong></> : ' (penyedia)'} sejumlah{' '}
              <strong>{formatRupiah(data.total_nominal)}</strong> sesuai kontrak (SOP PR/PKU/KU-001/2025).
              Pendebetan dilakukan <strong>per bank</strong> (rekening Senat dan penyedia masing-masing di BNI dan BSI).
            </p>
            <div className="mt-2 flex flex-col gap-1 text-xs">
              {data.kontrak?.no_kontrak && (
                <div className="flex justify-between"><span>No. Kontrak</span><span>{data.kontrak.no_kontrak}{data.kontrak.tgl_kontrak ? ` · ${data.kontrak.tgl_kontrak}` : ''}</span></div>
              )}
              {data.kontrak?.adendum && (
                <div className="flex justify-between"><span>Adendum</span><span>{data.kontrak.adendum}</span></div>
              )}
              <div className="flex justify-between"><span>No. SPM</span><span>{data.pembayaran.no_spm || '-'}</span></div>
              <div className="flex justify-between"><span>No. SP2D</span><span>{data.pembayaran.no_sp2d || '-'}</span></div>
              <div className="flex justify-between"><span>Tanggal SP2D</span><span>{data.pembayaran.tgl_sp2d || '-'}</span></div>
            </div>
          </Card>

          <Card className="overflow-x-auto print:border-0 print:p-0 print:shadow-none">
            <p className="mb-2 text-sm font-semibold text-gray-600 print:text-black">Rincian Pendebetan per Bank</p>
            <p className="mb-2 text-xs text-gray-500 print:text-black">
              Nominal per bank sudah dikurangi biaya admin bank {formatRupiah(data.biaya_admin_bank)} per taruna
              (sama seperti Form-07) — identik dengan total per bank Form-07, sebab dana ini adalah hasil
              pendebetan Form-07.
            </p>
            <TabelCetak headers={['Bank', 'Jml Taruna', 'Rekening Senat (Sumber)', 'Rekening Penyedia (Tujuan)', 'Nominal (Rp)']}>
              {data.per_bank.map((b) => (
                <BarisCetak key={b.bank}>
                  <SelCetak>{b.bank}</SelCetak>
                  <SelCetak className="text-right">{b.jml_taruna}</SelCetak>
                  <SelCetak>{(b.rek_senat_sumber || '…… (belum diisi Admin)') + (b.rek_senat_nama ? ` a.n. ${b.rek_senat_nama}` : '')}</SelCetak>
                  <SelCetak>{(b.rek_penyedia_tujuan || '…… (belum diisi Admin)') + (b.rek_penyedia_nama ? ` a.n. ${b.rek_penyedia_nama}` : '')}</SelCetak>
                  <SelCetak className="text-right">{formatRupiah(b.total)}</SelCetak>
                </BarisCetak>
              ))}
            </TabelCetak>
            <div className="mt-2 flex justify-between text-sm font-bold">
              <span>TOTAL</span>
              <span>{formatRupiah(data.total_nominal)}</span>
            </div>
            <p className="mt-1 text-xs italic">Terbilang: <strong>{data.nominal_terbilang}</strong></p>
            {data.per_bank.some((b) => !b.rek_senat_sumber || !b.rek_penyedia_tujuan) && (
              <p className="mt-2 text-xs text-red-600 print:hidden">
                ⚠️ Ada nomor rekening Senat/Penyedia yang belum diisi — Admin mengisinya lewat
                <code> setRekeningInstansi()</code> di editor Apps Script sebelum surat ini diajukan.
              </p>
            )}
          </Card>

          <BlokTtd2Kolom
            kiri={{ label: 'Mengajukan,', jabatan: 'Ketua Senat Taruna' }}
            kanan={{ label: 'Menyetujui,', jabatan: 'Pejabat Pembuat Komitmen (PPK)', nama: data.pejabat.PPK.nama, nip: data.pejabat.PPK.nip }}
          />
          <p className="mt-2 text-center text-xs font-semibold">Mengetahui,</p>
          <BlokTtd2Kolom
            kiri={{ label: 'Wakil Direktur III', jabatan: 'Bidang Kemahasiswaan', nama: data.pejabat.WADIR3.nama, nip: data.pejabat.WADIR3.nip }}
            kanan={{ label: 'Direktur', jabatan: 'Politeknik KP Sorong', nama: data.pejabat.DIREKTUR.nama, nip: data.pejabat.DIREKTUR.nip }}
          />
        </div>
      )}
    </div>
  );
}
