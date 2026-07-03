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
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-ivory">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between bg-primary px-4 py-3 text-white shadow">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">e-BAMA</span>
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${online ? 'bg-green-300' : 'bg-red-400'}`}
            title={online ? 'Online' : 'Offline'}
          />
          {!online && <span className="text-xs">Offline</span>}
        </div>
        <NavLink to="/antrian" className="relative min-h-tap min-w-tap p-2 text-xl" aria-label="Antrian aksi">
          📤
          {nAntrian > 0 && (
            <span className="absolute -right-0.5 -top-0.5 rounded-full bg-red-500 px-1.5 text-xs font-bold">
              {nAntrian}
            </span>
          )}
        </NavLink>
      </header>

      {/* Isi halaman */}
      <main className="flex-1 px-4 pb-24 pt-4">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-lg justify-around border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]">
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
  );
}
