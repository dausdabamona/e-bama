// Toast global — dipakai untuk umpan balik offline: "Koneksi tidak stabil. Disimpan lokal..."
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type JenisToast = 'info' | 'sukses' | 'galat';

interface ItemToast {
  id: number;
  pesan: string;
  jenis: JenisToast;
}

const ToastContext = createContext<{ toast: (pesan: string, jenis?: JenisToast) => void }>({
  toast: () => {}
});

let idBerikut = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [daftar, setDaftar] = useState<ItemToast[]>([]);

  const toast = useCallback((pesan: string, jenis: JenisToast = 'info') => {
    const id = idBerikut++;
    setDaftar((d) => [...d, { id, pesan, jenis }]);
    setTimeout(() => setDaftar((d) => d.filter((t) => t.id !== id)), 4000);
  }, []);

  const warna: Record<JenisToast, string> = {
    info: 'bg-gray-800 text-white',
    sukses: 'bg-primary text-white',
    galat: 'bg-red-600 text-white'
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {daftar.map((t) => (
          <div key={t.id} className={`max-w-sm rounded-xl px-4 py-2.5 text-sm shadow-lg ${warna[t.jenis]}`}>
            {t.pesan}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
