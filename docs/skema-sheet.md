# Skema Sheet e-BAMA — 13 Sheet (3NF + 3 Snapshot)

> ⚠️ **STATUS: DRAF REKONSTRUKSI — WAJIB DIREVIEW.**
> Lampiran skema asli tidak disertakan dalam PROMPT 0. Skema di bawah
> **direkonstruksi** dari detail yang tersebar di PROMPT 1–8 sebagai draf awal.
> Sesuai Aturan Main no.2, **skema hanya berubah lewat revisi dokumen ini**.
> Firdaus harap memverifikasi nama kolom, enum, dan tipe **sebelum TAHAP 1**.

Konvensi:
- Nama sheet: `SCREAMING_SNAKE_CASE` (baca dari `SHEETS` di `00_config.gs`).
- Nama kolom: `snake_case`, **baris 1 = header** (freeze, bold, bg `#E0F2F1`).
- Tipe `tanggal` = format `YYYY-MM-DD`; `timestamp` = datetime.
- **Uang selalu integer rupiah.**
- Kolom bertanda 🔒 = **snapshot** (ditulis sistem sekali, tak diedit manual).
- Kolom bertanda 🔑 = kunci/ID unik.

Ikhtisar 13 sheet:

| # | Sheet | Peran | Snapshot |
|---|-------|-------|----------|
| 1 | `PENGGUNA` | Akun & sesi login | — |
| 2 | `TARUNA` | Master data taruna | — |
| 3 | `STATUS_HARIAN` | Status tidak-makan harian | — |
| 4 | `PESANAN` | Pesanan makan (mesin status) | 🔒 jml_taruna |
| 5 | `REALISASI` | Realisasi penyerahan makan | — |
| 6 | `REKAP_BULANAN` | Materialized view bulanan | 🔒 seluruh baris |
| 7 | `PEMBAYARAN` | Pembayaran LS ke penyedia | 🔒 nilai_total |
| 8 | `TAGIHAN` | Tagihan gagal debet | 🔒 nominal |
| 9 | `SURAT_PERINGATAN` | Riwayat SP (append-only) | — |
| 10 | `LAMPIRAN` | Berkas polymorphic (Drive) | — |
| 11 | `AUDIT_LOG` | Jejak audit (append-only) | — |
| 12 | `KONTRAK` | Kontrak penyedia (harga/porsi) | — |
| 13 | `PENYEDIA` | Master data penyedia | — |

---

## 1. PENGGUNA

| Kolom | Tipe | Enum / Aturan |
|-------|------|---------------|
| `user_id` 🔑 | teks | mis. `kpa01`, `ppk01` |
| `nama` | teks | |
| `role` | enum | `KPA` \| `PPK` \| `SENAT` \| `PEMBINA` \| `ADMIN` |
| `pin_hash` | teks | SHA-256(pin + SALT) — jangan simpan PIN polos |
| `token` | teks | UUID sesi aktif (boleh kosong) |
| `token_exp` | timestamp | kedaluwarsa 24 jam |
| `status` | enum | `AKTIF` \| `NONAKTIF` |
| `dibuat_pada` | timestamp | |
| `diperbarui_pada` | timestamp | |

## 2. TARUNA

| Kolom | Tipe | Enum / Aturan |
|-------|------|---------------|
| `nit` 🔑 | teks | Nomor Induk Taruna |
| `nama` | teks | |
| `prodi` | teks | |
| `tingkat` | enum | `1` \| `2` \| `3` \| `4` |
| `rek_mask` | teks | pola `••••1234` / 4 digit terakhir — **tolak nomor lengkap** |
| `status` | enum | `AKTIF` \| `NONAKTIF` |
| `dibuat_pada` | timestamp | |
| `diperbarui_pada` | timestamp | |

## 3. STATUS_HARIAN

Satu taruna satu status per tanggal (upsert oleh Admin/Pembina).

| Kolom | Tipe | Enum / Aturan |
|-------|------|---------------|
| `status_id` 🔑 | teks | `STS-000001` |
| `nit` | teks | ref TARUNA |
| `tanggal` | tanggal | |
| `sebab` | enum | `PESIAR` \| `CUTI` \| `SAKIT` \| `PENUNDAAN` \| `DINAS` |
| `keterangan` | teks | |
| `dicatat_oleh` | teks | user_id |
| `dicatat_pada` | timestamp | |

## 4. PESANAN

Mesin status: `DRAFT → DIAJUKAN → (DIKEMBALIKAN | DISETUJUI) → TERKIRIM`.

| Kolom | Tipe | Enum / Aturan |
|-------|------|---------------|
| `pesanan_id` 🔑 | teks | `PSN-000001` |
| `tgl_makan` | tanggal | **unik** (satu pesanan per hari, kecuali revisi) |
| `jml_taruna` 🔒 | integer | AKTIF − STATUS_HARIAN; koreksi manual wajib `catatan` |
| `menu` | teks | |
| `status` | enum | `DRAFT` \| `DIAJUKAN` \| `DIKEMBALIKAN` \| `DISETUJUI` \| `TERKIRIM` |
| `catatan` | teks | wajib bila `jml_taruna` dikoreksi manual |
| `alasan_kembali` | teks | wajib saat `pesanan.return` |
| `verif_by` | teks | user_id Pembina |
| `verif_at` | timestamp | |
| `revisi_dari` | teks | `pesanan_id` asal (SOP 7b) |
| `dibuat_oleh` | teks | user_id Senat |
| `dibuat_pada` | timestamp | |
| `diperbarui_pada` | timestamp | |

## 5. REALISASI

| Kolom | Tipe | Enum / Aturan |
|-------|------|---------------|
| `realisasi_id` 🔑 | teks | `RLS-000001` |
| `pesanan_id` | teks | ref PESANAN (harus TERKIRIM) |
| `tgl_makan` | tanggal | |
| `porsi_diterima` | integer | |
| `jml_makan` | integer | jumlah taruna yang makan |
| `ketidaksesuaian` | teks | |
| `tindak_lanjut` | teks | |
| `geotag` | teks | `lat,lng` |
| `ttd_pembina_at` | timestamp | diisi saat ttd Pembina |
| `ttd_senat_at` | timestamp | diisi saat ttd Senat |
| `dibuat_oleh` | teks | user_id |
| `dibuat_pada` | timestamp | |

> Foto realisasi disimpan di `LAMPIRAN` (`ref_type=REALISASI`, `jenis=FOTO`).

## 6. REKAP_BULANAN 🔒

Materialized view — **seluruh baris snapshot**, di-update sistem incremental
untuk bulan berjalan, ditolak bila `FINAL`.

| Kolom | Tipe | Enum / Aturan |
|-------|------|---------------|
| `rekap_id` 🔑 | teks | `RKP-{yyyymm}-{nit}` |
| `bulan` | teks | `YYYY-MM` |
| `nit` | teks | ref TARUNA |
| `nama` | teks | denormalisasi (materialized view) |
| `hari_makan` | integer | jumlah realisasi sah |
| `hari_tidak_makan` | integer | dari STATUS_HARIAN |
| `harga_per_porsi` 🔒 | integer | snapshot dari KONTRAK aktif |
| `porsi_per_hari` 🔒 | integer | snapshot dari KONTRAK aktif |
| `nominal` 🔒 | integer | `hari_makan × harga_per_porsi × porsi_per_hari` |
| `status` | enum | `DRAFT` \| `TERVERIFIKASI_PPK` \| `FINAL` |
| `verif_ppk_by` | teks | user_id PPK |
| `verif_ppk_at` | timestamp | |
| `final_at` | timestamp | |
| `diperbarui_pada` | timestamp | |

## 7. PEMBAYARAN

Status: `DIAJUKAN → SP2D_TERBIT → DITRANSFER → DIKONFIRMASI → SELESAI`.

| Kolom | Tipe | Enum / Aturan |
|-------|------|---------------|
| `bayar_id` 🔑 | teks | `BYR-{yyyymm}` |
| `bulan` | teks | `YYYY-MM` (rekap harus FINAL) |
| `nilai_total` 🔒 | integer | SUM(nominal) rekap FINAL |
| `status` | enum | `DIAJUKAN` \| `SP2D_TERBIT` \| `DITRANSFER` \| `DIKONFIRMASI` \| `SELESAI` |
| `no_spm` | teks | |
| `tgl_spm` | tanggal | |
| `no_sp2d` | teks | |
| `tgl_sp2d` | tanggal | |
| `konfirmasi_senat_at` | timestamp | diisi saat `bayar.confirm` |
| `dibuat_oleh` | teks | user_id PPK |
| `dibuat_pada` | timestamp | |
| `diperbarui_pada` | timestamp | |

## 8. TAGIHAN

Status: `TERTAGIH → LUNAS | DIHAPUSKAN | ESKALASI_MANUAL`.

| Kolom | Tipe | Enum / Aturan |
|-------|------|---------------|
| `tagihan_id` 🔑 | teks | `TGH-{yyyymm}-{nit}` |
| `bulan` | teks | `YYYY-MM` |
| `nit` | teks | ref TARUNA |
| `sebab` | teks | alasan gagal debet |
| `nominal` 🔒 | integer | snapshot REKAP_BULANAN (FINAL) |
| `status` | enum | `TERTAGIH` \| `LUNAS` \| `DIHAPUSKAN` \| `ESKALASI_MANUAL` |
| `tgl_setor` | tanggal | diisi saat `tagihan.setor` |
| `diverifikasi_oleh` | teks | user_id PPK |
| `catatan_hapus` | teks | **wajib** saat `tagihan.waive` |
| `dibuat_oleh` | teks | user_id |
| `dibuat_pada` | timestamp | |
| `diperbarui_pada` | timestamp | |

## 9. SURAT_PERINGATAN

Append-only (protect warning-only). Satu baris per penerbitan SP.

| Kolom | Tipe | Enum / Aturan |
|-------|------|---------------|
| `sp_id` 🔑 | teks | `SP-000001` |
| `no_surat` | teks | `B-{urut}/PKPS/SP{level}/{romawi}/{tahun}` |
| `tagihan_id` | teks | ref TAGIHAN |
| `level` | enum | `1` \| `2` \| `3` |
| `tgl_surat` | tanggal | |
| `tenggat` | tanggal | today + CONFIG.SP.TENGGAT_HARI[level] |
| `generated_by` | enum | `SISTEM` \| `MANUAL` |
| `drive_file_id` | teks | PDF di FOLDER_SP |
| `dibuat_pada` | timestamp | |

## 10. LAMPIRAN

Polymorphic — satu tabel untuk semua berkas.

| Kolom | Tipe | Enum / Aturan |
|-------|------|---------------|
| `lamp_id` 🔑 | teks | `LMP-000001` |
| `ref_type` | enum | `PESANAN` \| `REALISASI` \| `TAGIHAN` \| `PEMBAYARAN` \| `SP` \| `STATUS_HARIAN` |
| `ref_id` | teks | id entitas terkait |
| `jenis` | enum | `FOTO` \| `BA` \| `BUKTI_SETOR` \| `SURAT` \| `INVOICE` \| `BUKTI_DEBET` \| `SP` |
| `drive_file_id` | teks | |
| `nama_file` | teks | |
| `diunggah_oleh` | teks | user_id |
| `diunggah_pada` | timestamp | |

## 11. AUDIT_LOG

Append-only (protect warning-only). Ditulis setiap aksi tulis & error.

| Kolom | Tipe | Enum / Aturan |
|-------|------|---------------|
| `log_id` 🔑 | teks | `LOG-000001` |
| `waktu` | timestamp | |
| `user_id` | teks | `SISTEM` untuk aksi otomatis |
| `aksi` | teks | mis. `pesanan.create`, `ERROR` |
| `ref_type` | teks | |
| `ref_id` | teks | |
| `data_lama` | teks | JSON.stringify |
| `data_baru` | teks | JSON.stringify |

## 12. KONTRAK

Harga & porsi dasar perhitungan rekap.

| Kolom | Tipe | Enum / Aturan |
|-------|------|---------------|
| `kontrak_id` 🔑 | teks | `KTR-000001` |
| `no_kontrak` | teks | |
| `penyedia_id` | teks | ref PENYEDIA |
| `harga_per_porsi` | integer | rupiah |
| `porsi_per_hari` | integer | mis. 3 (pagi/siang/malam) |
| `tgl_mulai` | tanggal | |
| `tgl_selesai` | tanggal | |
| `status` | enum | `AKTIF` \| `NONAKTIF` |
| `dibuat_pada` | timestamp | |

## 13. PENYEDIA

| Kolom | Tipe | Enum / Aturan |
|-------|------|---------------|
| `penyedia_id` 🔑 | teks | `PYD-000001` |
| `nama` | teks | |
| `npwp` | teks | |
| `rek_no` | teks | rekening penyedia (bukan taruna) |
| `rek_bank` | teks | |
| `alamat` | teks | |
| `kontak` | teks | |
| `status` | enum | `AKTIF` \| `NONAKTIF` |
| `dibuat_pada` | timestamp | |
