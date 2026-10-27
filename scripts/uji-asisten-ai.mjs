// uji-asisten-ai.mjs — uji terima TAHAP M1 (docs/rancangan-mcp.md §5.6).
// Memastikan akun role ASISTEN_AI: boleh baca kokpit, DITOLAK rekening penuh & aksi tulis.
//
// Cara pakai (PowerShell, dari folder e-bama):
//   $env:EBAMA_USER_ID="asisten-ai"; $env:EBAMA_KATA_SANDI="..."; node scripts/uji-asisten-ai.mjs 2026-10
// EBAMA_GAS_URL opsional (bawaan = URL produksi di frontend/src/lib/api.ts).

const GAS_URL = process.env.EBAMA_GAS_URL ||
  'https://script.google.com/macros/s/AKfycbwNocZaP2vV_PSbXkpQ3doLHCyo_14ueUSjWpwTLG5Lq8ge68YfBgBO8sVJw4YSaoY2nQ/exec';
const USER_ID = process.env.EBAMA_USER_ID || 'asisten-ai';
const KATA_SANDI = process.env.EBAMA_KATA_SANDI;
const bulan = process.argv[2] || new Date().toISOString().slice(0, 7);

if (!KATA_SANDI) {
  console.error('[X] Isi dulu variabel EBAMA_KATA_SANDI.');
  process.exit(1);
}

async function panggil(action, payload = {}, token = '') {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token, payload }),
    redirect: 'follow'
  });
  const teks = await res.text();
  try { return JSON.parse(teks); } catch { return { ok: false, error: 'Balasan bukan JSON: ' + teks.slice(0, 120) }; }
}

let lolos = 0, gagal = 0;
function cek(nama, syarat, info) {
  if (syarat) { lolos++; console.log('  [OK]   ' + nama); }
  else { gagal++; console.log('  [GAGAL] ' + nama + (info ? ' — ' + info : '')); }
}

const info = await panggil('sistem.info');
console.log('Sistem:', info.ok ? `${info.data.app} v${info.data.versi}, mode prototipe = ${info.data.prototipe ? 'ON' : 'OFF'}` : info.error);
if (info.ok && info.data.prototipe) {
  console.log('  [PERINGATAN] Mode prototipe ON: siapa pun yang tahu URL bisa memakai token PROTOTIPE:<ROLE> tanpa login.');
}

const login = await panggil('auth.login', { user_id: USER_ID, pin: KATA_SANDI });
cek('login ' + USER_ID, login.ok && login.data.role === 'ASISTEN_AI', login.error || ('role = ' + (login.data && login.data.role)));
if (!login.ok) process.exit(1);
const token = login.data.token;

const kokpit = await panggil('ppk.kokpit', { bulan }, token);
cek(`ppk.kokpit ${bulan} DIIZINKAN`, kokpit.ok, kokpit.error);

const rekap = await panggil('rekap.harian', { tanggal: bulan + '-01' }, token);
cek('rekap.harian (roles kosong) DIIZINKAN', rekap.ok, rekap.error);

const tolak = 'Anda tidak berwenang melakukan aksi ini.';
for (const [action, payload] of [
  ['cetak.form07', { bulan }],
  ['cetak.form10', { bulan }],
  ['rekening.lihat_lengkap', { nit_list: [] }],
  ['bayar.create', { bulan }],
  ['status.set', {}],
  ['pengguna.list', {}]
]) {
  const r = await panggil(action, payload, token);
  cek(`${action} DITOLAK`, !r.ok && r.error === tolak, r.ok ? 'malah berhasil!' : r.error);
}

await panggil('auth.logout', {}, token);
console.log(`\nHasil: ${lolos} lolos, ${gagal} gagal.`);
console.log('Cek juga sheet AUDIT_LOG: harus ada baris baca.ai:ppk.kokpit dan baca.ai:rekap.harian.');
process.exit(gagal ? 1 : 0);
