// AuthContext {session, login, logout} — token di localStorage, guard per role.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api';

export type Role = 'KPA' | 'PPK' | 'STAF_PPK' | 'SENAT' | 'PEMBINA' | 'ADMIN' | 'WADIR3' | 'BAAK' | 'PENYEDIA' | 'KETUA_JURUSAN' | 'OPERATOR_SAKTI';

// STAF_PPK mencerminkan hak PPK di UI (menu, tombol, tampilan) — KECUALI tombol
// "Buat Pembayaran" (bayar.create) yang tetap khusus PPK. Otorisasi sebenarnya
// tetap di backend (ACTION_MAP); ini hanya untuk menyembunyikan/menampilkan UI.
export function sepertiPpk(role?: Role | null): boolean {
  return role === 'PPK' || role === 'STAF_PPK';
}

export interface Session {
  token: string;
  role: Role;
  nama: string;
  user_id: string;
  prodi?: string; // hanya terisi untuk role KETUA_JURUSAN
}

// ── Mode Prototipe (bypass login) ─────────────────────────────────────────
// Selama e-BAMA masih prototipe, backend menerima token 'PROTOTIPE:<ROLE>'
// tanpa kata sandi (lihat backend/src/00_config.gs). Frontend hanya
// menyediakan pemilih peran; otorisasi tetap diputuskan backend.
export const PREFIX_TOKEN_PROTOTIPE = 'PROTOTIPE:';
export const ROLE_PROTOTIPE: Role[] = ['PPK', 'STAF_PPK', 'KPA', 'WADIR3', 'SENAT', 'PEMBINA', 'ADMIN', 'BAAK'];

export function sesiPrototipe(session?: Session | null): boolean {
  return !!session && session.token.indexOf(PREFIX_TOKEN_PROTOTIPE) === 0;
}

interface AuthNilai {
  session: Session | null;
  login: (userId: string, kataSandi: string) => Promise<void>;
  masukPrototipe: (role: Role) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthNilai>({
  session: null,
  login: async () => {},
  masukPrototipe: () => {},
  logout: async () => {}
});

const KUNCI = 'ebama_session';

function bacaSession(): Session | null {
  try {
    const s = localStorage.getItem(KUNCI);
    return s ? (JSON.parse(s) as Session) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(bacaSession);

  // Token kedaluwarsa di server → dilempar ke login
  useEffect(() => {
    const habis = () => setSession(null);
    window.addEventListener('ebama:sesi-habis', habis);
    return () => window.removeEventListener('ebama:sesi-habis', habis);
  }, []);

  // Kunci payload tetap `pin` demi kompatibilitas kontrak API (auth.login);
  // nilainya kini kata sandi bebas min 6 karakter, bukan PIN 6 digit.
  const login = useCallback(async (userId: string, kataSandi: string) => {
    const data = await api<{ token: string; role: Role; nama: string }>('auth.login', {
      user_id: userId, pin: kataSandi
    });
    const s: Session = { token: data.token, role: data.role, nama: data.nama, user_id: userId };
    localStorage.setItem(KUNCI, JSON.stringify(s));
    setSession(s);
  }, []);

  // Masuk tanpa kata sandi dengan memilih peran (Mode Prototipe).
  const masukPrototipe = useCallback((role: Role) => {
    const s: Session = {
      token: PREFIX_TOKEN_PROTOTIPE + role, role, nama: 'Mode Prototipe', user_id: 'PROTO-' + role
    };
    localStorage.setItem(KUNCI, JSON.stringify(s));
    try { sessionStorage.removeItem('ebama_keluar'); } catch { /* abaikan */ }
    setSession(s);
  }, []);

  const logout = useCallback(async () => {
    if (!sesiPrototipe(bacaSession())) {
      try { await api('auth.logout', {}); } catch { /* offline pun tetap keluar */ }
    }
    // Tandai keluar manual supaya halaman login tidak langsung masuk otomatis lagi.
    try { sessionStorage.setItem('ebama_keluar', '1'); } catch { /* abaikan */ }
    localStorage.removeItem(KUNCI);
    setSession(null);
  }, []);

  return <AuthContext.Provider value={{ session, login, masukPrototipe, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthNilai {
  return useContext(AuthContext);
}

/** Guard rute: wajib login; bila `roles` diisi, role harus cocok. */
export function WajibLogin({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { session } = useAuth();
  const lokasi = useLocation();
  if (!session) return <Navigate to="/login" state={{ dari: lokasi }} replace />;
  // Mode Prototipe: semua halaman terbuka (backend yang tetap memutuskan).
  if (roles && roles.length > 0 && !sesiPrototipe(session) && !roles.includes(session.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
