// Routing utama — HashRouter (GitHub Pages), guard per role.
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, WajibLogin, useAuth } from './auth/auth-context';
import { Layout, NAV_PER_ROLE } from './components/layout';
import { ToastProvider } from './components/ui/toast';
import { HalamanAkun } from './pages/akun';
import { HalamanAntrian } from './pages/antrian';
import { DalamPengembangan } from './pages/dalam-pengembangan';
import { HalamanLogin } from './pages/login';
import { HalamanPesananList } from './pages/pesanan/pesanan-list';
import { HalamanPesananBuat } from './pages/pesanan/pesanan-buat';
import { HalamanPesananDetail } from './pages/pesanan/pesanan-detail';
import { HalamanRealisasiList } from './pages/realisasi/realisasi-list';
import { HalamanRealisasiBuat } from './pages/realisasi/realisasi-form';
import { HalamanRealisasiDetail } from './pages/realisasi/realisasi-detail';
import { HalamanVerifikasi } from './pages/verifikasi';
import { HalamanStatusTaruna } from './pages/status-taruna/status-taruna';
import { HalamanTagihanList } from './pages/tagihan/tagihan-list';
import { HalamanTagihanDetail } from './pages/tagihan/tagihan-detail';

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
              <Route path="/pesanan" element={<WajibLogin roles={['SENAT']}><HalamanPesananList /></WajibLogin>} />
              <Route path="/pesanan/baru" element={<WajibLogin roles={['SENAT']}><HalamanPesananBuat /></WajibLogin>} />
              <Route path="/pesanan/:id" element={<WajibLogin roles={['SENAT', 'PEMBINA']}><HalamanPesananDetail /></WajibLogin>} />
              {/* Senat + Pembina */}
              <Route path="/realisasi" element={<WajibLogin roles={['SENAT', 'PEMBINA']}><HalamanRealisasiList /></WajibLogin>} />
              <Route path="/realisasi/baru/:pesananId" element={<WajibLogin roles={['SENAT', 'PEMBINA']}><HalamanRealisasiBuat /></WajibLogin>} />
              <Route path="/realisasi/:id" element={<WajibLogin roles={['SENAT', 'PEMBINA']}><HalamanRealisasiDetail /></WajibLogin>} />
              {/* Pembina */}
              <Route path="/verifikasi" element={<WajibLogin roles={['PEMBINA']}><HalamanVerifikasi /></WajibLogin>} />
              <Route path="/status-taruna" element={<WajibLogin roles={['PEMBINA', 'ADMIN']}><HalamanStatusTaruna /></WajibLogin>} />
              {/* PPK */}
              <Route path="/rekap" element={<WajibLogin roles={['PPK']}><DalamPengembangan judul="Rekap Bulanan" /></WajibLogin>} />
              <Route path="/pembayaran" element={<WajibLogin roles={['PPK']}><DalamPengembangan judul="Pembayaran" /></WajibLogin>} />
              {/* Senat + PPK (+KPA lihat) */}
              <Route path="/tagihan" element={<WajibLogin roles={['SENAT', 'PPK', 'KPA']}><HalamanTagihanList /></WajibLogin>} />
              <Route path="/tagihan/:id" element={<WajibLogin roles={['SENAT', 'PPK', 'KPA']}><HalamanTagihanDetail /></WajibLogin>} />
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
