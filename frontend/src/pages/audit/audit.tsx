// /audit (Admin, PPK, KPA) — tabel AUDIT_LOG, filter tanggal/pengguna/aksi.
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorMessage } from '../../components/ui/error-message';
import { Input } from '../../components/ui/input';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { useListCache } from '../../lib/use-list-cache';

interface LogAudit {
  timestamp: string; user_id: string; aksi: string; ref_type: string; ref_id: string;
  data_lama: string; data_baru: string;
}

function tigaPuluhHariLalu(): string {
  const d = new Date(); d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}
function hariIni(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HalamanAudit() {
  const [dari, setDari] = useState(tigaPuluhHariLalu());
  const [sampai, setSampai] = useState(hariIni());
  const [userId, setUserId] = useState('');
  const [aksi, setAksi] = useState('');
  const [terapkan, setTerapkan] = useState({ dari, sampai, userId: '', aksi: '' });

  const { data, memuat, galat, refresh } = useListCache<{ log: LogAudit[] }>('audit.list', {
    dari: terapkan.dari, sampai: terapkan.sampai,
    user_id: terapkan.userId || undefined, aksi: terapkan.aksi || undefined
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-primary-dark">Audit Log</h1>

      <Card className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Input label="Dari" type="date" value={dari} onChange={(e) => setDari(e.target.value)} />
          <Input label="Sampai" type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Input label="User ID (opsional)" value={userId} onChange={(e) => setUserId(e.target.value)} />
          <Input label="Aksi (opsional)" placeholder="mis. pesanan" value={aksi} onChange={(e) => setAksi(e.target.value)} />
        </div>
        <Button onClick={() => setTerapkan({ dari, sampai, userId, aksi })}>Terapkan Filter</Button>
      </Card>

      {memuat && !data && <LoadingSpinner label="Memuat log…" />}
      {galat && !data && <ErrorMessage pesan={galat} onRetry={refresh} />}
      {data && (data.log ?? []).length === 0 && <EmptyState pesan="Tidak ada log pada rentang ini." />}

      {data?.log?.map((l, i) => (
        <Card key={i} className="text-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono font-semibold">{l.aksi}</span>
            <span className="text-xs text-gray-400">{l.timestamp}</span>
          </div>
          <p className="text-xs text-gray-500">{l.user_id} · {l.ref_type} {l.ref_id}</p>
        </Card>
      ))}
    </div>
  );
}
