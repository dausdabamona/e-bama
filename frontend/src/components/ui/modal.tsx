// Modal dasar — overlay + kartu, dipakai konfirmasi PIN & form ringkas.
import type { ReactNode } from 'react';

export function Modal({
  judul,
  onClose,
  children
}: {
  judul: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-primary-dark">{judul}</h2>
          <button
            className="min-h-tap min-w-tap rounded-full text-xl text-gray-400"
            onClick={onClose}
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
