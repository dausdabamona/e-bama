// Halaman login: user_id + PIN 6 digit dengan keypad numerik besar.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const TOMBOL = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'hapus', '0', 'masuk'] as const;

export function HalamanLogin() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [userId, setUserId] = useState('');
  const [pin, setPin] = useState('');
  const [galat, setGalat] = useState('');
  const [proses, setProses] = useState(false);

  async function masuk(pinFinal: string) {
    if (!userId.trim()) { setGalat('Isi ID pengguna dulu.'); return; }
    if (pinFinal.length !== 6) { setGalat('PIN harus 6 digit.'); return; }
    setProses(true);
    setGalat('');
    try {
      await login(userId.trim(), pinFinal);
      nav('/', { replace: true });
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal masuk.');
      setPin('');
    } finally {
      setProses(false);
    }
  }

  function tekan(t: (typeof TOMBOL)[number]) {
    setGalat('');
    if (t === 'hapus') { setPin((p) => p.slice(0, -1)); return; }
    if (t === 'masuk') { void masuk(pin); return; }
    setPin((p) => {
      const baru = (p + t).slice(0, 6);
      if (baru.length === 6) void masuk(baru); // otomatis masuk saat 6 digit
      return baru;
    });
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

      <Input
        label="ID Pengguna"
        name="user_id"
        autoComplete="username"
        placeholder="mis. senat01"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        disabled={proses}
      />

      {/* Indikator PIN 6 titik */}
      <div className="flex justify-center gap-3" aria-label="PIN 6 digit">
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full border-2 border-primary ${i < pin.length ? 'bg-primary' : 'bg-white'}`}
          />
        ))}
      </div>

      {galat && <p className="text-center text-sm text-red-600">{galat}</p>}
      {proses && <p className="text-center text-sm text-gray-500">Memproses…</p>}

      {/* Keypad numerik besar */}
      <div className="grid grid-cols-3 gap-3">
        {TOMBOL.map((t) => (
          <Button
            key={t}
            varian={t === 'masuk' ? 'utama' : 'garis'}
            className="min-h-[56px] text-xl"
            disabled={proses}
            onClick={() => tekan(t)}
          >
            {t === 'hapus' ? '⌫' : t === 'masuk' ? '➜' : t}
          </Button>
        ))}
      </div>
    </div>
  );
}
