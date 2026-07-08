// Halaman Akun: info sesi, ganti kata sandi, keluar
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sepertiPpk, useAuth } from '../auth/auth-context';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/toast';

export function HalamanAkun() {
  const { session, logout } = useAuth();
  const { toast } = useToast();
  const [sandiLama, setSandiLama] = useState('');
  const [sandiBaru, setSandiBaru] = useState('');
  const [proses, setProses] = useState(false);

  async function gantiSandi() {
    if (sandiBaru.length < 6) { toast('Kata sandi baru minimal 6 karakter.', 'galat'); return; }
    setProses(true);
    try {
      // Kunci payload tetap pin_lama/pin_baru demi kompatibilitas kontrak API.
      await api('auth.change_pin', { pin_lama: sandiLama, pin_baru: sandiBaru });
      toast('Kata sandi berhasil diganti.', 'sukses');
      setSandiLama(''); setSandiBaru('');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal mengganti kata sandi.', 'galat');
    } finally {
      setProses(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-primary-dark">Akun</h1>
      <Card>
        <p className="font-semibold">{session?.nama}</p>
        <p className="text-sm text-gray-500">{session?.user_id} — {session?.role}</p>
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">Ganti Kata Sandi</h2>
        <Input label="Kata sandi lama" type="password" autoComplete="current-password"
          value={sandiLama} onChange={(e) => setSandiLama(e.target.value)} />
        <Input label="Kata sandi baru (min 6 karakter)" type="password" autoComplete="new-password"
          value={sandiBaru} onChange={(e) => setSandiBaru(e.target.value)} />
        <Button onClick={() => void gantiSandi()} disabled={proses}>
          {proses ? 'Memproses…' : 'Simpan Kata Sandi Baru'}
        </Button>
      </Card>
      {sepertiPpk(session?.role) && (
        <Link to="/kontrak"><Button varian="garis" className="w-full">📄 Kelola Kontrak & Penyedia</Button></Link>
      )}
      {(sepertiPpk(session?.role) || session?.role === 'ADMIN') && (
        <Link to="/rekap/historis"><Button varian="garis" className="w-full">🗂️ Input Rekap Historis (Migrasi)</Button></Link>
      )}
      {(sepertiPpk(session?.role) || session?.role === 'ADMIN' || session?.role === 'KPA') && (
        <Link to="/luar-kampus"><Button varian="garis" className="w-full">🧳 Bantuan Luar Kampus (PKL/KPA/PTB)</Button></Link>
      )}
      {(session?.role === 'ADMIN' || sepertiPpk(session?.role) || session?.role === 'KPA' || session?.role === 'WADIR3') && (
        <Link to="/audit"><Button varian="garis" className="w-full">📜 Lihat Audit Log</Button></Link>
      )}
      <Button varian="bahaya" onClick={() => void logout()}>Keluar</Button>
    </div>
  );
}
