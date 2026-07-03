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
Database : Google Spreadsheet — 15 sheet (skema 3NF + 3 snapshot)
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
  luar sistem sebelum impor. **Satu-satunya pengecualian (usulan, belum
  diimplementasi):** sheet terpisah `TARUNA_REKENING` khusus Form-07/08,
  dibatasi ADMIN/PPK + wajib audit log tiap baca — lihat § 7.
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

## 7. Cetak Form Manual SOP

> Rancangan/keputusan desain untuk 8 form resmi (`docs/format-dokumen.md`).
> **Belum diimplementasi** (belum ada action, belum ada sheet baru) — sesi
> ini baru merancang skema + kontrak API supaya sesi berikutnya tidak perlu
> menggali ulang dari riwayat chat. Kerjakan sebagai TAHAP tersendiri (satu
> tahap = satu sesi, per Aturan Main Eksekusi).

**Pola format cetak** (rujukan: `frontend/src/pages/laporan/laporan-resmi.tsx`):
- Satu action `cetak.formNN` (GET-style) — payload kecil (id/bulan) → data
  bundel lengkap dari sheet terkait (lihat `docs/kontrak-api.md` § Cetak
  Form Manual SOP untuk rincian tiap form).
- Halaman cetak React merender SEMUA bagian; kelas `print:hidden` untuk
  kontrol layar (bulan-picker, tombol), `hidden ... print:block` untuk kop
  surat resmi yang HANYA tampil saat dicetak.
- Tombol Cetak = `window.print()` — CSS `@media print` di `index.css` sudah
  menyembunyikan header/sidebar/bottom-nav.
- Field yang datanya TIDAK dilacak sistem → kolom isian manual, state lokal
  React saja, TIDAK dikirim/disimpan ke server (isi ulang tiap kali cetak).

**Rekening lengkap — pengecualian TERBATAS dari § 4** (Form-07 & Form-08
SOP mewajibkan nomor rekening PENUH karena bank butuh itu untuk
debet/transfer; bukan pembatalan aturan mutlak § 4, tapi celah sempit yang
disengaja):
- Sheet BARU `TARUNA_REKENING` (usulan — lihat `docs/skema-sheet.md` § D),
  TERPISAH dari `TARUNA.rek_mask` yang tetap 4 digit untuk semua hal lain
  (dashboard, laporan, `taruna.list`, dst).
- Dibaca HANYA sebagai bagian internal `cetak.form07`/`cetak.form08` —
  TIDAK ADA action generik `rekening.get`/`rekening.list`.
- Role: **ADMIN & PPK SAJA** — ditolak backend untuk role lain (termasuk
  KPA/WADIR3/BAAK), bukan cuma disembunyikan di frontend.
- WAJIB 1 baris `AUDIT_LOG` tiap panggilan (BACA, bukan cuma tulis) — catat
  daftar NIT yang terbaca, JANGAN catat nomor rekeningnya di `AUDIT_LOG`.
- Tidak ada UI CRUD bebas untuk sheet ini — pengisian lewat proses migrasi
  terkontrol (pola `scripts/migrasi-taruna.md`), sheet diproteksi
  warning-only (seperti `AUDIT_LOG`).

**8 Form** (detail lengkap: `docs/kontrak-api.md` § Cetak Form Manual SOP;
peta asal per form: `docs/format-dokumen.md`):

| Form | Nama | Sheet sumber | Status data |
|---|---|---|---|
| 01 | Rencana & Persetujuan Pemesanan Harian (H-1) | PESANAN, STATUS_HARIAN, KONTRAK | ✅ cocok penuh |
| 02 | Daftar Hadir / Tanda Terima Makan | TARUNA | ✅ cocok penuh |
| 03 | Rekap Taruna Tidak Menerima Makan | STATUS_HARIAN, LAMPIRAN | ✅ cocok penuh |
| 04 | Rekapitulasi Bulanan Porsi Makan | PESANAN, REALISASI | ✅ cocok penuh |
| 05 | BA Rekonsiliasi 3 Titik | TARUNA, PESANAN, REALISASI | ✅ cocok |
| 06 | Verifikasi & Rencana Pembayaran PPK | PEMBAYARAN, REKAP_BULANAN | ⚠️ perlu fungsi `_terbilang_()` baru (belum ada) |
| 07 | Usulan Penahanan & Pendebetan Bank | PEMBAYARAN, REKAP_BULANAN, **TARUNA_REKENING (baru)** | ❌ perlu sheet baru dulu; **ADMIN/PPK saja** |
| 08 | Usulan Pembayaran Luar Kampus | BANTUAN_LUAR_KAMPUS, **TARUNA_REKENING (baru)** | ⚠️ kegiatan sudah ada, rekening perlu sheet baru; **ADMIN/PPK saja** |

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
