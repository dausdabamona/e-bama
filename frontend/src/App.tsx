// Routing utama — HashRouter (GitHub Pages), guard per role.
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, WajibLogin, useAuth } from './auth/auth-context';
import { Layout, NAV_PER_ROLE } from './components/layout';
import { ToastProvider } from './components/ui/toast';
import { HalamanAkun } from './pages/akun';
import { HalamanAntrian } from './pages/antrian';
import { DalamPengembangan } from './pages/dalam-pengembangan';
import { HalamanLogin } from './pages/login';

/** Beranda: arahkan ke item nav pertama sesuai role. */
function Beranda() {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={NAV_PER_ROLE[session.role][0].ke} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<HalamanLogin />} />
            <Route element={<WajibLogin><Layout /></WajibLogin>}>
              <Route path="/" element={<Beranda />} />
              {/* Senat */}
              <Route path="/pesanan" element={<WajibLogin roles={['SENAT']}><DalamPengembangan judul="Pesanan" /></WajibLogin>} />
              {/* Senat + Pembina */}
              <Route path="/realisasi" element={<WajibLogin roles={['SENAT', 'PEMBINA']}><DalamPengembangan judul="Realisasi" /></WajibLogin>} />
              {/* Pembina */}
              <Route path="/verifikasi" element={<WajibLogin roles={['PEMBINA']}><DalamPengembangan judul="Verifikasi Pesanan" /></WajibLogin>} />
              <Route path="/status-taruna" element={<WajibLogin roles={['PEMBINA', 'ADMIN']}><DalamPengembangan judul="Status Taruna" /></WajibLogin>} />
              {/* PPK */}
              <Route path="/rekap" element={<WajibLogin roles={['PPK']}><DalamPengembangan judul="Rekap Bulanan" /></WajibLogin>} />
              <Route path="/pembayaran" element={<WajibLogin roles={['PPK']}><DalamPengembangan judul="Pembayaran" /></WajibLogin>} />
              {/* Senat + PPK (+KPA lihat) */}
              <Route path="/tagihan" element={<WajibLogin roles={['SENAT', 'PPK', 'KPA']}><DalamPengembangan judul="Tagihan" /></WajibLogin>} />
              {/* PPK + KPA */}
              <Route path="/laporan" element={<WajibLogin roles={['PPK', 'KPA']}><DalamPengembangan judul="Laporan" /></WajibLogin>} />
              <Route path="/dashboard" element={<WajibLogin roles={['KPA']}><DalamPengembangan judul="Dashboard" /></WajibLogin>} />
              {/* Admin */}
              <Route path="/taruna" element={<WajibLogin roles={['ADMIN']}><DalamPengembangan judul="Data Taruna" /></WajibLogin>} />
              <Route path="/pengguna" element={<WajibLogin roles={['ADMIN']}><DalamPengembangan judul="Pengguna" /></WajibLogin>} />
              {/* Semua role */}
              <Route path="/akun" element={<HalamanAkun />} />
              <Route path="/antrian" element={<HalamanAntrian />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
