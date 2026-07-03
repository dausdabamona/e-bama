// Wrapper tabel untuk halaman cetak — header shading biru muda (D9E2F3),
// border tipis, font kecil. Dipakai bersama oleh Form 01-08.
import type { ReactNode } from 'react';

export function TabelCetak({ headers, children, className = '' }: {
  headers: string[]; children: ReactNode; className?: string;
}) {
  return (
    <table className={`w-full border-collapse text-xs ${className}`}>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i} className="border border-gray-400 bg-[#D9E2F3] px-2 py-1 text-left font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

/** Baris data — sel bergaris tipis, konsisten dengan header TabelCetak. */
export function BarisCetak({ children }: { children: ReactNode }) {
  return <tr>{children}</tr>;
}

export function SelCetak({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <td className={`border border-gray-300 px-2 py-1 ${className}`}>{children}</td>;
}
