// /realisasi/baru/:pesananId — form harian realisasi: porsi, ketidaksesuaian, foto, geotag.
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ambilFotoInput, kompresFotoBase64 } from '../../lib/foto';
import { ambilGeotag, type Geotag } from '../../lib/geo';
import { aksiTulis } from '../../lib/sync';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useToast } from '../../components/ui/toast';
import type { Realisasi } from './tipe';

export function HalamanRealisasiBuat() {
  const { pesananId } = useParams<{ pesananId: string }>();
  const nav = useNavigate();
  const { toast } = useToast();

  const [porsi, setPorsi] = useState('');
  const [jmlMakan, setJmlMakan] = useState('');
  const [ketidaksesuaian, setKetidaksesuaian] = useState('');
  const [tindakLanjut, setTindakLanjut] = useState('');
  const [geo, setGeo] = useState<Geotag | null>(null);
  const [geoManualLat, setGeoManualLat] = useState('');
  const [geoManualLng, setGeoManualLng] = useState('');
  const [galatGeo, setGalatGeo] = useState('');
  const [fotoNama, setFotoNama] = useState('');
  const [fotoBase64, setFotoBase64] = useState('');
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');

  async function ambilLokasi() {
    setGalatGeo('');
    try {
      setGeo(await ambilGeotag());
    } catch (e) {
      setGalatGeo(e instanceof Error ? e.message : 'Gagal ambil lokasi. Isi manual di bawah.');
    }
  }

  async function pilihFoto() {
    const file = await ambilFotoInput();
    if (!file) return;
    setFotoNama(file.name);
    setFotoBase64(await kompresFotoBase64(file));
  }

  async function simpan() {
    const lat = geo?.lat ?? Number(geoManualLat);
    const lng = geo?.lng ?? Number(geoManualLng);
    if (!porsi || !jmlMakan) { setGalat('Porsi diterima dan jumlah taruna makan wajib diisi.'); return; }
    if (!isFinite(lat) || !isFinite(lng)) { setGalat('Geotag wajib diisi (otomatis atau manual).'); return; }

    setProses(true);
    setGalat('');
    try {
      const payload: Record<string, unknown> = {
        pesanan_id: pesananId,
        porsi_diterima: Number(porsi),
        jml_taruna_makan: Number(jmlMakan),
        ketidaksesuaian, tindak_lanjut: tindakLanjut,
        geotag_lat: lat, geotag_lng: lng
      };
      if (fotoBase64) payload.berkas = { base64: fotoBase64, nama_file: fotoNama || 'realisasi.jpg' };

      const r = await aksiTulis<{ realisasi: Realisasi }>('realisasi.create', payload);
      if (r.antri) {
        toast('Koneksi tidak stabil. Disimpan lokal, akan dikirim otomatis.', 'info');
        nav('/realisasi');
        return;
      }
      toast('Realisasi tersimpan.', 'sukses');
      nav(`/realisasi/${r.data!.realisasi.real_id}`);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setProses(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button className="text-sm text-primary" onClick={() => nav('/realisasi')}>← Kembali</button>
      <h1 className="text-xl font-bold text-primary-dark">Realisasi Harian</h1>

      <Card className="flex flex-col gap-3">
        <Input label="Porsi Diterima" type="number" value={porsi} onChange={(e) => setPorsi(e.target.value)} />
        <Input label="Jumlah Taruna Makan" type="number" value={jmlMakan} onChange={(e) => setJmlMakan(e.target.value)} />
        <Input label="Ketidaksesuaian (kosongkan bila sesuai)" value={ketidaksesuaian} onChange={(e) => setKetidaksesuaian(e.target.value)} />
        <Input label="Tindak Lanjut" value={tindakLanjut} onChange={(e) => setTindakLanjut(e.target.value)} />

        <div className="rounded-xl border border-gray-200 p-3">
          <p className="mb-2 text-sm font-medium">Lokasi (Geotag)</p>
          {geo ? (
            <p className="text-sm text-green-700">📍 {geo.lat.toFixed(6)}, {geo.lng.toFixed(6)}</p>
          ) : (
            <Button varian="garis" onClick={() => void ambilLokasi()}>Ambil Lokasi GPS</Button>
          )}
          {galatGeo && (
            <div className="mt-2 flex flex-col gap-2">
              <p className="text-sm text-red-600">{galatGeo}</p>
              <div className="flex gap-2">
                <Input label="Latitude" value={geoManualLat} onChange={(e) => setGeoManualLat(e.target.value)} />
                <Input label="Longitude" value={geoManualLng} onChange={(e) => setGeoManualLng(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <Button varian="garis" onClick={() => void pilihFoto()}>
          {fotoNama ? `📎 ${fotoNama}` : '📷 Ambil Foto Dokumentasi'}
        </Button>

        {galat && <p className="text-sm text-red-600">{galat}</p>}
        <Button onClick={() => void simpan()} disabled={proses}>
          {proses ? 'Menyimpan…' : 'Simpan Realisasi'}
        </Button>
      </Card>
    </div>
  );
}
