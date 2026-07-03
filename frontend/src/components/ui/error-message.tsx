// Kondisi ERROR — selalu sediakan tombol Coba Lagi
import { Button } from './button';

export function ErrorMessage({ pesan, onRetry }: { pesan: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="text-3xl" aria-hidden>⚠️</span>
      <p className="text-sm text-red-700">{pesan}</p>
      {onRetry && (
        <Button varian="garis" onClick={onRetry}>Coba Lagi</Button>
      )}
    </div>
  );
}
