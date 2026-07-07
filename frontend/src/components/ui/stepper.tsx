// Input angka dengan tombol +/− besar — pengganti ketik untuk porsi, jumlah
// komponen, hari, dll. (ponsel murah: ketuk lebih cepat & akurat dari keyboard
// numerik kecil). Prompt "Beranda Kotak-Tugas", Bagian 2a.
export function Stepper({
  value, onChange, min = 0, max, step = 1, label, satuan, disabled
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  satuan?: string;
  disabled?: boolean;
}) {
  const bisaKurang = !disabled && value > min;
  const bisaTambah = !disabled && (max === undefined || value < max);

  function kurang() {
    if (bisaKurang) onChange(Math.max(min, value - step));
  }
  function tambah() {
    if (bisaTambah) onChange(max !== undefined ? Math.min(max, value + step) : value + step);
  }

  return (
    <div>
      {label && <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={kurang}
          disabled={!bisaKurang}
          aria-label="Kurangi"
          className="flex min-h-tap min-w-tap items-center justify-center rounded-xl border-2 border-primary text-2xl font-bold leading-none text-primary active:bg-primary-light disabled:border-gray-200 disabled:text-gray-300"
        >
          −
        </button>
        <span className="min-w-[3.5rem] text-center text-xl font-bold tabular-nums text-gray-800">
          {value}
          {satuan && <span className="ml-1 text-sm font-normal text-gray-400">{satuan}</span>}
        </span>
        <button
          type="button"
          onClick={tambah}
          disabled={!bisaTambah}
          aria-label="Tambah"
          className="flex min-h-tap min-w-tap items-center justify-center rounded-xl border-2 border-primary text-2xl font-bold leading-none text-primary active:bg-primary-light disabled:border-gray-200 disabled:text-gray-300"
        >
          +
        </button>
      </div>
    </div>
  );
}
