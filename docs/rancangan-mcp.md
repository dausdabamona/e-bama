# Rancangan MCP e-BAMA — Dokumen Keputusan (TAHAP M0)

> **Status:** DISETUJUI (LANJUT, 22 Okt 2026). M1: kode siap, belum di-deploy. M2: kode `mcp/` siap (27 Okt 2026), lolos uji tiruan 9/9, menunggu uji riil.
> **Tanggal:** 22 Oktober 2026 · **Basis kode:** commit `97e5de9` (sp2d.batal).
> **Sumber kebenaran:** endpoint & payload tetap `docs/kontrak-api.md`; skema tetap
> `docs/skema-sheet.md`. Dokumen ini HANYA mengunci keputusan MCP dan tidak
> menyalin isi payload (single source of truth).

---

## 1. Tujuan

Server MCP yang membuat Claude (Claude Desktop di laptop PPK) bisa **membaca**
data e-BAMA untuk empat kebutuhan PPK:

1. Status SPM & SP2D (sudah sampai mana per prodi/tingkat/suplier)
2. Rekonsiliasi debet bank (taruna berhasil/gagal terdebet, outstanding tagihan)
3. Rekap & laporan bulanan
4. Data formulir SOP (bahan pengecekan, narasi, atau penyusunan dokumen)

MCP adalah **klien ketiga** di samping PWA dan portal penyedia. Seluruh logika
bisnis tetap di GAS; MCP hanya meneruskan `{action, token, payload}`.

## 2. Keputusan yang dikunci

| # | Keputusan | Alasan |
|---|---|---|
| D1 | **MCP lokal, transport stdio, Node.js + TypeScript**, `@modelcontextprotocol/sdk` | Pola sama dengan RANCANG; tanpa server tambahan |
| D2 | MCP memanggil **Web App GAS e-BAMA** (doPost), bukan Sheets API langsung | Logika bisnis, rumus rekap, dan aturan uang tetap satu pintu di GAS |
| D3 | **Tahap 1 = baca-saja** | Risiko rendah; tulis dipertimbangkan setelah tahap 1 stabil |
| D4 | **Role baru `ASISTEN_AI`** + allowlist `ASISTEN_AI_ACTIONS` (deny-by-default), pola sama dengan `OPERATOR_SAKTI` | Batas baca-saja ditegakkan backend, tidak bergantung pada kode MCP |
| D5 | **Akun MCP terpisah** dari akun PPK Firdaus | Token satu-per-akun: login MCP memakai akun PPK akan mematikan sesi PWA |
| D6 | **Nomor rekening penuh taruna tidak pernah lewat MCP** | CLAUDE.md §4; data ±247 rekening akan ikut masuk percakapan AI |
| D7 | Cetak resmi (format, kop, TTD) **tetap dari PWA** | Format form satu sumber (`frontend/src/pages/...`); MCP memberi data |
| D8 | Kode MCP di **`e-bama/mcp/`** (monorepo) | Satu repo, satu riwayat; `.gitignore` sudah menutup `.env`, `node_modules/`, `dist/` |

## 3. Action yang DIIZINKAN untuk `ASISTEN_AI` (allowlist tahap 1)

Semua baca murni. Pemeriksaan handler: tidak ada handler di daftar ini yang
mengubah keluaran berdasarkan `session.role`, jadi `ASISTEN_AI` melihat data
yang sama dengan PPK untuk action ini.

| Kebutuhan | Action GAS | Nama tool MCP |
|---|---|---|
| Uji koneksi | `sistem.info` (publik) | `info_sistem` |
| Ringkasan PPK | `ppk.kokpit` | `kokpit_ppk` |
| Ringkasan PPK | `dashboard.running` | `dashboard_bulan_berjalan` |
| SPM & SP2D | `spm.list` | `daftar_spm` |
| SPM & SP2D | `bayar.list`, `bayar.get` | `daftar_pembayaran`, `detail_pembayaran` |
| SPM & SP2D | `sp2d.list` | `daftar_sp2d` |
| SPM & SP2D | `sp2d.rekonsiliasi` | `rekonsiliasi_sp2d` |
| Debet bank | `tagihan.status_debet` | `status_debet` |
| Debet bank | `tagihan.summary` | `ringkasan_tagihan` |
| Debet bank | `tagihan.list` | `daftar_tagihan` |
| Rekap & laporan | `rekap.get` | `rekap_bulanan` |
| Rekap & laporan | `rekap.harian` | `rekap_harian` |
| Rekap & laporan | `laporan.bulanan`, `laporan.resmi` | `laporan_bulanan`, `laporan_resmi` |
| Form SOP | `cetak.form01`–`cetak.form06`, `cetak.form09` | `data_form_sop` (satu tool, parameter `form`) |
| Rujukan | `taruna.list` (hanya `rek_mask`) | `daftar_taruna` |
| Akun | `auth.change_pin` (akun sendiri, via halaman Akun PWA) | — (bukan tool) |

Total: 23 action → 17 tool.

## 4. Action yang SENGAJA DIKELUARKAN

| Action | Alasan |
|---|---|
| `cetak.form07`, `cetak.form08`, `cetak.form10` | Memuat `no_rekening_lengkap` taruna (D6) |
| `cetak.kuasa_debet_keluar`, `cetak.blokir_gagal_debet` | Memuat `no_rekening_lengkap` taruna (D6) |
| `rekening.*` | Rekening penuh (D6) |
| `cetak.pendebetan_penyedia`, `cetak.surat_pendebetan_bank`, `cetak.laporan_penyaluran_penyedia` | Surat ke bank/penyedia; belum masuk 4 kebutuhan (YAGNI) |
| `audit.list`, `pengguna.list` | Bukan kebutuhan PPK harian |
| Semua aksi tulis (`*.create/update/set/import/...`) | D3 |

Lapis kedua: handler sensitif sudah memanggil `_hanyaAdminPPK_(session)`, yang
menolak role selain ADMIN/PPK/STAF_PPK. Jadi seandainya allowlist salah ketik,
`ASISTEN_AI` tetap tertolak di rekening penuh.

**Catatan `cetak.form09`:** memuat rekening **instansi** (Senat & penyedia),
bukan rekening taruna. Rekening ini memang tercetak di surat resmi. Diizinkan.

## 5. Perubahan backend (TAHAP M1)

1. `00_config.gs` → `ROLES.ASISTEN_AI` dan `ENUM.ROLE` tambah `'ASISTEN_AI'`.
2. `01_router.gs`:
   - tambah `var ASISTEN_AI_ACTIONS = {...}` (daftar §3 + `auth.logout`);
     **revisi 27 Okt 2026:** + `auth.change_pin`, karena pengguna baru selalu
     berkata sandi bawaan `123456` dan tanpa aksi ini akun tertahan di sana.
     Panggilan ini dikecualikan dari audit baca (payload memuat kata sandi);
   - tambah pagar di `doPost` setelah pagar `OPERATOR_SAKTI`;
   - tambahkan `'ASISTEN_AI'` ke array `roles` action §3 yang `roles`-nya
     tidak kosong (router memeriksa allowlist **dan** `roles`).
3. **Audit baca (disetujui):** setiap panggilan `ASISTEN_AI` yang berhasil
   dicatat 1 baris `AUDIT_LOG` (`aksi='baca.ai:<action>'`, payload ringkas, tanpa
   data balasan). Alasan: jejak data apa saja yang dibaca AI, sejalan dengan
   pengecualian audit-baca untuk rekening. Biaya: baris AUDIT_LOG bertambah
   (perkiraan puluhan per hari).
4. Revisi dokumen dulu sebelum kode (Aturan Main #2):
   `docs/skema-sheet.md` (enum role + paragraf role `ASISTEN_AI`),
   `docs/kontrak-api.md` (bagian baru "Akses MCP"), `CLAUDE.md` §4.
5. `clasp push` → uji di editor GAS → `clasp deploy` (URL Web App tetap sama
   bila memakai deployment yang ada) → buat akun lewat `pengguna.upsert`
   (mis. `user_id: asisten-ai`), ganti kata sandi default.
6. Jalankan `setupDatabase()` di editor GAS (idempotent) supaya dropdown
   kolom `PENGGUNA.role` memuat `ASISTEN_AI`.
7. Uji: `node scripts/uji-asisten-ai.mjs <YYYY-MM>` — login `asisten-ai` →
   `ppk.kokpit` & `rekap.harian` (harus ok) → `cetak.form07`, `cetak.form10`,
   `rekening.lihat_lengkap`, `bayar.create`, `status.set`, `pengguna.list`
   (harus ditolak) → AUDIT_LOG memuat baris `baca.ai:*`.

## 6. Rancangan server MCP (TAHAP M2–M3)

```
e-bama/mcp/
├── package.json        # "type":"module", bin, script build
├── tsconfig.json
├── .env.contoh         # contoh isi, tanpa rahasia
├── README.md           # cara pasang di Claude Desktop
└── src/
    ├── index.ts        # daftar tool + transport stdio
    ├── klien-gas.ts    # login, cache token, panggil(action, payload)
    └── alat.ts         # definisi 17 tool (nama, deskripsi ID, skema zod)
```

**Konfigurasi** (`mcp/.env`, tidak di-commit):
`EBAMA_GAS_URL`, `EBAMA_USER_ID`, `EBAMA_KATA_SANDI`.

**Perilaku klien GAS:**
- Login sekali, token disimpan di memori proses (TTL 24 jam).
- Balasan "Sesi tidak valid" → login ulang **satu kali**, lalu ulangi panggilan.
  Tidak ada perulangan login (rate limit: 5 gagal → blokir 15 menit).
- POST `text/plain`, ikuti redirect 302 GAS (fetch Node mengubah ke GET ke URL
  `googleusercontent` — perilaku normal Web App GAS).
- Batas waktu 90 detik per panggilan (GAS bisa lambat saat cold start).
- `{ok:false,error}` diteruskan apa adanya sebagai pesan error tool (Bahasa
  Indonesia dari backend).

**Penyaring tambahan di MCP (lapis ketiga):** sebelum dikirim ke Claude, MCP
membuang kunci `no_rekening_lengkap` / `no_rekening` di mana pun dalam balasan.
Untuk tahap 1 seharusnya tidak pernah ada; penyaring ini jaring pengaman.

**Format parameter:** `bulan` = `YYYY-MM`, `tanggal` = `YYYY-MM-DD`, sesuai
`_wajibBulan_` / `_wajibTgl_` di backend. Deskripsi tool berbahasa Indonesia.

**Pemasangan Claude Desktop** (`claude_desktop_config.json`):
```json
{ "mcpServers": { "e-BAMA": {
    "command": "node",
    "args": ["C:\\Users\\A C E R\\e-bama\\mcp\\dist\\index.js"] } } }
```

## 7. Risiko yang diterima

| Risiko | Penanganan |
|---|---|
| Nama, NIT, nominal per taruna masuk percakapan Claude | Diterima PPK untuk kebutuhan rekonsiliasi; rekening penuh tetap tertutup (D6); audit baca §5.3 |
| Kata sandi akun AI tersimpan di file `.env` laptop | Akun hanya bisa baca; bisa dinonaktifkan Admin kapan saja (`status: NONAKTIF`) |
| **Mode prototipe** (`MODE_PROTOTIPE_BAWAAN = true` di `00_config.gs`): bila Script Property `MODE_PROTOTIPE` belum `OFF`, token `PROTOTIPE:<ROLE>` melewati semua pagar role — termasuk aksi tulis. Pagar `ASISTEN_AI` tidak berarti selama mode ini ON | Di luar cakupan MCP; diperiksa saat uji M1 (`sistem.info` → `prototipe`). Keputusan mematikannya ada di Firdaus |
| Kontrak API berubah, tool MCP ketinggalan | Tool membungkus action 1:1; perubahan payload cukup diikuti di `alat.ts` |

## 8. Tahapan

| Tahap | Isi | Kriteria selesai |
|---|---|---|
| **M0** | Dokumen ini | LANJUT dari Firdaus |
| **M1** | Backend: role `ASISTEN_AI`, allowlist, audit baca, revisi 3 dokumen, deploy, akun | `scripts/uji-asisten-ai.mjs` lolos semua |
| **M2** | Kerangka `mcp/` + `info_sistem` + `kokpit_ppk`, pasang di Claude Desktop (lihat `mcp/README.md`) | Claude Desktop menampilkan kokpit bulan berjalan |
| **M3** | 15 tool sisanya + penyaring rekening + README | Tiap tool dicocokkan dengan tampilan PWA untuk satu bulan riil |
| M4 (nanti) | Tulis terbatas — keputusan terpisah | — |

## 9. Pertanyaan terbuka

Terjawab 22 Okt 2026 (LANJUT tanpa catatan → usulan dipakai):
1. Audit baca §5.3: **dicatat**.
2. `user_id` akun: **`asisten-ai`**.
