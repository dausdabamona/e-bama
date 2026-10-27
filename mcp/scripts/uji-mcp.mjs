// uji-mcp.mjs — uji protokol server MCP e-BAMA terhadap GAS TIRUAN (tanpa internet).
// Memeriksa: daftar tool, info_sistem, kokpit_ppk (bulan default WIT), login ulang
// saat sesi kedaluwarsa, penyaring rekening D6, penolakan akun non-ASISTEN_AI.
// Cara pakai (dari folder mcp, setelah `npm run build`): node scripts/uji-mcp.mjs

import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const SERVER_MCP = fileURLToPath(new URL('../dist/index.js', import.meta.url));
let jumlahLogin = 0, sesiKedaluwarsaSekali = true, roleAkun = 'ASISTEN_AI', bulanDiterima = '';

const gas = http.createServer((req, res) => {
  let isi = '';
  req.on('data', (c) => (isi += c));
  req.on('end', () => {
    const { action, token, payload } = JSON.parse(isi);
    const balas = (o) => res.end(JSON.stringify(o));
    if (action === 'sistem.info') return balas({ ok: true, data: { app: 'e-BAMA', versi: 'uji', prototipe: false, role_prototipe: [] } });
    if (action === 'auth.login') { jumlahLogin++; return balas({ ok: true, data: { token: 'T' + jumlahLogin, role: roleAkun } }); }
    if (!token) return balas({ ok: false, error: 'Sesi tidak valid atau kedaluwarsa. Silakan login ulang.' });
    if (action === 'ppk.kokpit') {
      if (sesiKedaluwarsaSekali) { sesiKedaluwarsaSekali = false; return balas({ ok: false, error: 'Sesi tidak valid atau kedaluwarsa. Silakan login ulang.' }); }
      bulanDiterima = payload.bulan;
      return balas({ ok: true, data: { ringkasan: { bulan: payload.bulan, target_rekap: 1000 },
        tahapan: [{ no: 1, label: 'Rekap', status: 'hijau', taruna: [{ nit: '1', no_rekening_lengkap: '9999', rek_mask: '***99' }] }],
        tindakan: [] } });
    }
    return balas({ ok: false, error: 'Anda tidak berwenang melakukan aksi ini.' });
  });
});
await new Promise((r) => gas.listen(0, '127.0.0.1', r));
const urlGas = `http://127.0.0.1:${gas.address().port}/exec`;

let lolos = 0, gagal = 0;
const cek = (nama, syarat, info = '') => { syarat ? lolos++ : gagal++; console.log(`  [${syarat ? 'OK' : 'GAGAL'}] ${nama}${!syarat && info ? ' — ' + info : ''}`); };

async function sambung() {
  const klien = new Client({ name: 'uji', version: '1' });
  await klien.connect(new StdioClientTransport({ command: process.execPath, args: [SERVER_MCP],
    env: { ...process.env, EBAMA_GAS_URL: urlGas, EBAMA_USER_ID: 'asisten-ai', EBAMA_KATA_SANDI: 'uji' }, stderr: 'ignore' }));
  return klien;
}
const teks = (h) => h.content[0].text;

const klien = await sambung();
const { tools } = await klien.listTools();
cek('daftar tool = info_sistem, kokpit_ppk', tools.map((t) => t.name).sort().join() === 'info_sistem,kokpit_ppk', tools.map((t) => t.name).join());
cek('semua tool readOnlyHint', tools.every((t) => t.annotations?.readOnlyHint === true));

const info = await klien.callTool({ name: 'info_sistem', arguments: {} });
cek('info_sistem tanpa login', !info.isError && JSON.parse(teks(info)).app === 'e-BAMA' && jumlahLogin === 0, teks(info));

const bulanWit = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jayapura', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
const kokpit = await klien.callTool({ name: 'kokpit_ppk', arguments: {} });
cek('kokpit_ppk bulan default = bulan WIT', !kokpit.isError && bulanDiterima === bulanWit, `${bulanDiterima} vs ${bulanWit}: ${teks(kokpit)}`);
cek('sesi kedaluwarsa → login ulang tepat 1 kali', jumlahLogin === 2, 'login = ' + jumlahLogin);
cek('no_rekening_lengkap dibuang, rek_mask tetap', !teks(kokpit).includes('no_rekening_lengkap') && teks(kokpit).includes('rek_mask'));

const k2 = await klien.callTool({ name: 'kokpit_ppk', arguments: { bulan: '2026-03' } });
cek('kokpit_ppk bulan eksplisit, token dipakai ulang', !k2.isError && bulanDiterima === '2026-03' && jumlahLogin === 2);

const salah = await klien.callTool({ name: 'kokpit_ppk', arguments: { bulan: '2026-13' } });
cek('format bulan salah ditolak', salah.isError === true);
await klien.close();

roleAkun = 'PPK';
const klien2 = await sambung();
const tolak = await klien2.callTool({ name: 'kokpit_ppk', arguments: {} });
cek('akun ber-role PPK ditolak MCP', tolak.isError && teks(tolak).includes('bukan ASISTEN_AI'), teks(tolak));
await klien2.close();

gas.close();
console.log(`\nHasil: ${lolos} lolos, ${gagal} gagal.`);
process.exit(gagal ? 1 : 0);
