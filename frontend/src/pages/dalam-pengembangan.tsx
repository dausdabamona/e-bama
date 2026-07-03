// Placeholder modul — diisi pada TAHAP 6–7
import { Card } from '../components/ui/card';

export function DalamPengembangan({ judul }: { judul: string }) {
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-primary-dark">{judul}</h1>
      <Card className="text-center text-gray-500">
        <span className="mb-2 block text-3xl" aria-hidden>🚧</span>
        Dalam pengembangan
      </Card>
    </div>
  );
}
