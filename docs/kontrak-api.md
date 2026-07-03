# Kontrak API e-BAMA — GAS Web App

> **Satu sumber kebenaran endpoint.** Perubahan endpoint hanya lewat revisi
> file ini. Skema data merujuk `docs/skema-sheet.md`.

## Transport

- **Endpoint tunggal:** URL Web App GAS (`doPost`), health check via `doGet`.
- **Request:** HTTP POST, body `text/plain` berisi JSON (menghindari preflight CORS):

```json
{ "action": "pesanan.create", "token": "uuid-sesi", "payload": { } }
```

- **Response — amplop seragam:**

```json
{ "ok": true,  "data": {  } }
{ "ok": false, "error": "Pesan kesalahan Bahasa Indonesia" }
```

- `auth.login` adalah satu-satunya action tanpa token.
- **Role diperiksa di GAS** (routing table `ACTION_MAP {action: {handler, roles}}`), bukan di frontend.
- Semua aksi tulis: dibungkus `LockService` + append `AUDIT_LOG`. Tanpa pengecualian.
- Error tak terduga: dicatat AUDIT_LOG aksi=`ERROR`, balasan generik tanpa stack trace.
- Upload file: field `berkas: {base64, nama_file, jenis}` di payload → `lampiranSave()`; maks 5 MB.

## Daftar Action

### Auth

| Action | Role | Payload → Data | Keterangan |
|---|---|---|---|
| `auth.login` | publik | `{user_id, pin}` → `{token, role, nama}` | gagal 5× → blokir 15 menit (CacheService) |
| `auth.logout` | semua | `{}` | hapus token |
| `auth.change_pin` | semua | `{pin_lama, pin_baru}` | pin_lama wajib benar; pin 6 digit |

### Master (Admin)

Modul: `taruna.*` → `10_taruna.gs`; `penyedia.*`, `kontrak.*` & `menu.*` → `05_master.gs`;
`pengguna.*` → `02_auth.gs`.

| Action | Role | Keterangan |
|---|---|---|
| `taruna.list` | semua login | filter `{status?, prodi?, tingkat?, kelas?}` |
| `taruna.upsert` | ADMIN | tolak `rek_mask` yang memuat >4 digit angka (indikasi rekening lengkap) |
| `penyedia.list` | semua login | |
| `penyedia.upsert` | ADMIN, PPK | |
| `kontrak.list` | semua login | |
| `kontrak.get` | semua login | `{kontrak_id}` → `{kontrak, lampiran}` |
| `kontrak.upsert` | PPK | hanya boleh diubah selama `DRAFT` |
| `kontrak.approve` | PPK | `DRAFT → DISETUJUI_PPK` (SOP no. 4) |
| `kontrak.lampiran_upload` | PPK | `{kontrak_id, berkas:{base64,nama_file,jenis}}` — menu & nilai gizi (`jenis=MENU_GIZI`), BA penunjukan (`BA`), notulen (`NOTULEN`); boleh kapan saja |
| `menu.list` | semua login | `{kontrak_id}` → `{menu: [...]}` urut Senin→Minggu |
| `menu.upsert` | PPK | `{kontrak_id, hari, menu_pagi, menu_siang, menu_malam}` — menu mingguan terjadwal (referensi hari-dalam-minggu, bukan snapshot tanggal); kunci gabungan (kontrak_id, hari) |
| `pengguna.list` / `pengguna.upsert` / `pengguna.reset_pin` | ADMIN | |

### Status Harian (SOP: Peringatan no. 2)

| Action | Role | Keterangan |
|---|---|---|
| `status.set` | ADMIN, PEMBINA | upsert per (tanggal, nit) |
| `status.batch` | ADMIN, PEMBINA | input massal (mis. satu kelas pesiar) |
| `status.list` | semua login | per rentang tanggal |

### Pesanan (SOP no. 5–7) — mesin status `DRAFT → DIAJUKAN → (DIKEMBALIKAN | DISETUJUI) → TERKIRIM`

> PPK menyetujui `REKAP_BULANAN`, bukan pesanan harian — lihat bagian Rekap Bulanan.

| Action | Role | Keterangan |
|---|---|---|
| `pesanan.create` | SENAT | tgl_makan unik; `jml_taruna` otomatis (AKTIF − STATUS_HARIAN), koreksi manual wajib catatan; simpan snapshot |
| `pesanan.submit` | SENAT | `DRAFT → DIAJUKAN`; hanya pembuat |
| `pesanan.verify` | PEMBINA | `DIAJUKAN → DISETUJUI` (SOP no. 6) |
| `pesanan.return` | PEMBINA | `DIAJUKAN → DIKEMBALIKAN`; alasan wajib |
| `pesanan.kirim` | SENAT | `DISETUJUI → TERKIRIM`; hanya ≤ H-1 dari tgl_makan; lewat itu tolak → arahkan ke `pesanan.revisi` |
| `pesanan.revisi` | SENAT | pesanan baru ber-`revisi_dari` (SOP 7b); wajib lampiran BA perubahan |
| `pesanan.list` / `pesanan.get` | semua login | |

Transisi ilegal → error eksplisit (mis. "Pesanan berstatus DRAFT, tidak bisa diverifikasi").

### Realisasi (SOP no. 8–9)

| Action | Role | Keterangan |
|---|---|---|
| `realisasi.create` | PEMBINA, SENAT | pesanan wajib TERKIRIM; porsi, ketidaksesuaian, geotag; foto via lampiran `jenis=FOTO` |
| `realisasi.ttd` | PEMBINA, SENAT | mengisi `ttd_{role}_at` miliknya (konfirmasi PIN); kedua ttd terisi → otomatis `rekapUpdate(tanggal)` |
| `realisasi.list` | semua login | |

### Rekap Bulanan (SOP no. 10)

| Action | Role | Keterangan |
|---|---|---|
| `rekap.get` | PPK, KPA, WADIR3 | per bulan |
| `rekap.verify` | PPK | `DRAFT → TERVERIFIKASI_PPK` |
| `rekap.final` | PPK | `→ FINAL` — beku, dasar SPM; update berikutnya ditolak |
| `rekap.approve_wadir3` | WADIR3 | `FINAL → DISETUJUI_WADIR3` — otorisasi pencairan (bukan koreksi angka); syarat `bayar.create` |

`rekapUpdate(tanggal)` internal (bukan action publik): incremental per hari, uang integer.

### Pembayaran (SOP no. 11–17) — mesin status `DIAJUKAN → SP2D_TERBIT → DITRANSFER → DIKONFIRMASI → SELESAI`

> Pembayaran mencakup pencairan ke rekening taruna (SP2D dari KPPN) yang lalu
> auto-debet ke rekening Senat → penyedia — satu mekanisme LS, satu approval
> Wadir 3 di gerbang `rekap.approve_wadir3` mencakup keduanya.

| Action | Role | Keterangan |
|---|---|---|
| `bayar.create` | PPK | syarat REKAP bulan tsb `DISETUJUI_WADIR3`; `nilai_total` = SUM(nominal) snapshot |
| `bayar.update` | PPK | isi no_spm/tgl_spm, no_sp2d/tgl_sp2d — status naik sesuai urutan; lampiran surat blokir / bukti debet / invoice |
| `bayar.confirm` | SENAT | `DITRANSFER → DIKONFIRMASI` (SOP 15–16) |
| `bayar.close` | PPK | `→ SELESAI` (SOP 17) |
| `bayar.list` / `bayar.get` | PPK, KPA, SENAT, WADIR3 | |

### Tagihan Gagal Debet — status `TERTAGIH → LUNAS | DIHAPUSKAN | ESKALASI_MANUAL`

| Action | Role | Keterangan |
|---|---|---|
| `tagihan.create` | SENAT, PPK | batch `{bulan, nit[], sebab}`; nominal snapshot dari REKAP FINAL; tolak duplikat bulan+nit; **langsung terbitkan SP-1** |
| `tagihan.list` | semua login | sertakan `level_aktif` (MAX level SP) + `tenggat_aktif`; cache 60 detik, invalidate saat tulis |
| `tagihan.summary` | PPK, KPA, WADIR3 | `{per_level: {0..3: {jumlah, nominal}}, total_outstanding}` — dashboard piutang |
| `tagihan.setor` | SENAT | bukti setor (`jenis=BUKTI_SETOR`) + tgl_setor; status tetap TERTAGIH |
| `tagihan.verify` | PPK | syarat bukti setor ada → `LUNAS` |
| `tagihan.waive` | PPK | `catatan_hapus` WAJIB → `DIHAPUSKAN` |
| `tagihan.regenerate_sp` | PPK | terbitkan ulang PDF level aktif — no_surat BARU, baris SP baru, `generated_by=MANUAL` |
| `sp.list` | semua login | riwayat SP per tagihan |

### Laporan & Audit

| Action | Role | Keterangan |
|---|---|---|
| `laporan.bulanan` | PPK, KPA, WADIR3 | ringkasan rekap + realisasi + pembayaran + piutang per bulan (SOP 17–19); format menyesuaikan Laporan Bulanan BAMA |
| `audit.list` | ADMIN, PPK, KPA, WADIR3 | filter `{dari?, sampai?, user_id?, aksi?}`; dibatasi 500 baris terbaru |

## Proses internal terjadwal (bukan action HTTP)

| Fungsi | Jadwal | Keterangan |
|---|---|---|
| `eskalasiTagihan()` | harian 06.00 WIT | TAGIHAN `TERTAGIH` lewat tenggat SP aktif: level 1→terbit SP-2, 2→SP-3, 3→status `ESKALASI_MANUAL`. **Idempotent** — SP level target sudah ada → lewati |
| `backupMingguan()` | mingguan | copy spreadsheet ke Drive `e-BAMA/BACKUP` |

## Konfigurasi kebijakan (`00_config.gs` → `CONFIG.SP`)

| Kunci | Default | Keterangan |
|---|---|---|
| `TENGGAT_HARI` | `{1:7, 2:7, 3:3}` | hari kalender per level SP |
| `PENANDATANGAN` | `{1:'PPK', 2:'PPK', 3:'KPA'}` | PPK: Firdaus Dabamona, S.T., NIP 198201032007011002; KPA: Daniel Heintje Ndahawali, S.Pi., M.Si., NIP 197207172002121003 |
| `JAM_TRIGGER` | `6` | jam trigger eskalasi, Asia/Jayapura |

Nilai di atas kebijakan internal — ubah lewat konfigurasi, bukan kode.

**Pola override:** nilai di kode adalah DEFAULT. Bila Script Properties memuat
kunci `SP_TENGGAT_HARI`, `SP_PENANDATANGAN`, atau `SP_JAM_TRIGGER` (JSON),
nilai properties menggantikan default (merge per-kunci). Ubah via
`setKebijakanSP(obj)` dari editor GAS. Semua modul membaca kebijakan lewat
`getKebijakanSP()` — **dilarang** membaca `CONFIG.SP` langsung.

## Format nomor surat SP

```
B-{urut}/PKPS/SP{level}/{bulan-romawi}/{tahun}
```

Counter `{urut}` per level di Script Properties, tidak pernah mundur.
Placeholder template Doc: `{{NO_SURAT}} {{TGL_SURAT}} {{NAMA}} {{NIT}}
{{PRODI_TINGKAT}} {{BULAN}} {{NOMINAL}} {{NOMINAL_TERBILANG}} {{REK_SENAT}}
{{TENGGAT}} {{PENANDATANGAN_NAMA}} {{PENANDATANGAN_NIP}}`.
