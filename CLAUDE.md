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
Database : Google Spreadsheet — 17 sheet (skema 3NF + 3 snapshot)
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
- **Rekening taruna hanya 4 digit terakhir** (`rek_mask`, pola `••••1234`) di
  sheet TARUNA dan di **SEMUA** action/tampilan lain — validasi menolak input
  yang terlihat seperti nomor rekening penuh lewat `taruna.upsert` maupun impor
  CSV Taruna. **Satu-satunya pengecualian:** sheet terpisah `TARUNA_REKENING`
  (lihat `docs/skema-sheet.md` §16) yang menyimpan nomor rekening PENUH,
  dibaca/ditulis HANYA lewat dua action `rekening.lihat_lengkap` (role ADMIN,
  PPK) dan `rekening.simpan` (role ADMIN saja) — bukan lewat `taruna.upsert`.
  Setiap panggilan `rekening.lihat_lengkap` yang berhasil WAJIB mencatat satu
  baris AUDIT_LOG (siapa melihat rekening siapa, kapan — TANPA nomor
  rekeningnya sendiri), sebuah pengecualian dari aturan umum "hanya aksi tulis
  yang diaudit" karena sensitivitas datanya. Lihat § 7.
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

> Implementasi bertahap untuk 10 form resmi (`docs/format-dokumen.md`) —
> **semua 10 form sudah diimplementasi** (lihat tabel status di bawah).
> Perubahan lebih lanjut ke form-form ini tetap dikerjakan sebagai TAHAP
> tersendiri (satu tahap = satu sesi, per Aturan Main Eksekusi) — jangan
> gabung perubahan form dengan perubahan skema di sesi yang sama.

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
disengaja) — **sudah diimplementasi**:
- Sheet TERPISAH `TARUNA_REKENING` (lihat `docs/skema-sheet.md` §16),
  TERPISAH dari `TARUNA.rek_mask` yang tetap 4 digit untuk semua hal lain
  (dashboard, laporan, `taruna.list`, dst).
- Dua action khusus (`22_rekening.gs`): `rekening.lihat_lengkap` (role ADMIN,
  PPK — dipakai internal `cetak.form07`/`cetak.form08`) dan `rekening.simpan`
  (role **ADMIN SAJA**, supaya input data sensitif ini tetap satu pintu) —
  bukan CRUD generik, keduanya diperiksa role dua kali: `ACTION_MAP.roles`
  DAN helper `_hanyaAdminPPK_(session)` di dalam handler.
- WAJIB 1 baris `AUDIT_LOG` tiap panggilan `rekening.lihat_lengkap` yang
  berhasil (BACA, bukan cuma tulis) — catat NIT yang terbaca, JANGAN catat
  nomor rekeningnya di `AUDIT_LOG`.
- Tidak ada form isi bebas di halaman Taruna biasa — pengisian rekening
  lengkap lewat modal terpisah "🔒 Rekening" di `/taruna` yang HANYA tampil
  untuk role ADMIN (frontend hiding only; backend tetap menegakkan lewat
  `rekening.simpan` roles:['ADMIN']). Sheet diproteksi warning-only (seperti
  `AUDIT_LOG`).

**8 Form** (detail lengkap: `docs/kontrak-api.md` § Cetak Form Manual SOP;
peta asal per form: `docs/format-dokumen.md`):

| Form | Nama | Sheet sumber | Status |
|---|---|---|---|
| 01 | Rencana & Persetujuan Pemesanan Harian (H-1) | PESANAN, STATUS_HARIAN, KONTRAK | ✅ diimplementasi |
| 02 | Daftar Hadir / Tanda Terima Makan | TARUNA, STATUS_HARIAN, REALISASI | ✅ diimplementasi — tanpa presensi individual (dikonfirmasi Firdaus): ttd digital REALISASI jadi bukti, bukan paraf per-taruna |
| 03 | Rekap Taruna Tidak Menerima Makan | STATUS_HARIAN, LAMPIRAN | ✅ diimplementasi |
| 04 | Rekapitulasi Bulanan Porsi Makan | PESANAN, REALISASI, KONTRAK | ✅ diimplementasi — total porsi/hari agregat (dikonfirmasi Firdaus), tanpa rincian Sarapan/Siang/Malam |
| 05 | BA Rekonsiliasi 3 Titik | TARUNA, PESANAN, REALISASI | ✅ diimplementasi |
| 06 | Verifikasi & Rencana Pembayaran PPK | PEMBAYARAN, REKAP_BULANAN | ✅ diimplementasi (`_terbilang_()` di `03_helpers.gs`) |
| 07 | Usulan Penahanan & Pendebetan Bank | PEMBAYARAN, REKAP_BULANAN, **TARUNA_REKENING** | ✅ diimplementasi; **ADMIN/PPK saja**, halaman TIDAK di-cache Dexie; **dipisah per bank (BSI/BNI)** + Lampiran Kuasa Blokir + TTD tiap taruna + rekening Senat tujuan + **Mengetahui Direktur & Wadir 3** |
| 08 | Usulan Pembayaran Luar Kampus | BANTUAN_LUAR_KAMPUS, STATUS_HARIAN, **TARUNA_REKENING** | ✅ diimplementasi — tarif dari `nilai_per_hari` (BANTUAN_LUAR_KAMPUS), jml hari dihitung ulang dari STATUS_HARIAN (dikonfirmasi Firdaus); **ADMIN/PPK saja**, halaman TIDAK di-cache Dexie |
| 09 | Pendebetan Rekening Senat → Penyedia (per bank) | PEMBAYARAN, REKAP_BULANAN, `TARUNA.bank`, `REKENING_INSTANSI` (Script Property) | ✅ diimplementasi — tahap-2 pembayaran (dokumen-only, mesin status pembayaran TIDAK diubah); role SENAT/PPK/ADMIN; **tidak baca TARUNA_REKENING** (rekening instansi, bukan rekening taruna); Mengetahui Direktur & Wadir 3 |
| 10 | Rencana Pengajuan SPM per Suplier | REKAP_BULANAN, TARUNA, **TARUNA_REKENING** (rekening PENUH + `penyedia_id`) | ✅ diimplementasi — **ADMIN/PPK saja**, halaman TIDAK di-cache Dexie, tiap panggilan 1 baris AUDIT_LOG; **dipecah per ID suplier** (tiap suplier = 1 lembar SPM) lalu dikelompokkan **prodi+tingkat** (dikonfirmasi Firdaus: angkatan sudah terwakili ID suplier); suplier per taruna dari `TARUNA_REKENING.penyedia_id` (nama di-join PENYEDIA, fallback tampil ID); TTD Senat/PPK + Mengetahui Direktur & Wadir 3 |

Semua 10 form sudah diimplementasi. Desain Form 02/04/08 sebelumnya sempat
menunggu konfirmasi eksplisit Firdaus (lihat riwayat sesi) — bukan asumsi
sendiri. Form 09 ditambahkan atas permintaan Firdaus (alur pendebetan 2 tahap:
taruna→Senat lalu Senat→Penyedia, rekening masing-masing 2 bank BNI/BSI);
keputusan "dokumen dulu, mesin status tetap, SELESAI tutup manual PPK". Form 10
menambahkan pemecahan pengajuan SPM ke KPPN **per ID suplier** lalu prodi+tingkat
(dikonfirmasi Firdaus) + kolom `penyedia_id` di TARUNA_REKENING (suplier per
rekening taruna). Catatan data riil: `penyedia_id` bisa berupa kode suplier
eksternal (mis. 7 digit dari SPAN), bukan hanya `PNY-xxxxxx` — supaya `Form-10`
menampilkan NAMA suplier (bukan cuma ID), sheet PENYEDIA harus memuat baris ber-ID
tsb; kalau tidak, Form-10 tetap mengelompokkan per ID.

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
