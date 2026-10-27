#!/usr/bin/env node
// index.ts — server MCP e-BAMA (stdio, baca-saja). Rancangan: docs/rancangan-mcp.md.
// Catatan stdio: stdout khusus protokol MCP; semua log ke stderr.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { bacaKonfigurasi, KlienGas } from './klien-gas.js';
import { daftarkanAlat } from './alat.js';

const VERSI = '0.1.0';

// mcp/.env dibaca relatif terhadap file ini (dist/ → ../.env),
// karena Claude Desktop menjalankan server dari folder kerja lain.
const jalurEnv = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(jalurEnv)) {
  process.loadEnvFile(jalurEnv);
} else {
  console.error(`[e-BAMA MCP] File ${jalurEnv} tidak ditemukan; memakai variabel lingkungan saja.`);
}

const server = new McpServer(
  { name: 'e-BAMA', version: VERSI },
  {
    instructions:
      'Server baca-saja e-BAMA (Bantuan Makan Taruna, Poltek KP Sorong). ' +
      'Format bulan YYYY-MM, tanggal YYYY-MM-DD, zona WIT. Nominal dalam rupiah. ' +
      'Nomor rekening penuh taruna tidak pernah tersedia lewat server ini. ' +
      'Cetak resmi (kop, TTD) tetap dari PWA e-BAMA.'
  }
);

daftarkanAlat(server, new KlienGas(bacaKonfigurasi()));

await server.connect(new StdioServerTransport());
console.error(`[e-BAMA MCP] v${VERSI} siap (stdio).`);
