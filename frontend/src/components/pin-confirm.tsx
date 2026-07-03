// Dialog konfirmasi PIN — dipakai untuk tanda tangan digital (realisasi.ttd).
import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Modal } from './ui/modal';

export function PinConfirmModal({
  judul = 'Konfirmasi Tanda Tangan',
  keterangan,
  onBatal,
  onKonfirmasi
}: {
  judul?: string;
  keterangan?: string;
  onBatal: () => void;
  onKonfirmasi: (pin: string) => Promise<void>;
}) {
  const [pin, setPin] = useState('');
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');

  async function kirim() {
    if (!/^\d{6}$/.test(pin)) { setGalat('PIN harus 6 digit angka.'); return; }
    setProses(true);
    setGalat('');
    try {
      await onKonfirmasi(pin);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setProses(false);
    }
  }

  return (
    <Modal judul={judul} onClose={onBatal}>
      <div className="flex flex-col gap-3">
        {keterangan && <p className="text-sm text-gray-600">{keterangan}</p>}
        <Input
          label="Masukkan PIN Anda (6 digit)"
          type="password"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
        {galat && <p className="text-sm text-red-600">{galat}</p>}
        <div className="flex gap-2">
          <Button varian="garis" className="flex-1" onClick={onBatal} disabled={proses}>Batal</Button>
          <Button className="flex-1" onClick={() => void kirim()} disabled={proses}>
            {proses ? 'Memproses…' : 'Tanda Tangan'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
