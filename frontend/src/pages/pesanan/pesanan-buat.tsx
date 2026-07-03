// /pesanan/baru — tgl_makan → jml_taruna otomatis (dihitung server via pesanan.create
// dengan jml_taruna kosong akan pakai auto; di sini kita panggil status.list untuk
// estimasi tampilan, nilai final tetap dihitung ulang di server saat submit).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { aksiTulis } from '../../lib/sync';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useToast } from '../../components/ui/toast';
import type { Pesanan } from './tipe';

function hariIni(): string {
  return new Date().toISOString().slice(0, 10);
}
function besok(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function HalamanPesananBuat() {
  const nav = useNavigate();
  const { toast } = useToast();
  const [tglMakan, setTglMakan] = useState(besok());
  const [menu, setMenu] = useState('');
  const [jmlOtomatis, setJmlOtomatis] = useState<number | null>(null);
  const [jmlKoreksi, setJmlKoreksi] = useState('');
  const [catatan, setCatatan] = useState('');
  const [memuatEstimasi, setMemuatEstimasi] = useState(false);
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');

  async function hitungEstimasi(tgl: string) {
    setTglMakan(tgl);
    setMemuatEstimasi(true);
    try {
      // taruna.list AKTIF − status.list pada tanggal tsb (estimasi klien; server tetap hitung ulang)
      const [taruna, status] = await Promise.all([
        api<{ taruna: { status: string }[] }>('taruna.list', { status: 'AKTIF' }),
        api<{ status: { tanggal: string; nit: string }[] }>('status.list', { dari: tgl, sampai: tgl })
      ]);
      setJmlOtomatis(taruna.taruna.length - status.status.length);
    } catch {
      setJmlOtomatis(null); // biarkan server yang menghitung saat submit
    } finally {
      setMemuatEstimasi(false);
    }
  }

  const berbeda = jmlKoreksi !== '' && jmlOtomatis !== null && Number(jmlKoreksi) !== jmlOtomatis;

  async function simpan(ajukanLangsung: boolean) {
    if (!menu.trim()) { setGalat('Menu wajib diisi.'); return; }
    if (berbeda && !catatan.trim()) { setGalat('Catatan wajib diisi karena jumlah berbeda dari hitungan otomatis.'); return; }
    setProses(true);
    setGalat('');
    try {
      const payload: Record<string, unknown> = { tgl_makan: tglMakan, menu: menu.trim() };
      if (jmlKoreksi !== '') { payload.jml_taruna = Number(jmlKoreksi); payload.catatan = catatan.trim(); }

      const hasil = await aksiTulis<{ pesanan: Pesanan }>('pesanan.create', payload);
      if (hasil.antri) {
        toast('Koneksi tidak stabil. Disimpan lokal, akan dikirim otomatis.', 'info');
        nav('/pesanan');
        return;
      }
      const idBaru = hasil.data!.pesanan.pesanan_id;
      if (ajukanLangsung) {
        await aksiTulis('pesanan.submit', { pesanan_id: idBaru });
      }
      toast('Pesanan tersimpan.', 'sukses');
      nav(`/pesanan/${idBaru}`);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setProses(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-primary-dark">Buat Pesanan</h1>
      <Card className="flex flex-col gap-3">
        <Input
          label="Tanggal Makan"
          type="date"
          min={hariIni()}
          value={tglMakan}
          onChange={(e) => void hitungEstimasi(e.target.value)}
        />
        <Input label="Menu" placeholder="mis. Nasi, ikan kuah kuning, sayur" value={menu} onChange={(e) => setMenu(e.target.value)} />

        <div className="rounded-xl bg-primary-light/40 p-3 text-sm">
          {memuatEstimasi ? 'Menghitung estimasi…' :
            jmlOtomatis !== null
              ? <>Estimasi otomatis: <span className="font-bold">{jmlOtomatis} taruna</span> (taruna AKTIF dikurangi yang berstatus harian)</>
              : 'Estimasi akan dihitung ulang oleh server saat disimpan.'}
        </div>

        <Input
          label="Koreksi jumlah taruna (opsional)"
          type="number"
          placeholder={jmlOtomatis !== null ? String(jmlOtomatis) : ''}
          value={jmlKoreksi}
          onChange={(e) => setJmlKoreksi(e.target.value)}
        />
        {berbeda && (
          <Input
            label="Catatan (wajib — jumlah berbeda dari estimasi)"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
          />
        )}

        {galat && <p className="text-sm text-red-600">{galat}</p>}

        <div className="flex gap-2 pt-2">
          <Button varian="garis" className="flex-1" onClick={() => void simpan(false)} disabled={proses}>
            Simpan Draf
          </Button>
          <Button className="flex-1" onClick={() => void simpan(true)} disabled={proses}>
            {proses ? 'Menyimpan…' : 'Simpan & Ajukan'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
