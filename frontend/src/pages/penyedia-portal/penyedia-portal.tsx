// /penyedia-portal (role PENYEDIA) — portal rekanan katering eksternal.
// Menampilkan HANYA data milik penyedia yang login (di-scope backend via
// session.penyedia_id): profil, kontrak + menu mingguan, jadwal pengantaran
// mendatang, ringkas realisasi, dan status pembayaran. TIDAK memuat data
// taruna/rekening/identitas staf — backend sudah menyaringnya.
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { labelBulan } from '../../components/bulan-picker';
import { useListCache } from '../../lib/use-list-cache';
import { formatRupiah } from '../tagihan/tipe';

interface MenuHari { hari: string; menu_pagi: string; menu_siang: string; menu_malam: string }
interface LampiranRingkas { jenis: string; nama_file: string }
interface KontrakPortal {
  kontrak_id: string; harga_per_porsi: number; porsi_per_hari: number; harga_per_hari_efektif: number;
  tgl_mulai: string; tgl_akhir: string; status: string;
  menu: MenuHari[]; lampiran: LampiranRingkas[];
}
interface PesananPortal { tgl_makan: string; jml_taruna: number; menu: string; catatan: string; status: string }
interface RealisasiPortal { tanggal: string; porsi_diterima: number; jml_taruna_makan: number; ketidaksesuaian: string; tindak_lanjut: string }
interface PembayaranPortal {
  bulan: string; nilai_total: number; no_spm: string; tgl_spm: string;
  no_sp2d: string; tgl_sp2d: string; status: string; invoice_dikonfirmasi: boolean;
}
interface Portal {
  penyedia: { nama: string; kontak: string; alamat: string; status: string };
  kontrak: KontrakPortal[];
  pesanan: PesananPortal[];
  realisasi: RealisasiPortal[];
  pembayaran: PembayaranPortal[];
}

const LABEL_STATUS_BAYAR: Record<string, string> = {
  DIAJUKAN: 'Diajukan (menunggu SP2D)',
  SP2D_TERBIT: 'SP2D terbit',
  DITRANSFER: 'Dana ditransfer',
  DIKONFIRMASI: 'Dikonfirmasi',
  SELESAI: 'Selesai'
};

/** Pisah teks menu multi-baris jadi item — tampilkan sebagai daftar ringkas. */
function itemMenu(teks: string): string[] {
  return (teks || '').split('\n').map((s) => s.trim()).filter(Boolean);
}

export function HalamanPenyediaPortal() {
  const { data, memuat, galat, refresh } = useListCache<Portal>('penyedia.portal', {});

  if (memuat && !data) return <LoadingSpinner label="Memuat data penyedia…" />;
  if (galat && !data) return <ErrorMessage pesan={galat} onRetry={refresh} />;
  if (!data) return null;

  const { penyedia, kontrak, pesanan, realisasi, pembayaran } = data;

  return (
    <div className="flex flex-col gap-4">
      {/* Profil penyedia */}
      <div>
        <h1 className="text-xl font-bold text-primary-dark">{penyedia.nama}</h1>
        <p className="text-sm text-gray-500">
          {penyedia.kontak && <>📞 {penyedia.kontak} · </>}
          {penyedia.alamat || 'Alamat belum diisi'}
        </p>
      </div>

      {/* Kontrak + menu mingguan */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-600">Kontrak Saya</h2>
        {kontrak.length === 0 ? (
          <EmptyState pesan="Belum ada kontrak untuk penyedia ini." />
        ) : (
          kontrak.map((k) => (
            <Card key={k.kontrak_id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-primary-dark">{k.kontrak_id}</p>
                  <p className="text-xs text-gray-500">{k.tgl_mulai} s/d {k.tgl_akhir}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  k.status === 'DISETUJUI_PPK' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {k.status === 'DISETUJUI_PPK' ? 'Disetujui' : 'Draft'}
                </span>
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Harga/hari</p>
                  <p className="font-semibold">{formatRupiah(k.harga_per_hari_efektif ?? 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Porsi/hari</p>
                  <p className="font-semibold">{k.porsi_per_hari}</p>
                </div>
              </div>

              {k.menu.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-gray-500">Menu Mingguan</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500">
                          <th className="py-1 pr-2">Hari</th><th className="py-1 pr-2">Pagi</th>
                          <th className="py-1 pr-2">Siang</th><th className="py-1">Malam</th>
                        </tr>
                      </thead>
                      <tbody>
                        {k.menu.map((m) => (
                          <tr key={m.hari} className="border-b border-gray-100 align-top">
                            <td className="py-1 pr-2 font-medium">{m.hari}</td>
                            <td className="py-1 pr-2 whitespace-pre-line">{m.menu_pagi || '-'}</td>
                            <td className="py-1 pr-2 whitespace-pre-line">{m.menu_siang || '-'}</td>
                            <td className="py-1 whitespace-pre-line">{m.menu_malam || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {k.lampiran.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-gray-500">Dokumen Kontrak</p>
                  <ul className="flex flex-wrap gap-2">
                    {k.lampiran.map((l, i) => (
                      <li key={i} className="rounded-lg bg-gray-100 px-2 py-1 text-xs text-gray-600">
                        📎 {l.nama_file || l.jenis} <span className="text-gray-400">({l.jenis})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          ))
        )}
      </section>

      {/* Jadwal pengantaran */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-gray-600">Jadwal Pengantaran</h2>
        <p className="text-xs text-gray-400">
          Pesanan yang sudah final (disetujui/terkirim) — porsi = jumlah taruna hari itu.
          Menu satu pengantaran mencakup <strong>Malam</strong> hari itu + <strong>Pagi &amp; Siang</strong> keesokan harinya.
        </p>
        {pesanan.length === 0 ? (
          <EmptyState pesan="Belum ada jadwal pengantaran mendatang." />
        ) : (
          pesanan.map((p, i) => (
            <Card key={i} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-primary-dark">{p.tgl_makan}</p>
                <span className="text-sm">{p.jml_taruna} porsi</span>
              </div>
              {itemMenu(p.menu).length > 0 && (
                <ul className="list-inside list-disc text-xs text-gray-600">
                  {itemMenu(p.menu).map((m, j) => <li key={j}>{m}</li>)}
                </ul>
              )}
              {p.catatan && <p className="text-xs text-amber-700">Catatan: {p.catatan}</p>}
            </Card>
          ))
        )}
      </section>

      {/* Ringkas realisasi */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-gray-600">Riwayat Penerimaan</h2>
        {realisasi.length === 0 ? (
          <EmptyState pesan="Belum ada data penerimaan." />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-1 pr-2">Tanggal</th><th className="py-1 pr-2 text-right">Porsi</th>
                  <th className="py-1 pr-2 text-right">Makan</th><th className="py-1">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {realisasi.map((r, i) => (
                  <tr key={i} className={`border-b border-gray-100 align-top ${r.ketidaksesuaian ? 'bg-amber-50' : ''}`}>
                    <td className="py-1 pr-2">{r.tanggal}</td>
                    <td className="py-1 pr-2 text-right">{r.porsi_diterima}</td>
                    <td className="py-1 pr-2 text-right">{r.jml_taruna_makan}</td>
                    <td className="py-1">
                      {r.ketidaksesuaian
                        ? <span className="text-amber-700">{r.ketidaksesuaian}{r.tindak_lanjut ? ` → ${r.tindak_lanjut}` : ''}</span>
                        : <span className="text-green-700">Sesuai</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      {/* Status pembayaran */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-gray-600">Status Pembayaran</h2>
        {pembayaran.length === 0 ? (
          <EmptyState pesan="Belum ada pembayaran tercatat." />
        ) : (
          pembayaran.map((p, i) => (
            <Card key={i} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-primary-dark">{labelBulan(p.bulan)}</p>
                <span className="font-semibold">{formatRupiah(p.nilai_total)}</span>
              </div>
              <p className="text-xs">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${
                  p.status === 'SELESAI' ? 'bg-green-100 text-green-700'
                    : p.status === 'DIAJUKAN' ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {LABEL_STATUS_BAYAR[p.status] || p.status}
                </span>
              </p>
              {(p.no_sp2d || p.no_spm) && (
                <p className="text-xs text-gray-500">
                  {p.no_spm && <>SPM {p.no_spm}{p.tgl_spm ? ` (${p.tgl_spm})` : ''} · </>}
                  {p.no_sp2d && <>SP2D {p.no_sp2d}{p.tgl_sp2d ? ` (${p.tgl_sp2d})` : ''}</>}
                </p>
              )}
              {p.invoice_dikonfirmasi && <p className="text-xs text-green-700">✓ Invoice sudah dikonfirmasi diterima</p>}
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
