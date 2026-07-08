# Skema Database e-BAMA — Google Spreadsheet (17 Sheet)

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
| role | enum | `KPA` / `PPK` / `SENAT` / `PEMBINA` / `ADMIN` / `WADIR3` / `BAAK` / `PENYEDIA` / `KETUA_JURUSAN` / `OPERATOR_SAKTI` |
| pin_hash | string | SHA-256(kata_sandi + SALT); SALT di Script Properties. Nama kolom dipertahankan (`pin_hash`) walau kredensialnya kini kata sandi bebas min 6 karakter (bukan PIN 6 digit) — hash sama, tak perlu migrasi |
| token | string | token sesi aktif (UUID) |
| token_exp | datetime | kadaluarsa 24 jam sejak login |
| penyedia_id | FK → PENYEDIA | **hanya untuk role `PENYEDIA`** (akun portal rekanan katering). Menautkan akun ke SATU penyedia — semua data yang dilihat akun ini dibatasi ke `penyedia_id` ini (row-level scoping). Kosong untuk role internal. Wajib & harus valid saat role=`PENYEDIA` (divalidasi `pengguna.upsert`) |
| status | enum | `AKTIF` / `NONAKTIF` |
| prodi | string | **hanya untuk role `KETUA_JURUSAN`** — menautkan akun ke SATU prodi (harus cocok `TARUNA.prodi`). Ketua Jurusan hanya bisa input absen luar kampus & lihat rekap taruna prodi ini (row-level scoping). Kosong untuk role lain. Di-append di AKHIR skema (migrasi idempotent). |

**Role `PENYEDIA` (rekanan eksternal) — pagar akses ketat.** Berbeda dari 7 role
internal, akun `PENYEDIA` adalah rekanan di luar kampus yang login sendiri untuk
melihat kontrak/jadwal/pembayarannya. Karena banyak action ber-`roles:[]` ("semua
pengguna login") mengekspos data seluruh sistem (mis. `taruna.list` memuat
`rek_mask`, `pesanan.list` seluruh pesanan, `penyedia.list` seluruh rekanan),
role `PENYEDIA` **TIDAK** tunduk pada semantik `roles:[]`. Router hanya
mengizinkan akun `PENYEDIA` memanggil action yang ada di allowlist eksplisit
(`PENYEDIA_ACTIONS` di `01_router.gs`): `penyedia.portal`, `auth.logout`,
`auth.change_pin`. Selain itu ditolak — apa pun `roles`-nya. Data yang dikembalikan
`penyedia.portal` di-scope ke `session.penyedia_id` dan hanya memuat field
non-sensitif (TANPA data per-taruna, TANPA rekening, TANPA geotag realisasi,
TANPA identitas staf internal).

**Role `OPERATOR_SAKTI` — pagar akses seketat `PENYEDIA`.** Staf yang menyalin
nomor SPM ke aplikasi SAKTI (Kemenkeu) — TIDAK butuh akses menu lain, dan
SENGAJA TIDAK diberi akses rekening penuh (lihat § 7 CLAUDE.md). Router hanya
mengizinkan akun ini memanggil action di allowlist eksplisit
(`OPERATOR_SAKTI_ACTIONS` di `01_router.gs`): `cetak.form06` (Verifikasi &
Rencana Pembayaran PPK), `cetak.form09` (Pendebetan Rekening Senat →
Penyedia), `auth.logout`, `auth.change_pin`. Tidak tunduk semantik `roles:[]`.
Form-10 (Rencana Pengajuan SPM per Suplier) SENGAJA tidak diberikan ke role
ini karena berisi rekening taruna PENUH (`_hanyaAdminPPK_`, ADMIN/PPK saja) —
dikonfirmasi Firdaus. Tidak ada kolom tambahan di PENGGUNA untuk role ini
(tanpa scope FK, beda dari `PENYEDIA`/`KETUA_JURUSAN`).

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
| no_kontrak | string | nomor surat kontrak riil (beda dari `kontrak_id` internal); opsional. Di-append di akhir (migrasi idempotent). |
| tgl_kontrak | date | tanggal kontrak ditandatangani; opsional |
| adendum | string | catatan adendum kontrak; opsional |
| rek_penyedia_bni | string | nomor rekening PENUH penyedia di BNI (payee); dipakai Form-07/09 (fallback Script Property) |
| rek_penyedia_bsi | string | nomor rekening PENUH penyedia di BSI (payee); dipakai Form-07/09 (fallback Script Property) |
| harga_per_hari | integer | rupiah/taruna/hari — **tarif utama** sejak revisi ini (dikonfirmasi Firdaus: harga kontrak dihitung per hari, bukan per porsi). Wajib diisi untuk kontrak baru; opsional untuk baca (lihat catatan fallback di bawah). |

> 6 kolom terakhir di-**append di AKHIR** array skema supaya `setupDatabase()`
> (idempotent, tulis-ulang header) tidak menggeser data lama.

**Migrasi harga per porsi → per hari** (dikonfirmasi Firdaus): `harga_per_porsi`
dan `porsi_per_hari` TETAP ada di skema (tidak dihapus/diganti nama). Nominal
`REKAP_BULANAN` kini dihitung dari `harga_per_hari`; kalau kosong (kontrak lama
yang belum diedit), sistem fallback ke `harga_per_porsi × porsi_per_hari` (lihat
`_hargaPerHariKontrak_` di `05_master.gs`) — nilai efektif kontrak yang sedang
berjalan tidak berubah tiba-tiba. `porsi_per_hari` tetap dipakai sebagai info
jumlah makan sehari (mis. "3× sehari"); `harga_per_porsi` sudah tidak dipakai
untuk hitung uang kecuali sebagai fallback tersebut — form Tambah/Ubah Kontrak
tidak lagi meminta `harga_per_porsi` (lihat `docs/kontrak-api.md`).

Lampiran kontrak (menu & nilai gizi, BA penunjukan penyedia, notulen rapat) → LAMPIRAN `ref_type=KONTRAK`.

### 5. MENU_KONTRAK

Menu mingguan terjadwal sesuai kontrak (referensi hari-dalam-minggu — **bukan**
snapshot per tanggal). Terpisah dari kolom `menu` di PESANAN, yang tetap bebas
diisi/diubah Senat per hari secara ad hoc.

| Kolom | Tipe | Keterangan |
|---|---|---|
| menu_id | string | kunci; `MNU-000001` |
| kontrak_id | FK → KONTRAK | |
| hari | enum | `SENIN` / `SELASA` / `RABU` / `KAMIS` / `JUMAT` / `SABTU` / `MINGGU` — unik per (kontrak_id, hari) |
| menu_pagi | string | daftar menu sarapan, satu item per baris |
| menu_siang | string | daftar menu makan siang |
| menu_malam | string | daftar menu makan malam |

Kalau kontrak berganti (kontrak baru dibuat), menu ikut diisi ulang untuk
`kontrak_id` yang baru — tidak otomatis disalin dari kontrak lama.

**Komposisi satu pengantaran (dikonfirmasi Firdaus).** Rekanan mengantar
**sekali** per hari, dan satu pengantaran mencakup **tiga waktu makan yang
melintasi dua hari kalender**: **MALAM hari D** + **PAGI hari D+1** + **SIANG
hari D+1**. Jadi untuk `PESANAN.tgl_makan = D` (mis. Selasa), menu yang
dirakit = `menu_malam[D]` + `menu_pagi[D+1]` + `menu_siang[D+1]` (Selasa
Malam + Rabu Pagi + Rabu Siang). Perakitan ini dilakukan di halaman Buat
Pesanan Senat (frontend, `pesanan-buat.tsx`) sebagai isian awal `PESANAN.menu`
— tetap boleh diubah Senat per hari (ad hoc). Pagi & Siang hari D sendiri
sudah tercakup di pengantaran hari D-1.

---

## B. TRANSAKSI

### 6. STATUS_HARIAN

Taruna yang TIDAK berhak makan pada tanggal tertentu (SOP: Peringatan no. 2).

| Kolom | Tipe | Keterangan |
|---|---|---|
| status_id | string | kunci; `STH-000001` |
| tanggal | date | |
| nit | FK → TARUNA | unik per (tanggal, nit) — upsert |
| status | enum | `PESIAR` / `CUTI` / `SAKIT_RUMAH` / `PENUNDAAN_STUDI` / `TANPA_KETERANGAN` / `KEGIATAN_LUAR_KAMPUS` / `PKL_1` / `PKL_2` / `PKL_3` / `KPA` / `MAGANG` / `PTB`. **7 status kegiatan luar kampus** (KEGIATAN_LUAR_KAMPUS + PKL_1/2/3 + KPA + MAGANG + PTB) = berhak bantuan makan luar kampus → dihitung Form-08 (lihat `STATUS_LUAR_KAMPUS` di `00_config.gs`). PESIAR/CUTI/SAKIT_RUMAH/PENUNDAAN_STUDI/`TANPA_KETERANGAN` **tidak** dapat bantuan apa pun. KEGIATAN_LUAR_KAMPUS tetap ada sebagai catch-all kegiatan luar kampus lainnya (dikonfirmasi Firdaus). `TANPA_KETERANGAN` (absen tanpa alasan resmi) TANPA mekanisme peringatan/eskalasi otomatis (dikonfirmasi Firdaus, beda dari `SURAT_PERINGATAN` §7 yang murni tagihan) — taruna masuk kembali cukup berhenti diinput status ini, tanpa aksi tambahan |
| input_by | FK → PENGGUNA | |
| timestamp | datetime | |

Surat pendukung → LAMPIRAN `ref_type=STATUS_HARIAN`.

Penulisan bisa berupa **rentang tanggal** (`tgl_akhir` opsional di payload
`status.set`/`status.batch`/`kajur.status_set`/`kajur.status_batch`, maks 186
hari) — tetap satu baris per (tanggal, nit), skema TIDAK berubah; hanya
kemudahan input (mis. cuti 2 minggu tidak perlu diinput satu-per-satu hari).

### 7. PESANAN

Pre-Order H-1, satu pesanan per hari (SOP no. 5–7).
Mesin status: `DRAFT → DIAJUKAN → (DIKEMBALIKAN | DISETUJUI) → TERKIRIM`.

> **Koreksi (dikonfirmasi pemilik produk):** PPK **tidak** menyetujui pesanan
> harian — PPK menyetujui `REKAP_BULANAN` (lihat sheet 14). Pembina adalah
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

### 8. REALISASI

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
| piket_nit | FK → TARUNA | Ownership Taruna, Fitur 1 "Piket Verifikasi Makan" — NIT taruna piket yang ikut verifikasi, divalidasi ke roster TARUNA. Kosong = belum diverifikasi piket. Di-append di AKHIR (migrasi idempotent) |
| piket_nama | string | denormalisasi nama piket (untuk cetak/tampilan tanpa join TARUNA ulang) |
| piket_menu_sesuai | boolean | piket konfirmasi menu sesuai jadwal kontrak hari itu |
| piket_porsi_cukup | boolean | piket konfirmasi porsi cukup |
| piket_kualitas | enum | `BAIK` / `CUKUP` / `KURANG` — penilaian piket |
| piket_gizi | string | komponen gizi standar (`getKebijakanGizi()`, `00_config.gs`) yang piket centang benar-benar ada di piring, dipisah koma (mis. "Karbohidrat,Protein,Sayur") |
| piket_catatan | string | opsional |
| piket_at | datetime | waktu verifikasi piket dicatat |
| penerimaan | string (JSON) | Penerimaan Barang Senat — `{pagi:[{komponen,ada,jumlah}], siang:[...], malam:[...]}`. `komponen` ∈ `getKebijakanKomponenMenu()` (`00_config.gs`), `ada` boolean, `jumlah` integer ≥ 0. Kosong = belum diisi. Diisi lewat `realisasi.penerimaan` (tahap berikutnya), TERPISAH dari checklist piket (beda momen: serah-terima vs makan). Di-append di AKHIR (migrasi idempotent) |

Foto dokumentasi (terkompres ±200KB) → LAMPIRAN `ref_type=REALISASI`, `jenis=FOTO`.

**Piket Verifikasi Makan** (dikonfirmasi Firdaus — Ownership Taruna Fitur 1):
kolom `piket_*` MENAMBAH bukti realisasi, TIDAK menggantikan `ttd_pembina_at`/
`ttd_senat_at`/foto/geotag yang sudah ada. Diisi lewat aksi verifikasi piket
terpisah (tahap berikutnya) memakai perangkat bersama Pembina/Senat — TANPA
akun/login taruna sendiri (prinsip "ringan", non-punitif — kolektif lewat
Senat & Piket, bukan komplain individual bebas). Arah datanya menegakkan
kontrak ke PENYEDIA (lihat `realisasi.rekap_kepatuhan`, tahap lanjutan),
bukan menghukum taruna.

**Penerimaan Barang Senat** (dikonfirmasi Firdaus): checklist kelengkapan +
jumlah komponen menu NYATA (Nasi/Sayur/Lauk/Buah/Minuman/dst, `getKebijakanKomponenMenu()`)
per waktu makan, diisi Senat/Pembina/Admin di titik SERAH-TERIMA barang —
BEDA momen & aktor dari checklist piket (`piket_*`, di titik MAKAN, kategori
GIZI bukan item menu). Keduanya melengkapi `porsi_diterima`/`jml_taruna_makan`/
ttd yang sudah ada, TIDAK menggantikan. Kompak sebagai satu kolom JSON (1
REALISASI = 1 antaran = 3 waktu) — bukan sheet anak, supaya tidak menambah baris.
Tiap baris `{komponen, ada, jumlah}` boleh menambahkan `keterangan` OPSIONAL
(bebas isi, maks 60 karakter, TIDAK dikunci enum) — dipakai terutama untuk
komponen `Lauk` mencatat jenis nyatanya hari itu (Ikan/Ayam/Tempe/Kerupuk dst,
bisa pilih dari saran umum atau isi manual), karena jenis lauk bervariasi
setiap hari dan tidak layak dikunci enum tetap.

### 9. PEMBAYARAN

LS via KPPN (SOP no. 11–17), **khusus Dalam Kampus** — Luar Kampus tidak
melewati sheet ini sama sekali (lihat §18 SPM, kategori `LUAR_KAMPUS` berdiri
sendiri tanpa `bayar_id`). Satu baris = satu bulan; rincian per kelompok
Prodi+Tingkat+Suplier disimpan sebagai baris `SPM` anaknya (§18), BUKAN di
sheet ini — perubahan dari desain lama (lihat catatan migrasi di bawah).

**Mesin status: `DIAJUKAN` → `SELESAI`.** `SELESAI` OTOMATIS begitu SEMUA
`SPM` anak (kategori `DALAM_KAMPUS`, bulan yang sama) berstatus `SP2D_TERBIT`
— dicek tiap kali `spm.set_sp2d` mencairkan satu SPM. Pendebetan 2 tahap
(taruna→Senat→Penyedia) tetap berjalan lewat dokumen cetak terpisah (Form-07
lalu Form-09) yang TIDAK mengunci status ini — lihat § Cetak Form Manual SOP
di `docs/kontrak-api.md`. `bayar.close` tersisa sebagai fallback manual untuk
baris historis berstatus lama (`SP2D_TERBIT`/`DITRANSFER`/`DIKONFIRMASI`).

| Kolom | Tipe | Keterangan |
|---|---|---|
| bayar_id | string | kunci; `BYR-000001` |
| bulan | string | `YYYY-MM`; unik per kontrak |
| kontrak_id | FK → KONTRAK | |
| nilai_total 📸 | integer | snapshot SUM(nominal) REKAP_BULANAN FINAL bulan tsb |
| status | enum | `DIAJUKAN` / `SELESAI` (nilai lama `SP2D_TERBIT`/`DITRANSFER`/`DIKONFIRMASI` hanya mungkin muncul di baris historis) |

**Kolom LEGACY** (dipertahankan fisik di sheet — `setupDatabase()` idempotent
tulis-ulang header, menghapus kolom di tengah akan menggeser data lama;
TIDAK diisi lagi untuk baris baru sejak SPM §18 aktif): `no_spm`, `tgl_spm`,
`no_sp2d`, `tgl_sp2d`, `konfirmasi_senat_at`. Sisa desain lama di mana kolom
ini jadi "wakil" tunggal per bulan (berbohong soal kardinalitas — realitanya
1 bulan = banyak SP2D per kelompok Prodi+Tingkat).

> **Migrasi (dikonfirmasi Firdaus):** baris **Januari–Maret 2026** sudah ada
> di produksi sebelum SPM §18 dibuat, sudah berstatus `SELESAI` dengan
> `no_spm`/`no_sp2d` "wakil" lama terisi — rincian per kelompok Prodi+Tingkat+
> Suplier bulan-bulan itu TIDAK PERNAH tercatat, jadi TIDAK dimigrasi/di-
> generate-kan SPM secara retroaktif. Ketiganya tetap dibaca apa adanya lewat
> kolom legacy di atas (status & nilai tidak berubah). SPM (§18) hanya
> berlaku untuk pembayaran yang dibuat SETELAH fitur ini aktif.

Surat blokir, bukti debet bank, invoice penyedia → LAMPIRAN `ref_type=PEMBAYARAN`.

### 10. TAGIHAN

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
| tgl_setor | date | tanggal taruna setor ke rekening Senat (diisi Senat/Pembina/Admin/PPK saat lapor bukti transfer) |
| diverifikasi_oleh | FK → PENGGUNA | **verifikasi KEDUA/final** (siapa pun di antara Senat/Pembina/Admin/PPK, asal orang berbeda dari verifikator pertama) — inilah yang memicu status `LUNAS` |
| catatan_hapus | string | WAJIB terisi bila status `DIHAPUSKAN` |
| verif_pembina_oleh | FK → PENGGUNA | **verifikator PERTAMA** — nama kolom historis ("pembina") tapi SEKARANG GENERIK: siapa pun di antara Senat/Pembina/Admin/PPK (dikonfirmasi Firdaus, direvisi dari alur berurutan Pembina→PPK/Admin — kini peran bebas). Kosong = belum ada verifikator pertama. Di-append di AKHIR (migrasi idempotent) |
| verif_2_oleh | FK → PENGGUNA | **verifikator KEDUA** — WAJIB user_id berbeda dari `verif_pembina_oleh` (peran boleh sama, mis. dua staf Pembina berlainan orang). Terisi bersamaan dengan transisi ke `LUNAS`. Di-append di AKHIR |
| nilai_transfer | integer | nominal yang dimasukkan verifikator (harus > 0) — TIDAK WAJIB sama dengan `nominal` tagihan (dikonfirmasi Firdaus, direvisi dari validasi ketat: dunia nyata sering beda karena potongan biaya transfer antarbank atau kurang bayar). Inilah bentuk konkret "tanda sudah diverifikasi"; selisih dari `nominal` tetap terlihat di data untuk rekonsiliasi, TIDAK memblokir `LUNAS`. Di-append di AKHIR |
| tgl_diteruskan_penyedia | date | tanggal dana hasil tagih-ulang (yang sudah `LUNAS` disetor taruna ke rekening Senat) DITERUSKAN ke rekening penyedia — jalur ini TERPISAH dari SP2D/SPM (pembayaran LS utama). Kosong = belum diteruskan; inilah "utang Poltek ke penyedia" dari sisi tagih-ulang. Diisi via `tagihan.teruskan_penyedia` (batch, role Senat/Pembina/Admin/PPK), bukti transfer WAJIB (LAMPIRAN `jenis=BUKTI_TERUSKAN_PENYEDIA`, satu bukti per batch ditautkan ke tagihan pertama). Di-append di AKHIR |

Bukti setor (screenshot/foto transfer) → LAMPIRAN `ref_type=TAGIHAN`, `jenis=BUKTI_SETOR` — WAJIB
ada sebelum verifikasi manapun (pertama atau kedua) boleh dilakukan.
Level SP aktif TIDAK disimpan di sini — dibaca `MAX(level)` dari SURAT_PERINGATAN.

**Piutang kurang bayar** (dikonfirmasi Firdaus): `selisih_transfer` (=
`nominal - nilai_transfer`) TIDAK disimpan sebagai kolom — dihitung saat
baca (`tagihan.list`). Bila di ATAS `getKebijakanTagihan().toleransiSelisihTransfer`
(default Rp20.000, `00_config.gs`), tagihan tetap jadi `LUNAS` seperti biasa,
tapi selisihnya dicatat di `AUDIT_LOG` (`piutang_kurang_bayar`) dan ditandai
di frontend sebagai piutang yang perlu ditagihkan lagi pada pendebetan bulan
berikutnya — proses tagih ulang tetap MANUAL lewat `tagihan.create` bulan
depan (nominal tagihan baru wajib berbasis REKAP_BULANAN FINAL bulan itu),
bukan otomatis.

**Alur verifikasi ganda** (dikonfirmasi Firdaus, direvisi — bukan lagi berurutan per
peran): `tagihan.setor` bisa diisi role **SENAT/PEMBINA/ADMIN/PPK** — melampirkan bukti
transfer, status tetap `TERTAGIH`. Lalu `tagihan.verifikasi` (role SENAT/PEMBINA/ADMIN/PPK,
payload `{tagihan_id, nilai_transfer}`) dipanggil **dua kali oleh dua orang berbeda** —
peran boleh sama, yang wajib beda hanya `user_id`. Tanda "sudah diverifikasi" adalah
memasukkan `nilai_transfer` (> 0) — TIDAK WAJIB sama dengan `nominal` tagihan (dikonfirmasi
Firdaus, direvisi: potongan biaya transfer/kurang bayar tetap bisa dilunaskan; selisih
tetap tercatat untuk rekonsiliasi). Panggilan pertama → set `verif_pembina_oleh`
(verifikator 1), status TETAP `TERTAGIH`. Panggilan kedua — ditolak bila `user_id` sama
dengan verifikator pertama —
→ set `verif_2_oleh`, `status=LUNAS`, `diverifikasi_oleh` terisi. **Efek samping
otomatis** saat `LUNAS`: SP mana pun milik tagihan ini yang `tgl_terbit` LEBIH BARU dari
`tgl_setor` (taruna sudah bayar SEBELUM SP itu terbit — SP jadi tak berdasar) **DIHAPUS**
dari SURAT_PERINGATAN (bukan cuma diabaikan), supaya riwayat SP tidak menyesatkan.

### 11. SURAT_PERINGATAN

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

### 12. LAMPIRAN — satu-satunya rumah file (polymorphic)

| Kolom | Tipe | Keterangan |
|---|---|---|
| lamp_id | string | kunci; `LMP-000001` |
| ref_type | enum | `KONTRAK` / `STATUS_HARIAN` / `PESANAN` / `REALISASI` / `PEMBAYARAN` / `TAGIHAN` / `SP` |
| ref_id | string | ID baris pada sheet ref_type |
| jenis | enum | `FOTO` / `SURAT` / `BA` / `INVOICE` / `BUKTI_SETOR` / `BUKTI_DEBET` / `MENU_GIZI` / `NOTULEN` / `BUKTI_TERUSKAN_PENYEDIA` / `LAINNYA` |
| drive_file_id | string | file di folder Drive e-BAMA/LAMPIRAN (PDF SP di e-BAMA/SURAT_PERINGATAN) |
| nama_file | string | |
| uploaded_by | FK → PENGGUNA | |
| timestamp | datetime | |

Batas ukuran unggah: 5 MB per file.

### 13. AUDIT_LOG — append-only, dilarang edit/hapus

| Kolom | Tipe | Keterangan |
|---|---|---|
| timestamp | datetime | |
| user_id | FK → PENGGUNA | atau `SISTEM` untuk trigger |
| aksi | string | nama action API atau `ERROR` / `ESKALASI` |
| ref_type | string | |
| ref_id | string | |
| data_lama | string | JSON |
| data_baru | string | JSON |

### 14. REKAP_BULANAN 📸 — materialized view

Di-update **incremental** oleh `rekapUpdate(tanggal)` setiap REALISASI sah /
STATUS_HARIAN masuk — TIDAK dihitung ulang sebulan penuh (hindari timeout GAS
6 menit). Dibekukan saat FINAL (dasar SPM).

> **Urutan persetujuan (dikonfirmasi Firdaus): Wadir 3 DULU, baru PPK.**
> `DRAFT → DISETUJUI_WADIR3` (Wakil Direktur III menyetujui rekap lebih dulu,
> angka BELUM beku) → `TERVERIFIKASI_PPK` (PPK verifikasi) → `FINAL` (PPK
> finalkan — angka BEKU, dasar SPM, **siap dibayar**). Prinsipnya PPK di posisi
> TERAKHIR: menerima hasil yang sudah disetujui untuk dinyatakan siap dibayar.
> Syarat `bayar.create` = rekap `FINAL`.

> **Migrasi bulan pra-aplikasi:** untuk bulan yang sudah berjalan manual
> sebelum e-BAMA aktif (mis. Januari–Juni), baris diisi langsung lewat
> `rekap.input_historis` (PPK/Admin) — BUKAN dengan membuat Pesanan/Realisasi
> harian palsu bertanggal mundur (`pesanan.kirim` memang menolak tanggal yang
> sudah lewat). `biaya_per_hari` (Rp/hari, satu angka per panggilan — bisa beda
> per kelompok kalau rate historis tidak seragam) diinput manual saat itu,
> tidak selalu merujuk KONTRAK yang ada di sistem. Jejak sumbernya di
> AUDIT_LOG (`sumber: INPUT_HISTORIS_PRA_APLIKASI`), bukan kolom sheet
> tersendiri. Setelah masuk, bulan itu lanjut alur normal: persetujuan Wadir 3
> → verifikasi PPK → finalkan PPK → pembayaran.

| Kolom | Tipe | Keterangan |
|---|---|---|
| bulan | string | `YYYY-MM`; kunci gabungan (bulan, nit) |
| nit | FK → TARUNA | |
| hari_makan | integer | jumlah hari realisasi sah |
| hari_tidak_makan | integer | dari STATUS_HARIAN |
| nominal | integer | hari_makan × harga_per_porsi × porsi_per_hari (kontrak aktif) |
| status | enum | urut alur: `DRAFT` → `DISETUJUI_WADIR3` (Wadir 3) → `TERVERIFIKASI_PPK` (PPK) → `FINAL` (PPK, beku/siap bayar) |
| verif_by | FK → PENGGUNA | |
| verif_at | datetime | |

Setelah `FINAL`: semua update pada bulan tsb DITOLAK.

### 15. BANTUAN_LUAR_KAMPUS

Bantuan biaya makan tunai untuk taruna yang sedang PKL/Magang/KPA/PTB di luar
kampus — mekanisme **berbeda** dari Dalam Kampus (bukan lewat kontrak
penyedia/rekening Senat; transfer tunai langsung, `nilai_per_hari` bisa
**beda per individu per wilayah penempatan**, bukan satu rate untuk semua).

Ketua Jurusan & panitia PKL/KPA yang menyusun rekapnya di luar sistem; hasilnya
diajukan ke PPK untuk diinput di sini. **Catatan murni** (tanpa alur status
verifikasi/final seperti REKAP_BULANAN) — cukup diimpor lewat CSV format yang
sama seperti dokumen rekap yang sudah biasa dipakai (kolom NIT, Kegiatan,
Periode Pembayaran, Total Hari, Nilai/Hari, Pembayaran_ke).

| Kolom | Tipe | Keterangan |
|---|---|---|
| bantuan_id | string | kunci; `BLK-000001` |
| nit | FK → TARUNA | |
| kegiatan | string | jenis kegiatan luar kampus, bebas (mis. `PKL2`, `PKL3`, `PTB`, `KPA`) — TIDAK dikunci enum karena jenisnya bisa bertambah |
| bulan | string | `YYYY-MM`, dipilih PPK/Admin saat impor — dipakai filter laporan (bukan hasil parse otomatis dari periode) |
| periode | string | teks periode pembayaran apa adanya dari dokumen sumber (mis. "9 s/d 31 Maret 2026") |
| total_hari | integer | |
| nilai_per_hari | integer | rupiah per individu — BISA beda antar taruna dalam kegiatan & bulan yang sama |
| nominal 📸 | integer | snapshot = total_hari × nilai_per_hari saat diimpor |
| pembayaran_ke | integer | nomor tahap pembayaran (1, 2, 3, dst.) |
| keterangan | string | opsional, mis. nama file sumber untuk jejak migrasi |
| status | enum | `DRAFT` / `DISETUJUI_KAJUR` — persetujuan Ketua Jurusan (`kajur.approve`). Di-append di AKHIR (migrasi idempotent); baris lama tanpa nilai dianggap DRAFT |
| approved_by | FK → PENGGUNA | Ketua Jurusan yang menyetujui (diisi `kajur.approve`) |
| approved_at | datetime | waktu persetujuan |

Kunci gabungan (nit, kegiatan, bulan, pembayaran_ke) — upsert, aman diimpor
ulang. **Persetujuan Ketua Jurusan:** jml hari makan luar kampus diinput Ketua
Jurusan lewat STATUS_HARIAN (status ∈ STATUS_LUAR_KAMPUS, boleh tanggal lampau);
lalu Ketua Jurusan menyetujui rekap prodinya (`kajur.approve` → `DISETUJUI_KAJUR`).
Form-08 menampilkan flag `disetujui_kajur` per baris (soft-gate, tidak menghentikan
cetak). Nomor rekening taruna **TIDAK** disalin dari dokumen sumber (dokumen
kertas Ketua Jurusan/panitia sering memuat rekening lengkap — DILARANG masuk
sistem, lihat aturan `rek_mask` di sheet TARUNA).

### 16. TARUNA_REKENING — pengecualian TERBATAS aturan rekening lengkap

**Latar belakang:** Form-07 (Usulan Penahanan & Pendebetan Bank) dan Form-08
(Usulan Pembayaran Luar Kampus) menurut SOP wajib melampirkan nomor rekening
**lengkap** taruna — bank tidak bisa memproses debet/transfer hanya dari 4
digit terakhir. Selama ini itu ditangani PPK **di luar sistem** (arsip
pribadi, sesuai temuan Itjen III). Sheet **terpisah** ini dibuat khusus untuk
menutup celah itu tanpa melonggarkan aturan `rek_mask` di sheet TARUNA yang
tetap 4 digit untuk SEMUA penggunaan lain (dashboard, laporan, taruna.list,
dst.) — separasi sheet dipilih (bukan kolom baru di TARUNA) supaya proteksi
akses bisa ketat di satu tempat, dan `taruna.list`/`taruna.upsert` biasa tidak
pernah bersentuhan dengan data ini sama sekali.

| Kolom | Tipe | Keterangan |
|---|---|---|
| nit | FK → TARUNA | kunci; satu baris per taruna |
| no_rekening_lengkap | string | nomor rekening PENUH — **satu-satunya tempat** di seluruh e-BAMA yang boleh menyimpan ini |
| bank | enum | `BNI` / `BSI` — cermin `TARUNA.bank`, disalin supaya sheet ini bisa dibaca berdiri sendiri |
| nama_pemilik | string | nama pemilik rekening (kadang beda kecil ejaan dari `TARUNA.nama` — dicatat apa adanya sesuai buku rekening) |
| updated_by | FK → PENGGUNA | |
| updated_at | datetime | |
| penyedia_id | FK → PENYEDIA (opsional) | **suplier katering yang dipasangkan ke rekening taruna ini** — dipakai memecah pengajuan SPM ke KPPN per ID suplier lalu prodi+tingkat (`cetak.form10`/Form-10). Lewat action (`rekening.simpan`/`_batch`) nilainya **divalidasi harus ada di sheet PENYEDIA**; boleh berupa kode suplier eksternal (mis. 7 digit dari SPAN), bukan cuma `PNY-xxxxxx` — asalkan baris PENYEDIA ber-ID tsb sudah ada supaya Form-10 bisa menampilkan NAMA-nya (kalau tidak, Form-10 tetap mengelompokkan per ID dan menampilkan ID-nya). Untuk migrasi massal boleh di-paste langsung ke sheet TARUNA_REKENING (urutan kolom persis skema ini). Kolom di-append di AKHIR skema supaya `setupDatabase()` (idempotent, tulis-ulang header) tidak menggeser data lama |

**Aturan akses (mempersempit CLAUDE.md § 4 dengan pengecualian eksplisit, BUKAN membatalkannya):**

- **Dua action khusus, bukan CRUD generik:**
  - `rekening.lihat_lengkap` — role **ADMIN, PPK SAJA**; payload `{nit}` atau
    `{nit_list}`; dipakai `cetak.form07`/`cetak.form08` untuk mengambil nomor
    rekening penuh saat menyusun lampiran usulan pendebetan/pembayaran.
  - `rekening.simpan` (+ `rekening.simpan_batch`) — role **ADMIN SAJA** (PPK
    **tidak** bisa menulis, supaya input data sensitif ini tetap satu pintu);
    mengisi/memperbarui baris TARUNA_REKENING. Menerima `penyedia_id` opsional
    (divalidasi ada di PENYEDIA) — bila key tak dikirim, nilai lama
    dipertahankan; `''` mengosongkan. `rekening.lihat_lengkap` mengembalikan
    `penyedia_id` + `penyedia_nama` (join PENYEDIA).
  - Role lain (termasuk KPA/WADIR3/BAAK/PEMBINA/SENAT) ditolak di
    `ACTION_MAP.roles` (backend), bukan cuma disembunyikan di frontend.
- **Setiap panggilan `rekening.lihat_lengkap` yang berhasil WAJIB** menulis 1
  baris `AUDIT_LOG` (`aksi='rekening.lihat_lengkap'`, `ref_type='TARUNA_REKENING'`,
  `ref_id=nit`) — **JANGAN** simpan nomor rekeningnya di `AUDIT_LOG`, cukup
  catat **SIAPA** melihat rekening **SIAPA** dan **KAPAN** (`data_lama`/
  `data_baru` dikosongkan). Ini pengecualian dari aturan umum "hanya aksi
  tulis yang di-audit" (CLAUDE.md § 4) — di sini aksi **baca** pun wajib
  diaudit karena sensitivitas datanya. `rekening.simpan` diaudit seperti aksi
  tulis biasa (`data_lama`/`data_baru` berisi field yang berubah, BUKAN nomor
  rekeningnya — cukup penanda field berubah).
- Kedua action dibungkus `withLock` — termasuk `rekening.lihat_lengkap` yang
  sebenarnya baca-saja, karena sensitivitas datanya (bukan demi konsistensi
  tulis seperti sheet lain).
- Sheet diproteksi warning-only di level spreadsheet (pola sama seperti
  `AUDIT_LOG`/`SURAT_PERINGATAN`).
- `taruna.upsert` (Admin/BAAK) **tetap hanya** menerima `rek_mask` 4 digit —
  tidak ada jalan masuk rekening lengkap lewat action itu maupun lewat impor
  CSV Taruna biasa. Pengisian `TARUNA_REKENING` adalah proses terpisah lewat
  `rekening.simpan`.

### 17. SP2D_MONITORING — rekonsiliasi SP2D vs data sistem

Menyimpan hasil impor file "Monitoring SP2D" (ekspor OM-SPAN/SAKTI KPPN),
dipakai untuk **membandingkan** (bukan menautkan langsung) nominal yang
tercatat sistem (`REKAP_BULANAN` untuk Dalam Kampus, `BANTUAN_LUAR_KAMPUS`
untuk Luar Kampus) dengan nominal yang benar-benar cair via SP2D.

**Kenapa dibandingkan per kelompok, bukan ditautkan per baris:** satu baris
file sumber mewakili SATU kombinasi **Prodi + Tingkat + Bulan** (Dalam
Kampus) atau **Prodi + Tingkat + Bulan + Kegiatan** (Luar Kampus) — jauh
lebih rinci daripada satu baris `PEMBAYARAN`/bulan yang ada sekarang, dan
untuk Luar Kampus bisa berupa rentang tanggal (bukan bulan penuh). Menautkan
paksa 1:1 akan rawan salah cocok — jadi rekonsiliasi dilakukan lewat **SUM
per kelompok** (Prodi+Tingkat[+Kegiatan] dalam bulan yang sama).

Kolom **Prodi/Tingkat/Bulan/Kegiatan tidak ada** di file sumber — diparse
dari teks bebas kolom "Uraian SPP/SPM" (lihat `_parseUraianSpm_` di
`23_sp2d.gs`). Kalau parsing gagal, baris tetap masuk (nominal uang tidak
boleh hilang) tapi ditandai `perlu_cek_manual='YA'` dan **dikecualikan**
dari perbandingan otomatis — ditampilkan terpisah untuk dicek manual.

**Dua format sumber, dua granularitas baris (lihat § "Format per-taruna"
di bawah):**
- **Format agregat** ("Monitoring SP2D" OM-SPAN klasik) — satu baris =
  satu kelompok Prodi+Tingkat+Bulan(+Kegiatan). `nit` **kosong**;
  `prodi`/`tingkat`/`jumlah_orang` **terisi langsung** dari hasil parsing
  Uraian, karena pada baris ini atribut tsb memang properti asli baris itu
  sendiri (satu SPM memang mewakili satu kelompok taruna).
- **Format per-taruna** ("SPANExt") — satu baris = satu taruna penerima.
  `nit` **terisi** (dicocokkan Admin/PPK dari nama penerima saat impor,
  lihat frontend). `prodi`/`tingkat` **diparse dari Deskripsi** (mis.
  "Program Studi I TPI") sebagai **snapshot saat pembayaran** (dikonfirmasi
  Firdaus) supaya tabel langsung terbaca — best-effort: kalau gagal parse,
  dikosongkan TANPA menandai `perlu_cek_manual` (kunci tetap `nit`;
  prodi/tingkat masih bisa diturunkan via join TARUNA saat rekonsiliasi).
  `jumlah_orang` **dikosongkan** (per baris = 1 taruna; angka "N Orang" di
  Deskripsi itu ukuran kelompok, bukan per-individu). `bulan` = bulan
  **makan**, diparse dari Deskripsi ("...Bulan Januari 2026...") sama seperti
  format agregat — **BUKAN** dari `tgl_sp2d` (tanggal pencairan sering beda
  bulan dari bulan makan, mis. makan Januari dicairkan Februari;
  `REKAP_BULANAN` dikunci per bulan makan, jadi pakai `tgl_sp2d` akan bikin
  rekonsiliasi selalu selisih).

| Kolom | Tipe | Keterangan |
|---|---|---|
| no_spm | string | kunci; dari kolom "No. SPP/SPM" (format agregat) atau "Nomor Referensi" transaksi (format per-taruna, lihat catatan) — dipakai deteksi baris baru saat impor ulang |
| kategori | enum | `DALAM_KAMPUS` / `LUAR_KAMPUS` — dipilih pengguna saat impor (satu file = satu kategori) |
| nit | FK → TARUNA (opsional) | **kosong untuk baris agregat**; terisi untuk baris per-taruna (SPANExt) — dicocokkan Admin/PPK dari "Nama Penerima" file sumber |
| prodi | string | hasil parsing Uraian/Deskripsi (`TPI`/`MP`/`TBP`) — **kedua format** (per-taruna sebagai snapshot, best-effort; kosong bila gagal parse) |
| tingkat | string | idem — hasil parsing Uraian/Deskripsi (`I`/`II`/`III`), kedua format |
| bulan | string | `YYYY-MM` bulan **makan** — kedua format: hasil parsing teks (Uraian agregat / Deskripsi per-taruna), BUKAN dari `tgl_sp2d` (tanggal cair bisa beda bulan) |
| kegiatan | string | khusus Luar Kampus (`KPA`/`PKL2`/`PKL3`/`PTB`), kosong untuk Dalam Kampus — diparse dari Uraian/Deskripsi di kedua format |
| jumlah_orang | integer | hanya format agregat, dari "...untuk N Orang" di Uraian; **selalu kosong** untuk baris per-taruna (implisit 1, tidak perlu disimpan) |
| jumlah_pembayaran | integer | dari kolom "Jumlah Pembayaran" (agregat) atau "Jumlah" (per-taruna, format "Rp. 1.144.000" diparse jadi integer di frontend) |
| tgl_spm, no_sp2d, tgl_sp2d, status_sp2d | - | apa adanya dari file sumber (`-` → dikosongkan, artinya SP2D belum terbit) |
| uraian_asli | string | teks Uraian SPP/SPM (agregat) atau Deskripsi (per-taruna) lengkap, disimpan apa adanya untuk verifikasi manual |
| no_sp2d | string | Nomor SP2D (15 digit) — ada di KEDUA format (kolom "No. SP2D" agregat / "NO SP2D" SPANExt). **Kunci penaut agregat↔rincian** untuk cross-check (1 SP2D = 1 kelompok tingkat, dikonfirmasi Firdaus). Kosong bila SP2D belum terbit (`-`) |
| perlu_cek_manual | string | `'YA'` bila: format agregat → prodi/tingkat/bulan/jumlah_orang (atau kegiatan utk Luar Kampus) gagal diparse; format per-taruna → `bulan` tidak terbaca dari Deskripsi, kegiatan gagal diparse (Luar Kampus), atau `nit` tidak dikenal di TARUNA. **Pengaman salah-kategori:** baris impor kategori `DALAM_KAMPUS` yang Uraiannya justru bertema Luar Kampus (mengandung "Taruna KPA"/"PKL II"/"PKL III"/"Praktik Pembelajaran Taruna Berprestasi" — "KPA" di *nomor SK* `KPA.PKPS` TIDAK dihitung) otomatis ditandai `'YA'` → dikeluarkan dari rekonsiliasi Dalam Kampus (mencegah KPA/PKL yang salah pilih kategori menumpuk jadi "selisih") |

**Impor (`sp2d.import`, role ADMIN/PPK):** PPK unduh file terbaru dari
OM-SPAN tiap bulan, unggah CSV (header persis file sumber — agregat atau
SPANExt per-taruna, terdeteksi otomatis dari header di frontend). Impor
**HANYA menambah** baris dengan `no_spm` yang belum pernah ada — baris
yang sudah ada TIDAK diproses ulang (dikonfirmasi Firdaus: cek bulanan
cukup untuk penambahan, bukan mengulang proses seluruh riwayat).

**Dedup ganda (kunci `no_spm` + kunci `nit`+`no_sp2d`):** untuk format
per-taruna (SPANExt), `no_spm` disintesis dari teks referensi/nama
penerima — dua ekspor dari transaksi SP2D yang SAMA bisa menghasilkan
`no_spm` yang sedikit berbeda (variasi ejaan/spasi nama), lolos dari cek
`no_spm` dan menggandakan baris. Sejak diperkeras, impor JUGA menolak
baris baru bila kombinasi `nit`+`no_sp2d` sudah ada (dicek pula dalam satu
batch impor yang sama), tanpa mengubah kunci utama `no_spm`.

**Bersih-bersih data dobel yang sudah terlanjur masuk** (`sp2d.cek_dobel`
baca-saja lalu `sp2d.hapus_dobel`, role PPK/ADMIN, `23_sp2d.gs`): mencari
kelompok baris ber-`nit`+`no_sp2d` sama (≥2 baris), menyisakan baris
pertama, menghapus sisanya lewat `sheetDeleteRows` (`03_helpers.gs`) —
**satu-satunya penghapusan baris data di seluruh backend**, dipakai
HATI-HATI. Tiap baris yang dihapus tetap dicatat penuh di `AUDIT_LOG`
(`data_lama` = snapshot baris, `data_baru` = null) sebagai jejak forensik
meski barisnya sudah tidak ada di sheet.

**Rekonsiliasi (`sp2d.rekonsiliasi`, role PPK/KPA/WADIR3/ADMIN, baca saja):**
digabung ke halaman Laporan Bulanan yang sudah ada — payload `{bulan}`,
mengembalikan perbandingan per kelompok (`dalam_kampus`/`luar_kampus`,
dari baris agregat SAJA — baris ber-`nit` dikecualikan supaya tidak
mengotori kelompok "prodi/tingkat kosong") **dan** perbandingan per taruna
(`dalam_kampus_per_taruna`/`luar_kampus_per_taruna`, dari baris ber-`nit`
SAJA, `prodi`/`tingkat` hasil join TARUNA saat itu), **cross-check per SP2D**
(`cross_check_sp2d` — menautkan total agregat dengan SUM+COUNT rincian lewat
`no_sp2d`; membuktikan agregat & rincian saling konsisten), plus daftar baris
`perlu_cek_manual` bulan itu.

**Rekonsiliasi 3 lapis:** (1) *Sistem* (REKAP_BULANAN) = berapa SEHARUSNYA;
(2) *SP2D Agregat* (Monitoring) = total per SP2D yang KPPN cairkan (acuan);
(3) *SP2D Rincian* (SPANExt) = siapa penerima + nominal masing-masing.
`cross_check_sp2d` mengecek lapis 2 vs 3 (internal SP2D); perbandingan per
kelompok/per taruna mengecek lapis 1 vs (2/3).

**Relasi ke PEMBAYARAN — lewat SPM (§18), bukan langsung.** Satu baris
`PEMBAYARAN` (per bulan) memayungi BANYAK baris `SPM` (kategori
`DALAM_KAMPUS`) — KPPN menerbitkan satu SP2D per kelompok Prodi+Tingkat,
jadi satu bulan pembayaran Dalam Kampus = beberapa SPM/SP2D (contoh nyata
Januari 2026 = **10 SP2D**: TPI/I, MP/I, MP/II ×2, TBP/II ×2, MP/III,
TBP/III, TBP/I, TPI/II). `sp2d.import` mencocokkan baris agregat
(`kategori='DALAM_KAMPUS'`, `nit` kosong, `perlu_cek_manual≠'YA'`) ke baris
`SPM` lewat (prodi, tingkat, bulan) dan mengisi `no_sp2d`/`tgl_sp2d` di SPM
itu (lihat §18) — begitu SEMUA SPM bulan itu `SP2D_TERBIT`, `PEMBAYARAN.status`
otomatis `SELESAI`. **Legacy (bulan sebelum SPM aktif, lihat §9):** relasi
lama langsung SP2D_MONITORING→PEMBAYARAN lewat `_rincianSp2dDalamKampus_`
(`23_sp2d.gs`, live-derive tanpa SPM) tetap dipakai HANYA untuk membaca
bulan-bulan legacy itu, tidak untuk bulan baru.

### 18. SPM — pengajuan SPM ke KPPN (authored, header kelompok)

Satu sheet, dua kategori (`kategori`) — `DALAM_KAMPUS` dan `LUAR_KAMPUS`
SIMETRIS, satu pola: satu baris = **satu SPM** = satu kelompok. Beda dari
SP2D_MONITORING (§17, **imported** — cermin OM-SPAN untuk rekonsiliasi): SPM
ini **authored** oleh satker (PPK) SEBELUM SP2D terbit, lalu diisi hasilnya
begitu SP2D terbit (dikonfirmasi Firdaus: **1 SPM selalu = 1 SP2D**, jadi
field hasil SP2D menempel langsung di baris SPM yang sama, tidak perlu tabel
terpisah). Keanggotaan taruna TIDAK disalin ke sini — SPM = header kelompok +
data yang tak bisa dihitung ulang (nomor, tanggal, status, hasil SP2D),
BUKAN salinan baris taruna; selalu diturunkan dari `REKAP_BULANAN` (Dalam
Kampus) atau `BANTUAN_LUAR_KAMPUS` (Luar Kampus) saat dibutuhkan.

**Pengelompokan (kunci gabungan, beda per kategori):**
- **`DALAM_KAMPUS`**: `(bulan, prodi, tingkat, penyedia_id)`. Dikonfirmasi
  Firdaus: satu suplier SELALU melayani satu kelompok prodi+tingkat utuh
  (tidak pernah campur) — jadi kelompok ini otomatis = satu SP2D KPPN (§17:
  "1 No. SP2D = 1 kelompok Prodi+Tingkat"), menjaga 1:1. `bayarCreate`
  (`15_pembayaran.gs`) MENOLAK pembuatan bila ada taruna ber-REKAP bulan itu
  yang `TARUNA_REKENING.penyedia_id`-nya kosong/tidak valid (split per suplier
  tidak boleh menghasilkan grup "suplier kosong").
- **`LUAR_KAMPUS`**: `(bulan, prodi, tingkat, kegiatan, pembayaran_ke)`.
  Dikonfirmasi Firdaus: Luar Kampus kerap dibayar BERTAHAP per kegiatan
  (awal/selama/akhir kegiatan) — setiap tahap dipicu satu laporan + satu
  surat pengajuan Prodi/Ketua Jurusan = satu SPM tersendiri. Tanpa suplier
  (transfer tunai langsung ke taruna, tidak lewat kontrak penyedia).

**PENTING — kunci di atas TIDAK LAGI UNIK begitu satu grup pernah dipisah
lewat `spm.split`** (dikonfirmasi Firdaus): bisa ada LEBIH DARI SATU baris
SPM berbagi kunci grup yang sama, dibedakan lewat `nit_anggota` yang saling
TIDAK tumpang tindih (lihat kolom `nit_anggota` di bawah). Untuk grup yang
belum pernah displit, perilaku LAMA tetap berlaku apa adanya (satu baris =
satu grup, `nit_anggota` kosong, keanggotaan diturunkan dari sumbernya).

| Kolom | Tipe | Keterangan |
|---|---|---|
| spm_id | string | kunci; `SPM-000001` |
| kategori | enum | `DALAM_KAMPUS` / `LUAR_KAMPUS` |
| bayar_id | FK → PEMBAYARAN (opsional) | HANYA diisi utk `DALAM_KAMPUS` (induk bulan, §9); kosong utk `LUAR_KAMPUS` — Luar Kampus tidak punya sheet amplop |
| bulan | string | `YYYY-MM`, kedua kategori |
| prodi | string | bagian kunci kelompok, kedua kategori |
| tingkat | string | bagian kunci kelompok, kedua kategori |
| penyedia_id | FK → PENYEDIA (opsional) | HANYA `DALAM_KAMPUS`; kosong utk `LUAR_KAMPUS` |
| kegiatan | string | HANYA `LUAR_KAMPUS` (`KPA`/`PKL2`/`PKL3`/`PTB`, dari BANTUAN_LUAR_KAMPUS); kosong utk `DALAM_KAMPUS` |
| pembayaran_ke | integer | HANYA `LUAR_KAMPUS` — bagian kunci kelompok (tahap 1/2/3/dst.); kosong utk `DALAM_KAMPUS` |
| periode | string | HANYA `LUAR_KAMPUS` (opsional) — salinan teks periode dari `BANTUAN_LUAR_KAMPUS`, pembeda antar-tahap saat memasangkan SP2D manual |
| nominal 📸 | integer | snapshot SUM nominal kelompok (`REKAP_BULANAN` / `BANTUAN_LUAR_KAMPUS`) saat SPM dibuat; BEKU begitu status `DIAJUKAN` — boleh re-derive selama `DRAFT` |
| no_spm | string | nomor SPM riil (SAKTI); kosong saat `DRAFT`. Boleh diedit ulang PPK SELAMA status ≠ `SP2D_TERBIT` — menangani SPM ditolak/dikembalikan KPPN (tidak ada status `DITOLAK` terpisah, dikonfirmasi Firdaus) |
| tgl_spm | date | idem no_spm — boleh diedit ulang selama status ≠ `SP2D_TERBIT` |
| no_sp2d | string | diisi saat SP2D terbit (1:1 dengan SPM) |
| tgl_sp2d | date | |
| status | enum | `DRAFT` → `DIAJUKAN` → `SP2D_TERBIT` (cair). **Tidak ada `DITOLAK`** — PPK edit ulang no_spm/tgl_spm di tempat kalau SPM dikembalikan KPPN |
| nit_anggota | string (opsional) | NIT dipisah koma. **Default KOSONG** = baris natural, keanggotaan diturunkan dari sumber (perilaku lama, TIDAK berubah). Begitu satu baris dalam grup pernah displit (`spm.split`), SEMUA baris turunan grup itu (sisa induk MAUPUN pecahan) WAJIB terisi eksplisit — supaya keanggotaan antar-baris yang berbagi kunci grup sama tidak ambigu |
| induk_spm_id | FK → SPM (opsional) | Jejak asal kalau baris ini hasil `spm.split` dari SPM lain. Kosong = baris asli, atau baris yang sudah pernah `spm.gabung` kembali jadi utuh |

**Alur:** `bayar.create` (Dalam Kampus, §9) langsung generate N baris SPM
`DRAFT` — satu per (prodi, tingkat, penyedia_id) dari REKAP FINAL bulan itu.
`spm.generate_luar_kampus` (dipicu manual PPK) generate SPM `DRAFT` dari
`BANTUAN_LUAR_KAMPUS` bulan itu, grup per (prodi, tingkat, kegiatan,
pembayaran_ke) — soft-gate: tandai grup yang belum seluruhnya
`DISETUJUI_KAJUR` (pola sama seperti Form-08, tidak menghentikan generate).
`spm.update` isi `no_spm`/`tgl_spm` & ajukan (`DRAFT`→`DIAJUKAN`, nominal &
kunci kelompok beku). `spm.set_sp2d` isi hasil SP2D → `SP2D_TERBIT`; untuk
`DALAM_KAMPUS`, begitu SEMUA SPM bulan itu `SP2D_TERBIT`, `PEMBAYARAN.status`
otomatis `SELESAI` (+ audit). `spm.regenerate` re-derive dari sumber, hanya
boleh selama SEMUA SPM grup itu masih `DRAFT` — DITOLAK juga bila grup itu
sudah pernah displit (ada baris `induk_spm_id` terisi ATAU >1 baris berbagi
kunci grup yang sama) — gabungkan dulu lewat `spm.gabung` sebelum bisa
`spm.regenerate` lagi.

**Pisah/gabung taruna dalam satu grup (`spm.split`/`spm.gabung`,
`15_pembayaran.gs`, DALAM_KAMPUS saja untuk saat ini)** — dikonfirmasi
Firdaus, untuk kasus PPK perlu mengajukan sebagian taruna dalam satu
kelompok (prodi+tingkat+suplier) sebagai SPM tersendiri ke KPPN (mis. data
taruna tsb perlu diproses terpisah dari rombongannya):
- `spm.split {spm_id, nit_list}` — HANYA selama baris itu `DRAFT` (snapshot
  beku sama seperti aturan `nominal` §5). Membuat baris SPM BARU (kategori/
  bayar_id/bulan/prodi/tingkat/penyedia_id SAMA dengan induk, `nominal` =
  SUM REKAP_BULANAN taruna di `nit_list`, `nit_anggota` = `nit_list`,
  `induk_spm_id` = spm_id induk, status `DRAFT`); baris induk nominalnya
  dikurangi & `nit_anggota`-nya diisi eksplisit (anggota lama dikurangi
  `nit_list`) — TIDAK boleh memisah SELURUH anggota (harus tersisa ≥1 di
  induk).
- `spm.gabung {spm_id_a, spm_id_b}` — kebalikannya, HANYA selama KEDUA baris
  `DRAFT` dan sama-sama anggota kunci grup yang sama; gabungkan
  `nit_anggota`+`nominal` ke satu baris, hapus baris satunya. Kalau hasil
  gabungan PERSIS sama dengan keanggotaan ALAMI grup itu (semua taruna balik
  utuh, tidak ada sisa split), `nit_anggota` OTOMATIS dikosongkan lagi supaya
  baris kembali "natural" seperti sebelum pernah displit.
- **Efek ke auto-isi SP2D (disengaja, BUKAN bug):** `_autoIsiSpmDariSp2d_`
  (lihat guard di bawah) sudah mensyaratkan PERSIS SATU baris SPM per kunci
  grup — begitu grup displit (>1 baris berbagi kunci sama), auto-isi
  OTOMATIS DILEWATI utk grup itu (guard lama, tidak perlu diubah). PPK
  mengisi `no_spm`/`no_sp2d` manual per pecahan lewat `spm.update`/
  `spm.set_sp2d` seperti biasa.

**Auto-isi dari impor SP2D (`sp2d.import`, §17 → `_autoIsiSpmDariSp2d_`,
`15_pembayaran.gs`) — dijalankan OTOMATIS tiap impor selesai:** `DALAM_KAMPUS`
dicocokkan lewat (prodi, tingkat, bulan) — selalu tak ambigu (satu kelompok =
satu SPM, lihat di atas), TAPI tetap dijaga: kalau baris agregat Monitoring
utk kunci itu bukan PERSIS SATU (mis. re-impor ganda, ATAU grup sudah displit
jadi >1 baris SPM), auto-isi DILEWATI.
`LUAR_KAMPUS` dicocokkan lewat (prodi, tingkat, kegiatan, bulan) TAPI hanya
bila grup itu punya PERSIS SATU baris SPM — kalau ada beberapa `pembayaran_ke`
untuk kombinasi yang sama (SP2D_MONITORING tidak mem-parse tahap pembayaran
dari teks Uraian), auto-isi DILEWATI dan PPK memasangkan manual lewat
`spm.update`/`spm.set_sp2d` (pakai `periode`/nominal sebagai pembeda). Mengisi
`no_spm`/`tgl_spm` (DRAFT→DIAJUKAN) dan/atau `no_sp2d`/`tgl_sp2d`
(DIAJUKAN→SP2D_TERBIT) sekaligus bila keduanya sudah ada di data Monitoring;
SPM `SP2D_TERBIT` (beku) tidak disentuh. Audit `spm.auto_isi` per baris
(sumber `AUTO_IMPOR`), terpisah dari audit manual `spm.update`/`spm.set_sp2d`.
Rekonsiliasi tingkat-grup tetap sah walau tanpa auto-isi per SPM:
SUM seluruh tahap SPM grup itu harus = SUM SP2D grup itu.

**Provenance terpisah dari SP2D_MONITORING (§17):** `SPM` = authored (dibuat
satker SEBELUM SP2D terbit); `SP2D_MONITORING` = imported (cermin OM-SPAN,
read-only, rekonsiliasi/bukti). Keduanya TIDAK PERNAH dicampur jadi satu
sumber — SPM tidak ditulis ke SP2D_MONITORING, dan sebaliknya.

**Tidak berlaku untuk 3 bulan legacy (Jan–Mar 2026):** lihat catatan §9 —
pembayaran bulan-bulan itu memakai desain lama (satu "wakil" no_spm/no_sp2d
per bulan di sheet PEMBAYARAN) dan TIDAK dimigrasi/di-generate-kan SPM
secara retroaktif (rincian per kelompok bulan-bulan itu memang tidak pernah
tercatat).

---

## Diagram relasi (ringkas)

```
PENYEDIA ─< KONTRAK ─< PESANAN ─< REALISASI ──▶ REKAP_BULANAN(📸 view)
              └─< MENU_KONTRAK (referensi menu mingguan, bukan snapshot)
TARUNA ──< STATUS_HARIAN                              │
TARUNA ──< TAGIHAN ─< SURAT_PERINGATAN                ├─▶ PEMBAYARAN ─< SPM (kategori DALAM_KAMPUS)
TARUNA ──< TARUNA_REKENING (akses ADMIN/PPK saja)     └─▶ TAGIHAN.nominal        ▲
BANTUAN_LUAR_KAMPUS ───────────────────────────────────────────▶ SPM (kategori LUAR_KAMPUS, tanpa bayar_id)
SP2D_MONITORING (imported OM-SPAN) ─────── auto-isi no_sp2d/tgl_sp2d ──┘
LAMPIRAN (polymorphic) + AUDIT_LOG ── melintang semua tabel
```
