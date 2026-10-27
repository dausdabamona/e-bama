// alat.ts — definisi tool MCP e-BAMA. Satu tool membungkus action GAS 1:1
// (docs/rancangan-mcp.md §3). Payload & bentuk balasan: docs/kontrak-api.md.
// TAHAP M2: info_sistem + kokpit_ppk. Tool lain menyusul di M3.

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GalatGas, KlienGas } from './klien-gas.js';

const ZONA_WAKTU = 'Asia/Jayapura';

/** Bulan berjalan (YYYY-MM) menurut WIT, bukan zona laptop/UTC. */
export function bulanBerjalan(sekarang = new Date()): string {
  const bagian = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_WAKTU,
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(sekarang);
  const tahun = bagian.find((b) => b.type === 'year')?.value;
  const bulan = bagian.find((b) => b.type === 'month')?.value;
  return `${tahun}-${bulan}`;
}

const skemaBulan = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Format bulan harus YYYY-MM, mis. 2026-10')
  .optional()
  .describe('Bulan yang dilihat, format YYYY-MM. Kosongkan untuk bulan berjalan (WIT).');

type HasilTool = { content: { type: 'text'; text: string }[]; isError?: boolean };

function hasilData(data: unknown): HasilTool {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function hasilGalat(e: unknown): HasilTool {
  const pesan = e instanceof GalatGas || e instanceof Error ? e.message : String(e);
  return { content: [{ type: 'text', text: `Galat e-BAMA: ${pesan}` }], isError: true };
}

async function jalankan(fungsi: () => Promise<unknown>): Promise<HasilTool> {
  try {
    return hasilData(await fungsi());
  } catch (e) {
    return hasilGalat(e);
  }
}

export function daftarkanAlat(server: McpServer, klien: KlienGas): void {
  server.registerTool(
    'info_sistem',
    {
      title: 'Info sistem e-BAMA',
      description:
        'Uji koneksi ke server e-BAMA tanpa login. Mengembalikan nama aplikasi, versi, ' +
        'dan apakah mode prototipe sedang ON. Bila prototipe ON, ingatkan PPK bahwa ' +
        'pagar role belum berlaku penuh.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true }
    },
    async () => jalankan(() => klien.panggilPublik('sistem.info'))
  );

  server.registerTool(
    'kokpit_ppk',
    {
      title: 'Kokpit PPK',
      description:
        'Ringkasan kerja PPK untuk satu bulan: target rekap, terbayar SP2D, outstanding ' +
        'tagihan, porsi dipesan vs dimakan, nominal pesanan proyeksi vs realisasi sah, ' +
        'tanggal tanpa pesanan, status 9 tahapan (hijau/kuning/merah/n_a), dan daftar ' +
        'tindakan berurut prioritas. Nominal dalam rupiah. Status n_a berarti belum ' +
        'berlaku untuk bulan itu, bukan masalah.',
      inputSchema: { bulan: skemaBulan },
      annotations: { readOnlyHint: true, openWorldHint: true }
    },
    async ({ bulan }) => jalankan(() => klien.panggil('ppk.kokpit', { bulan: bulan || bulanBerjalan() }))
  );
}
