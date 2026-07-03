// Tombol utama — tap target >= 44px, tema teal
import type { ButtonHTMLAttributes } from 'react';

type Varian = 'utama' | 'garis' | 'bahaya' | 'polos';

const GAYA: Record<Varian, string> = {
  utama: 'bg-primary text-white active:bg-primary-dark disabled:bg-gray-300',
  garis: 'border-2 border-primary text-primary active:bg-primary-light disabled:border-gray-300 disabled:text-gray-400',
  bahaya: 'bg-red-600 text-white active:bg-red-700 disabled:bg-gray-300',
  polos: 'text-primary active:bg-primary-light disabled:text-gray-400'
};

export function Button({
  varian = 'utama',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { varian?: Varian }) {
  return (
    <button
      className={`min-h-tap min-w-tap rounded-xl px-4 py-2.5 font-semibold text-base transition-colors ${GAYA[varian]} ${className}`}
      {...props}
    />
  );
}
