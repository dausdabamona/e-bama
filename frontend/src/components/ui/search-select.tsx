// Dropdown pilih-satu yang bisa diketik utk mencari/filter — pengganti
// <select> native saat daftar opsi panjang (mis. ratusan taruna).
import { useMemo, useState } from 'react';

interface OpsiCari {
  value: string;
  label: string;
}

export function SearchSelect({
  value, onChange, opsi, placeholder = 'Cari…', label
}: {
  value: string;
  onChange: (value: string) => void;
  opsi: OpsiCari[];
  placeholder?: string;
  label?: string;
}) {
  const [cari, setCari] = useState('');
  const [buka, setBuka] = useState(false);
  const terpilih = opsi.find((o) => o.value === value);

  const hasil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return opsi;
    return opsi.filter((o) => o.label.toLowerCase().includes(q));
  }, [cari, opsi]);

  return (
    <div className="relative">
      {label && <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>}
      <input
        type="text"
        value={buka ? cari : (terpilih?.label ?? '')}
        placeholder={placeholder}
        onFocus={() => { setBuka(true); setCari(''); }}
        onBlur={() => setTimeout(() => setBuka(false), 150)}
        onChange={(e) => setCari(e.target.value)}
        className="min-h-tap w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-light"
      />
      {buka && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {hasil.length === 0 && <p className="p-3 text-sm text-gray-400">Tidak ditemukan.</p>}
          {hasil.map((o) => (
            <button
              key={o.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(o.value); setCari(''); setBuka(false); }}
              className="block min-h-tap w-full px-3 py-2 text-left text-sm hover:bg-primary-light/30"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
