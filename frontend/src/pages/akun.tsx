// Halaman Akun: info sesi, ganti PIN, keluar
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/toast';

export function HalamanAkun() {
  const { session, logout } = useAuth();
  const { toast } = useToast();
  const [pinLama, setPinLama] = useState('');
  const [pinBaru, setPinBaru] = useState('');
  const [proses, setProses] = useState(false);

  async function gantiPin() {
    if (!/^\d{6}$/.test(pinBaru)) { toast('PIN baru harus 6 digit angka.', 'galat'); return; }
    setProses(true);
    try {
      await api('auth.change_pin', { pin_lama: pinLama, pin_baru: pinBaru });
      toast('PIN berhasil diganti.', 'sukses');
      setPinLama(''); setPinBaru('');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal mengganti PIN.', 'galat');
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
        <h2 className="font-semibold">Ganti PIN</h2>
        <Input label="PIN lama" type="password" inputMode="numeric" maxLength={6}
          value={pinLama} onChange={(e) => setPinLama(e.target.value)} />
        <Input label="PIN baru (6 digit)" type="password" inputMode="numeric" maxLength={6}
          value={pinBaru} onChange={(e) => setPinBaru(e.target.value)} />
        <Button onClick={() => void gantiPin()} disabled={proses}>
          {proses ? 'Memproses…' : 'Simpan PIN Baru'}
        </Button>
      </Card>
      {(session?.role === 'ADMIN' || session?.role === 'PPK' || session?.role === 'KPA' || session?.role === 'WADIR3') && (
        <Link to="/audit"><Button varian="garis" className="w-full">📜 Lihat Audit Log</Button></Link>
      )}
      <Button varian="bahaya" onClick={() => void logout()}>Keluar</Button>
    </div>
  );
}
