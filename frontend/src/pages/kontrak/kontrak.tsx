// /kontrak (PPK) — CRUD Penyedia & Kontrak + unggah lampiran (menu & nilai
// gizi, BA penunjukan, notulen rapat) sebagai dokumen pendukung kontrak.
import { useEffect, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { Input } from '../../components/ui/input';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { Modal } from '../../components/ui/modal';
import { TombolTemplateCsv } from '../../components/ui/tombol-template-csv';
import { useToast } from '../../components/ui/toast';
import { api } from '../../lib/api';
import { ambilBerkasInput, berkasKeBase64 } from '../../lib/berkas';
import { bacaFileTeks, deteksiPemisah, parseCsv } from '../../lib/csv';
import { useListCache } from '../../lib/use-list-cache';
import { urlDrive, type Lampiran } from '../pesanan/tipe';
import { formatRupiah } from '../tagihan/tipe';
import { HARI, JENIS_LAMPIRAN_KONTRAK, MENU_SOP_DEFAULT, validasiNpwpMask, type Kontrak, type MenuHari, type Penyedia } from './tipe';

export function HalamanKontrak() {
  const penyediaQ = useListCache<{ penyedia: Penyedia[] }>('penyedia.list', {});
  const kontrakQ = useListCache<{ kontrak: Kontrak[] }>('kontrak.list', {});
  const [modalPenyedia, setModalPenyedia] = useState<Penyedia | 'baru' | null>(null);
  const [modalKontrak, setModalKontrak] = useState<Kontrak | 'baru' | null>(null);
  const [lampiranKontrakId, setLampiranKontrakId] = useState<string | null>(null);
  const [menuKontrakId, setMenuKontrakId] = useState<string | null>(null);

  const namaPenyedia = new Map((penyediaQ.data?.penyedia ?? []).map((p) => [p.penyedia_id, p.nama]));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-primary-dark">Kontrak & Penyedia</h1>

      {/* ── Penyedia ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-600">Penyedia</h2>
        <Button varian="garis" onClick={() => setModalPenyedia('baru')}>+ Tambah</Button>
      </div>
      {penyediaQ.memuat && !penyediaQ.data && <LoadingSpinner />}
      {penyediaQ.galat && !penyediaQ.data && <ErrorMessage pesan={penyediaQ.galat} onRetry={penyediaQ.refresh} />}
      {penyediaQ.data && (penyediaQ.data.penyedia ?? []).length === 0 && <EmptyState pesan="Belum ada penyedia." />}
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4 xl:grid-cols-3">
        {penyediaQ.data?.penyedia?.map((p) => (
          <Card key={p.penyedia_id} className="flex items-center justify-between active:bg-primary-light/30" onClick={() => setModalPenyedia(p)}>
            <div>
              <p className="font-semibold">{p.nama}</p>
              <p className="text-sm text-gray-500">{p.kontak}</p>
            </div>
            <Badge status={p.status} />
          </Card>
        ))}
      </div>

      {/* ── Kontrak ──────────────────────────────────────────────────── */}
      <div className="mt-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-600">Kontrak</h2>
        <Button varian="garis" onClick={() => setModalKontrak('baru')}>+ Tambah</Button>
      </div>
      {kontrakQ.memuat && !kontrakQ.data && <LoadingSpinner />}
      {kontrakQ.galat && !kontrakQ.data && <ErrorMessage pesan={kontrakQ.galat} onRetry={kontrakQ.refresh} />}
      {kontrakQ.data && (kontrakQ.data.kontrak ?? []).length === 0 && <EmptyState pesan="Belum ada kontrak." />}
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4 xl:grid-cols-3">
        {kontrakQ.data?.kontrak?.map((k) => (
          <Card key={k.kontrak_id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{namaPenyedia.get(k.penyedia_id) ?? k.penyedia_id}</p>
                <p className="text-sm text-gray-500">
                  {formatRupiah(k.harga_per_hari_efektif ?? k.harga_per_hari ?? 0)}/hari · {k.porsi_per_hari}× sehari
                </p>
                <p className="text-xs text-gray-400">{k.tgl_mulai} s.d. {k.tgl_akhir}</p>
                {k.no_kontrak && (
                  <p className="text-xs text-gray-500">No. {k.no_kontrak}{k.tgl_kontrak ? ` · ${k.tgl_kontrak}` : ''}</p>
                )}
                {k.adendum && <p className="text-xs text-gray-500">Adendum: {k.adendum}</p>}
                {(k.rek_penyedia_bni || k.rek_penyedia_bsi) && (
                  <p className="text-xs text-gray-500">
                    Rek. penyedia{k.rek_penyedia_bni ? ` · BNI ${k.rek_penyedia_bni}` : ''}{k.rek_penyedia_bsi ? ` · BSI ${k.rek_penyedia_bsi}` : ''}
                  </p>
                )}
              </div>
              <Badge status={k.status} />
            </div>
            {k.status === 'DRAFT' && (
              <div className="flex gap-2">
                <Button varian="garis" className="flex-1" onClick={() => setModalKontrak(k)}>Ubah</Button>
                <ButtonSetujui kontrakId={k.kontrak_id} onSukses={kontrakQ.refresh} />
              </div>
            )}
            <div className="flex gap-2">
              <Button varian="garis" className="flex-1" onClick={() => setLampiranKontrakId(k.kontrak_id)}>
                📎 Lampiran
              </Button>
              <Button varian="garis" className="flex-1" onClick={() => setMenuKontrakId(k.kontrak_id)}>
                🍽️ Menu
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {modalPenyedia && (
        <ModalPenyedia
          awal={modalPenyedia === 'baru' ? null : modalPenyedia}
          onClose={() => setModalPenyedia(null)}
          onSukses={() => { setModalPenyedia(null); penyediaQ.refresh(); }}
        />
      )}
      {modalKontrak && (
        <ModalKontrak
          awal={modalKontrak === 'baru' ? null : modalKontrak}
          penyedia={penyediaQ.data?.penyedia ?? []}
          onClose={() => setModalKontrak(null)}
          onSukses={() => { setModalKontrak(null); kontrakQ.refresh(); }}
        />
      )}
      {lampiranKontrakId && (
        <ModalLampiran kontrakId={lampiranKontrakId} onClose={() => setLampiranKontrakId(null)} />
      )}
      {menuKontrakId && (
        <ModalMenu kontrakId={menuKontrakId} onClose={() => setMenuKontrakId(null)} />
      )}
    </div>
  );
}

function ButtonSetujui({ kontrakId, onSukses }: { kontrakId: string; onSukses: () => void }) {
  const { toast } = useToast();
  const [proses, setProses] = useState(false);

  async function setujui() {
    setProses(true);
    try {
      await api('kontrak.approve', { kontrak_id: kontrakId });
      toast('Kontrak disetujui.', 'sukses');
      onSukses();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  return <Button className="flex-1" onClick={() => void setujui()} disabled={proses}>Setujui</Button>;
}

function ModalPenyedia({ awal, onClose, onSukses }: {
  awal: Penyedia | null; onClose: () => void; onSukses: () => void;
}) {
  const { toast } = useToast();
  const [nama, setNama] = useState(awal?.nama ?? '');
  const [kontak, setKontak] = useState(awal?.kontak ?? '');
  const [alamat, setAlamat] = useState(awal?.alamat ?? '');
  const [npwp, setNpwp] = useState(awal ? awal.npwp_mask.replace(/\D/g, '') : '');
  const [status, setStatus] = useState(awal?.status ?? 'AKTIF');
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');

  async function simpan() {
    if (!nama.trim()) { setGalat('Nama wajib diisi.'); return; }
    const v = validasiNpwpMask(npwp);
    if (!v.ok) { setGalat(v.pesan); return; }
    setProses(true); setGalat('');
    try {
      await api('penyedia.upsert', {
        penyedia_id: awal?.penyedia_id, nama: nama.trim(), kontak: kontak.trim(),
        alamat: alamat.trim(), npwp_mask: npwp.replace(/\D/g, ''), status
      });
      toast('Penyedia tersimpan.', 'sukses');
      onSukses();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setProses(false);
    }
  }

  return (
    <Modal judul={awal ? 'Ubah Penyedia' : 'Tambah Penyedia'} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Input label="Nama Penyedia" value={nama} onChange={(e) => setNama(e.target.value)} />
        <Input label="Kontak" value={kontak} onChange={(e) => setKontak(e.target.value)} />
        <Input label="Alamat" value={alamat} onChange={(e) => setAlamat(e.target.value)} />
        <Input label="4 Digit Terakhir NPWP" value={npwp} onChange={(e) => setNpwp(e.target.value)} maxLength={4} inputMode="numeric" />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as 'AKTIF' | 'NONAKTIF')}
            className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5">
            <option value="AKTIF">AKTIF</option>
            <option value="NONAKTIF">NONAKTIF</option>
          </select>
        </div>
        {galat && <p className="text-sm text-red-600">{galat}</p>}
        <Button onClick={() => void simpan()} disabled={proses}>{proses ? 'Menyimpan…' : 'Simpan'}</Button>
      </div>
    </Modal>
  );
}

function ModalKontrak({ awal, penyedia, onClose, onSukses }: {
  awal: Kontrak | null; penyedia: Penyedia[]; onClose: () => void; onSukses: () => void;
}) {
  const { toast } = useToast();
  const [penyediaId, setPenyediaId] = useState(awal?.penyedia_id ?? penyedia[0]?.penyedia_id ?? '');
  const [hargaPerHari, setHargaPerHari] = useState(awal ? String(awal.harga_per_hari || '') : '');
  const [porsi, setPorsi] = useState(awal ? String(awal.porsi_per_hari) : '3');
  const [tglMulai, setTglMulai] = useState(awal?.tgl_mulai ?? '');
  const [tglAkhir, setTglAkhir] = useState(awal?.tgl_akhir ?? '');
  const [noKontrak, setNoKontrak] = useState(awal?.no_kontrak ?? '');
  const [tglKontrak, setTglKontrak] = useState(awal?.tgl_kontrak ?? '');
  const [adendum, setAdendum] = useState(awal?.adendum ?? '');
  const [rekBni, setRekBni] = useState(awal?.rek_penyedia_bni ?? '');
  const [rekBsi, setRekBsi] = useState(awal?.rek_penyedia_bsi ?? '');
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');

  async function simpan() {
    if (!penyediaId) { setGalat('Pilih penyedia.'); return; }
    if (!hargaPerHari || !porsi || !tglMulai || !tglAkhir) { setGalat('Harga per hari, porsi, dan periode wajib diisi.'); return; }
    setProses(true); setGalat('');
    try {
      await api('kontrak.upsert', {
        kontrak_id: awal?.kontrak_id, penyedia_id: penyediaId,
        harga_per_hari: Number(hargaPerHari),
        // harga_per_porsi: legacy, tidak lagi diminta di form — kirim nilai lama apa
        // adanya (pass-through) supaya kontrak lama yang masih andalkan fallback
        // (lihat _hargaPerHariKontrak_) tidak tertimpa jadi 0.
        harga_per_porsi: awal?.harga_per_porsi ?? 0,
        porsi_per_hari: Number(porsi),
        tgl_mulai: tglMulai, tgl_akhir: tglAkhir,
        no_kontrak: noKontrak, tgl_kontrak: tglKontrak, adendum: adendum,
        rek_penyedia_bni: rekBni, rek_penyedia_bsi: rekBsi
      });
      toast('Kontrak tersimpan.', 'sukses');
      onSukses();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setProses(false);
    }
  }

  return (
    <Modal judul={awal ? 'Ubah Kontrak' : 'Tambah Kontrak'} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Penyedia</label>
          <select value={penyediaId} onChange={(e) => setPenyediaId(e.target.value)}
            className="min-h-tap w-full rounded-xl border border-gray-300 px-3 py-2.5">
            <option value="">— Pilih penyedia —</option>
            {penyedia.map((p) => <option key={p.penyedia_id} value={p.penyedia_id}>{p.nama}</option>)}
          </select>
        </div>
        <Input label="Harga per Hari (Rp/taruna/hari)" type="number" value={hargaPerHari} onChange={(e) => setHargaPerHari(e.target.value)} />
        <p className="-mt-2 text-xs text-gray-400">
          Satu angka total per taruna per hari — SUDAH mencakup semua waktu makan
          (mis. pagi/siang/malam), bukan harga satuan per porsi. Tidak dibagi
          dengan Porsi per Hari di bawah (murni info, bukan pembagi harga).
        </p>
        <Input label="Porsi per Hari (info — brp kali makan sehari)" type="number" value={porsi} onChange={(e) => setPorsi(e.target.value)} />
        <div className="flex gap-2">
          <Input label="Tgl Mulai" type="date" value={tglMulai} onChange={(e) => setTglMulai(e.target.value)} />
          <Input label="Tgl Akhir" type="date" value={tglAkhir} onChange={(e) => setTglAkhir(e.target.value)} />
        </div>
        <div className="border-t border-gray-100 pt-2">
          <p className="mb-2 text-xs font-semibold text-gray-500">Data Dokumen Kontrak (opsional)</p>
          <div className="flex flex-col gap-3">
            <Input label="Nomor Kontrak" value={noKontrak} onChange={(e) => setNoKontrak(e.target.value)} />
            <Input label="Tanggal Kontrak" type="date" value={tglKontrak} onChange={(e) => setTglKontrak(e.target.value)} />
            <Input label="Adendum" value={adendum} onChange={(e) => setAdendum(e.target.value)} />
            <Input label="Rekening Penyedia BNI (nomor penuh)" value={rekBni} onChange={(e) => setRekBni(e.target.value)} />
            <Input label="Rekening Penyedia BSI (nomor penuh)" value={rekBsi} onChange={(e) => setRekBsi(e.target.value)} />
          </div>
        </div>
        {galat && <p className="text-sm text-red-600">{galat}</p>}
        <Button onClick={() => void simpan()} disabled={proses}>{proses ? 'Menyimpan…' : 'Simpan'}</Button>
      </div>
    </Modal>
  );
}

function ModalLampiran({ kontrakId, onClose }: { kontrakId: string; onClose: () => void }) {
  const { toast } = useToast();
  const { data, memuat, galat, refresh } = useListCache<{ kontrak: Kontrak; lampiran: Lampiran[] }>(
    'kontrak.get', { kontrak_id: kontrakId }
  );
  const [proses, setProses] = useState<string | null>(null);

  async function unggah(jenis: string) {
    const file = await ambilBerkasInput();
    if (!file) return;
    setProses(jenis);
    try {
      const base64 = await berkasKeBase64(file);
      await api('kontrak.lampiran_upload', { kontrak_id: kontrakId, berkas: { base64, nama_file: file.name, jenis } });
      toast('Lampiran terunggah.', 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(null);
    }
  }

  return (
    <Modal judul="Lampiran Kontrak" onClose={onClose}>
      <div className="flex flex-col gap-3">
        {memuat && !data && <LoadingSpinner />}
        {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}

        <div className="flex flex-col gap-2">
          {JENIS_LAMPIRAN_KONTRAK.map((j) => (
            <Button key={j.jenis} varian="garis" onClick={() => void unggah(j.jenis)} disabled={proses === j.jenis}>
              {proses === j.jenis ? 'Mengunggah…' : `📎 Unggah ${j.label}`}
            </Button>
          ))}
        </div>

        {data && data.lampiran.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-gray-100 pt-2">
            <p className="text-sm font-semibold text-gray-600">Lampiran Tersimpan</p>
            {data.lampiran.map((l) => (
              <a key={l.lamp_id} href={urlDrive(l.drive_file_id)} target="_blank" rel="noreferrer"
                className="text-sm text-primary underline">
                {JENIS_LAMPIRAN_KONTRAK.find((j) => j.jenis === l.jenis)?.label ?? l.jenis}: {l.nama_file}
              </a>
            ))}
          </div>
        )}
        {data && data.lampiran.length === 0 && <EmptyState pesan="Belum ada lampiran." />}
      </div>
    </Modal>
  );
}

type FormMenu = Record<string, { pagi: string; siang: string; malam: string }>;

function formMenuKosong(): FormMenu {
  const f: FormMenu = {};
  HARI.forEach((h) => { f[h] = { pagi: '', siang: '', malam: '' }; });
  return f;
}

function ModalMenu({ kontrakId, onClose }: { kontrakId: string; onClose: () => void }) {
  const { toast } = useToast();
  const { data, memuat, galat, refresh } = useListCache<{ menu: MenuHari[] }>('menu.list', { kontrak_id: kontrakId });
  const [form, setForm] = useState<FormMenu>(formMenuKosong());
  const [sudahDimuat, setSudahDimuat] = useState(false);
  const [proses, setProses] = useState(false);

  useEffect(() => {
    if (data && !sudahDimuat) {
      const f = formMenuKosong();
      data.menu.forEach((m) => { f[m.hari] = { pagi: m.menu_pagi, siang: m.menu_siang, malam: m.menu_malam }; });
      setForm(f);
      setSudahDimuat(true);
    }
  }, [data, sudahDimuat]);

  function ubah(hari: string, field: 'pagi' | 'siang' | 'malam', nilai: string) {
    setForm((f) => ({ ...f, [hari]: { ...f[hari], [field]: nilai } }));
  }

  function isiContohSop() {
    const f = formMenuKosong();
    HARI.forEach((h) => { f[h] = { ...MENU_SOP_DEFAULT[h] }; });
    setForm(f);
    toast('Contoh menu SOP diisi — periksa lalu Simpan Semua.', 'info');
  }

  // Muat menu dari CSV (header: hari, menu_pagi, menu_siang, menu_malam — satu
  // item per baris di dalam sel). Hanya mengisi FORM; belum menyimpan sampai
  // "Simpan Semua Menu" ditekan (pola sama seperti impor lain).
  async function muatDariCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const teks = await bacaFileTeks(file);
      const semua = parseCsv(teks, deteksiPemisah(teks));
      if (semua.length < 2) { toast('File CSV kosong atau tidak valid.', 'galat'); return; }
      const header = semua[0].map((h) => h.trim().toLowerCase());
      const cari = (...kandidat: string[]) => header.findIndex((h) => kandidat.includes(h));
      const iHari = cari('hari');
      const iPagi = cari('menu_pagi', 'pagi');
      const iSiang = cari('menu_siang', 'siang');
      const iMalam = cari('menu_malam', 'malam');
      if (iHari < 0 || iPagi < 0 || iSiang < 0 || iMalam < 0) {
        toast('Header CSV wajib memuat: hari, menu_pagi, menu_siang, menu_malam.', 'galat');
        return;
      }
      const f = formMenuKosong();
      let terisi = 0;
      semua.slice(1).forEach((row) => {
        const hari = (row[iHari] ?? '').trim().toUpperCase();
        if (!HARI.includes(hari)) return;
        f[hari] = {
          pagi: (row[iPagi] ?? '').trim(),
          siang: (row[iSiang] ?? '').trim(),
          malam: (row[iMalam] ?? '').trim()
        };
        terisi++;
      });
      if (terisi === 0) { toast('Tidak ada baris hari yang dikenali (SENIN…MINGGU).', 'galat'); return; }
      setForm(f);
      setSudahDimuat(true); // cegah useEffect menimpa dengan data server
      toast(`${terisi} hari dimuat dari CSV — periksa lalu Simpan Semua Menu.`, 'sukses');
    } catch {
      toast('Gagal membaca file CSV.', 'galat');
    } finally {
      e.target.value = ''; // reset supaya file yang sama bisa dipilih lagi
    }
  }

  async function simpanSemua() {
    setProses(true);
    try {
      for (const h of HARI) {
        const isi = form[h];
        await api('menu.upsert', {
          kontrak_id: kontrakId, hari: h,
          menu_pagi: isi.pagi, menu_siang: isi.siang, menu_malam: isi.malam
        });
      }
      toast('Menu mingguan tersimpan.', 'sukses');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal.', 'galat');
    } finally {
      setProses(false);
    }
  }

  return (
    <Modal judul="Menu Mingguan Kontrak" onClose={onClose}>
      <div className="flex flex-col gap-3">
        {memuat && !data && <LoadingSpinner />}
        {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button varian="garis" className="flex-1" onClick={isiContohSop}>📋 Isi Contoh Menu SOP</Button>
          <label className="flex min-h-tap flex-1 cursor-pointer items-center justify-center rounded-xl border-2 border-primary px-4 py-2.5 text-base font-semibold text-primary transition-colors active:bg-primary-light">
            📄 Muat dari CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void muatDariCsv(e)} />
          </label>
        </div>
        <p className="text-xs text-gray-400">
          CSV: kolom <code>hari, menu_pagi, menu_siang, menu_malam</code> — satu item menu per baris di dalam sel.
        </p>
        <TombolTemplateCsv
          namaFile="template-menu-mingguan-kontrak.csv"
          header={['hari', 'menu_pagi', 'menu_siang', 'menu_malam']}
          contoh={HARI.map((h) => [h, MENU_SOP_DEFAULT[h].pagi, MENU_SOP_DEFAULT[h].siang, MENU_SOP_DEFAULT[h].malam])}
          label="📥 Unduh Template CSV (terisi Menu SOP)"
        />

        <div className="flex max-h-[55vh] flex-col gap-4 overflow-y-auto pr-1">
          {HARI.map((h) => (
            <div key={h} className="rounded-xl border border-gray-200 p-3">
              <p className="mb-2 text-sm font-bold text-primary-dark">{h}</p>
              <div className="flex flex-col gap-2">
                <TextareaMenu label="Pagi" value={form[h]?.pagi ?? ''} onChange={(v) => ubah(h, 'pagi', v)} />
                <TextareaMenu label="Siang" value={form[h]?.siang ?? ''} onChange={(v) => ubah(h, 'siang', v)} />
                <TextareaMenu label="Malam" value={form[h]?.malam ?? ''} onChange={(v) => ubah(h, 'malam', v)} />
              </div>
            </div>
          ))}
        </div>

        <Button onClick={() => void simpanSemua()} disabled={proses}>
          {proses ? 'Menyimpan…' : 'Simpan Semua Menu'}
        </Button>
      </div>
    </Modal>
  );
}

function TextareaMenu({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-light"
      />
    </div>
  );
}
