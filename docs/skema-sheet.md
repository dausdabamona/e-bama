# Skema Database e-BAMA — Google Spreadsheet (13 Sheet)

> **Satu sumber kebenaran skema.** Perubahan skema hanya lewat revisi file ini,
> bukan langsung di kode. Nama sheet dan kolom: `snake_case`, dikunci di
> `00_config.gs` objek `SHEETS`.
>
> Normalisasi: 3NF, dengan **3 denormalisasi snapshot yang disengaja**
> (ditandai 📸) — ditulis sistem SEKALI saat transisi status, dilarang diedit
> manual, momen penulisan tercatat di AUDIT_LOG.
>
> Semua nilai uang: **integer rupiah** (tanpa desimal, tanpa float).
> Semua file/berkas: **hanya** lewat sheet LAMPIRAN (polymorphic) — tidak ada
> kolom file ID di sheet lain.

---

## A. MASTER

### 1. PENGGUNA

| Kolom | Tipe | Keterangan |
|---|---|---|
| user_id | string | kunci; kode singkat, mis. `ppk01`, `senat01` |
| nama | string | |
| role | enum | `KPA` / `PPK` / `SENAT` / `PEMBINA` / `ADMIN` / `WADIR3` |
| pin_hash | string | SHA-256(pin + SALT); SALT di Script Properties |
| token | string | token sesi aktif (UUID) |
| token_exp | datetime | kadaluarsa 24 jam sejak login |
| status | enum | `AKTIF` / `NONAKTIF` |

### 2. TARUNA

| Kolom | Tipe | Keterangan |
|---|---|---|
| nit | string | kunci; Nomor Induk Taruna |
| nama | string | |
| prodi | string | |
| tingkat | string | |
| kelas | string | |
| bank | enum | `BNI` / `BSI` |
| rek_mask | string | **HANYA 4 digit terakhir** (mis. `••••4821`). Nomor rekening lengkap DILARANG masuk sistem — arsip lengkap dipegang PPK di luar aplikasi (tindak lanjut temuan Itjen III) |
| status | enum | `AKTIF` / `NONAKTIF` |

### 3. PENYEDIA

| Kolom | Tipe | Keterangan |
|---|---|---|
| penyedia_id | string | kunci; `PNY-000001` |
| nama | string | |
| kontak | string | |
| alamat | string | |
| npwp_mask | string | 4 digit terakhir saja |
| status | enum | `AKTIF` / `NONAKTIF` |

### 4. KONTRAK

| Kolom | Tipe | Keterangan |
|---|---|---|
| kontrak_id | string | kunci; `KTR-000001` |
| penyedia_id | FK → PENYEDIA | |
| harga_per_porsi | integer | rupiah |
| porsi_per_hari | integer | umumnya 3 (pagi/siang/malam) |
| tgl_mulai | date | |
| tgl_akhir | date | |
| status | enum | `DRAFT` / `DISETUJUI_PPK` |
| approved_by | FK → PENGGUNA | |
| approved_at | datetime | |

Lampiran kontrak (menu & nilai gizi, BA penunjukan penyedia, notulen rapat) → LAMPIRAN `ref_type=KONTRAK`.

---

## B. TRANSAKSI

### 5. STATUS_HARIAN

Taruna yang TIDAK berhak makan pada tanggal tertentu (SOP: Peringatan no. 2).

| Kolom | Tipe | Keterangan |
|---|---|---|
| status_id | string | kunci; `STH-000001` |
| tanggal | date | |
| nit | FK → TARUNA | unik per (tanggal, nit) — upsert |
| status | enum | `PESIAR` / `CUTI` / `SAKIT_RUMAH` / `PENUNDAAN_STUDI` / `KEGIATAN_LUAR_KAMPUS` (PKL/Magang/KPA — Form-03) |
| input_by | FK → PENGGUNA | |
| timestamp | datetime | |

Surat pendukung → LAMPIRAN `ref_type=STATUS_HARIAN`.

### 6. PESANAN

Pre-Order H-1, satu pesanan per hari (SOP no. 5–7).
Mesin status: `DRAFT → DIAJUKAN → (DIKEMBALIKAN | DISETUJUI) → TERKIRIM`.

> **Koreksi (dikonfirmasi pemilik produk):** PPK **tidak** menyetujui pesanan
> harian — PPK menyetujui `REKAP_BULANAN` (lihat sheet 13). Pembina adalah
> satu-satunya verifikator pesanan sebelum dikirim ke penyedia. Form-01
> mencantumkan tanda tangan PPK sebagai bagian arsip administratif, bukan
> gerbang persetujuan sistem per-hari.

| Kolom | Tipe | Keterangan |
|---|---|---|
| pesanan_id | string | kunci; `PSN-000001` |
| tgl_makan | date | **unik** — satu pesanan per hari |
| kontrak_id | FK → KONTRAK | kontrak aktif pada tgl_makan |
| jml_taruna 📸 | integer | snapshot: taruna AKTIF − STATUS_HARIAN tgl tsb; boleh dikoreksi manual dengan catatan wajib |
| menu | string | |
| catatan | string | wajib diisi bila jml_taruna ≠ hitungan otomatis |
| status | enum | `DRAFT` / `DIAJUKAN` / `DIKEMBALIKAN` / `DISETUJUI` / `TERKIRIM` |
| created_by | FK → PENGGUNA | Senat |
| verif_by | FK → PENGGUNA | Pembina |
| verif_at | datetime | |
| revisi_dari | FK → PESANAN | terisi bila pesanan ini revisi setelah TERKIRIM (SOP 7b); wajib lampiran BA perubahan |

### 7. REALISASI

Pendataan penyediaan makan harian (SOP no. 8–9).

| Kolom | Tipe | Keterangan |
|---|---|---|
| real_id | string | kunci; `REL-000001` |
| pesanan_id | FK → PESANAN | pesanan harus TERKIRIM |
| tanggal | date | |
| porsi_diterima | integer | |
| jml_taruna_makan | integer | |
| ketidaksesuaian | string | kosong bila sesuai |
| tindak_lanjut | string | dikembalikan / dilengkapi penyedia |
| geotag_lat | number | dari GPS browser |
| geotag_lng | number | |
| ttd_pembina_at | datetime | tanda tangan digital (konfirmasi PIN) |
| ttd_senat_at | datetime | idem; kedua ttd terisi → trigger rekapUpdate(tanggal) |

Foto dokumentasi (terkompres ±200KB) → LAMPIRAN `ref_type=REALISASI`, `jenis=FOTO`.

### 8. PEMBAYARAN

LS via KPPN (SOP no. 11–17).
Mesin status: `DIAJUKAN → SP2D_TERBIT → DITRANSFER → DIKONFIRMASI → SELESAI`.

| Kolom | Tipe | Keterangan |
|---|---|---|
| bayar_id | string | kunci; `BYR-000001` |
| bulan | string | `YYYY-MM`; unik per kontrak |
| kontrak_id | FK → KONTRAK | |
| nilai_total 📸 | integer | snapshot SUM(nominal) REKAP_BULANAN FINAL bulan tsb |
| no_spm | string | input manual PPK |
| tgl_spm | date | |
| no_sp2d | string | input manual PPK |
| tgl_sp2d | date | |
| konfirmasi_senat_at | datetime | invoice diterima penyedia (SOP 15–16) |
| status | enum | lihat mesin status di atas |

Surat blokir, bukti debet bank, invoice penyedia → LAMPIRAN `ref_type=PEMBAYARAN`.

### 9. TAGIHAN

Piutang gagal debet rekening taruna.
Status: `TERTAGIH → LUNAS | DIHAPUSKAN | ESKALASI_MANUAL`.

| Kolom | Tipe | Keterangan |
|---|---|---|
| tagihan_id | string | kunci; format `TGH-{yyyymm}-{nit}` — unik per bulan+taruna |
| bulan | string | `YYYY-MM` |
| nit | FK → TARUNA | |
| nominal 📸 | integer | snapshot dari REKAP_BULANAN (harus FINAL) saat tagihan dibuat |
| sebab | enum | `GAGAL_DEBET` / `SALDO_KURANG` / `REKENING_BERMASALAH` |
| status | enum | `TERTAGIH` / `LUNAS` / `DIHAPUSKAN` / `ESKALASI_MANUAL` |
| tgl_setor | date | tanggal taruna setor ke rekening Senat |
| diverifikasi_oleh | FK → PENGGUNA | PPK |
| catatan_hapus | string | WAJIB terisi bila status `DIHAPUSKAN` |

Bukti setor → LAMPIRAN `ref_type=TAGIHAN`, `jenis=BUKTI_SETOR`.
Level SP aktif TIDAK disimpan di sini — dibaca `MAX(level)` dari SURAT_PERINGATAN.

### 10. SURAT_PERINGATAN

Riwayat SP per tagihan — **append-only**; eskalasi = INSERT baris baru, bukan UPDATE.

| Kolom | Tipe | Keterangan |
|---|---|---|
| sp_id | string | kunci; `SP-000001` |
| tagihan_id | FK → TAGIHAN | |
| level | integer | 1 / 2 / 3 |
| no_surat | string | `B-{urut}/PKPS/SP{level}/{bulan-romawi}/{tahun}` |
| tgl_terbit | date | |
| tenggat | date | tgl_terbit + CONFIG.SP.TENGGAT_HARI[level] (default 7/7/3 hari kalender) |
| ditandatangani_oleh | enum | dari CONFIG.SP.PENANDATANGAN (default: SP1–2 `PPK`, SP3 `KPA`) |
| generated_by | enum | `SISTEM` (trigger eskalasi) / `MANUAL` (regenerate oleh PPK) |

PDF surat → LAMPIRAN `ref_type=SP`.

---

## C. PENDUKUNG

### 11. LAMPIRAN — satu-satunya rumah file (polymorphic)

| Kolom | Tipe | Keterangan |
|---|---|---|
| lamp_id | string | kunci; `LMP-000001` |
| ref_type | enum | `KONTRAK` / `STATUS_HARIAN` / `PESANAN` / `REALISASI` / `PEMBAYARAN` / `TAGIHAN` / `SP` |
| ref_id | string | ID baris pada sheet ref_type |
| jenis | enum | `FOTO` / `SURAT` / `BA` / `INVOICE` / `BUKTI_SETOR` / `BUKTI_DEBET` / `MENU_GIZI` / `NOTULEN` / `LAINNYA` |
| drive_file_id | string | file di folder Drive e-BAMA/LAMPIRAN (PDF SP di e-BAMA/SURAT_PERINGATAN) |
| nama_file | string | |
| uploaded_by | FK → PENGGUNA | |
| timestamp | datetime | |

Batas ukuran unggah: 5 MB per file.

### 12. AUDIT_LOG — append-only, dilarang edit/hapus

| Kolom | Tipe | Keterangan |
|---|---|---|
| timestamp | datetime | |
| user_id | FK → PENGGUNA | atau `SISTEM` untuk trigger |
| aksi | string | nama action API atau `ERROR` / `ESKALASI` |
| ref_type | string | |
| ref_id | string | |
| data_lama | string | JSON |
| data_baru | string | JSON |

### 13. REKAP_BULANAN 📸 — materialized view

Di-update **incremental** oleh `rekapUpdate(tanggal)` setiap REALISASI sah /
STATUS_HARIAN masuk — TIDAK dihitung ulang sebulan penuh (hindari timeout GAS
6 menit). Dibekukan saat FINAL (dasar SPM).

> **Gerbang persetujuan Wadir 3:** setelah PPK memfinalkan (`FINAL` — angka
> beku, dasar SPM), Wakil Direktur III harus menyetujui (`DISETUJUI_WADIR3`)
> sebelum PPK boleh membuat PEMBAYARAN (`bayar.create`). Ini otorisasi
> pencairan — bukan koreksi angka; nominal tidak berubah pada langkah ini.

| Kolom | Tipe | Keterangan |
|---|---|---|
| bulan | string | `YYYY-MM`; kunci gabungan (bulan, nit) |
| nit | FK → TARUNA | |
| hari_makan | integer | jumlah hari realisasi sah |
| hari_tidak_makan | integer | dari STATUS_HARIAN |
| nominal | integer | hari_makan × harga_per_porsi × porsi_per_hari (kontrak aktif) |
| status | enum | `DRAFT` / `TERVERIFIKASI_PPK` / `FINAL` / `DISETUJUI_WADIR3` |
| verif_by | FK → PENGGUNA | |
| verif_at | datetime | |

Setelah `FINAL`: semua update pada bulan tsb DITOLAK.

---

## Diagram relasi (ringkas)

```
PENYEDIA ─< KONTRAK ─< PESANAN ─< REALISASI ──▶ REKAP_BULANAN(📸 view)
TARUNA ──< STATUS_HARIAN                              │
TARUNA ──< TAGIHAN ─< SURAT_PERINGATAN                ├─▶ PEMBAYARAN
                                                      └─▶ TAGIHAN.nominal
LAMPIRAN (polymorphic) + AUDIT_LOG ── melintang semua tabel
```
