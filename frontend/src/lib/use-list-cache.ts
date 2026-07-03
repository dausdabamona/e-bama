// Hook daftar offline-first: tampilkan cache dulu, refresh di belakang.
// Setiap tampilan data wajib 4 kondisi: loading / error / kosong / data.
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { ambilCache, simpanCache } from './db';

export interface HasilList<T> {
  data: T | null;
  dariCache: boolean;
  memuat: boolean;
  galat: string;
  refresh: () => void;
}

export function useListCache<T>(action: string, payload?: unknown): HasilList<T> {
  const key = action + ':' + JSON.stringify(payload ?? {});
  const [data, setData] = useState<T | null>(null);
  const [dariCache, setDariCache] = useState(false);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let aktif = true;
    (async () => {
      setGalat('');
      // 1) cache dulu
      const cached = await ambilCache<T>(key);
      if (aktif && cached !== null) {
        setData(cached);
        setDariCache(true);
        setMemuat(false);
      } else if (aktif) {
        setMemuat(true);
      }
      // 2) refresh di belakang
      try {
        const segar = await api<T>(action, payload);
        if (!aktif) return;
        setData(segar);
        setDariCache(false);
        await simpanCache(key, segar);
      } catch (e) {
        if (!aktif) return;
        if (cached === null) setGalat(e instanceof Error ? e.message : String(e));
      } finally {
        if (aktif) setMemuat(false);
      }
    })();
    return () => { aktif = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  return { data, dariCache, memuat, galat, refresh };
}
