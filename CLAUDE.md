# CLAUDE.md — e-BAMA

Panduan kerja untuk Claude Code di repo ini. **Baca sebelum menyentuh kode.**

e-BAMA adalah pengganti **SI-BUMATA**: aplikasi manajemen bantuan uang makan
taruna **Politeknik KP Sorong** (±247 taruna). Mekanisme pembayaran **LS** via
rekening taruna → auto-debet ke rekening Senat → penyedia, mengikuti **SOP
PR/PKU/KU-001/2025**.

---

## 1. Stack & Arsitektur

```
Frontend : React 19 + Vite + TypeScript + Tailwind + Dexie.js + HashRouter + vite-plugin-pwa
           → deploy GitHub Pages (https://dausdabamona.github.io/e-bama/)
Backend  : Google Apps Script (GAS) Web App — doPost action-based + token auth
           → dikelola via clasp, dipisah per modul .gs di backend/src/
Database : Google Spreadsheet — 14 sheet (skema 3NF + 3 snapshot)
File     : Google Drive — via sheet LAMPIRAN (polymorphic ref_type/ref_id)
```

- **Backend** berkomunikasi hanya lewat `doPost` dengan amplop seragam
  `{action, token, payload}` → balas `{ok:true, data}` atau `{ok:false, error}`.
- **Frontend** offline-first: cache & antrian aksi di IndexedDB (Dexie), sinkron
  saat kembali online.
- **Sumber kebenaran skema**: `docs/skema-sheet.md`. **Sumber kebenaran API**:
  `docs/kontrak-api.md`. Kode mengikuti dokumen, bukan sebaliknya.

Struktur repo (monorepo):

```
e-bama/
├── CLAUDE.md
├── backend/            # proyek clasp (GAS)
│   ├── .clasp.json     # TIDAK di-commit (.gitignore)
│   ├── appsscript.json
│   └── src/            # 00..99 .gs per modul
├── frontend/           # Vite (di-scaffold pada TAHAP 5)
└── docs/
    ├── skema-sheet.md
    └── kontrak-api.md
```

---

## 2. Konvensi firdaus-dev

- **Bahasa UI**: seluruh teks antarmuka **Bahasa Indonesia**.
- **Mobile-first**: desain dari lebar **320px**; tap target ≥ **44px**; tanpa
  overflow horizontal.
- **Tema**: terang **teal-ivory** (primary `teal-600`, background ivory `#FFFDF7`).
- **Offline-first**: setiap daftar tampilkan cache dulu, refresh di belakang;
  aksi tulis offline masuk antrian.
- **Penamaan**:
  - File: `kebab-case` (mis. `pesanan-form.tsx`)
  - Komponen React: `PascalCase` (mis. `PesananForm`)
  - Kolom sheet & key payload: `snake_case` (mis. `tgl_makan`)
  - Konstanta: `SCREAMING_SNAKE_CASE` (mis. `ACTION_MAP`, `CONFIG`)
- **Komentar business logic** ditulis **Bahasa Indonesia**.
- **Commit**: **Conventional Commits berbahasa Indonesia**
  (`feat: tambah endpoint pesanan.create`, `fix: perbaiki hitung jml_taruna`,
  `chore: ...`, `docs: ...`).

---

## 3. Aturan Uang

- **Semua nilai uang adalah integer rupiah. TIDAK ADA float.**
- Perkalian nominal (`hari_makan × harga_per_porsi × porsi_per_hari`) dan
  penjumlahan total selalu menghasilkan/di-`Math.round` ke integer.
- Jangan pernah menyimpan atau menampilkan pecahan rupiah.

---

## 4. Aturan Keamanan

- **Role dicek di GAS (backend), BUKAN di frontend.** Frontend hanya
  menyembunyikan menu; otorisasi sebenarnya di `ACTION_MAP.roles`.
- **Rekening taruna hanya 4 digit terakhir** (`rek_mask`, pola `••••1234`).
  **NOMOR REKENING LENGKAP DILARANG MASUK SISTEM** — validasi menolak input
  yang terlihat seperti nomor rekening penuh. Konversi ke 4 digit dilakukan di
  luar sistem sebelum impor.
- **Setiap aksi tulis** wajib:
  - dibungkus **`LockService`** (`withLock`), dan
  - mencatat satu baris **`AUDIT_LOG`** (`data_lama` / `data_baru`).
- Token kedaluwarsa 24 jam; rate limit login 5x gagal → blokir 15 menit.
- Error tak terduga TIDAK membocorkan stack trace ke klien.

---

## 5. Aturan Snapshot

Nilai berikut ditulis **sistem sekali** saat transisi status, lalu **beku** —
**tidak boleh diedit manual** (spreadsheet AUDIT_LOG & SURAT_PERINGATAN
diproteksi warning-only):

- **`PESANAN.jml_taruna`** — dihitung saat `pesanan.create` (taruna AKTIF −
  status harian), koreksi manual hanya dengan `catatan` wajib.
- **`TAGIHAN.nominal`** — snapshot dari `REKAP_BULANAN` (harus FINAL) saat
  `tagihan.create`.
- **`REKAP_BULANAN`** (hari_makan, nominal, dst.) — materialized view yang
  hanya di-update sistem untuk bulan berjalan; ditolak bila status `FINAL`.
- **`PEMBAYARAN.nilai_total`** — snapshot SUM(nominal) rekap FINAL.

---

## 6. Perintah Penting

**Backend (dari `backend/`):**
```bash
clasp push                    # unggah src/ ke Apps Script (BUKAN deploy)
clasp deploy                  # buat versi deployment baru
clasp open                    # buka editor GAS di browser
```
> `clasp push` ≠ deploy. Setelah push, refresh deployment test. URL produksi
> baru diganti pada TAHAP 8.

**Frontend (dari `frontend/`, mulai TAHAP 5):**
```bash
npm run dev                   # server pengembangan lokal
npm run build                 # build produksi ke dist/
npm run deploy                # deploy ke GitHub Pages
```

---

## Aturan Main Eksekusi (pegang di tiap sesi)

1. **Satu tahap = satu sesi = satu commit-set.** Selesaikan `KRITERIA SELESAI`
   sebelum pindah tahap. Jangan "sekalian" mengerjakan tahap berikutnya.
2. Jangan menyimpang dari skema. Perubahan kolom/nama **harus** lewat revisi
   `docs/skema-sheet.md` dulu.
3. Uji berurutan: **GAS editor → curl → UI**.
4. Data taruna riil **tidak boleh** masuk sebelum TAHAP 8. Uji pakai dummy.
5. Kebijakan tagihan (tenggat 7/7/3, penandatangan PPK/PPK/KPA,
   ESKALASI_MANUAL) ada di `CONFIG.SP` — ubah konfigurasi, bukan kode.
