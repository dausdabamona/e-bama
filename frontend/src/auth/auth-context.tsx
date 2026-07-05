// AuthContext {session, login, logout} — token di localStorage, guard per role.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api';

export type Role = 'KPA' | 'PPK' | 'SENAT' | 'PEMBINA' | 'ADMIN' | 'WADIR3' | 'BAAK' | 'PENYEDIA';

export interface Session {
  token: string;
  role: Role;
  nama: string;
  user_id: string;
}

interface AuthNilai {
  session: Session | null;
  login: (userId: string, kataSandi: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthNilai>({
  session: null,
  login: async () => {},
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

  const logout = useCallback(async () => {
    try { await api('auth.logout', {}); } catch { /* offline pun tetap keluar */ }
    localStorage.removeItem(KUNCI);
    setSession(null);
  }, []);

  return <AuthContext.Provider value={{ session, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthNilai {
  return useContext(AuthContext);
}

/** Guard rute: wajib login; bila `roles` diisi, role harus cocok. */
export function WajibLogin({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { session } = useAuth();
  const lokasi = useLocation();
  if (!session) return <Navigate to="/login" state={{ dari: lokasi }} replace />;
  if (roles && roles.length > 0 && !roles.includes(session.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
