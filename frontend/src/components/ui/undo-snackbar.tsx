// Snackbar "Urungkan" global — dipakai gantinya pop-up konfirmasi "Yakin?"
// untuk aksi yang REVERSIBEL (entri status, edit draf, dsb). Aksi tetap
// dijalankan LANGSUNG (optimistic); kalau pengguna menekan Urungkan dalam
// waktu singkat, `onUndo` dipanggil untuk membalikkannya.
// Prompt "Beranda Kotak-Tugas", Bagian 2g.
//
// PENTING (pagar pengaman prompt): HANYA untuk aksi reversibel. Aksi
// finansial/ireversibel (LUNAS, ajukan SPM, buat pembayaran, surat
// pendebetan) tetap wajib modal konfirmasi biasa — JANGAN dialihkan ke sini.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface ItemUndo {
  id: number;
  pesan: string;
  onUndo: () => void;
}

const UndoContext = createContext<{ tampilkanUndo: (pesan: string, onUndo: () => void, durasiMs?: number) => void }>({
  tampilkanUndo: () => {}
});

let idBerikut = 1;
const DURASI_DEFAULT_MS = 5000;

export function UndoSnackbarProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<ItemUndo | null>(null);
  const timer = useRef<number | null>(null);

  const tampilkanUndo = useCallback((pesan: string, onUndo: () => void, durasiMs = DURASI_DEFAULT_MS) => {
    if (timer.current) window.clearTimeout(timer.current);
    const id = idBerikut++;
    setItem({ id, pesan, onUndo });
    timer.current = window.setTimeout(() => {
      setItem((cur) => (cur?.id === id ? null : cur));
    }, durasiMs);
  }, []);

  function urungkan() {
    if (timer.current) window.clearTimeout(timer.current);
    item?.onUndo();
    setItem(null);
  }

  return (
    <UndoContext.Provider value={{ tampilkanUndo }}>
      {children}
      {item && (
        <div
          role="status"
          className="pointer-events-auto fixed inset-x-4 bottom-20 z-50 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg"
        >
          <span>{item.pesan}</span>
          <button type="button" className="shrink-0 font-bold text-primary-light" onClick={urungkan}>
            Urungkan
          </button>
        </div>
      )}
    </UndoContext.Provider>
  );
}

export function useUndoSnackbar() {
  return useContext(UndoContext);
}
