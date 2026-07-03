// Kerangka halaman: header (nama app, indikator online/offline, badge antrian)
// + bottom-nav 4–5 item BERBEDA per role.
import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth, type Role } from '../auth/auth-context';
import { jumlahAntrian } from '../lib/sync';

interface ItemNav {
  ke: string;
  label: string;
  ikon: string;
}

// Bottom-nav per role (sesuai PROMPT 5)
export const NAV_PER_ROLE: Record<Role, ItemNav[]> = {
  SENAT: [
    { ke: '/pesanan', label: 'Pesanan', ikon: '🍱' },
    { ke: '/realisasi', label: 'Realisasi', ikon: '✅' },
    { ke: '/tagihan', label: 'Tagihan', ikon: '💳' },
    { ke: '/akun', label: 'Akun', ikon: '👤' }
  ],
  PEMBINA: [
    { ke: '/verifikasi', label: 'Verifikasi', ikon: '🔎' },
    { ke: '/realisasi', label: 'Realisasi', ikon: '✅' },
    { ke: '/status-taruna', label: 'Status', ikon: '📋' },
    { ke: '/akun', label: 'Akun', ikon: '👤' }
  ],
  PPK: [
    { ke: '/rekap', label: 'Rekap', ikon: '📊' },
    { ke: '/pembayaran', label: 'Bayar', ikon: '🏦' },
    { ke: '/tagihan', label: 'Tagihan', ikon: '💳' },
    { ke: '/laporan', label: 'Laporan', ikon: '🖨️' },
    { ke: '/akun', label: 'Akun', ikon: '👤' }
  ],
  KPA: [
    { ke: '/dashboard', label: 'Dashboard', ikon: '📈' },
    { ke: '/laporan', label: 'Laporan', ikon: '🖨️' },
    { ke: '/akun', label: 'Akun', ikon: '👤' }
  ],
  ADMIN: [
    { ke: '/taruna', label: 'Taruna', ikon: '🎓' },
    { ke: '/status-taruna', label: 'Status', ikon: '📋' },
    { ke: '/pengguna', label: 'Pengguna', ikon: '👥' },
    { ke: '/akun', label: 'Akun', ikon: '👤' }
  ],
  WADIR3: [
    { ke: '/persetujuan-wadir3', label: 'Persetujuan', ikon: '✅' },
    { ke: '/dashboard', label: 'Dashboard', ikon: '📈' },
    { ke: '/laporan', label: 'Laporan', ikon: '🖨️' },
    { ke: '/akun', label: 'Akun', ikon: '👤' }
  ],
  BAAK: [
    { ke: '/taruna', label: 'Taruna', ikon: '🎓' },
    { ke: '/status-taruna', label: 'Status', ikon: '📋' },
    { ke: '/akun', label: 'Akun', ikon: '👤' }
  ]
};

export function Layout() {
  const { session } = useAuth();
  const [online, setOnline] = useState(navigator.onLine);
  const [nAntrian, setNAntrian] = useState(0);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    const hitung = () => { void jumlahAntrian().then(setNAntrian); };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener('ebama:antrian-berubah', hitung);
    hitung();
    const timer = setInterval(hitung, 5000);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.removeEventListener('ebama:antrian-berubah', hitung);
      clearInterval(timer);
    };
  }, []);

  const nav = session ? NAV_PER_ROLE[session.role] : [];

  return (
    <div className="flex min-h-dvh w-full bg-ivory lg:flex-row">
      {/* Sidebar — desktop (≥1024px) saja */}
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-gray-200 lg:bg-white lg:px-3 lg:py-6">
        <div className="mb-6 flex items-center gap-2 px-3">
          <span className="text-xl font-bold text-primary-dark">e-BAMA</span>
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`}
            title={online ? 'Online' : 'Offline'}
          />
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

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col lg:mx-0 lg:max-w-none">
        {/* Header */}
        <header className="sticky top-0 z-40 flex items-center justify-between bg-primary px-4 py-3 text-white shadow lg:border-b lg:border-gray-200 lg:bg-white lg:px-8 lg:py-4 lg:text-gray-800 lg:shadow-none">
          <div className="flex items-center gap-2 lg:hidden">
            <span className="text-lg font-bold">e-BAMA</span>
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${online ? 'bg-green-300' : 'bg-red-400'}`}
              title={online ? 'Online' : 'Offline'}
            />
            {!online && <span className="text-xs">Offline</span>}
          </div>
          <div className="hidden items-center gap-2 text-sm text-gray-500 lg:flex">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`}
              title={online ? 'Online' : 'Offline'}
            />
            {online ? 'Online' : 'Offline'}
          </div>
          <NavLink to="/antrian" className="relative min-h-tap min-w-tap p-2 text-xl lg:text-gray-700" aria-label="Antrian aksi">
            📤
            {nAntrian > 0 && (
              <span className="absolute -right-0.5 -top-0.5 rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                {nAntrian}
              </span>
            )}
          </NavLink>
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
