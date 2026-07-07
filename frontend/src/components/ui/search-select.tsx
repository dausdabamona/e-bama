// Dropdown pilih-satu yang bisa diketik utk mencari/filter — pengganti
// <select> native saat daftar opsi panjang (mis. ratusan taruna). Juga jadi
// komponen "Typeahead" toolkit (Prompt "Beranda Kotak-Tugas", Bagian 2c):
// untuk daftar BESAR (>20 opsi), pencarian baru aktif mulai 2 huruf — sebelum
// itu tampilkan "Terakhir dipakai" (kalau `storageKey` diisi) supaya tidak
// perlu menggulir ratusan baris. Daftar pendek tetap tampil penuh seperti biasa
// (tanpa gating) — perilaku lama tidak berubah untuk pemakai yang sudah ada.
import { useMemo, useState } from 'react';

interface OpsiCari {
  value: string;
  label: string;
}

const AMBANG_DAFTAR_BESAR = 20;
const MIN_HURUF_DAFTAR_BESAR = 2;
const MAKS_TERAKHIR_DIPAKAI = 5;

function ambilTerakhirDipakai(storageKey: string): string[] {
  try {
    const raw = localStorage.getItem(`typeahead_terakhir:${storageKey}`);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function catatTerakhirDipakai(storageKey: string, value: string): void {
  try {
    const lama = ambilTerakhirDipakai(storageKey).filter((v) => v !== value);
    const baru = [value, ...lama].slice(0, MAKS_TERAKHIR_DIPAKAI);
    localStorage.setItem(`typeahead_terakhir:${storageKey}`, JSON.stringify(baru));
  } catch {
    // localStorage penuh/nonaktif — bukan hal fatal, cukup lewati pencatatan.
  }
}

export function SearchSelect({
  value, onChange, opsi, placeholder = 'Cari…', label, storageKey
}: {
  value: string;
  onChange: (value: string) => void;
  opsi: OpsiCari[];
  placeholder?: string;
  label?: string;
  /** Kunci penyimpanan "terakhir dipakai" (mis. 'realisasi-piket-nit'). Opsional — tanpa ini, daftar besar tetap gating 2 huruf tapi tanpa riwayat. */
  storageKey?: string;
}) {
  const [cari, setCari] = useState('');
  const [buka, setBuka] = useState(false);
  const terpilih = opsi.find((o) => o.value === value);
  const daftarBesar = opsi.length > AMBANG_DAFTAR_BESAR;
  const q = cari.trim().toLowerCase();
  const perluGating = daftarBesar && q.length < MIN_HURUF_DAFTAR_BESAR;

  // `buka` sengaja jadi dependency — localStorage dibaca ULANG tiap dropdown
  // dibuka (bukan hanya sekali saat mount) supaya pilihan barusan langsung
  // muncul di "Terakhir dipakai" kali berikutnya dropdown dibuka.
  const terakhirDipakai = useMemo(() => {
    if (!perluGating || !storageKey || !buka) return [];
    const peta = new Map(opsi.map((o) => [o.value, o]));
    return ambilTerakhirDipakai(storageKey).map((v) => peta.get(v)).filter((o): o is OpsiCari => !!o);
  }, [perluGating, storageKey, opsi, buka]);

  const hasil = useMemo(() => {
    if (perluGating) return [];
    if (!q) return opsi;
    return opsi.filter((o) => o.label.toLowerCase().includes(q));
  }, [q, opsi, perluGating]);

  function pilih(v: string) {
    onChange(v);
    if (storageKey) catatTerakhirDipakai(storageKey, v);
    setCari('');
    setBuka(false);
  }

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
          {perluGating ? (
            <>
              {terakhirDipakai.length > 0 && (
                <>
                  <p className="px-3 pt-2 text-xs font-semibold uppercase text-gray-400">Terakhir dipakai</p>
                  {terakhirDipakai.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pilih(o.value)}
                      className="block min-h-tap w-full px-3 py-2 text-left text-sm hover:bg-primary-light/30"
                    >
                      {o.label}
                    </button>
                  ))}
                </>
              )}
              <p className="p-3 text-sm text-gray-400">
                Ketik minimal {MIN_HURUF_DAFTAR_BESAR} huruf untuk mencari dari {opsi.length} opsi…
              </p>
            </>
          ) : (
            <>
              {hasil.length === 0 && <p className="p-3 text-sm text-gray-400">Tidak ditemukan.</p>}
              {hasil.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pilih(o.value)}
                  className="block min-h-tap w-full px-3 py-2 text-left text-sm hover:bg-primary-light/30"
                >
                  {o.label}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
