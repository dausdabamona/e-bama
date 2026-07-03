// Badge status berwarna
import type { ReactNode } from 'react';

const WARNA: Record<string, string> = {
  DRAFT: 'bg-gray-200 text-gray-700',
  DIAJUKAN: 'bg-amber-100 text-amber-800',
  DIKEMBALIKAN: 'bg-red-100 text-red-700',
  DISETUJUI: 'bg-sky-100 text-sky-800',
  TERKIRIM: 'bg-primary-light text-primary-dark',
  TERVERIFIKASI_PPK: 'bg-sky-100 text-sky-800',
  FINAL: 'bg-amber-100 text-amber-800',
  DISETUJUI_WADIR3: 'bg-green-100 text-green-800',
  SP2D_TERBIT: 'bg-sky-100 text-sky-800',
  DITRANSFER: 'bg-indigo-100 text-indigo-800',
  DIKONFIRMASI: 'bg-primary-light text-primary-dark',
  SELESAI: 'bg-green-100 text-green-800',
  TERTAGIH: 'bg-red-100 text-red-700',
  LUNAS: 'bg-green-100 text-green-800',
  DIHAPUSKAN: 'bg-gray-200 text-gray-600',
  ESKALASI_MANUAL: 'bg-red-600 text-white',
  AKTIF: 'bg-green-100 text-green-800',
  NONAKTIF: 'bg-gray-200 text-gray-600'
};

export function Badge({ status, children }: { status?: string; children?: ReactNode }) {
  const kelas = (status && WARNA[status]) || 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${kelas}`}>
      {children ?? (status || '').replace(/_/g, ' ')}
    </span>
  );
}
