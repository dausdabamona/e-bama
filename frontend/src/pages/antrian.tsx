// Halaman Antrian: aksi offline tertunda/gagal + coba ulang manual
import { useEffect, useState } from 'react';
import { db, type AksiAntrian } from '../lib/db';
import { cobaUlang, sinkronAntrian } from '../lib/sync';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { useToast } from '../components/ui/toast';

export function HalamanAntrian() {
  const [daftar, setDaftar] = useState<AksiAntrian[]>([]);
  const { toast } = useToast();

  async function muat() {
    setDaftar(await db.antrian_aksi.orderBy('dibuat').toArray());
  }

  useEffect(() => {
    void muat();
    const ulang = () => { void muat(); };
    window.addEventListener('ebama:antrian-berubah', ulang);
    return () => window.removeEventListener('ebama:antrian-berubah', ulang);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary-dark">Antrian Aksi</h1>
        <Button varian="garis" onClick={() => { void sinkronAntrian().then(muat); }}>
          Sinkronkan
        </Button>
      </div>
      {daftar.length === 0 && <EmptyState pesan="Tidak ada aksi tertunda. Semua tersinkron." />}
      {daftar.map((a) => (
        <Card key={a.id} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-semibold">{a.action}</span>
            <Badge status={a.status === 'GAGAL' ? 'DIKEMBALIKAN' : 'DIAJUKAN'}>
              {a.status}
            </Badge>
          </div>
          <p className="text-xs text-gray-500">{new Date(a.dibuat).toLocaleString('id-ID')}</p>
          {a.pesan_gagal && <p className="text-sm text-red-600">{a.pesan_gagal}</p>}
          {a.status === 'GAGAL' && (
            <div className="flex gap-2">
              <Button varian="garis" onClick={() => { void cobaUlang(a).then(muat); }}>Coba Ulang</Button>
              <Button varian="bahaya" onClick={() => {
                void db.antrian_aksi.delete(a.id!).then(() => { toast('Aksi dihapus.'); void muat(); });
              }}>Hapus</Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
