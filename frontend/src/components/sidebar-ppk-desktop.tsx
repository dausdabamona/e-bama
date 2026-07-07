// Sidebar desktop khusus PPK — dari design_handoff_ebama_kokpit (Dashboard
// e-BAMA.dc.html): sidebar gelap dengan nav berkelompok + badge, pengganti
// sidebar terang generik HANYA untuk role PPK di layar ≥1024px (lg:).
// Mobile & role lain TIDAK terpengaruh — layout.tsx tetap pakai sidebar lama.
//
// CATATAN PENYESUAIAN dari desain asli (yang menampilkan nav ideal PPK):
// beberapa item pada mockup (Verifikasi Pesanan, Realisasi, Penerimaan
// Barang, Menu Hari Ini, Taruna, Pengguna) DIHILANGKAN karena route/action-nya
// TIDAK diizinkan untuk role PPK saat ini (mis. pesanan.antrian_verifikasi
// roles:['PEMBINA'] saja, /taruna roles:['ADMIN','BAAK','PEMBINA']) — sengaja
// tidak mengubah guard/permission yang sudah ada. "SPM" & "SP2D Monitoring"
// digabung ke halaman yang sudah memuatnya (Pembayaran, Laporan) karena belum
// ada halaman terpisah untuk itu.
import { NavLink } from 'react-router-dom';
import { useListCache } from '../lib/use-list-cache';

interface ItemNav {
  ke: string;
  label: string;
  jmlBadge?: number;
  badgeBahaya?: boolean;
}
interface GrupNav {
  judul?: string;
  item: ItemNav[];
}

interface Ringkasan {
  per_level: Record<string, { jumlah: number; nominal: number }>;
  total_outstanding: number;
}

function useBadgeTagihan(): number {
  const { data } = useListCache<Ringkasan>('tagihan.summary', {});
  if (!data) return 0;
  return ['0', '1', '2', '3'].reduce((s, lv) => s + (data.per_level[lv]?.jumlah ?? 0), 0);
}

function IkonNav({ children }: { children: React.ReactNode }) {
  return <span className="flex h-[17px] w-[17px] shrink-0 items-center justify-center opacity-90">{children}</span>;
}

export function SidebarPpkDesktop() {
  const jmlTagihan = useBadgeTagihan();

  const grup: GrupNav[] = [
    { item: [{ ke: '/kokpit-ppk', label: 'Kokpit' }] },
    {
      judul: 'Pengelolaan Makan',
      item: [
        { ke: '/rekap', label: 'Rekap Bulanan' },
        { ke: '/taruna/rekap-harian', label: 'Rekap Harian Taruna' }
      ]
    },
    {
      judul: 'Keuangan',
      item: [
        { ke: '/pembayaran', label: 'Pembayaran & SPM' },
        { ke: '/tagihan', label: 'Tagihan', jmlBadge: jmlTagihan, badgeBahaya: jmlTagihan > 0 },
        { ke: '/tagihan/impor-debet', label: 'Impor Debet' }
      ]
    },
    {
      judul: 'Pelaporan',
      item: [
        { ke: '/laporan', label: 'Laporan Bulanan & SP2D' },
        { ke: '/laporan/resmi', label: 'Laporan Resmi / SPJ' },
        { ke: '/audit', label: 'Audit Log' },
        { ke: '/cetak', label: 'Cetak Dokumen' }
      ]
    },
    {
      judul: 'Master Data',
      item: [{ ke: '/kontrak', label: 'Kontrak & Penyedia' }]
    }
  ];

  return (
    <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-[236px] lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:bg-[#0B3B39] lg:py-0 lg:text-[#CFEAE6]">
      <div className="flex items-center gap-2 border-b border-[#14524e] px-[18px] py-4">
        <span
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#14B8A6,#0F766E)' }}
        >
          e
        </span>
        <span className="text-base font-bold text-white">e-BAMA</span>
        <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[#14B8A6]" title="Tersinkron" />
      </div>

      <nav className="flex flex-col gap-1 px-2 py-3">
        {grup.map((g, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-3' : ''}>
            {g.judul && (
              <p className="px-2.5 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[.09em] text-[#7FB4AE]">
                {g.judul}
              </p>
            )}
            {g.item.map((it) => (
              <NavLink
                key={it.ke}
                to={it.ke}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-[7px] px-2.5 py-[7px] text-[13.5px] ${
                    isActive ? 'bg-[#0F766E] font-semibold text-white' : 'text-[#CFEAE6] hover:bg-[#14524e]'
                  }`
                }
              >
                <IkonNav>
                  <span className="block h-1.5 w-1.5 rounded-full bg-current" />
                </IkonNav>
                <span className="truncate">{it.label}</span>
                {!!it.jmlBadge && (
                  <span
                    className={`ml-auto min-w-[18px] rounded-full px-1.5 py-px text-center text-[10.5px] font-semibold text-white ${
                      it.badgeBahaya ? 'bg-[#DC2626]' : 'bg-[#D97706]'
                    }`}
                  >
                    {it.jmlBadge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
