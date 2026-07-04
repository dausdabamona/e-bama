// Dialog konfirmasi kata sandi — dipakai untuk tanda tangan digital (realisasi.ttd).
// Kredensial yang sama dengan login (min 6 karakter, boleh huruf/angka/simbol).
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
  onKonfirmasi: (kataSandi: string) => Promise<void>;
}) {
  const [kataSandi, setKataSandi] = useState('');
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');

  async function kirim() {
    if (kataSandi.length < 6) { setGalat('Kata sandi minimal 6 karakter.'); return; }
    setProses(true);
    setGalat('');
    try {
      await onKonfirmasi(kataSandi);
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
          label="Masukkan Kata Sandi Anda"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={kataSandi}
          onChange={(e) => setKataSandi(e.target.value)}
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
