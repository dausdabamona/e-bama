// Kerangka halaman: header (nama app, indikator online/offline, badge antrian)
// + bottom-nav 4–5 item BERBEDA per role.
import { NavLink, Outlet } from 'react-router-dom';
import { sepertiPpk, useAuth, type Role } from '../auth/auth-context';
import { SidebarPpkDesktop } from './sidebar-ppk-desktop';
import { TopbarPpkDesktop } from './topbar-ppk-desktop';
import { BadgeAntrianSinkron, TitikStatusOnline, useSyncStatus } from './ui/sync-badge';

interface ItemNav {
  ke: string;
  label: string;
  ikon: string;
}

// Label role untuk indikator "sedang aktif sebagai" di header.
const LABEL_ROLE: Record<Role, string> = {
  KPA: 'KPA', PPK: 'PPK', STAF_PPK: 'Staf PPK', SENAT: 'Senat', PEMBINA: 'Pembina',
  ADMIN: 'Admin', WADIR3: 'Wadir 3', BAAK: 'BAAK', PENYEDIA: 'Penyedia',
  KETUA_JURUSAN: 'Ketua Jurusan', OPERATOR_SAKTI: 'Operator SAKTI'
};

// Bottom-nav per role (sesuai PROMPT 5)
export const NAV_PER_ROLE: Record<Role, ItemNav[]> = {
  SENAT: [
    { ke: '/pesanan', label: 'Pesanan', ikon: '🍱' },
    { ke: '/realisasi', label: 'Realisasi', ikon: '✅' },
    { ke: '/tagihan', label: 'Tagihan', ikon: '💳' },
    { ke: '/rekap-ringkas', label: 'Rekap', ikon: '📊' },
    { ke: '/akun', label: 'Akun', ikon: '👤' }
  ],
  PEMBINA: [
    { ke: '/verifikasi', label: 'Verifikasi', ikon: '🔎' },
    { ke: '/pesanan', label: 'Pesanan', ikon: '🍱' },
    { ke: '/realisasi', label: 'Realisasi', ikon: '✅' },
    { ke: '/tagihan', label: 'Tagihan', ikon: '💳' },
    { ke: '/status-taruna', label: 'Status', ikon: '📋' },
    { ke: '/taruna', label: 'Taruna', ikon: '🎓' },
    { ke: '/rekap-ringkas', label: 'Rekap', ikon: '📊' },
    { ke: '/akun', label: 'Akun', ikon: '👤' }
  ],
  PPK: [
    { ke: '/kokpit-ppk', label: 'Kokpit', ikon: '🧭' },
    { ke: '/rekap', label: 'Rekap', ikon: '📊' },
    { ke: '/realisasi', label: 'Realisasi', ikon: '✅' },
    { ke: '/pembayaran', label: 'Bayar', ikon: '🏦' },
    { ke: '/tagihan', label: 'Tagihan', ikon: '💳' },
    { ke: '/laporan', label: 'Laporan', ikon: '🖨️' },
    { ke: '/akun', label: 'Akun', ikon: '👤' }
  ],
  // Staf PPK: navigasi cermin PPK (dia mengerjakan administrasi yang sama).
  STAF_PPK: [
    { ke: '/kokpit-ppk', label: 'Kokpit', ikon: '🧭' },
    { ke: '/rekap', label: 'Rekap', ikon: '📊' },
    { ke: '/realisasi', label: 'Realisasi', ikon: '✅' },
    { ke: '/pembayaran', label: 'Bayar', ikon: '🏦' },
    { ke: '/tagihan', label: 'Tagihan', ikon: '💳' },
    { ke: '/laporan', label: 'Laporan', ikon: '🖨️' },
    { ke: '/akun', label: 'Akun', ikon: '👤' }
  ],
  KPA: [
    { ke: '/dashboard', label: 'Dashboard', ikon: '📈' },
    { ke: '/kokpit-ppk', label: 'Kokpit', ikon: '🧭' },
    { ke: '/laporan', label: 'Laporan', ikon: '🖨️' },
    { ke: '/akun', label: 'Akun', ikon: '👤' }
  ],
  ADMIN: [
    { ke: '/taruna', label: 'Taruna', ikon: '🎓' },
    { ke: '/status-taruna', label: 'Status', ikon: '📋' },
    { ke: '/tagihan', label: 'Tagihan', ikon: '💳' },
    { ke: '/pengguna', label: 'Pengguna', ikon: '👥' },
    { ke: '/laporan', label: 'Laporan', ikon: '🖨️' },
    { ke: '/akun', label: 'Akun', ikon: '👤' }
  ],
  WADIR3: [
    { ke: '/persetujuan-wadir3', label: 'Persetujuan', ikon: '✅' },
    { ke: '/dashboard', label: 'Dashboard', ikon: '📈' },
    { ke: '/kokpit-ppk', label: 'Kokpit', ikon: '🧭' },
    { ke: '/laporan', label: 'Laporan', ikon: '🖨️' },
    { ke: '/akun', label: 'Akun', ikon: '👤' }
  ],
  BAAK: [
    { ke: '/taruna', label: 'Taruna', ikon: '🎓' },
    { ke: '/status-taruna', label: 'Status', ikon: '📋' },
    { ke: '/akun', label: 'Akun', ikon: '👤' }
  ],
  PENYEDIA: [
    { ke: '/penyedia-portal', label: 'Beranda', ikon: '🍽️' },
    { ke: '/akun', label: 'Akun', ikon: '👤' }
  ],
  KETUA_JURUSAN: [
    { ke: '/luar-kampus-kajur', label: 'Luar Kampus', ikon: '🧳' },
    { ke: '/akun', label: 'Akun', ikon: '👤' }
  ],
  OPERATOR_SAKTI: [
    { ke: '/cetak', label: 'Cetak', ikon: '🖨️' },
    { ke: '/akun', label: 'Akun', ikon: '👤' }
  ]
};

export function Layout() {
  const { session } = useAuth();
  const { online, nAntrian } = useSyncStatus();

  // Jaga-jaga: kalau session.role tak dikenal di build ini (mis. role baru
  // ditambah backend tapi frontend belum di-deploy ulang), NAV_PER_ROLE[role]
  // = undefined → `nav.map` melempar & seluruh app blank. Fallback ke [] .
  const nav = (session ? NAV_PER_ROLE[session.role] : null) ?? [];
  // Desktop khusus PPK (design_handoff_ebama_kokpit): sidebar gelap + topbar
  // sendiri, HANYA ≥1024px. Mobile & role lain tetap memakai shell lama.
  const ppkDesktop = sepertiPpk(session?.role);

  return (
    <div className="flex min-h-dvh w-full bg-ivory lg:flex-row">
      {/* Sidebar — desktop (≥1024px) saja */}
      {ppkDesktop ? (
        <SidebarPpkDesktop />
      ) : (
        <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-gray-200 lg:bg-white lg:px-3 lg:py-6">
          <div className="mb-6 flex items-center gap-2 px-3">
            <span className="text-xl font-bold text-primary-dark">e-BAMA</span>
            <TitikStatusOnline online={online} />
          </div>
          <nav className="flex flex-col gap-1">
            {nav.map((item) => (
              <NavLink
                key={item.ke}
                to={item.ke}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                    isActive ? 'bg-primary-light font-bold text-primary-dark' : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                <span className="text-lg" aria-hidden>{item.ikon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
      )}

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col lg:mx-0 lg:max-w-none">
        {ppkDesktop && session && <TopbarPpkDesktop session={session} />}
        {/* Header */}
        <header className={`sticky top-0 z-40 flex items-center justify-between bg-primary px-4 py-3 text-white shadow lg:border-b lg:border-gray-200 lg:bg-white lg:px-8 lg:py-4 lg:text-gray-800 lg:shadow-none ${ppkDesktop ? 'lg:hidden' : ''}`}>
          <div className="flex items-center gap-2 lg:hidden">
            <span className="text-lg font-bold">e-BAMA</span>
            <TitikStatusOnline online={online} />
            {!online && <span className="text-xs">Offline</span>}
            {nAntrian > 0 && <BadgeAntrianSinkron nAntrian={nAntrian} className="bg-white/20 text-white" />}
          </div>
          <div className="hidden items-center gap-2 text-sm text-gray-500 lg:flex">
            <TitikStatusOnline online={online} />
            {online ? 'Online' : 'Offline'}
            {nAntrian > 0 && <BadgeAntrianSinkron nAntrian={nAntrian} />}
          </div>
          <div className="flex items-center gap-2">
            {session && (
              <NavLink to="/akun" className="flex items-center gap-1.5" aria-label="Akun & role aktif" title={`Masuk sebagai ${session.nama} (${LABEL_ROLE[session.role] ?? session.role})`}>
                <span className="hidden max-w-[9rem] truncate text-sm sm:inline">{session.nama}</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold lg:bg-primary-light lg:text-primary-dark">
                  {LABEL_ROLE[session.role] ?? session.role}
                </span>
              </NavLink>
            )}
            <NavLink to="/antrian" className="relative min-h-tap min-w-tap p-2 text-xl lg:text-gray-700" aria-label="Antrian aksi">
              📤
              {nAntrian > 0 && (
                <span className="absolute -right-0.5 -top-0.5 rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                  {nAntrian}
                </span>
              )}
            </NavLink>
          </div>
        </header>

        {/* Isi halaman */}
        <main className="flex-1 px-4 pb-24 pt-4 lg:mx-auto lg:w-full lg:max-w-6xl lg:px-8 lg:py-6">
          <Outlet />
        </main>

        {/* Bottom nav — mobile saja */}
        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-lg justify-around border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
          {nav.map((item) => (
            <NavLink
              key={item.ke}
              to={item.ke}
              className={({ isActive }) =>
                `flex min-h-tap flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
                  isActive ? 'font-bold text-primary' : 'text-gray-500'
                }`
              }
            >
              <span className="text-lg" aria-hidden>{item.ikon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
