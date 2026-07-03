// Pola offline-first: aksi tulis saat offline → antrian Dexie → sinkron saat 'online'.
// Aksi GAGAL ditandai dan bisa dicoba ulang manual dari halaman Antrian.
import { api, ApiError } from './api';
import { db, type AksiAntrian } from './db';

let sedangSinkron = false;

/** Jumlah aksi tertunda+gagal (untuk badge header). */
export async function jumlahAntrian(): Promise<number> {
  return db.antrian_aksi.count();
}

/**
 * Jalankan aksi tulis dengan dukungan offline:
 * - offline → langsung antre, balas {antri:true}
 * - online tapi error jaringan → antre juga
 * - error validasi dari server → dilempar (bukan urusan antrian)
 */
export async function aksiTulis<T = unknown>(
  action: string,
  payload: unknown
): Promise<{ antri: boolean; data?: T }> {
  if (!navigator.onLine) {
    await db.antrian_aksi.add({
      action, payload, dibuat: new Date().toISOString(), status: 'TERTUNDA'
    });
    return { antri: true };
  }
  try {
    const data = await api<T>(action, payload);
    return { antri: false, data };
  } catch (e) {
    if (e instanceof ApiError && e.jaringan) {
      await db.antrian_aksi.add({
        action, payload, dibuat: new Date().toISOString(), status: 'TERTUNDA'
      });
      return { antri: true };
    }
    throw e;
  }
}

/** Kirim seluruh antrian TERTUNDA berurutan. Gagal validasi → tandai GAGAL. */
export async function sinkronAntrian(): Promise<{ sukses: number; gagal: number }> {
  if (sedangSinkron || !navigator.onLine) return { sukses: 0, gagal: 0 };
  sedangSinkron = true;
  let sukses = 0, gagal = 0;
  try {
    const daftar = await db.antrian_aksi.where('status').equals('TERTUNDA').sortBy('dibuat');
    for (const aksi of daftar) {
      try {
        await api(aksi.action, aksi.payload);
        await db.antrian_aksi.delete(aksi.id!);
        sukses++;
      } catch (e) {
        if (e instanceof ApiError && e.jaringan) break; // koneksi putus lagi → berhenti, coba nanti
        await db.antrian_aksi.update(aksi.id!, {
          status: 'GAGAL',
          pesan_gagal: e instanceof Error ? e.message : String(e)
        });
        gagal++;
      }
    }
  } finally {
    sedangSinkron = false;
  }
  window.dispatchEvent(new CustomEvent('ebama:antrian-berubah'));
  return { sukses, gagal };
}

/** Coba ulang satu aksi GAGAL (dari halaman Antrian). */
export async function cobaUlang(aksi: AksiAntrian): Promise<void> {
  await db.antrian_aksi.update(aksi.id!, { status: 'TERTUNDA', pesan_gagal: '' });
  await sinkronAntrian();
}

/** Pasang listener sinkron otomatis saat kembali online + saat aplikasi dibuka. */
export function pasangSinkronOtomatis(): void {
  window.addEventListener('online', () => { void sinkronAntrian(); });
  if (navigator.onLine) void sinkronAntrian();
}
