# MCP e-BAMA (baca-saja)

Server MCP lokal agar Claude Desktop bisa **membaca** data e-BAMA.
Keputusan & batasan: `../docs/rancangan-mcp.md`. Payload tiap action: `../docs/kontrak-api.md`.

## Status

| Tahap | Isi | Status |
|---|---|---|
| M2 | `info_sistem`, `kokpit_ppk` | Kode siap, lolos uji tiruan (`npm run uji`) — menunggu uji riil |
| M3 | 15 tool sisanya | Belum |

## Prasyarat

1. TAHAP M1 sudah di-deploy dan `node scripts/uji-asisten-ai.mjs <YYYY-MM>` lolos.
2. Akun `asisten-ai` (role `ASISTEN_AI`) sudah dibuat di panel Pengguna PWA.
3. Node.js 20.12 atau lebih baru (`node -v`).

## Pasang (PowerShell, dari folder `e-bama\mcp`)

```powershell
npm install
npm run build
npm run uji          # uji protokol terhadap GAS tiruan, harus 9 lolos
Copy-Item .env.contoh .env
notepad .env         # isi EBAMA_KATA_SANDI akun asisten-ai
```

`dist\index.js` adalah satu berkas utuh (tanpa `node_modules`), jadi cukup
dibangun sekali per perubahan kode.

## Daftarkan di Claude Desktop

Buka **Settings → Developer → Edit Config**, lalu tambahkan ke
`claude_desktop_config.json` (gabungkan dengan server lain yang sudah ada,
misalnya RANCANG):

```json
{
  "mcpServers": {
    "e-BAMA": {
      "command": "node",
      "args": ["C:\\Users\\A C E R\\e-bama\\mcp\\dist\\index.js"]
    }
  }
}
```

Tutup Claude Desktop sepenuhnya (termasuk dari system tray), buka lagi.

## Uji terima M2

Di Claude Desktop, minta:

1. "Cek info sistem e-BAMA" → harus menyebut `prototipe: false`.
2. "Tampilkan kokpit PPK bulan ini" → angka harus sama dengan halaman Kokpit di PWA.

## Tool

| Tool | Action GAS | Parameter |
|---|---|---|
| `info_sistem` | `sistem.info` (publik) | — |
| `kokpit_ppk` | `ppk.kokpit` | `bulan` (YYYY-MM, kosong = bulan berjalan WIT) |

## Pengamanan

- Login hanya dengan akun ber-role `ASISTEN_AI`; akun lain ditolak MCP sendiri
  sehingga sesi PWA PPK tidak terputus.
- Kunci `no_rekening_lengkap` / `no_rekening` dibuang dari setiap balasan
  (lapis ketiga D6).
- Sesi kedaluwarsa → login ulang tepat satu kali (menghindari blokir 5× gagal).
- `.env` berisi kata sandi dan tidak ikut di-commit (`.gitignore`).
