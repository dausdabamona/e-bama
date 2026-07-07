// Top bar desktop khusus PPK (dari design_handoff_ebama_kokpit) — dipasang
// berdampingan dengan SidebarPpkDesktop, HANYA di layar ≥1024px untuk role PPK.
// Pencarian global & lonceng notifikasi pada mockup asli SENGAJA belum
// dibuat di tahap ini — keduanya belum ada aksi/data nyata di backend, dan
// menampilkan kontrol yang tidak benar-benar berfungsi menyalahi prinsip
// "jangan palsukan status" yang dipegang di seluruh aplikasi ini.
import { NavLink } from 'react-router-dom';
import type { Session } from '../auth/auth-context';
import { BadgeAntrianSinkron, TitikStatusOnline, useSyncStatus } from './ui/sync-badge';

export function TopbarPpkDesktop({ session }: { session: Session }) {
  const { online, nAntrian } = useSyncStatus();
  const inisial = session.nama.split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <header className="sticky top-0 z-40 hidden items-center gap-3.5 border-b border-[#D9EEEA] bg-white px-[22px] py-[11px] lg:flex">
      <div>
        <p className="text-[15px] font-semibold text-gray-800">Kokpit PPK</p>
        <p className="text-xs text-gray-500">Politeknik KP Sorong · pusat kendali bulan berjalan</p>
      </div>

      <div className="ml-auto flex items-center gap-3.5">
        <span className="flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-xs font-semibold text-[#059669]">
          <TitikStatusOnline online={online} />
          {online ? 'Tersinkron' : 'Offline'}
        </span>
        {nAntrian > 0 && <BadgeAntrianSinkron nAntrian={nAntrian} />}
        <NavLink to="/akun" className="flex items-center gap-2" aria-label="Akun & role aktif">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0F766E] text-xs font-bold text-white">
            {inisial}
          </span>
          <span className="text-sm leading-tight text-gray-700">
            <span className="block font-medium">{session.nama}</span>
            <span className="block text-xs text-gray-400">PPK</span>
          </span>
        </NavLink>
      </div>
    </header>
  );
}
