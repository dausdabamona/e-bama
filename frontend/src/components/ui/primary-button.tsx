// Satu tombol aksi utama besar per layar, dipatok di bawah dalam jangkauan
// jempol — nonaktif sampai form valid (validasi inline ada di masing-masing
// form, komponen ini hanya menampilkan hasilnya lewat prop `disabled`).
// Prompt "Beranda Kotak-Tugas", Bagian 2h.
export function PrimaryButton({
  children, onClick, type = 'button', disabled, proses
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  proses?: boolean;
}) {
  return (
    <div className="fixed inset-x-0 bottom-16 z-30 border-t border-gray-100 bg-white/95 px-4 py-3 backdrop-blur-sm lg:sticky lg:bottom-0 lg:mt-4 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
      <button
        type={type}
        onClick={onClick}
        disabled={disabled || proses}
        className="mx-auto block min-h-tap w-full max-w-lg rounded-xl bg-primary px-4 text-base font-bold text-white shadow-md transition-colors active:bg-primary-dark disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none lg:max-w-none"
      >
        {proses ? 'Memproses…' : children}
      </button>
    </div>
  );
}
