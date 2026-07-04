// Halaman login: user_id + kata sandi (min 6 karakter, boleh huruf/angka/simbol).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export function HalamanLogin() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [userId, setUserId] = useState('');
  const [kataSandi, setKataSandi] = useState('');
  const [galat, setGalat] = useState('');
  const [proses, setProses] = useState(false);

  async function masuk() {
    if (!userId.trim()) { setGalat('Isi ID pengguna dulu.'); return; }
    if (kataSandi.length < 6) { setGalat('Kata sandi minimal 6 karakter.'); return; }
    setProses(true);
    setGalat('');
    try {
      await login(userId.trim(), kataSandi);
      nav('/', { replace: true });
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal masuk.');
      setKataSandi('');
    } finally {
      setProses(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 bg-ivory px-6 py-10">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-white">
          eB
        </div>
        <h1 className="text-2xl font-bold text-primary-dark">e-BAMA</h1>
        <p className="text-sm text-gray-500">Bantuan Uang Makan Taruna — Poltek KP Sorong</p>
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => { e.preventDefault(); void masuk(); }}
      >
        <Input
          label="ID Pengguna"
          name="user_id"
          autoComplete="username"
          placeholder="mis. senat01"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          disabled={proses}
        />

        <Input
          label="Kata Sandi"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="minimal 6 karakter"
          value={kataSandi}
          onChange={(e) => setKataSandi(e.target.value)}
          disabled={proses}
        />

        {galat && <p className="text-center text-sm text-red-600">{galat}</p>}

        <Button
          type="submit"
          className="min-h-[52px] text-lg"
          disabled={proses}
        >
          {proses ? 'Memproses…' : 'Masuk'}
        </Button>
      </form>
    </div>
  );
}
