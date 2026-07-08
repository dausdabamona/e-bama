// Routing utama — HashRouter (GitHub Pages), guard per role.
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, WajibLogin, useAuth } from './auth/auth-context';
import { Layout, NAV_PER_ROLE } from './components/layout';
import { ToastProvider } from './components/ui/toast';
import { UndoSnackbarProvider } from './components/ui/undo-snackbar';
import { HalamanAkun } from './pages/akun';
import { HalamanAntrian } from './pages/antrian';
import { HalamanAudit } from './pages/audit/audit';
import { HalamanBantuanLuarKampus } from './pages/blk/blk';
import { HalamanCetakIndex } from './pages/cetak/cetak-index';
import { HalamanCetakForm01 } from './pages/cetak/form-01';
import { HalamanCetakSuratPesanan } from './pages/cetak/surat-pesanan';
import { HalamanCetakForm02 } from './pages/cetak/form-02';
import { HalamanCetakForm03 } from './pages/cetak/form-03';
import { HalamanCetakForm04 } from './pages/cetak/form-04';
import { HalamanCetakForm05 } from './pages/cetak/form-05';
import { HalamanCetakForm06 } from './pages/cetak/form-06';
import { HalamanCetakForm07 } from './pages/cetak/form-07';
import { HalamanCetakForm08 } from './pages/cetak/form-08';
import { HalamanCetakForm09 } from './pages/cetak/form-09';
import { HalamanCetakForm10 } from './pages/cetak/form-10';
import { HalamanFormatSerahTerima } from './pages/cetak/format-serah-terima';
import { HalamanCetakSp1 } from './pages/cetak/sp1';
import { HalamanCetakBlokirGagalDebet } from './pages/cetak/blokir-gagal-debet';
import { HalamanDashboardKpa } from './pages/dashboard-kpa/dashboard-kpa';
import { HalamanKokpitPpk } from './pages/kokpit-ppk/kokpit-ppk';
import { HalamanKontrak } from './pages/kontrak/kontrak';
import { HalamanLaporan } from './pages/laporan/laporan';
import { HalamanMenuHariIni } from './pages/menu-hari-ini';
import { HalamanLaporanResmi } from './pages/laporan/laporan-resmi';
import { HalamanLogin } from './pages/login';
import { HalamanPembayaran } from './pages/pembayaran/pembayaran';
import { HalamanPengguna } from './pages/pengguna/pengguna';
import { HalamanPenyediaPortal } from './pages/penyedia-portal/penyedia-portal';
import { HalamanKetuaJurusan } from './pages/ketua-jurusan/ketua-jurusan';
import { HalamanPesananList } from './pages/pesanan/pesanan-list';
import { HalamanPesananBuat } from './pages/pesanan/pesanan-buat';
import { HalamanPesananDetail } from './pages/pesanan/pesanan-detail';
import { HalamanRealisasiList } from './pages/realisasi/realisasi-list';
import { HalamanRealisasiBuat } from './pages/realisasi/realisasi-form';
import { HalamanRealisasiDetail } from './pages/realisasi/realisasi-detail';
import { HalamanRekap } from './pages/rekap/rekap';
import { HalamanRekapHistoris } from './pages/rekap/rekap-historis';
import { HalamanPersetujuanWadir3 } from './pages/rekap/persetujuan-wadir3';
import { HalamanRekapRingkas } from './pages/rekap/rekap-ringkas';
import { HalamanStatusTaruna } from './pages/status-taruna/status-taruna';
import { HalamanTagihanList } from './pages/tagihan/tagihan-list';
import { HalamanStatusDebet } from './pages/tagihan/status-debet';
import { HalamanTagihanDetail } from './pages/tagihan/tagihan-detail';
import { HalamanTagihanGagalDebet } from './pages/tagihan/tagihan-gagal-debet';
import { HalamanTagihanImporDebet } from './pages/tagihan/impor-debet';
import { HalamanTagihanTeruskanPenyedia } from './pages/tagihan/teruskan-penyedia';
import { HalamanTarunaList } from './pages/taruna/taruna-list';
import { HalamanTarunaImpor } from './pages/taruna/taruna-import';
import { HalamanRekapHarianTaruna } from './pages/taruna/rekap-harian';
import { HalamanTarunaImporRekening } from './pages/taruna/taruna-impor-rekening';
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
      <UndoSnackbarProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<HalamanLogin />} />
            <Route element={<WajibLogin><Layout /></WajibLogin>}>
              <Route path="/" element={<Beranda />} />
              {/* Senat */}
              <Route path="/pesanan" element={<WajibLogin roles={['SENAT', 'PEMBINA']}><HalamanPesananList /></WajibLogin>} />
              <Route path="/pesanan/baru" element={<WajibLogin roles={['SENAT', 'PEMBINA']}><HalamanPesananBuat /></WajibLogin>} />
              <Route path="/pesanan/:id" element={<WajibLogin roles={['SENAT', 'PEMBINA']}><HalamanPesananDetail /></WajibLogin>} />
              {/* Senat + Pembina */}
              <Route path="/realisasi" element={<WajibLogin roles={['SENAT', 'PEMBINA']}><HalamanRealisasiList /></WajibLogin>} />
              <Route path="/realisasi/baru/:pesananId" element={<WajibLogin roles={['SENAT', 'PEMBINA']}><HalamanRealisasiBuat /></WajibLogin>} />
              <Route path="/realisasi/:id" element={<WajibLogin roles={['SENAT', 'PEMBINA']}><HalamanRealisasiDetail /></WajibLogin>} />
              <Route path="/menu-hari-ini" element={<WajibLogin roles={['SENAT', 'PEMBINA']}><HalamanMenuHariIni /></WajibLogin>} />
              {/* Pembina */}
              <Route path="/verifikasi" element={<WajibLogin roles={['PEMBINA']}><HalamanVerifikasi /></WajibLogin>} />
              <Route path="/status-taruna" element={<WajibLogin roles={['PEMBINA', 'ADMIN', 'BAAK']}><HalamanStatusTaruna /></WajibLogin>} />
              {/* Rekap ringkas baca-saja (Senat, Pembina) — grup Prodi+Tingkat, tanpa nominal */}
              <Route path="/rekap-ringkas" element={<WajibLogin roles={['SENAT', 'PEMBINA']}><HalamanRekapRingkas /></WajibLogin>} />
              {/* PPK */}
              <Route path="/rekap" element={<WajibLogin roles={['PPK', 'STAF_PPK']}><HalamanRekap /></WajibLogin>} />
              <Route path="/rekap/historis" element={<WajibLogin roles={['PPK', 'STAF_PPK', 'ADMIN']}><HalamanRekapHistoris /></WajibLogin>} />
              <Route path="/kokpit-ppk" element={<WajibLogin roles={['PPK', 'STAF_PPK', 'KPA', 'WADIR3']}><HalamanKokpitPpk /></WajibLogin>} />
              <Route path="/kontrak" element={<WajibLogin roles={['PPK', 'STAF_PPK']}><HalamanKontrak /></WajibLogin>} />
              <Route path="/pembayaran" element={<WajibLogin roles={['PPK', 'STAF_PPK', 'SENAT', 'KPA', 'WADIR3']}><HalamanPembayaran /></WajibLogin>} />
              {/* Senat + PPK (+KPA/Wadir3 lihat) */}
              <Route path="/tagihan" element={<WajibLogin roles={['SENAT', 'PPK', 'STAF_PPK', 'KPA', 'WADIR3', 'PEMBINA', 'ADMIN']}><HalamanTagihanList /></WajibLogin>} />
              <Route path="/tagihan/gagal-debet" element={<WajibLogin roles={['PPK', 'STAF_PPK']}><HalamanTagihanGagalDebet /></WajibLogin>} />
              <Route path="/tagihan/impor-debet" element={<WajibLogin roles={['PPK', 'STAF_PPK']}><HalamanTagihanImporDebet /></WajibLogin>} />
              <Route path="/tagihan/status-debet" element={<WajibLogin roles={['SENAT', 'PPK', 'STAF_PPK', 'KPA', 'WADIR3']}><HalamanStatusDebet /></WajibLogin>} />
              <Route path="/tagihan/teruskan-penyedia" element={<WajibLogin roles={['SENAT', 'PEMBINA', 'ADMIN', 'PPK', 'STAF_PPK']}><HalamanTagihanTeruskanPenyedia /></WajibLogin>} />
              <Route path="/tagihan/:id" element={<WajibLogin roles={['SENAT', 'PPK', 'STAF_PPK', 'KPA', 'WADIR3', 'PEMBINA', 'ADMIN']}><HalamanTagihanDetail /></WajibLogin>} />
              {/* PPK + KPA + Wadir3 */}
              <Route path="/laporan" element={<WajibLogin roles={['PPK', 'STAF_PPK', 'KPA', 'WADIR3', 'ADMIN']}><HalamanLaporan /></WajibLogin>} />
              <Route path="/laporan/resmi" element={<WajibLogin roles={['PPK', 'STAF_PPK', 'KPA', 'WADIR3', 'ADMIN']}><HalamanLaporanResmi /></WajibLogin>} />
              <Route path="/luar-kampus" element={<WajibLogin roles={['PPK', 'STAF_PPK', 'ADMIN', 'KPA', 'WADIR3']}><HalamanBantuanLuarKampus /></WajibLogin>} />
              <Route path="/dashboard" element={<WajibLogin roles={['KPA', 'WADIR3']}><HalamanDashboardKpa /></WajibLogin>} />
              {/* Wadir 3 */}
              <Route path="/persetujuan-wadir3" element={<WajibLogin roles={['WADIR3']}><HalamanPersetujuanWadir3 /></WajibLogin>} />
              {/* Admin */}
              <Route path="/taruna" element={<WajibLogin roles={['ADMIN', 'BAAK', 'PEMBINA']}><HalamanTarunaList /></WajibLogin>} />
              <Route path="/taruna/impor" element={<WajibLogin roles={['ADMIN', 'BAAK']}><HalamanTarunaImpor /></WajibLogin>} />
              <Route path="/taruna/impor-rekening" element={<WajibLogin roles={['ADMIN']}><HalamanTarunaImporRekening /></WajibLogin>} />
              <Route path="/taruna/rekap-harian" element={<WajibLogin roles={['ADMIN', 'BAAK', 'PEMBINA', 'PPK', 'STAF_PPK']}><HalamanRekapHarianTaruna /></WajibLogin>} />
              <Route path="/pengguna" element={<WajibLogin roles={['ADMIN']}><HalamanPengguna /></WajibLogin>} />
              {/* Penyedia (rekanan eksternal) — portal terbatas */}
              <Route path="/penyedia-portal" element={<WajibLogin roles={['PENYEDIA']}><HalamanPenyediaPortal /></WajibLogin>} />
              {/* Ketua Jurusan — input absen luar kampus + approve rekap (scope prodi) */}
              <Route path="/luar-kampus-kajur" element={<WajibLogin roles={['KETUA_JURUSAN']}><HalamanKetuaJurusan /></WajibLogin>} />
              {/* Admin, PPK, KPA, Wadir3 */}
              <Route path="/audit" element={<WajibLogin roles={['ADMIN', 'PPK', 'STAF_PPK', 'KPA', 'WADIR3']}><HalamanAudit /></WajibLogin>} />
              {/* Semua role */}
              <Route path="/akun" element={<HalamanAkun />} />
              <Route path="/antrian" element={<HalamanAntrian />} />
              <Route path="/cetak" element={<HalamanCetakIndex />} />
              <Route path="/cetak/form-01" element={<WajibLogin roles={['SENAT', 'PEMBINA', 'PPK', 'STAF_PPK', 'ADMIN']}><HalamanCetakForm01 /></WajibLogin>} />
              <Route path="/cetak/form-01/:tgl" element={<WajibLogin roles={['SENAT', 'PEMBINA', 'PPK', 'STAF_PPK', 'ADMIN']}><HalamanCetakForm01 /></WajibLogin>} />
              <Route path="/cetak/format-serah-terima" element={<WajibLogin roles={['SENAT', 'PEMBINA', 'PPK', 'STAF_PPK', 'ADMIN']}><HalamanFormatSerahTerima /></WajibLogin>} />
              <Route path="/cetak/sp1" element={<WajibLogin roles={['PPK', 'STAF_PPK', 'ADMIN']}><HalamanCetakSp1 /></WajibLogin>} />
              <Route path="/cetak/blokir-gagal-debet" element={<WajibLogin roles={['ADMIN', 'PPK', 'STAF_PPK']}><HalamanCetakBlokirGagalDebet /></WajibLogin>} />
              <Route path="/cetak/surat-pesanan/:id" element={<WajibLogin roles={['SENAT', 'PEMBINA', 'PPK', 'STAF_PPK', 'ADMIN']}><HalamanCetakSuratPesanan /></WajibLogin>} />
              <Route path="/cetak/form-02" element={<WajibLogin roles={['PEMBINA', 'PPK', 'STAF_PPK', 'ADMIN']}><HalamanCetakForm02 /></WajibLogin>} />
              <Route path="/cetak/form-02/:tgl" element={<WajibLogin roles={['PEMBINA', 'PPK', 'STAF_PPK', 'ADMIN']}><HalamanCetakForm02 /></WajibLogin>} />
              <Route path="/cetak/form-03" element={<WajibLogin roles={['PPK', 'STAF_PPK', 'ADMIN', 'PEMBINA']}><HalamanCetakForm03 /></WajibLogin>} />
              <Route path="/cetak/form-04" element={<WajibLogin roles={['SENAT', 'PEMBINA', 'PPK', 'STAF_PPK', 'ADMIN']}><HalamanCetakForm04 /></WajibLogin>} />
              <Route path="/cetak/form-04/:bulan" element={<WajibLogin roles={['SENAT', 'PEMBINA', 'PPK', 'STAF_PPK', 'ADMIN']}><HalamanCetakForm04 /></WajibLogin>} />
              <Route path="/cetak/form-05" element={<WajibLogin roles={['PEMBINA', 'PPK', 'STAF_PPK', 'ADMIN']}><HalamanCetakForm05 /></WajibLogin>} />
              <Route path="/cetak/form-05/:tgl" element={<WajibLogin roles={['PEMBINA', 'PPK', 'STAF_PPK', 'ADMIN']}><HalamanCetakForm05 /></WajibLogin>} />
              <Route path="/cetak/form-06" element={<WajibLogin roles={['PPK', 'STAF_PPK', 'KPA', 'ADMIN', 'OPERATOR_SAKTI']}><HalamanCetakForm06 /></WajibLogin>} />
              <Route path="/cetak/form-06/:bulan" element={<WajibLogin roles={['PPK', 'STAF_PPK', 'KPA', 'ADMIN', 'OPERATOR_SAKTI']}><HalamanCetakForm06 /></WajibLogin>} />
              <Route path="/cetak/form-07" element={<WajibLogin roles={['ADMIN', 'PPK', 'STAF_PPK']}><HalamanCetakForm07 /></WajibLogin>} />
              <Route path="/cetak/form-07/:bulan" element={<WajibLogin roles={['ADMIN', 'PPK', 'STAF_PPK']}><HalamanCetakForm07 /></WajibLogin>} />
              <Route path="/cetak/form-08" element={<WajibLogin roles={['ADMIN', 'PPK', 'STAF_PPK']}><HalamanCetakForm08 /></WajibLogin>} />
              <Route path="/cetak/form-09" element={<WajibLogin roles={['SENAT', 'PPK', 'STAF_PPK', 'ADMIN', 'OPERATOR_SAKTI']}><HalamanCetakForm09 /></WajibLogin>} />
              <Route path="/cetak/form-09/:bulan" element={<WajibLogin roles={['SENAT', 'PPK', 'STAF_PPK', 'ADMIN', 'OPERATOR_SAKTI']}><HalamanCetakForm09 /></WajibLogin>} />
              <Route path="/cetak/form-10" element={<WajibLogin roles={['ADMIN', 'PPK', 'STAF_PPK']}><HalamanCetakForm10 /></WajibLogin>} />
              <Route path="/cetak/form-10/:bulan" element={<WajibLogin roles={['ADMIN', 'PPK', 'STAF_PPK']}><HalamanCetakForm10 /></WajibLogin>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </UndoSnackbarProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
