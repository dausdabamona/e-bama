// Kartu konten dasar
import type { HTMLAttributes } from 'react';

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-gray-100 bg-white p-4 shadow-sm ${className}`}
      {...props}
    />
  );
}
