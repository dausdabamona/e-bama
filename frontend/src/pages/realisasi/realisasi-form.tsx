// /realisasi/baru/:pesananId — form harian realisasi: porsi, ketidaksesuaian, foto, geotag.
// Realisasi Satu-Ketuk (Fitur "Kurangi Beban Pembina" 2a-2c): jumlah
// diprefill dari PESANAN.jml_taruna, tombol "Sesuai Pesanan" mengunci nilai
// tanpa perlu mengetik — happy path jadi konfirmasi+foto saja. Selisih tetap
// bisa diubah manual (alur lama, tak berubah).
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { ambilFotoInput, kompresFotoBase64 } from '../../lib/foto';
import { ambilGeotag, type Geotag } from '../../lib/geo';
import { aksiTulis } from '../../lib/sync';
import { useListCache } from '../../lib/use-list-cache';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { SearchSelect } from '../../components/ui/search-select';
import { useToast } from '../../components/ui/toast';
import type { Pesanan } from '../pesanan/tipe';
import type { Taruna } from '../taruna/tipe';
import type { KebijakanPenerimaan, KebijakanPiket, Penerimaan, Realisasi, WaktuMakan } from './tipe';

const LABEL_KUALITAS: Record<'BAIK' | 'CUKUP' | 'KURANG', string> = {
  BAIK: 'Baik', CUKUP: 'Cukup', KURANG: 'Kurang'
};

const WAKTU_MAKAN: WaktuMakan[] = ['pagi', 'siang', 'malam'];
const LABEL_WAKTU: Record<WaktuMakan, string> = { pagi: 'Pagi', siang: 'Siang', malam: 'Malam' };

interface BarisPenerimaan { ada: boolean; jumlah: string }
type StatePenerimaan = Record<WaktuMakan, Record<string, BarisPenerimaan>>;

function barisKosong(): StatePenerimaan {
  return { pagi: {}, siang: {}, malam: {} };
}

export function HalamanRealisasiBuat() {
  const { pesananId } = useParams<{ pesananId: string }>();
  const { session } = useAuth();
  const nav = useNavigate();
  const { toast } = useToast();

  const pesananQ = useListCache<{ pesanan: Pesanan }>('pesanan.get', { pesanan_id: pesananId });
  const jmlPesanan = pesananQ.data?.pesanan?.jml_taruna ?? null;
  const tarunaQ = useListCache<{ taruna: Taruna[] }>('taruna.list', { status: 'AKTIF' });
  const kebijakanQ = useListCache<KebijakanPiket>('realisasi.kebijakan_piket', {});
  const komponenGizi = kebijakanQ.data?.komponen_gizi ?? [];
  const piketWajib = kebijakanQ.data?.wajib ?? false;

  const bisaPenerimaan = session?.role === 'SENAT';
  const suratPenyediaQ = useListCache<{ menu: Record<WaktuMakan, string> }>(
    'pesanan.surat_penyedia', { pesanan_id: pesananId }
  );
  const kebijakanPenerimaanQ = useListCache<KebijakanPenerimaan>('realisasi.kebijakan_penerimaan', {});
  const komponenMenu = kebijakanPenerimaanQ.data?.komponen ?? [];

  const [porsi, setPorsi] = useState('');
  const [jmlMakan, setJmlMakan] = useState('');
  const [ketidaksesuaian, setKetidaksesuaian] = useState('');
  const [tindakLanjut, setTindakLanjut] = useState('');
  const [ubahManual, setUbahManual] = useState(false);
  const [geo, setGeo] = useState<Geotag | null>(null);
  const [geoManualLat, setGeoManualLat] = useState('');
  const [geoManualLng, setGeoManualLng] = useState('');
  const [galatGeo, setGalatGeo] = useState('');
  const [fotoNama, setFotoNama] = useState('');
  const [fotoBase64, setFotoBase64] = useState('');
  const [fotoWideNama, setFotoWideNama] = useState('');
  const [fotoWideBase64, setFotoWideBase64] = useState('');
  const [piketNit, setPiketNit] = useState('');
  const [piketMenuSesuai, setPiketMenuSesuai] = useState(false);
  const [piketPorsiCukup, setPiketPorsiCukup] = useState(false);
  const [piketKualitas, setPiketKualitas] = useState<'' | 'BAIK' | 'CUKUP' | 'KURANG'>('');
  const [piketGizi, setPiketGizi] = useState<Set<string>>(new Set());
  const [piketCatatan, setPiketCatatan] = useState('');
  const [tabWaktu, setTabWaktu] = useState<WaktuMakan>('pagi');
  const [penerimaan, setPenerimaan] = useState<StatePenerimaan>(barisKosong());
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');

  function toggleGizi(komponen: string) {
    setPiketGizi((s) => {
      const baru = new Set(s);
      if (baru.has(komponen)) baru.delete(komponen); else baru.add(komponen);
      return baru;
    });
  }

  function barisUntuk(waktu: WaktuMakan, komponen: string): BarisPenerimaan {
    return penerimaan[waktu][komponen] ?? { ada: false, jumlah: '' };
  }

  function setBarisPenerimaan(waktu: WaktuMakan, komponen: string, patch: Partial<BarisPenerimaan>) {
    setPenerimaan((s) => ({
      ...s,
      [waktu]: { ...s[waktu], [komponen]: { ...barisUntuk(waktu, komponen), ...patch } }
    }));
  }

  function waktuTerisi(waktu: WaktuMakan): boolean {
    return Object.values(penerimaan[waktu]).some((b) => b.ada);
  }

  function serialisasiPenerimaan(): Penerimaan {
    const hasil = {} as Penerimaan;
    WAKTU_MAKAN.forEach((w) => {
      hasil[w] = komponenMenu.map((k) => {
        const b = barisUntuk(w, k);
        return { komponen: k, ada: b.ada, jumlah: b.ada ? Number(b.jumlah) || 0 : 0 };
      });
    });
    return hasil;
  }

  const adaPenerimaanTerisi = WAKTU_MAKAN.some((w) => waktuTerisi(w));

  // Prefill sekali saat data pesanan datang — TIDAK menimpa kalau Pembina
  // sudah mengetik sesuatu (mis. setelah refresh cache).
  useEffect(() => {
    if (jmlPesanan !== null && !porsi && !jmlMakan) {
      setPorsi(String(jmlPesanan));
      setJmlMakan(String(jmlPesanan));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jmlPesanan]);

  function sesuaiPesanan() {
    if (jmlPesanan === null) return;
    setPorsi(String(jmlPesanan));
    setJmlMakan(String(jmlPesanan));
    setKetidaksesuaian('');
    setTindakLanjut('');
    setUbahManual(false);
    document.getElementById('realisasi-lanjut')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function ambilLokasi() {
    setGalatGeo('');
    try {
      setGeo(await ambilGeotag());
    } catch (e) {
      setGalatGeo(e instanceof Error ? e.message : 'Gagal ambil lokasi. Isi manual di bawah.');
    }
  }

  // Number('') === 0 di JavaScript (bukan NaN) — tanpa cek trim() kosong,
  // field lat/lng manual yang DIBIARKAN KOSONG lolos sebagai "0,0" valid,
  // membuat geoSiap true padahal geotag belum diisi sama sekali (bug lama,
  // ditemukan saat verifikasi Realisasi Satu-Ketuk).
  const manualLat = geoManualLat.trim() === '' ? NaN : Number(geoManualLat);
  const manualLng = geoManualLng.trim() === '' ? NaN : Number(geoManualLng);
  const lat = geo?.lat ?? manualLat;
  const lng = geo?.lng ?? manualLng;
  const geoSiap = isFinite(lat) && isFinite(lng);

  /**
   * Baris watermark (tanggal-jam + koordinat) dibakar ke foto SEBELUM
   * kompresi (Fitur E) — melekat permanen di file, bukan metadata terpisah
   * yang gampang lepas. Butuh geotag lebih dulu supaya koordinat akurat.
   */
  function barisWatermark(): string[] {
    const kini = new Date();
    const tgl = kini.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const jam = kini.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return [`${tgl} ${jam} WIT`, `${lat.toFixed(6)}, ${lng.toFixed(6)}`];
  }

  async function pilihFoto(jenis: 'closeup' | 'wide') {
    const file = await ambilFotoInput();
    if (!file) return;
    const base64 = await kompresFotoBase64(file, 200, barisWatermark());
    if (jenis === 'closeup') { setFotoNama(file.name); setFotoBase64(base64); }
    else { setFotoWideNama(file.name); setFotoWideBase64(base64); }
  }

  async function simpan() {
    if (!porsi || !jmlMakan) { setGalat('Porsi diterima dan jumlah taruna makan wajib diisi.'); return; }
    if (!geoSiap) { setGalat('Geotag wajib diisi (otomatis atau manual).'); return; }
    if (piketWajib && !piketNit) { setGalat('Verifikasi piket wajib diisi (kebijakan aktif).'); return; }
    if (piketNit && !piketKualitas) { setGalat('Pilih kualitas makan pada Verifikasi Piket Taruna.'); return; }

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
      if (fotoBase64) payload.berkas = { base64: fotoBase64, nama_file: fotoNama || 'realisasi-closeup.jpg' };
      if (fotoWideBase64) payload.berkas_wide = { base64: fotoWideBase64, nama_file: fotoWideNama || 'realisasi-wide.jpg' };
      if (piketNit) {
        payload.piket_nit = piketNit;
        payload.piket_menu_sesuai = piketMenuSesuai;
        payload.piket_porsi_cukup = piketPorsiCukup;
        payload.piket_kualitas = piketKualitas;
        payload.piket_gizi = Array.from(piketGizi);
        payload.piket_catatan = piketCatatan;
      }

      const r = await aksiTulis<{ realisasi: Realisasi }>('realisasi.create', payload);

      // Kirim checklist Penerimaan Barang sebagai aksi TERPISAH (pesanan_id,
      // bukan real_id — aman dipakai bahkan bila realisasi.create di atas
      // sendiri masih antri offline: antrian diproses berurutan/FIFO, jadi
      // baris REALISASI sudah ada begitu aksi ini dijalankan nanti).
      if (bisaPenerimaan && adaPenerimaanTerisi) {
        await aksiTulis('realisasi.penerimaan', { pesanan_id: pesananId, penerimaan: serialisasiPenerimaan() });
      }

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

      {/* Penerimaan Barang Senat: checklist kelengkapan+jumlah komponen menu
          NYATA per waktu makan, di titik SERAH-TERIMA — TERPISAH dari checklist
          piket (di titik makan, kategori gizi bukan item menu). Hanya utk Senat. */}
      {bisaPenerimaan && (
        <Card className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-600">Penerimaan Barang</p>
          <p className="text-xs text-gray-500">
            Cek kelengkapan & jumlah komponen menu saat serah-terima dari penyedia.
          </p>
          <div className="flex gap-2">
            {WAKTU_MAKAN.map((w) => (
              <Button key={w} type="button" varian={tabWaktu === w ? 'utama' : 'garis'}
                className="flex-1" onClick={() => setTabWaktu(w)}>
                {waktuTerisi(w) ? '✅' : '⏳'} {LABEL_WAKTU[w]}
              </Button>
            ))}
          </div>

          {suratPenyediaQ.data?.menu?.[tabWaktu] && (
            <p className="rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
              <span className="font-medium">Menu rujukan: </span>
              {suratPenyediaQ.data.menu[tabWaktu]}
            </p>
          )}

          <div className="flex flex-col gap-2">
            {komponenMenu.map((k) => {
              const b = barisUntuk(tabWaktu, k);
              return (
                <div key={k} className="flex items-center gap-2">
                  <label className="flex min-h-tap flex-1 items-center gap-2 text-sm">
                    <input type="checkbox" checked={b.ada}
                      onChange={(e) => setBarisPenerimaan(tabWaktu, k, { ada: e.target.checked })}
                      className="h-5 w-5" />
                    {k}
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    disabled={!b.ada}
                    value={b.ada ? b.jumlah : '0'}
                    onChange={(e) => setBarisPenerimaan(tabWaktu, k, { jumlah: e.target.value })}
                    className="min-h-tap w-24 rounded-xl border border-gray-300 px-3 py-2 text-center text-lg font-semibold disabled:bg-gray-100 disabled:text-gray-400"
                  />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        {/* Jumlah dipesan ditonjolkan besar/bold (mudah dikonfirmasi di ponsel
            sambil berdiri) — happy path tinggal ketuk "Sesuai Pesanan". */}
        <div className="flex flex-col gap-1 rounded-xl bg-primary-light px-3 py-2">
          <span className="text-xs text-gray-600">Jumlah Dipesan</span>
          <span className="text-2xl font-bold text-primary-dark">
            {jmlPesanan !== null ? `${jmlPesanan} taruna` : '…'}
          </span>
        </div>
        <Button onClick={sesuaiPesanan} disabled={jmlPesanan === null}>
          ✅ Sesuai Pesanan
        </Button>
        <button
          type="button"
          className="text-left text-xs text-primary underline"
          onClick={() => setUbahManual((v) => !v)}
        >
          {ubahManual ? '▲ Sembunyikan detail' : '⚠️ Ada selisih? Ubah jumlah di sini'}
        </button>

        {ubahManual && (
          <>
            <Input label="Porsi Diterima" type="number" value={porsi} onChange={(e) => setPorsi(e.target.value)} />
            <Input label="Jumlah Taruna Makan" type="number" value={jmlMakan} onChange={(e) => setJmlMakan(e.target.value)} />
            <Input label="Ketidaksesuaian (kosongkan bila sesuai)" value={ketidaksesuaian} onChange={(e) => setKetidaksesuaian(e.target.value)} />
            <Input label="Tindak Lanjut" value={tindakLanjut} onChange={(e) => setTindakLanjut(e.target.value)} />
          </>
        )}

        <div id="realisasi-lanjut" className="rounded-xl border border-gray-200 p-3">
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

        {/* Dua foto (Fitur E): close-up (kualitas makanan) + wide-shot (kuantitas
            porsi). Watermark tanggal-jam+koordinat dibakar ke keduanya — butuh
            geotag lebih dulu supaya koordinat yang tertera akurat. Kamera-only
            (bukan galeri) via ambilFotoInput — cegah unggah foto lama/rekayasa. */}
        <div className="flex flex-col gap-2">
          <Button varian="garis" onClick={() => void pilihFoto('closeup')} disabled={!geoSiap}>
            {fotoNama ? `📎 Close-up: ${fotoNama}` : '📷 Ambil Foto Close-up (kualitas)'}
          </Button>
          <Button varian="garis" onClick={() => void pilihFoto('wide')} disabled={!geoSiap}>
            {fotoWideNama ? `📎 Wide-shot: ${fotoWideNama}` : '📷 Ambil Foto Wide-shot (kuantitas porsi)'}
          </Button>
          {!geoSiap && (
            <p className="text-xs text-gray-400">Ambil/isi lokasi (geotag) dulu sebelum memotret — watermark butuh koordinat.</p>
          )}
        </div>
      </Card>

      {/* Ownership Taruna Fitur 1b: piket taruna ikut menandatangani di
          perangkat bersama (TANPA akun sendiri) — menguatkan bukti realisasi,
          MELENGKAPI ttd Pembina+Senat+foto+geotag di atas, bukan menggantikan. */}
      <Card className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-gray-600">
          Verifikasi Piket Taruna {piketWajib ? '(wajib)' : '(opsional)'}
        </p>
        <p className="text-xs text-gray-500">
          Kolektif lewat Senat & Piket — bahan evaluasi kepatuhan penyedia,
          bukan komplain individual. Piket cukup diketik di sini, tanpa login.
        </p>
        <SearchSelect
          label="NIT/Nama Piket"
          placeholder="Ketik nama atau NIT piket…"
          value={piketNit}
          onChange={setPiketNit}
          opsi={(tarunaQ.data?.taruna ?? []).map((t) => ({ value: t.nit, label: `${t.nama} (${t.nit})` }))}
        />
        {piketNit && (
          <>
            <label className="flex min-h-tap items-center gap-2 text-sm">
              <input type="checkbox" checked={piketMenuSesuai}
                onChange={(e) => setPiketMenuSesuai(e.target.checked)} className="h-5 w-5" />
              Menu sesuai jadwal kontrak
            </label>
            <label className="flex min-h-tap items-center gap-2 text-sm">
              <input type="checkbox" checked={piketPorsiCukup}
                onChange={(e) => setPiketPorsiCukup(e.target.checked)} className="h-5 w-5" />
              Porsi cukup
            </label>

            <p className="text-sm font-medium text-gray-700">Kualitas</p>
            <div className="flex gap-2">
              {(['BAIK', 'CUKUP', 'KURANG'] as const).map((k) => (
                <Button key={k} type="button" varian={piketKualitas === k ? 'utama' : 'garis'}
                  className="flex-1" onClick={() => setPiketKualitas(k)}>
                  {LABEL_KUALITAS[k]}
                </Button>
              ))}
            </div>

            {komponenGizi.length > 0 && (
              <>
                <p className="text-sm font-medium text-gray-700">Gizi yang benar-benar ada di piring</p>
                <div className="flex flex-wrap gap-2">
                  {komponenGizi.map((g) => (
                    <label key={g} className="flex min-h-tap items-center gap-1 rounded-full border border-gray-300 px-3 py-1 text-sm">
                      <input type="checkbox" checked={piketGizi.has(g)} onChange={() => toggleGizi(g)} className="h-4 w-4" />
                      {g}
                    </label>
                  ))}
                </div>
              </>
            )}

            <Input label="Catatan (opsional)" value={piketCatatan} onChange={(e) => setPiketCatatan(e.target.value)} />
          </>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        {galat && <p className="text-sm text-red-600">{galat}</p>}
        <Button onClick={() => void simpan()} disabled={proses}>
          {proses ? 'Menyimpan…' : 'Simpan Realisasi'}
        </Button>
      </Card>
    </div>
  );
}
