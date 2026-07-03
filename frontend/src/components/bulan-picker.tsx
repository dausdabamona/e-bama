// Pemilih bulan (YYYY-MM) dengan tombol navigasi ‹ ›
import { Button } from './ui/button';

function geserBulan(bulan: string, delta: number): string {
  const [y, m] = bulan.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export function labelBulan(bulan: string): string {
  const [y, m] = bulan.split('-').map(Number);
  return `${NAMA_BULAN[m - 1]} ${y}`;
}

export function bulanIni(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function BulanPicker({ bulan, onChange }: { bulan: string; onChange: (b: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-white p-2 shadow-sm">
      <Button varian="polos" className="px-3" onClick={() => onChange(geserBulan(bulan, -1))} aria-label="Bulan sebelumnya">
        ‹
      </Button>
      <span className="font-semibold text-primary-dark">{labelBulan(bulan)}</span>
      <Button varian="polos" className="px-3" onClick={() => onChange(geserBulan(bulan, 1))} aria-label="Bulan berikutnya">
        ›
      </Button>
    </div>
  );
}
