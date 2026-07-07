// /tagihan/teruskan-penyedia — tandai batch tagihan LUNAS yang dananya sudah
// diteruskan dari rekening Senat ke penyedia. TERPISAH dari jalur SP2D/SPM
// (pembayaran LS utama) — ini khusus dana hasil tagih-ulang gagal debet.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ambilBerkasInput, berkasKeBase64 } from '../../lib/berkas';
import { aksiTulis } from '../../lib/sync';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useToast } from '../../components/ui/toast';
import { useListCache } from '../../lib/use-list-cache';
import { formatRupiah, type Tagihan } from './tipe';
import type { Taruna } from '../taruna/tipe';

export function HalamanTagihanTeruskanPenyedia() {
  const nav = useNavigate();
  const { toast } = useToast();
  const tagihanQ = useListCache<{ tagihan: Tagihan[] }>('tagihan.list', {});
  const tarunaQ = useListCache<{ taruna: Taruna[] }>('taruna.list', {});
  const namaByNit = new Map((tarunaQ.data?.taruna ?? []).map((t) => [t.nit, t.nama]));

  const [terpilih, setTerpilih] = useState<Set<string>>(new Set());
  const [fotoNama, setFotoNama] = useState('');
  const [fotoBase64, setFotoBase64] = useState('');
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');

  const belumDiteruskan = useMemo(() => {
    return (tagihanQ.data?.tagihan ?? [])
      .filter((t) => t.status === 'LUNAS' && !t.tgl_diteruskan_penyedia)
      .sort((a, b) => b.bulan.localeCompare(a.bulan));
  }, [tagihanQ.data]);

  const totalTerpilih = belumDiteruskan
    .filter((t) => terpilih.has(t.tagihan_id))
    .reduce((sum, t) => sum + (t.nilai_transfer || t.nominal), 0);

  function toggle(id: string) {
    setTerpilih((s) => {
      const baru = new Set(s);
      if (baru.has(id)) baru.delete(id); else baru.add(id);
      return baru;
    });
  }

  function pilihSemua() {
    setTerpilih(new Set(belumDiteruskan.map((t) => t.tagihan_id)));
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
    if (terpilih.size === 0) { setGalat('Pilih minimal satu tagihan.'); return; }
    if (!fotoBase64) { setGalat('Bukti transfer ke penyedia wajib diunggah.'); return; }
    setProses(true); setGalat('');
    try {
      const r = await aksiTulis('tagihan.teruskan_penyedia', {
        tagihan_id_list: Array.from(terpilih),
        berkas: { base64: fotoBase64, nama_file: fotoNama || 'bukti-teruskan-penyedia.jpg' }
      });
      toast(r.antri ? 'Disimpan lokal, akan dikirim otomatis.' : `${terpilih.size} tagihan ditandai diteruskan ke penyedia.`, 'sukses');
      if (!r.antri) {
        setTerpilih(new Set());
        setFotoNama(''); setFotoBase64('');
        tagihanQ.refresh();
      } else {
        nav('/tagihan');
      }
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setProses(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button className="text-sm text-primary" onClick={() => nav('/tagihan')}>← Kembali</button>
      <h1 className="text-xl font-bold text-primary-dark">Teruskan Dana ke Penyedia</h1>
      <p className="text-sm text-gray-500">
        Tandai tagihan yang sudah <b>LUNAS</b> (dana taruna sudah masuk rekening Senat) dan dananya
        sudah diteruskan ke rekening penyedia. Ini jalur tagih-ulang gagal debet — TERPISAH dari
        pembayaran SPM/SP2D utama.
      </p>

      {tagihanQ.memuat && !tagihanQ.data && <LoadingSpinner label="Memuat tagihan…" />}
      {tagihanQ.galat && !tagihanQ.data && <ErrorMessage pesan={tagihanQ.galat} onRetry={tagihanQ.refresh} />}
      {tagihanQ.data && belumDiteruskan.length === 0 && (
        <EmptyState pesan="Tidak ada tagihan LUNAS yang menunggu diteruskan ke penyedia." />
      )}

      {belumDiteruskan.length > 0 && (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Pilih Tagihan LUNAS ({belumDiteruskan.length})</p>
            <button className="text-xs text-primary" onClick={pilihSemua}>Pilih Semua</button>
          </div>
          <div className="flex flex-col gap-1 rounded-xl border border-gray-200 p-2">
            {belumDiteruskan.map((t) => (
              <label key={t.tagihan_id} className="flex min-h-tap items-center gap-2 pl-1 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={terpilih.has(t.tagihan_id)} onChange={() => toggle(t.tagihan_id)} />
                <span className="flex-1">{namaByNit.get(t.nit) ?? t.nit} · {t.bulan}</span>
                <span className="text-gray-500">{formatRupiah(t.nilai_transfer || t.nominal)}</span>
              </label>
            ))}
          </div>

          <p className="text-sm">Total Terpilih: <span className="font-bold">{formatRupiah(totalTerpilih)}</span></p>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Bukti Transfer ke Penyedia</label>
            <Button varian="garis" onClick={() => void pilihBerkas()}>
              {fotoNama ? `📎 ${fotoNama}` : '📎 Pilih Berkas'}
            </Button>
          </div>

          {galat && <p className="text-sm text-red-600">{galat}</p>}
          <Button onClick={() => void kirim()} disabled={proses}>
            {proses ? 'Memproses…' : `Tandai ${terpilih.size} Tagihan Diteruskan`}
          </Button>
        </Card>
      )}
    </div>
  );
}
