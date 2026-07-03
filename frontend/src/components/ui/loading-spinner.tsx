// Kondisi LOADING
export function LoadingSpinner({ label = 'Memuat…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-gray-500" role="status">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-light border-t-primary" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
