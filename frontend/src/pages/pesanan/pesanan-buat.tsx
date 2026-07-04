// /pesanan/baru — tgl_makan → jml_taruna otomatis (dihitung server via pesanan.create
// dengan jml_taruna kosong akan pakai auto; di sini kita panggil status.list untuk
// estimasi tampilan, nilai final tetap dihitung ulang di server saat submit).
// Menu juga otomatis diambil dari MENU_KONTRAK sesuai hari-dalam-minggu tgl_makan
// (kontrak aktif DISETUJUI_PPK) — tetap bisa diubah Senat per hari (ad hoc).
import { useEffect, useRef, useState } from 'react';
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

const NAMA_HARI = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];

/** Nama hari (SENIN..MINGGU) dari string tanggal 'YYYY-MM-DD' — pakai komponen
 *  lokal supaya tidak bergeser akibat parsing UTC. */
function hariDalamMinggu(tgl: string): string {
  const [y, m, d] = tgl.split('-').map(Number);
  if (!y || !m || !d) return '';
  return NAMA_HARI[new Date(y, m - 1, d).getDay()];
}

/** Tanggal 'YYYY-MM-DD' digeser n hari (pakai komponen lokal). */
function tambahHari(tgl: string, n: number): string {
  const [y, m, d] = tgl.split('-').map(Number);
  if (!y || !m || !d) return tgl;
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

interface MenuHari { hari: string; menu_pagi: string; menu_siang: string; menu_malam: string }
interface KontrakRingkas { kontrak_id: string; status: string; tgl_mulai: string; tgl_akhir: string }

/** Item satu waktu makan (dipisah baris) → "a, b, c". */
function itemsMenu(teks: string): string {
  return (teks || '').split('\n').map((s) => s.trim()).filter(Boolean).join(', ');
}

/**
 * Komposisi satu pengantaran rekanan untuk pesanan tanggal D (dikonfirmasi Firdaus):
 * MALAM hari D + PAGI hari D+1 + SIANG hari D+1. Contoh: pesanan Selasa →
 * "Selasa Malam" + "Rabu Pagi" + "Rabu Siang". Diberi label hari eksplisit
 * karena satu pengantaran memang mencakup dua hari kalender.
 */
function komposisiPesanan(hariMalam: string, menuMalam: MenuHari | undefined,
                          hariPagiSiang: string, menuPagiSiang: MenuHari | undefined): string {
  const baris: string[] = [];
  if (menuMalam && itemsMenu(menuMalam.menu_malam)) baris.push(`${hariMalam} Malam: ${itemsMenu(menuMalam.menu_malam)}`);
  if (menuPagiSiang && itemsMenu(menuPagiSiang.menu_pagi)) baris.push(`${hariPagiSiang} Pagi: ${itemsMenu(menuPagiSiang.menu_pagi)}`);
  if (menuPagiSiang && itemsMenu(menuPagiSiang.menu_siang)) baris.push(`${hariPagiSiang} Siang: ${itemsMenu(menuPagiSiang.menu_siang)}`);
  return baris.join('\n');
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

  // Saran menu dari kontrak untuk tanggal terpilih + hari-nya (untuk ditampilkan/dipakai ulang)
  const [menuKontrak, setMenuKontrak] = useState('');
  const [hariKontrak, setHariKontrak] = useState('');
  const [pesanMenuKontrak, setPesanMenuKontrak] = useState('');
  // Melacak nilai auto-isi terakhir supaya penggantian tanggal boleh menimpa
  // menu yang BELUM diedit manual, tapi tidak menimpa yang sudah diketik Senat.
  const menuAutoRef = useRef('');

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
    void muatMenuKontrak(tgl);
  }

  /** Susun menu satu pengantaran (Malam hari-D + Pagi & Siang hari D+1) dari
   *  kontrak aktif → auto-isi bila field menu masih kosong / belum diedit manual. */
  async function muatMenuKontrak(tgl: string) {
    const hariMalam = hariDalamMinggu(tgl);                 // hari D  (mis. Selasa)
    const hariPagiSiang = hariDalamMinggu(tambahHari(tgl, 1)); // hari D+1 (mis. Rabu)
    setHariKontrak(`${hariMalam} Malam + ${hariPagiSiang} Pagi & Siang`);
    setPesanMenuKontrak('');
    try {
      const kres = await api<{ kontrak: KontrakRingkas[] }>('kontrak.list', {});
      const aktif = kres.kontrak.find(
        (k) => k.status === 'DISETUJUI_PPK' && k.tgl_mulai <= tgl && tgl <= k.tgl_akhir
      );
      if (!aktif) { setMenuKontrak(''); setPesanMenuKontrak('Belum ada kontrak aktif (DISETUJUI_PPK) untuk tanggal ini.'); return; }

      const mres = await api<{ menu: MenuHari[] }>('menu.list', { kontrak_id: aktif.kontrak_id });
      const menuMalam = mres.menu.find((x) => x.hari === hariMalam);
      const menuPagiSiang = mres.menu.find((x) => x.hari === hariPagiSiang);
      const saran = komposisiPesanan(hariMalam, menuMalam, hariPagiSiang, menuPagiSiang);
      setMenuKontrak(saran);
      if (!saran) { setPesanMenuKontrak(`Menu kontrak untuk ${hariMalam}/${hariPagiSiang} belum diisi.`); return; }

      // Auto-isi bila field masih kosong atau belum diedit sejak auto-isi terakhir.
      setMenu((prev) => (prev.trim() === '' || prev === menuAutoRef.current) ? saran : prev);
      menuAutoRef.current = saran;
    } catch {
      setMenuKontrak('');
      setPesanMenuKontrak('Gagal memuat menu kontrak (tetap bisa diisi manual).');
    }
  }

  // Hitung estimasi + muat menu untuk tanggal awal (besok) saat halaman dibuka.
  useEffect(() => {
    void hitungEstimasi(besok());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pakaiMenuKontrak() {
    if (!menuKontrak) return;
    setMenu(menuKontrak);
    menuAutoRef.current = menuKontrak;
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

        <div className="rounded-xl bg-primary-light/40 p-3 text-sm">
          {memuatEstimasi ? 'Menghitung estimasi…' :
            jmlOtomatis !== null
              ? <>Estimasi otomatis: <span className="font-bold">{jmlOtomatis} taruna</span> (taruna AKTIF dikurangi yang berstatus harian)</>
              : 'Estimasi akan dihitung ulang oleh server saat disimpan.'}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="block text-sm font-medium text-gray-700">Menu Pengantaran</label>
            {menuKontrak && menu !== menuKontrak && (
              <button type="button" className="shrink-0 text-xs font-semibold text-primary" onClick={pakaiMenuKontrak}>
                🍽️ Pakai menu kontrak
              </button>
            )}
          </div>
          {hariKontrak && (
            <p className="mb-1 text-xs text-gray-500">
              Satu pengantaran = <span className="font-semibold">{hariKontrak}</span> (rekanan mengantar sekali, mencakup malam ini + pagi & siang esok).
            </p>
          )}
          <textarea
            rows={5}
            placeholder="Menu otomatis dari kontrak, bisa diubah bila perlu"
            value={menu}
            onChange={(e) => setMenu(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-light"
          />
          {pesanMenuKontrak && <p className="mt-1 text-xs text-amber-700">{pesanMenuKontrak}</p>}
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
