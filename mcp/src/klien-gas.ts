// klien-gas.ts — klien Web App GAS e-BAMA untuk server MCP.
// Rujukan perilaku: docs/rancangan-mcp.md §6 "Perilaku klien GAS".
// - Login sekali, token disimpan di memori proses (TTL 24 jam).
// - "Sesi tidak valid" → login ulang SATU kali, lalu ulangi panggilan.
// - POST text/plain, ikuti redirect 302 GAS.
// - Batas waktu 90 detik per panggilan.
// - {ok:false,error} diteruskan apa adanya.
// - Lapis ketiga D6: kunci rekening penuh dibuang dari setiap balasan.

const URL_GAS_BAWAAN =
  'https://script.google.com/macros/s/AKfycbwNocZaP2vV_PSbXkpQ3doLHCyo_14ueUSjWpwTLG5Lq8ge68YfBgBO8sVJw4YSaoY2nQ/exec';

const BATAS_WAKTU_MS = 90_000;
const TTL_TOKEN_MS = 24 * 60 * 60 * 1000;
const PENANDA_SESI_TIDAK_VALID = 'Sesi tidak valid';
const KUNCI_REKENING_TERLARANG = new Set(['no_rekening_lengkap', 'no_rekening']);

export interface BalasanGas<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export class GalatGas extends Error {}

export interface KonfigurasiKlien {
  urlGas: string;
  userId: string;
  kataSandi: string;
}

export function bacaKonfigurasi(): KonfigurasiKlien {
  return {
    urlGas: (process.env.EBAMA_GAS_URL || '').trim() || URL_GAS_BAWAAN,
    userId: (process.env.EBAMA_USER_ID || '').trim() || 'asisten-ai',
    kataSandi: process.env.EBAMA_KATA_SANDI || ''
  };
}

/** Buang kunci rekening penuh di kedalaman mana pun (jaring pengaman D6). */
export function saringRekening(nilai: unknown): unknown {
  if (Array.isArray(nilai)) return nilai.map(saringRekening);
  if (nilai && typeof nilai === 'object') {
    const hasil: Record<string, unknown> = {};
    for (const [kunci, isi] of Object.entries(nilai as Record<string, unknown>)) {
      if (KUNCI_REKENING_TERLARANG.has(kunci)) continue;
      hasil[kunci] = saringRekening(isi);
    }
    return hasil;
  }
  return nilai;
}

export class KlienGas {
  private token = '';
  private tokenBerlakuSampai = 0;
  private sedangLogin: Promise<string> | null = null;

  constructor(private readonly konfigurasi: KonfigurasiKlien) {}

  /** Kirim satu permintaan mentah ke doPost GAS. */
  private async kirim<T>(action: string, payload: unknown, token: string): Promise<BalasanGas<T>> {
    let res: Response;
    try {
      res = await fetch(this.konfigurasi.urlGas, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, token, payload }),
        redirect: 'follow',
        signal: AbortSignal.timeout(BATAS_WAKTU_MS)
      });
    } catch (e) {
      const pesan = e instanceof Error ? e.message : String(e);
      if (e instanceof Error && e.name === 'TimeoutError') {
        throw new GalatGas(`Server e-BAMA tidak menjawab dalam ${BATAS_WAKTU_MS / 1000} detik (action ${action}). Coba lagi sebentar.`);
      }
      throw new GalatGas(`Gagal menghubungi server e-BAMA: ${pesan}`);
    }
    const teks = await res.text();
    try {
      return JSON.parse(teks) as BalasanGas<T>;
    } catch {
      throw new GalatGas(`Balasan server bukan JSON (HTTP ${res.status}): ${teks.slice(0, 160)}`);
    }
  }

  private async login(): Promise<string> {
    if (this.sedangLogin) return this.sedangLogin;
    this.sedangLogin = (async () => {
      if (!this.konfigurasi.kataSandi) {
        throw new GalatGas('EBAMA_KATA_SANDI belum diisi di file mcp/.env.');
      }
      const r = await this.kirim<{ token: string; role: string }>(
        'auth.login',
        { user_id: this.konfigurasi.userId, pin: this.konfigurasi.kataSandi },
        ''
      );
      if (!r.ok || !r.data?.token) {
        throw new GalatGas(`Login ${this.konfigurasi.userId} gagal: ${r.error || 'tanpa token'}`);
      }
      if (r.data.role !== 'ASISTEN_AI') {
        // Pagar D5: MCP hanya boleh memakai akun baca-saja.
        throw new GalatGas(
          `Akun ${this.konfigurasi.userId} ber-role ${r.data.role}, bukan ASISTEN_AI. ` +
            'Pakai akun khusus MCP agar sesi PWA tidak terputus dan akses tetap baca-saja.'
        );
      }
      this.token = r.data.token;
      this.tokenBerlakuSampai = Date.now() + TTL_TOKEN_MS;
      return this.token;
    })();
    try {
      return await this.sedangLogin;
    } finally {
      this.sedangLogin = null;
    }
  }

  private async tokenAktif(): Promise<string> {
    if (this.token && Date.now() < this.tokenBerlakuSampai) return this.token;
    return this.login();
  }

  /** Panggilan publik tanpa token (mis. sistem.info). */
  async panggilPublik<T>(action: string, payload: unknown = {}): Promise<T> {
    const r = await this.kirim<T>(action, payload, '');
    if (!r.ok) throw new GalatGas(r.error || `Action ${action} gagal.`);
    return saringRekening(r.data) as T;
  }

  /** Panggilan bertoken; login ulang satu kali bila sesi kedaluwarsa. */
  async panggil<T>(action: string, payload: unknown = {}): Promise<T> {
    let r = await this.kirim<T>(action, payload, await this.tokenAktif());
    if (!r.ok && (r.error || '').includes(PENANDA_SESI_TIDAK_VALID)) {
      this.token = '';
      r = await this.kirim<T>(action, payload, await this.login());
    }
    if (!r.ok) throw new GalatGas(r.error || `Action ${action} gagal.`);
    return saringRekening(r.data) as T;
  }
}
