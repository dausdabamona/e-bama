// Kondisi KOSONG
export function EmptyState({ pesan = 'Belum ada data.' }: { pesan?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-gray-500">
      <span className="text-3xl" aria-hidden>🗂️</span>
      <p className="text-sm">{pesan}</p>
    </div>
  );
}
