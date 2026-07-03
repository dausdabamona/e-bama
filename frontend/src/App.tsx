// Routing utama — HashRouter (GitHub Pages), guard per role.
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, WajibLogin, useAuth } from './auth/auth-context';
import { Layout, NAV_PER_ROLE } from './components/layout';
import { ToastProvider } from './components/ui/toast';
import { HalamanAkun } from './pages/akun';
import { HalamanAntrian } from './pages/antrian';
import { HalamanAudit } from './pages/audit/audit';
import { HalamanBantuanLuarKampus } from './pages/blk/blk';
import { HalamanCetakIndex } from './pages/cetak/cetak-index';
import { HalamanDashboardKpa } from './pages/dashboard-kpa/dashboard-kpa';
import { HalamanKontrak } from './pages/kontrak/kontrak';
import { HalamanLaporan } from './pages/laporan/laporan';
import { HalamanLaporanResmi } from './pages/laporan/laporan-resmi';
import { HalamanLogin } from './pages/login';
import { HalamanPembayaran } from './pages/pembayaran/pembayaran';
import { HalamanPengguna } from './pages/pengguna/pengguna';
import { HalamanPesananList } from './pages/pesanan/pesanan-list';
import { HalamanPesananBuat } from './pages/pesanan/pesanan-buat';
import { HalamanPesananDetail } from './pages/pesanan/pesanan-detail';
import { HalamanRealisasiList } from './pages/realisasi/realisasi-list';
import { HalamanRealisasiBuat } from './pages/realisasi/realisasi-form';
import { HalamanRealisasiDetail } from './pages/realisasi/realisasi-detail';
import { HalamanRekap } from './pages/rekap/rekap';
import { HalamanRekapHistoris } from './pages/rekap/rekap-historis';
import { HalamanPersetujuanWadir3 } from './pages/rekap/persetujuan-wadir3';
import { HalamanStatusTaruna } from './pages/status-taruna/status-taruna';
import { HalamanTagihanList } from './pages/tagihan/tagihan-list';
import { HalamanTagihanDetail } from './pages/tagihan/tagihan-detail';
import { HalamanTagihanGagalDebet } from './pages/tagihan/tagihan-gagal-debet';
import { HalamanTarunaList } from './pages/taruna/taruna-list';
import { HalamanTarunaImpor } from './pages/taruna/taruna-import';
import { HalamanVerifikasi } from './pages/verifikasi';

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
              <Route path="/status-taruna" element={<WajibLogin roles={['PEMBINA', 'ADMIN', 'BAAK']}><HalamanStatusTaruna /></WajibLogin>} />
              {/* PPK */}
              <Route path="/rekap" element={<WajibLogin roles={['PPK']}><HalamanRekap /></WajibLogin>} />
              <Route path="/rekap/historis" element={<WajibLogin roles={['PPK', 'ADMIN']}><HalamanRekapHistoris /></WajibLogin>} />
              <Route path="/kontrak" element={<WajibLogin roles={['PPK']}><HalamanKontrak /></WajibLogin>} />
              <Route path="/pembayaran" element={<WajibLogin roles={['PPK', 'SENAT', 'KPA', 'WADIR3']}><HalamanPembayaran /></WajibLogin>} />
              {/* Senat + PPK (+KPA/Wadir3 lihat) */}
              <Route path="/tagihan" element={<WajibLogin roles={['SENAT', 'PPK', 'KPA', 'WADIR3']}><HalamanTagihanList /></WajibLogin>} />
              <Route path="/tagihan/gagal-debet" element={<WajibLogin roles={['PPK']}><HalamanTagihanGagalDebet /></WajibLogin>} />
              <Route path="/tagihan/:id" element={<WajibLogin roles={['SENAT', 'PPK', 'KPA', 'WADIR3']}><HalamanTagihanDetail /></WajibLogin>} />
              {/* PPK + KPA + Wadir3 */}
              <Route path="/laporan" element={<WajibLogin roles={['PPK', 'KPA', 'WADIR3', 'ADMIN']}><HalamanLaporan /></WajibLogin>} />
              <Route path="/laporan/resmi" element={<WajibLogin roles={['PPK', 'KPA', 'WADIR3', 'ADMIN']}><HalamanLaporanResmi /></WajibLogin>} />
              <Route path="/luar-kampus" element={<WajibLogin roles={['PPK', 'ADMIN', 'KPA', 'WADIR3']}><HalamanBantuanLuarKampus /></WajibLogin>} />
              <Route path="/dashboard" element={<WajibLogin roles={['KPA', 'WADIR3']}><HalamanDashboardKpa /></WajibLogin>} />
              {/* Wadir 3 */}
              <Route path="/persetujuan-wadir3" element={<WajibLogin roles={['WADIR3']}><HalamanPersetujuanWadir3 /></WajibLogin>} />
              {/* Admin */}
              <Route path="/taruna" element={<WajibLogin roles={['ADMIN', 'BAAK']}><HalamanTarunaList /></WajibLogin>} />
              <Route path="/taruna/impor" element={<WajibLogin roles={['ADMIN', 'BAAK']}><HalamanTarunaImpor /></WajibLogin>} />
              <Route path="/pengguna" element={<WajibLogin roles={['ADMIN']}><HalamanPengguna /></WajibLogin>} />
              {/* Admin, PPK, KPA, Wadir3 */}
              <Route path="/audit" element={<WajibLogin roles={['ADMIN', 'PPK', 'KPA', 'WADIR3']}><HalamanAudit /></WajibLogin>} />
              {/* Semua role */}
              <Route path="/akun" element={<HalamanAkun />} />
              <Route path="/antrian" element={<HalamanAntrian />} />
              <Route path="/cetak" element={<HalamanCetakIndex />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
