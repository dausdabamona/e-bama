// Dexie 'ebama' — cache daftar per endpoint + antrian aksi tulis offline.
import Dexie, { type Table } from 'dexie';

export interface BarisCache {
  key: string;          // mis. 'pesanan.list:{"bulan":"2026-07"}'
  nilai: unknown;
  disimpan: string;     // ISO timestamp
}

export type StatusAntrian = 'TERTUNDA' | 'GAGAL';

export interface AksiAntrian {
  id?: number;
  action: string;
  payload: unknown;
  dibuat: string;       // ISO timestamp
  status: StatusAntrian;
  pesan_gagal?: string;
}

class EbamaDb extends Dexie {
  cache!: Table<BarisCache, string>;
  antrian_aksi!: Table<AksiAntrian, number>;

  constructor() {
    super('ebama');
    this.version(1).stores({
      cache: 'key',
      antrian_aksi: '++id, status, dibuat'
    });
  }
}

export const db = new EbamaDb();

/** Simpan hasil list ke cache. */
export async function simpanCache(key: string, nilai: unknown): Promise<void> {
  await db.cache.put({ key, nilai, disimpan: new Date().toISOString() });
}

/** Ambil cache (null bila belum ada). */
export async function ambilCache<T>(key: string): Promise<T | null> {
  const row = await db.cache.get(key);
  return row ? (row.nilai as T) : null;
}
