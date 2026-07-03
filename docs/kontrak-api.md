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
| `taruna.upsert` | ADMIN, BAAK | tolak `rek_mask` yang memuat >4 digit angka (indikasi rekening lengkap); BAAK (Biro Administrasi Akademik & Kemahasiswaan) berdampingan dengan Admin — sumber otoritatif data NIT/akademik |
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
| `status.set` | ADMIN, PEMBINA, BAAK | upsert per (tanggal, nit); BAAK dipakai untuk surat taruna keluar kampus (PKL) & surat penarikan kembali, lampirkan lewat `berkas` |
| `status.batch` | ADMIN, PEMBINA, BAAK | input massal (mis. satu kelas pesiar) |
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
| `rekap.input_historis` | PPK, ADMIN | `{bulan, biaya_per_hari, baris:[{nit,hari_makan,hari_tidak_makan?}]}` — migrasi bulan pra-aplikasi (mis. Januari–Juni sebelum e-BAMA aktif), TANPA Pesanan/Realisasi harian palsu; `biaya_per_hari` = satu angka Rp/hari (bukan harga_per_porsi × porsi_per_hari) karena rate historis bisa beda per kelompok — panggil berkali-kali per kelompok rate untuk bulan yang sama; tolak bila bulan itu sudah punya baris bukan `DRAFT`; jejak sumber di AUDIT_LOG (`sumber: INPUT_HISTORIS_PRA_APLIKASI`), lanjut alur normal `rekap.verify → rekap.final → rekap.approve_wadir3` |

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
| `laporan.bulanan` | PPK, KPA, WADIR3, ADMIN | ringkasan rekap + realisasi + pembayaran + piutang per bulan (SOP 17–19); format menyesuaikan Laporan Bulanan BAMA |
| `laporan.resmi` | PPK, KPA, WADIR3, ADMIN | data untuk format "Laporan Bulanan Pemantauan & Evaluasi Bantuan Biaya Makan" resmi (acuan Itjen/KKP) — HANYA bagian Dalam Kampus yang dilacak e-BAMA (info umum, data penerima, realisasi, penggunaan dana, sebagian permasalahan); bagian DIPA/SK/rencana anggaran/Pengusulan diisi manual di halaman cetak, TIDAK tersimpan di server |

### Bantuan Luar Kampus (PKL/Magang/KPA/PTB)

Modul: `blk.*` → `19_bantuan_luar_kampus.gs`. Mekanisme transfer tunai
langsung (BUKAN lewat kontrak penyedia) — `nilai_per_hari` bisa beda per
individu per wilayah penempatan. Ketua Jurusan & panitia menyusun rekap di
luar sistem; diajukan ke PPK untuk diinput. Catatan murni, tanpa alur status.

| Action | Role | Keterangan |
|---|---|---|
| `blk.list` | PPK, ADMIN, KPA, WADIR3 | filter `{bulan?, kegiatan?}` → `{bantuan, total}` |
| `blk.import` | PPK, ADMIN | `{baris:[{nit, kegiatan, bulan, periode, total_hari, nilai_per_hari, pembayaran_ke, keterangan?}]}` — upsert kunci gabungan (nit, kegiatan, bulan, pembayaran_ke), aman diimpor ulang |
| `audit.list` | ADMIN, PPK, KPA, WADIR3 | filter `{dari?, sampai?, user_id?, aksi?}`; dibatasi 500 baris terbaru |

### Cetak Form Manual SOP (Form 01–08) — USULAN, belum diimplementasi

> **Belum ada di `ACTION_MAP`.** Ini rancangan untuk tahap berikutnya (satu
> tahap = satu sesi, per Aturan Main Eksekusi `CLAUDE.md`) — modul rencana
> `backend/src/21_cetak.gs`. Peta form ↔ sumber data lengkap:
> `docs/format-dokumen.md`. Pola tampilan cetak (React): rujuk
> `frontend/src/pages/laporan/laporan-resmi.tsx` — satu action GET-style per
> form → data bundel lengkap, halaman merender semua bagian dengan kelas
> `print:hidden`/`print:block`, tombol Cetak = `window.print()`.
>
> **Rekening lengkap (Form-07 & Form-08 saja):** dibaca dari sheet baru
> `TARUNA_REKENING` (usulan — lihat `docs/skema-sheet.md` § D). Role **ADMIN,
> PPK SAJA** — backend menolak role lain secara eksplisit, bukan cuma
> disembunyikan di frontend. Setiap panggilan `cetak.form07`/`cetak.form08`
> WAJIB menulis 1 baris `AUDIT_LOG` berisi **daftar NIT** yang rekeningnya
> ikut terbaca (bukan nomor rekeningnya) — pengecualian dari aturan "hanya
> aksi tulis yang diaudit", karena di sini aksi **baca** pun wajib dicatat.

| Action | Role | Payload → Data | Status kecocokan data |
|---|---|---|---|
| `cetak.form01` | SENAT, PEMBINA, PPK, KPA | `{pesanan_id}` → `{pesanan, kontrak, jml_taruna_aktif, status_harian_terkait:[...], dibuat_oleh_nama, diverifikasi_oleh_nama}` — Rencana & Persetujuan Pemesanan Harian (H-1); sumber PESANAN+STATUS_HARIAN+KONTRAK | ✅ cocok penuh |
| `cetak.form02` | SENAT, PEMBINA | `{tanggal}` → `{tanggal, taruna:[{nit,nama,prodi,tingkat,kelas}]}` — lembar Daftar Hadir/Tanda Terima Makan KOSONG untuk paraf kertas; sumber TARUNA aktif per tanggal | ✅ cocok penuh (hasil scan tetap diunggah via `realisasi.create`/`lampiran`, bukan action ini) |
| `cetak.form03` | PEMBINA, BAAK, ADMIN, PPK, KPA | `{bulan}` → `{bulan, baris:[{nit,nama,status,tanggal,lampiran:[...]}]}` — Rekap Taruna Tidak Menerima Makan; sumber STATUS_HARIAN+LAMPIRAN | ✅ cocok penuh |
| `cetak.form04` | PPK, KPA, WADIR3, ADMIN | `{bulan}` → `{bulan, baris:[{tanggal,porsi_dipesan,porsi_terealisasi,ketidaksesuaian}], total_dipesan, total_terealisasi}` — Rekapitulasi Bulanan Porsi Makan; sumber PESANAN+REALISASI | ✅ cocok penuh |
| `cetak.form05` | PPK, KPA, WADIR3 | `{bulan}` → `{bulan, titik1_taruna_x_hari, titik2_total_pesanan, titik3_total_realisasi, selisih, cocok:boolean}` — BA Rekonsiliasi 3 Titik; sumber TARUNA(aktif×hari efektif)+PESANAN+REALISASI | ✅ cocok — pastikan "hari efektif" konsisten dgn `jml_hari_efektif` di `laporan.resmi` |
| `cetak.form06` | PPK | `{bayar_id}` → `{pembayaran, rekap_ringkas, nominal_terbilang, checklist:[...]}` — Verifikasi & Rencana Pembayaran PPK; sumber PEMBAYARAN+REKAP_BULANAN | ⚠️ perlu fungsi util baru `_terbilang_()` (angka→teks Indonesia) — belum ada di `03_helpers.gs` |
| `cetak.form07` | **ADMIN, PPK SAJA** (backend tolak role lain) | `{bayar_id}` → `{pembayaran, baris:[{nit,nama,bank,rekening_lengkap,nominal}]}` — Usulan Penahanan & Pendebetan Bank; sumber PEMBAYARAN+REKAP_BULANAN+**TARUNA_REKENING (baru)** | ❌ perlu sheet `TARUNA_REKENING` dulu sebelum bisa diimplementasi |
| `cetak.form08` | **ADMIN, PPK SAJA** (backend tolak role lain) | `{bulan, kegiatan?}` → `{bulan, kegiatan, baris:[{nit,nama,bank,rekening_lengkap,kegiatan,total_hari,nilai_per_hari,nominal}], total}` — Usulan Pembayaran Luar Kampus (PKL/Magang/KPA/PTB); sumber BANTUAN_LUAR_KAMPUS+**TARUNA_REKENING (baru)** | ⚠️ kegiatan/hari/nilai sudah ada (BANTUAN_LUAR_KAMPUS); `rekening_lengkap` perlu sheet baru sama seperti form07 |

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
