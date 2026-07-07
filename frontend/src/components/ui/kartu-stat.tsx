// Kartu statistik ringkas (label + angka besar + satuan opsional) — dipakai
// halaman rekap (Persetujuan Wadir 3, Rekap PPK, Rekap Ringkas Pembina) supaya
// gaya tampilan konsisten di ketiganya.
import { Card } from './card';

export function KartuStat({ label, nilai, satuan, tekankan }: {
  label: string; nilai: string; satuan?: string; tekankan?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={tekankan ? 'text-lg font-bold text-primary-dark' : 'text-lg font-bold'}>
        {nilai}{satuan && <span className="ml-1 text-xs font-normal text-gray-400">{satuan}</span>}
      </span>
    </Card>
  );
}
