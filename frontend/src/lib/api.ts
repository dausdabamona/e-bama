// Klien GAS — POST text/plain berisi JSON {action, token, payload} (hindari preflight CORS).
// Amplop balasan: {ok:true,data} | {ok:false,error}. Timeout 30 dtk, retry 1x error jaringan.

// URL deployment GAS. Bisa dioverride via variabel VITE_GAS_URL (GitHub Actions /
// .env lokal); bila kosong pakai URL produksi di bawah. URL ini bukan rahasia —
// ia memang terkirim ke browser dan dilindungi token + role di sisi GAS.
const GAS_URL_BAWAAN =
  'https://script.google.com/macros/s/AKfycbwNocZaP2vV_PSbXkpQ3doLHCyo_14ueUSjWpwTLG5Lq8ge68YfBgBO8sVJw4YSaoY2nQ/exec';
const GAS_URL = (import.meta.env.VITE_GAS_URL as string) || GAS_URL_BAWAAN;
const TIMEOUT_MS = 30_000;

export interface Amplop<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export class ApiError extends Error {
  jaringan: boolean;
  constructor(pesan: string, jaringan = false) {
    super(pesan);
    this.jaringan = jaringan;
  }
}

function tokenSaatIni(): string {
  try {
    const s = localStorage.getItem('ebama_session');
    return s ? (JSON.parse(s).token as string) : '';
  } catch {
    return '';
  }
}

async function kirim<T>(action: string, payload: unknown): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: tokenSaatIni(), payload: payload ?? {} }),
      signal: ctrl.signal
    });
    const amplop = (await res.json()) as Amplop<T>;
    if (!amplop.ok) {
      const pesan = amplop.error || 'Terjadi kesalahan.';
      // Sesi kedaluwarsa → lempar ke login
      if (pesan.indexOf('Sesi tidak valid') >= 0) {
        localStorage.removeItem('ebama_session');
        window.dispatchEvent(new CustomEvent('ebama:sesi-habis'));
      }
      throw new ApiError(pesan);
    }
    return amplop.data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('Jaringan bermasalah. Periksa koneksi Anda.', true);
  } finally {
    clearTimeout(timer);
  }
}

/** Panggil action GAS. Retry 1x otomatis untuk error jaringan. */
export async function api<T = unknown>(action: string, payload?: unknown): Promise<T> {
  try {
    return await kirim<T>(action, payload);
  } catch (e) {
    if (e instanceof ApiError && e.jaringan && navigator.onLine) {
      return await kirim<T>(action, payload); // coba sekali lagi
    }
    throw e;
  }
}
