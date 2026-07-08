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
| `auth.login` | publik | `{user_id, pin}` → `{token, role, nama}` | field `pin` = **kata sandi** (min 6 karakter bebas — nama field dipertahankan demi kompatibilitas); gagal 5× → blokir 15 menit (CacheService) |
| `auth.logout` | semua | `{}` | hapus token |
| `auth.change_pin` | semua | `{pin_lama, pin_baru}` | pin_lama wajib benar; `pin_baru` = kata sandi baru min 6 karakter (huruf/angka/simbol). Kolom simpan tetap `pin_hash`, kata sandi lama 6-digit tetap valid tanpa reset |

### Master (Admin)

Modul: `taruna.*` → `10_taruna.gs`; `penyedia.*`, `kontrak.*` & `menu.*` → `05_master.gs`;
`pengguna.*` → `02_auth.gs`.

| Action | Role | Keterangan |
|---|---|---|
| `taruna.list` | semua login | filter `{status?, prodi?, tingkat?, kelas?}` |
| `taruna.upsert` | ADMIN, BAAK | tolak `rek_mask` yang memuat >4 digit angka (indikasi rekening lengkap); BAAK (Biro Administrasi Akademik & Kemahasiswaan) berdampingan dengan Admin — sumber otoritatif data NIT/akademik |
| `penyedia.list` | semua login | |
| `penyedia.upsert` | ADMIN, PPK | |
| `kontrak.list` | semua login | tiap baris kontrak disisipkan `harga_per_hari_efektif` (turunan, lihat `_hargaPerHariKontrak_`) |
| `kontrak.get` | semua login | `{kontrak_id}` → `{kontrak, lampiran}` — `kontrak.harga_per_hari_efektif` idem `kontrak.list` |
| `kontrak.upsert` | PPK | hanya boleh diubah selama `DRAFT`. Payload: `{penyedia_id, harga_per_hari, porsi_per_hari, tgl_mulai, tgl_akhir, harga_per_porsi?, no_kontrak?, tgl_kontrak?, adendum?, rek_penyedia_bni?, rek_penyedia_bsi?}`. **`harga_per_hari`** (rupiah/taruna/hari) WAJIB sejak migrasi harga per-porsi→per-hari (dikonfirmasi Firdaus) — tarif utama dipakai `rekap.update`/cetak Form-01/04/`penyedia.portal`/`laporan.resmi`. `harga_per_porsi` kini OPSIONAL (legacy — default 0 bila tak dikirim; frontend `ModalKontrak` sudah tidak menampilkan inputnya, tapi tetap kirim nilai lama pass-through saat edit supaya tak menimpa fallback kontrak lama jadi 0). `porsi_per_hari` tetap wajib (info jumlah makan sehari, bukan dipakai hitung uang lagi). 6 field terakhir opsional; `rek_penyedia_*` = nomor rekening PENUH penyedia (payee, dipakai Form-07/09). |
| `kontrak.approve` | PPK | `DRAFT → DISETUJUI_PPK` (SOP no. 4) |
| `kontrak.lampiran_upload` | PPK | `{kontrak_id, berkas:{base64,nama_file,jenis}}` — menu & nilai gizi (`jenis=MENU_GIZI`), BA penunjukan (`BA`), notulen (`NOTULEN`); boleh kapan saja |
| `menu.list` | semua login | `{kontrak_id}` → `{menu: [...]}` urut Senin→Minggu |
| `menu.upsert` | PPK | `{kontrak_id, hari, menu_pagi, menu_siang, menu_malam}` — menu mingguan terjadwal (referensi hari-dalam-minggu, bukan snapshot tanggal); kunci gabungan (kontrak_id, hari) |
| `menu.hari_ini` | SENAT, PEMBINA | `{tanggal?}` (default hari ini) → `{tanggal, ada_kontrak, menu:{pagi,siang,malam}, standar_gizi, piket}` — Ownership Taruna Fitur 2a, papan "Menu Hari Ini" READ-ONLY. Komposisi antaran sama seperti `pesanan.create`: Malam(T) dari `MENU_KONTRAK` hari=dayOfWeek(T), Pagi/Siang(T) dari hari=dayOfWeek(T-1). `piket` = status verifikasi piket REALISASI tanggal itu (realisasi ber-`piket_at` terbaru) atau `null` bila belum ada. NOL data sensitif (tanpa rupiah/rekening/daftar per-taruna) |
| `pengguna.list` / `pengguna.upsert` / `pengguna.reset_pin` | ADMIN | `pengguna.upsert` menerima `penyedia_id` — **wajib & harus valid** bila `role=PENYEDIA` (menautkan akun ke satu penyedia), dipaksa kosong untuk role lain |

### Status Harian (SOP: Peringatan no. 2)

| Action | Role | Keterangan |
|---|---|---|
| `status.set` | ADMIN, PEMBINA, BAAK | `{tanggal, nit, status, berkas?, tgl_akhir?}` — upsert per (tanggal, nit); BAAK dipakai untuk surat taruna keluar kampus (PKL) & surat penarikan kembali, lampirkan lewat `berkas`. **`tgl_akhir` opsional**: bila diisi, membuat satu baris STATUS_HARIAN per hari dari `tanggal` s.d. `tgl_akhir` inklusif (maks 186 hari) — utk status berdurasi (cuti/sakit/PKL berhari-hari) tanpa input per hari. Balikan: `{status_id, aksi}` bila 1 hari, `{jml}` bila rentang |
| `status.batch` | ADMIN, PEMBINA, BAAK | `{tanggal, status, nit:[], berkas?, tgl_akhir?}` — input massal (mis. satu kelas pesiar); `tgl_akhir` idem `status.set` (per taruna × per hari dalam rentang). Balikan `{jml}` = jumlah baris (taruna×hari) |
| `kajur.taruna_list` | KETUA_JURUSAN | `{}` → `{taruna, prodi}` — taruna prodi akun (scope `session.prodi`), tanpa rekening |
| `kajur.status_set` | KETUA_JURUSAN | `{tanggal, nit, status, tgl_akhir?}` — input absen luar kampus 1 taruna prodinya. Status WAJIB ∈ STATUS_LUAR_KAMPUS; nit WAJIB di prodi akun. **Boleh tanggal lampau** (taruna PKL di luar kampus). `tgl_akhir` opsional idem `status.set` (rentang tanggal, mis. PKL 3 bulan). Tulis STATUS_HARIAN (`_statusUpsert_`) |
| `kajur.status_batch` | KETUA_JURUSAN | `{tanggal, status, nit:[], tgl_akhir?}` — idem massal (semua nit divalidasi di prodi dulu, all-or-nothing); `tgl_akhir` idem di atas |
| `kajur.rekap` | KETUA_JURUSAN | `{bulan}` → `{bulan, prodi, baris:[{nit,nama,tingkat,kelas,kegiatan,hari_luar_kampus,nilai_per_hari,nominal,ada_blk,disetujui_kajur}], total_nominal}` — rekap luar kampus prodi, jml hari dari STATUS_HARIAN × tarif BANTUAN_LUAR_KAMPUS. **TANPA nomor rekening** |
| `kajur.approve` | KETUA_JURUSAN | `{bulan}` → `{disetujui, prodi, bulan}` — set BANTUAN_LUAR_KAMPUS.status baris prodinya bulan itu `DRAFT→DISETUJUI_KAJUR` (withLock + audit) |
| `status.list` | semua login | per rentang tanggal |
| `status.tandai_kembali` | ADMIN, PEMBINA, BAAK | `{nit, tanggal_kembali?}` — batalkan sisa hari STATUS_HARIAN taruna sejak `tanggal_kembali` (default hari ini) ke depan. Dipakai saat taruna kembali LEBIH CEPAT dari `tgl_akhir` yang sudah diinput (`status.set`/`status.batch` menulis satu baris per hari di muka; tanpa aksi ini sisa hari ke depan tetap tercatat "di luar" di rekap). `tanggal_kembali` TIDAK boleh sebelum hari ini (riwayat tidak diubah). Hapus via `sheetDeleteRows`, balikan `{jml_dibatalkan}` |

### Pesanan (SOP no. 5–7) — mesin status `DRAFT → DIAJUKAN → (DIKEMBALIKAN | DISETUJUI) → TERKIRIM`

> PPK menyetujui `REKAP_BULANAN`, bukan pesanan harian — lihat bagian Rekap Bulanan.

| Action | Role | Keterangan |
|---|---|---|
| `pesanan.create` | SENAT | tgl_makan unik; `jml_taruna` otomatis (AKTIF − STATUS_HARIAN), koreksi manual wajib catatan; simpan snapshot |
| `pesanan.submit` | SENAT | `DRAFT → DIAJUKAN`; hanya pembuat. **Verifikasi by-Exception**: bila `getKebijakanVerifikasi().autoLolosRutin` aktif (default) dan pesanan RUTIN (`_pesananAnomali_` — sama dengan kemarin dalam ambang, tanpa override manual, tanpa perubahan STATUS_HARIAN belum tercermin) → langsung lanjut otomatis ke `TERKIRIM` (`verif_by='SISTEM'`, `catatan='Auto-lolos: rutin (sama dengan kemarin)'`), TIDAK menunggu antrian Pembina. Pesanan ANOMALI tetap di `DIAJUKAN` seperti biasa. Return `{pesanan_id, status, auto_lolos, label?}`. |
| `pesanan.verify` | PEMBINA | `DIAJUKAN → DISETUJUI` (SOP no. 6) |
| `pesanan.return` | PEMBINA | `DIAJUKAN → DIKEMBALIKAN`; alasan wajib |
| `pesanan.bulk_approve_rutin` | PEMBINA | Loloskan SEMUA pesanan `DIAJUKAN` yang RUTIN sekaligus (satu ketuk) — dipakai saat `autoLolosRutin`=false. RUTIN/ANOMALI dihitung ulang di backend (bukan dari klien); `verif_by`=Pembina yang mengeklik (bukan `SISTEM` — aksi manual). Return `{disetujui, detail:[{pesanan_id, label}]}`. |
| `pesanan.kirim` | SENAT | `DISETUJUI → TERKIRIM`; hanya ≤ H-1 dari tgl_makan; lewat itu tolak → arahkan ke `pesanan.revisi` |
| `pesanan.revisi` | SENAT | pesanan baru ber-`revisi_dari` (SOP 7b); wajib lampiran BA perubahan |
| `pesanan.list` / `pesanan.get` | semua login | |
| `pesanan.antrian_verifikasi` | PEMBINA | `{}` → `{kebijakan:{autoLolosRutin}, antrian:[{...pesanan, anomali, label, alasan, jml_kemarin, selisih}]}` — hanya baris `DIAJUKAN` + info anomali per baris (dipakai `/verifikasi`). Bila `autoLolosRutin` aktif, antrian ini SECARA ALAMI hanya anomali (rutin sudah auto-lolos di `pesanan.submit`); bila nonaktif, berisi semua dengan label masing-masing. |

Transisi ilegal → error eksplisit (mis. "Pesanan berstatus DRAFT, tidak bisa diverifikasi").

### Realisasi (SOP no. 8–9)

| Action | Role | Keterangan |
|---|---|---|
| `realisasi.create` | PEMBINA, SENAT | pesanan wajib TERKIRIM; porsi, ketidaksesuaian, geotag; foto via lampiran `jenis=FOTO`. Ownership Taruna Fitur 1b: field `piket_nit`/`piket_menu_sesuai`/`piket_porsi_cukup`/`piket_kualitas`/`piket_gizi[]`/`piket_catatan` OPSIONAL (wajib bila `getKebijakanPiket().wajib`, default false) — NIT divalidasi ke roster TARUNA, `piket_kualitas` wajib salah satu `BAIK`/`CUKUP`/`KURANG` begitu `piket_nit` diisi, `piket_gizi` divalidasi terhadap `getKebijakanGizi().komponen`. MENAMBAH bukti, TIDAK mengubah ttd/foto/geotag yang sudah ada |
| `realisasi.ttd` | PEMBINA, SENAT | mengisi `ttd_{role}_at` miliknya (konfirmasi kata sandi ulang, field payload tetap `pin`); kedua ttd terisi → otomatis `rekapUpdate(tanggal)` |
| `realisasi.list` | semua login | |
| `realisasi.kebijakan_piket` | semua login | `{}` → `{wajib, komponen_gizi}` — kebijakan piket (`getKebijakanPiket`) + standar gizi (`getKebijakanGizi`) efektif, dipakai form realisasi (checklist piket) & papan Menu Hari Ini (tahap lanjutan) |
| `realisasi.penerimaan` | SENAT, PEMBINA, ADMIN | `{real_id? , pesanan_id?, penerimaan:{pagi,siang,malam:[{komponen,ada,jumlah,keterangan?}]}}` — checklist Penerimaan Barang Senat per waktu makan × komponen (`komponen` divalidasi ke `getKebijakanKomponenMenu().komponen`, `jumlah` integer ≥ 0, kunci waktu selain pagi/siang/malam ditolak). `keterangan` OPSIONAL, bebas isi maks 60 karakter — dipakai mis. mencatat jenis lauk nyata (Ikan/Ayam/Tempe/Kerupuk dst), TIDAK dikunci enum. Realisasi TERKAIT harus SUDAH ADA (dicari via `real_id`, atau via `pesanan_id` bila `real_id` tak diberikan) — kalau belum ada, tolak dengan pesan "buat realisasi.create dulu". TERPISAH dari `realisasi.ttd` (decouple, boleh diisi kapan saja). MENAMBAH data, TIDAK mengubah `porsi_diterima`/`jml_taruna_makan`/ttd/`piket_*` yang sudah ada |
| `realisasi.kebijakan_penerimaan` | semua login | `{}` → `{komponen}` — daftar item menu (`getKebijakanKomponenMenu`) dipakai form realisasi (blok Penerimaan Barang, Senat) |
| `realisasi.rekap_penerimaan` | PPK, KPA, WADIR3, SENAT (baca) | `{bulan, penyedia_id?}` → `{bulan, total_realisasi, per_komponen:[{komponen,kali_ada,kali_tidak_ada,persen_lengkap,total_jumlah,total_selisih}], persen_lengkap_keseluruhan, komponen_paling_sering_kurang}` — turunan MURNI baca dari `REALISASI.penerimaan` (parse JSON), TIDAK menulis apa pun. `total_selisih` = SUM(`porsi_diterima` − jumlah tercatat) hanya saat komponen dicentang ada (indikasi kurang kuantitas). `penyedia_id` menyaring lewat `PESANAN.kontrak_id → KONTRAK.penyedia_id`. Bahan evaluasi penyedia |

### Rekap Bulanan (SOP no. 10)

| Action | Role | Keterangan |
|---|---|---|
| `rekap.get` | PPK, KPA, WADIR3 | `{bulan}` → `{rekap, total, bulan, D, ambang_outlier}` — `rekap` baris mentah REKAP_BULANAN (nit, hari_makan, hari_tidak_makan, nominal, status, dst; nama/prodi/tingkat di-join FRONTEND dari `taruna.list` yang sudah ter-cache offline, TIDAK diduplikasi di sini); `D` = hari realisasi sah bulan itu (`hari_makan + hari_tidak_makan` baris pertama — konstan utk semua taruna AKTIF); `ambang_outlier` dari `getKebijakanRekap()` (Script Property `KEBIJAKAN_REKAP`, default 3) — dipakai frontend utk penanda anomali (Redesign Rekap Bulanan), MURNI tampilan, tidak memengaruhi hitungan nominal |
| `rekap.approve_wadir3` | WADIR3 | `DRAFT → DISETUJUI_WADIR3` — **persetujuan PALING AWAL** atas rekap; angka belum beku |
| `rekap.batal_wadir3` | WADIR3 | `DISETUJUI_WADIR3 → DRAFT` — Wadir 3 membatalkan persetujuannya sendiri (mis. salah klik atau ada koreksi hari makan yang perlu diperbaiki dulu); ditolak bila PPK sudah memverifikasi (`TERVERIFIKASI_PPK`/`FINAL`) — setelah itu pembatalan tertutup otomatis |
| `rekap.verify` | PPK | `DISETUJUI_WADIR3 → TERVERIFIKASI_PPK` — PPK memeriksa hasil yang sudah disetujui Wadir 3 |
| `rekap.final` | PPK | `TERVERIFIKASI_PPK → FINAL` — **PPK finalkan (langkah TERAKHIR)**: angka BEKU, dasar SPM, siap dibayar; update berikutnya ditolak; syarat `bayar.create` |
| `rekap.input_historis` | PPK, ADMIN | `{bulan, biaya_per_hari, baris:[{nit,hari_makan,hari_tidak_makan?}]}` — migrasi bulan pra-aplikasi (mis. Januari–Juni sebelum e-BAMA aktif), TANPA Pesanan/Realisasi harian palsu; `biaya_per_hari` = satu angka Rp/hari (bukan harga_per_porsi × porsi_per_hari) karena rate historis bisa beda per kelompok — panggil berkali-kali per kelompok rate untuk bulan yang sama; tolak bila bulan itu sudah punya baris bukan `DRAFT`; jejak sumber di AUDIT_LOG (`sumber: INPUT_HISTORIS_PRA_APLIKASI`), lanjut alur normal `rekap.approve_wadir3 → rekap.verify → rekap.final` |

> **Urutan persetujuan (dikonfirmasi Firdaus):** Wadir 3 menyetujui DULU, baru PPK
> verifikasi lalu finalkan. Prinsipnya PPK di posisi TERAKHIR — menerima hasil
> yang sudah disetujui untuk dinyatakan siap dibayar. Angka beku saat PPK finalkan.

`rekapUpdate(tanggal)` internal (bukan action publik): incremental per hari, uang integer —
`nominal = hari_makan × harga_per_hari` (tarif kontrak aktif via `_hargaPerHariKontrak_`,
`05_master.gs`; fallback `harga_per_porsi × porsi_per_hari` untuk kontrak lama yang belum
diisi ulang sejak migrasi harga per-porsi → per-hari, dikonfirmasi Firdaus).

### Pembayaran (SOP no. 11–17) — mesin status `DIAJUKAN → SELESAI` (disederhanakan)

> **Disederhanakan (dikonfirmasi Firdaus):** No. SP2D terisi = dana SUDAH cair
> ke rekening taruna (SP2D dari KPPN, mekanisme LS) → pembayaran OTOMATIS
> `SELESAI` saat itu juga, TANPA konfirmasi Senat atau tutup manual terpisah.
> Pendebetan 2 tahap (taruna→Senat→Penyedia) TETAP berjalan, tapi lewat
> DOKUMEN CETAK terpisah (Form-07 lalu Form-09, § Cetak Form Manual SOP) yang
> TIDAK mengunci/menunggu status PEMBAYARAN ini — begitu No. SP2D diketahui,
> mencetak & mengirim Form-07 ke bank jadi MENDESAK (dana sudah cair).
> Persetujuan rekap (Wadir 3 → PPK verifikasi → PPK finalkan) sudah dilalui
> saat rekap berstatus `FINAL`, yang menjadi syarat `bayar.create`.

> **Relasi 1 PEMBAYARAN : N SP2D.** Satu baris PEMBAYARAN (per bulan) mewakili
> BANYAK SP2D nyata — KPPN menerbitkan satu SP2D per kelompok **Prodi+Tingkat**
> (mis. Januari 2026 = 10 SP2D). Field `no_spm`/`no_sp2d` di sheet PEMBAYARAN
> cuma "wakil" untuk input manual/fallback; rincian SP2D sebenarnya TIDAK
> disalin, tapi diturunkan **LIVE** dari `SP2D_MONITORING` (via
> `_rincianSp2dDalamKampus_`, `23_sp2d.gs`) dan ditempel di `bayar.list`/
> `bayar.get` sebagai `sp2d_rincian` (daftar kelompok Prodi+Tingkat, tiap
> kelompok memuat sub-daftar No. SP2D) + `sp2d_lengkap` (semua kelompok
> bersistem >0 sudah cocok) + `sp2d_perlu_cek_manual` (jumlah baris gagal
> parse). Begitu `sp2d_lengkap`, status OTOMATIS `SELESAI` — dijalankan dari
> `sp2d.import` (auto) atau `bayar.sync` (manual). Tiap kelompok `sp2d_rincian`
> juga memuat `per_suplier:[{penyedia_id,penyedia_nama,sistem,sp2d_perkiraan,selisih_perkiraan}]`
> (dikonfirmasi Firdaus) — pecahan per `TARUNA_REKENING.penyedia_id`. `sistem`
> ASLI (SUM REKAP_BULANAN suplier itu); `sp2d_perkiraan`/`selisih_perkiraan`
> SELALU **taksiran** (dibagi proporsional dari total SP2D kelompok berdasar
> porsi `sistem` tiap suplier, sisa pembulatan ditumpuk ke baris terakhir agar
> SUM tetap persis sama dgn `sp2d`) — `SP2D_MONITORING` (impor KPPN) tidak
> punya kolom suplier sama sekali, jadi angka SP2D per suplier yang sungguh
> asli memang tidak ada. Frontend WAJIB menandai kolom ini "perkiraan", bukan
> angka resmi KPPN.

| Action | Role | Keterangan |
|---|---|---|
| `bayar.create` | PPK | syarat REKAP bulan tsb `FINAL` (setelah Wadir 3 setujui → PPK verifikasi → PPK finalkan); `nilai_total` = SUM(nominal) snapshot. **Sekaligus** memanggil `_generateSpmDalamKampus_` (`15_pembayaran.gs`) — membuat baris `SPM` (kategori `DALAM_KAMPUS`) satu per kelompok (prodi, tingkat, `TARUNA_REKENING.penyedia_id`), status awal `DRAFT`, nominal beku. Ditolak bila ada taruna ber-REKAP bulan itu TANPA `penyedia_id` (lengkapi dulu lewat `rekening.simpan`) |
| `bayar.update` | PPK | isi no_spm/tgl_spm, no_sp2d/tgl_sp2d; No. SP2D terisi → status **langsung `SELESAI`**; lampiran surat blokir / bukti debet / invoice (bisa diunggah kapan saja). "Wakil" manual / fallback — cara utama ke `SELESAI` adalah lewat kelengkapan `SP2D_MONITORING` + `bayar.sync`, ATAU (bulan yang punya baris `SPM`) lewat `spm.set_sp2d` di semua baris SPM-nya |
| `bayar.sync` | PPK | `{bulan}` → tandai `SELESAI` bila PEMBAYARAN bulan itu masih `DIAJUKAN` DAN `_rincianSp2dDalamKampus_(bulan).lengkap`; kalau belum lengkap → error berisi jumlah kelompok yang belum cocok. Untuk kasus SP2D diunggah **sebelum** `bayar.create` (auto-sync di `sp2d.import` tak sempat menemukan barisnya). **Jalur legacy** — bulan yang sudah punya baris `SPM` selesai otomatis lewat `spm.set_sp2d` (`_cekSelesaikanPembayaranDariSpm_`), tidak perlu `bayar.sync` |
| `bayar.close` | PPK | fallback manual → `SELESAI`; **bukan bagian alur normal** — hanya untuk baris historis yang masih berstatus lama (`SP2D_TERBIT`/`DITRANSFER`/`DIKONFIRMASI`) dari sebelum penyederhanaan ini |
| `bayar.list` / `bayar.get` | PPK, KPA, SENAT, WADIR3 | balasan diperkaya `sp2d_rincian` + `sp2d_lengkap` + `sp2d_perlu_cek_manual` (LIVE dari `SP2D_MONITORING`) — **jalur legacy**, dipakai frontend HANYA utk bulan yang TIDAK punya baris `SPM` (lihat `spm.list` di bawah) |
| `spm.list` | PPK, KPA, SENAT, WADIR3, ADMIN | `{bulan?, bayar_id?, kategori?}` → `{spm:[{spm_id,bayar_id,kategori,bulan,prodi,tingkat,penyedia_id,penyedia_nama,kegiatan,pembayaran_ke,periode,nominal,no_spm,tgl_spm,no_sp2d,tgl_sp2d,status,nit_anggota,induk_spm_id}]}` — daftar baris `SPM` tersimpan (bukan perkiraan). `penyedia_nama` di-join dari PENYEDIA (kosong bila tak ketemu). `nit_anggota`/`induk_spm_id` kosong = baris natural (belum pernah displit); terisi = hasil `spm.split`/sisa induk setelahnya. Frontend `pembayaran.tsx`: bulan dgn `spm.length>0` → tampilkan kartu "SPM Dalam Kampus" (`spm-dalam-kampus.tsx`, bisa diedit inline), GANTI kartu "Rincian SP2D" legacy. Bulan dgn PEMBAYARAN sudah ada tapi `spm.length===0` (mis. dibuat sebelum fitur ini ada) → tampilkan kartu "Rancangan SPM belum dibuat" dgn tombol yang memanggil `spm.regenerate` (aman dipakai utk bikin PERTAMA KALI, bukan cuma "buat ulang") |
| `spm.update` | PPK, ADMIN | `{spm_id, no_spm?, tgl_spm?, status?}` → isi No. SPM & ajukan (`DRAFT→DIAJUKAN`, kirim `status:'DIAJUKAN'` eksplisit); ditolak bila SPM sudah `SP2D_TERBIT` (beku). Boleh diedit ulang selama belum `SP2D_TERBIT` (SPM ditolak/dikembalikan KPPN) |
| `spm.set_sp2d` | PPK, ADMIN | `{spm_id, no_sp2d, tgl_sp2d}` → isi hasil SP2D, `DIAJUKAN→SP2D_TERBIT` (syarat: harus `DIAJUKAN` dulu). Kategori `DALAM_KAMPUS`: begitu SEMUA SPM `bayar_id` itu `SP2D_TERBIT`, PEMBAYARAN induk otomatis `SELESAI` |
| `spm.anggota` | PPK, ADMIN | `{spm_id}` → `{spm_id, anggota:[{nit,nama,nominal}], total_nominal}` — daftar taruna dalam satu baris SPM, sumber checklist utk `spm.split`. Kalau `nit_anggota` baris itu terisi → dipakai langsung; kalau kosong (grup natural) → di-derive PERSIS seperti `_generateSpmDalamKampus_` (REKAP_BULANAN join TARUNA_REKENING.penyedia_id + TARUNA, filter prodi+tingkat+penyedia_id). HANYA kategori `DALAM_KAMPUS` |
| `spm.split` | PPK, ADMIN | `{spm_id, nit_list}` → `{spm_asal:{spm_id,nominal,nit_anggota}, spm_baru:{...baris SPM baru lengkap...}}` — keluarkan sebagian taruna (`nit_list`, harus anggota SPM ini, TIDAK boleh seluruh anggota) jadi baris SPM baru (kunci grup sama, `nit_anggota` diisi eksplisit, `induk_spm_id` = SPM asal, status `DRAFT`); nominal SPM asal berkurang, `nit_anggota`-nya ikut diisi eksplisit. HANYA `DALAM_KAMPUS`, HANYA selama status `DRAFT` (snapshot beku §5 CLAUDE.md). Efek DISENGAJA: `_autoIsiSpmDariSp2d_` otomatis melewati grup ini begitu >1 baris berbagi kunci sama — isi `no_spm`/`no_sp2d` manual per pecahan |
| `spm.gabung` | PPK, ADMIN | `{spm_id_a, spm_id_b}` → `{spm_id, nominal, nit_anggota, spm_dihapus}` — kebalikan `spm.split` (koreksi salah pisah). Ditolak bila salah satu bukan `DRAFT`, kunci grup (kategori+bayar_id+prodi+tingkat+penyedia_id+kegiatan+pembayaran_ke) beda, atau `nit_anggota` tumpang tindih (data tak konsisten). Baris dipertahankan: yang tanpa `induk_spm_id` (asli), atau `spm_id` lebih kecil kalau keduanya punya induk; baris satunya dihapus (`sheetDeleteRows`). Kategori `DALAM_KAMPUS`: kalau gabungan PERSIS sama dengan keanggotaan alami grup itu (`_nitAlamiDalamKampus_`), `nit_anggota` OTOMATIS dikosongkan lagi (baris kembali "natural") |
| `spm.regenerate` | PPK, ADMIN | `{bayar_id}` → hapus & buat ulang SPM `DALAM_KAMPUS` dari REKAP_BULANAN terbaru; HANYA bila SEMUA baris grup itu masih `DRAFT` (dipakai kalau REKAP dikoreksi setelah SPM dibuat, sebelum diajukan). DITOLAK JUGA bila grup sudah pernah displit (ada `induk_spm_id` terisi ATAU >1 baris berbagi kunci grup sama) — gabungkan dulu lewat `spm.gabung` |

### Tagihan Gagal Debet — status `TERTAGIH → LUNAS | DIHAPUSKAN | ESKALASI_MANUAL`

| Action | Role | Keterangan |
|---|---|---|
| `tagihan.create` | SENAT, PPK | batch `{bulan, nit[], sebab}`; nominal snapshot dari REKAP FINAL; tolak duplikat bulan+nit; **langsung terbitkan SP-1** |
| `tagihan.list` | semua login | sertakan `level_aktif` (MAX level SP) + `tenggat_aktif` + `verif_1_oleh`/`verif_2_oleh`/`nilai_transfer`/`bukti_setor_drive_file_id`/`selisih_transfer` (=nominal-nilai_transfer, dihitung) + `tgl_diteruskan_penyedia` (kosong = dana LUNAS belum diteruskan ke penyedia) + `kebijakan:{toleransiSelisihTransfer}` (dari `getKebijakanTagihan`, `00_config.gs`); cache 60 detik, invalidate saat tulis |
| `tagihan.summary` | PPK, KPA, WADIR3 | `{per_level: {0..3: {jumlah, nominal}}, total_outstanding, belum_disetor: {jumlah,nominal}, sudah_disetor_menunggu_verifikasi_1: {jumlah,nominal}, verifikasi_1x: {jumlah,nominal}, lunas_belum_diteruskan: {jumlah,nominal}, lunas_sudah_diteruskan: {jumlah,nominal}, eskalasi_manual: {jumlah,nominal}}` — dashboard piutang, dipakai juga di dashboard KPA (`total_outstanding` saja). `per_level` HANYA tagihan `TERTAGIH` murni (TIDAK termasuk `ESKALASI_MANUAL`, dipisah — lihat di bawah). Tiap tagihan `TERTAGIH` jatuh ke TEPAT SATU dari 3 bucket tahap (saling eksklusif, urut tahap): `belum_disetor` (`tgl_setor` kosong — tahap PALING AWAL; sebelumnya kondisi ini di-skip diam-diam dan tagihan-nya "hilang" dari ringkasan meski tetap kehitung di `total_outstanding`/`per_level`), `sudah_disetor_menunggu_verifikasi_1` (`tgl_setor` terisi, belum ada verifikator sama sekali), `verifikasi_1x` (sudah verifikator pertama, menunggu verifikator kedua). `lunas_belum_diteruskan`/`lunas_sudah_diteruskan` pakai `nilai_transfer` (fallback `nominal`) dan dipisah berdasar `tgl_diteruskan_penyedia` — `lunas_belum_diteruskan` adalah angka "dana tagih-ulang yang sudah dikumpulkan tapi belum diteruskan ke penyedia" (TERPISAH dari status SP2D/SPM jalur pembayaran LS utama). `eskalasi_manual` = tagihan berstatus `ESKALASI_MANUAL` (SP-3 lewat tenggat, ditandai `eskalasiTagihan()` §20_trigger.gs) — piutang paling telat/berisiko, TETAP masuk `total_outstanding` (bug lama: sebelumnya lenyap total dari `total_outstanding` maupun `per_level` begitu status naik ke `ESKALASI_MANUAL`) tapi dipisah dari `per_level` SP-1/2/3 supaya semantiknya jelas (masih diproses lewat SP vs sudah keluar dari proses SP). Invarian cross-check: `belum_disetor.jumlah + sudah_disetor_menunggu_verifikasi_1.jumlah + verifikasi_1x.jumlah + eskalasi_manual.jumlah` selalu sama dengan jumlah baris berstatus `TERTAGIH`+`ESKALASI_MANUAL` (SUM `per_level[0..3].jumlah` + `eskalasi_manual.jumlah`). Selain field top-level (agregat SEMUA bulan), ada juga `per_bulan: {'YYYY-MM': {ember lengkap yang sama}}` — status gagal debet dipecah PER BULAN (frontend menampilkan ringkasan mini di tiap grup bulan: sudah lunas, belum lunas, verifikasi 1x, siap diteruskan ke penyedia, sudah diteruskan). Invarian: `SUM per_bulan[*].total_outstanding === total_outstanding` |
| `tagihan.teruskan_penyedia` | SENAT, PEMBINA, ADMIN, PPK | `{tagihan_id_list:[], berkas:{base64,nama_file}}` — tandai BATCH tagihan `LUNAS` yang dananya sudah diteruskan dari rekening Senat ke penyedia (mengisi `tgl_diteruskan_penyedia`); TERPISAH dari jalur SP2D/SPM. Tolak bila ada baris berstatus bukan `LUNAS` atau sudah pernah diteruskan; bukti transfer WAJIB (LAMPIRAN `jenis=BUKTI_TERUSKAN_PENYEDIA`), satu lampiran ditautkan ke entri PERTAMA saja (pola sama seperti `statusBatch`). Return `{jml_diteruskan, total_nominal, tgl_diteruskan_penyedia}` |
| `tagihan.status_debet` | PPK, SENAT, KPA, WADIR3 (baca saja) | `{bulan}` → `{bulan, baris:[{nit,nama,prodi,tingkat,nominal,status_debet:'BERHASIL'\|'GAGAL',tagihan_id,sebab,status_tagihan}], total_taruna, jml_berhasil, jml_gagal}` — laporan status debet taruna→Senat per taruna. Bandingkan REKAP_BULANAN nominal>0 vs TAGIHAN bulan itu; `BERHASIL` = **inferensi** (tidak ada baris TAGIHAN, bukan konfirmasi aktif dari bank); `GAGAL` = ada baris TAGIHAN apa pun status penyelesaiannya (TERTAGIH/LUNAS/DIHAPUSKAN/ESKALASI_MANUAL tetap dihitung gagal debet awal) |
| `tagihan.setor` | SENAT, PEMBINA, ADMIN, PPK | bukti setor (`jenis=BUKTI_SETOR`, screenshot/foto transfer) + tgl_setor; status tetap TERTAGIH |
| `tagihan.verifikasi` | SENAT, PEMBINA, ADMIN, PPK | `{tagihan_id, nilai_transfer}` — verifikasi ganda TANPA urutan peran tetap (dikonfirmasi Firdaus, direvisi): siapa pun di antara 4 role boleh jadi verifikator 1 atau 2, syaratnya cuma dua ORANG berbeda (`user_id`), peran boleh sama. Syarat: bukti setor ada, `nilai_transfer` > 0 — TIDAK WAJIB sama dengan nominal tagihan (dikonfirmasi Firdaus, direvisi dari validasi ketat: potongan biaya transfer/kurang bayar tetap bisa dilunaskan, selisih tetap tercatat untuk rekonsiliasi). Panggilan ke-1 → set verifikator 1, status TETAP TERTAGIH. Panggilan ke-2 (user_id beda) → set verifikator 2 → `LUNAS`, `diverifikasi_oleh` terisi, return tambahan `piutang_kurang_bayar` (selisih di atas `getKebijakanTagihan().toleransiSelisihTransfer`, default Rp20.000 — 0 bila dalam toleransi; juga dicatat di AUDIT_LOG, jejak utk tagih ulang manual bulan depan). Efek samping: hapus SP milik tagihan ini yang `tgl_terbit` lebih baru dari `tgl_setor` (dibayar sebelum SP terbit → SP tak berdasar) |
| `tagihan.waive` | PPK | `catatan_hapus` WAJIB → `DIHAPUSKAN` |
| `tagihan.regenerate_sp` | PPK | terbitkan ulang PDF level aktif — no_surat BARU, baris SP baru, `generated_by=MANUAL` |
| `sp.list` | semua login | riwayat SP per tagihan |

### Laporan & Audit

| Action | Role | Keterangan |
|---|---|---|
| `laporan.bulanan` | PPK, KPA, WADIR3, ADMIN | ringkasan rekap + realisasi + pembayaran + piutang per bulan (SOP 17–19); format menyesuaikan Laporan Bulanan BAMA |
| `laporan.resmi` | PPK, KPA, WADIR3, ADMIN | data untuk format "Laporan Bulanan Pemantauan & Evaluasi Bantuan Biaya Makan" resmi (acuan Itjen/KKP) — HANYA bagian Dalam Kampus yang dilacak e-BAMA (info umum, data penerima, realisasi, penggunaan dana, sebagian permasalahan); bagian DIPA/SK/rencana anggaran/Pengusulan diisi manual di halaman cetak, TIDAK tersimpan di server. `kontrak` sub-objek += `harga_per_hari_efektif` (dipakai "Rencana Biaya per Orang per Hari"/"Standar Biaya per Hari"/"Besaran pendebetan per hari") |

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

### Cetak Form Manual SOP (Form 01–09)

> Modul `backend/src/21_cetak.gs`. Semua Form 01–09 **sudah ada di
> `ACTION_MAP`**. Form 09 (pendebetan Senat → Penyedia) adalah tahap-2
> pembayaran, dokumen-only (tidak mengubah mesin status pembayaran). Peta form ↔
> sumber data lengkap: `docs/format-dokumen.md`. Pola tampilan cetak (React):
> rujuk `frontend/src/pages/laporan/laporan-resmi.tsx` — satu action
> GET-style per form → data bundel lengkap, halaman merender semua bagian
> dengan kelas `print:hidden`/`print:block`, tombol Cetak = `window.print()`.
> Kolom yang memang wajib diisi manual (mis. "Penjelasan/Penyebab" Form 05)
> SENGAJA tidak diisi otomatis — state lokal React saja, tidak dikirim ke
> server.

| Action | Role | Payload → Data | Status |
|---|---|---|---|
| `cetak.form01` | SENAT, PEMBINA, PPK, ADMIN | `{tgl_makan}` → `{pesanan, kontrak:{kontrak_id,harga_per_porsi,porsi_per_hari,harga_per_hari_efektif}, jml_status_harian, dibuat_oleh_nama, diverifikasi_oleh_nama, verif_at}` — Rencana & Persetujuan Pemesanan Harian (H-1); total biaya = `jml_taruna × harga_per_hari_efektif` | ✅ diimplementasi |
| `cetak.form02` | PEMBINA, PPK, ADMIN | `{tanggal}` → `{tanggal, taruna:[{nit,nama,prodi,tingkat,kelas}], jml_taruna, realisasi}` — Daftar Hadir/Tanda Terima Makan; **tanpa presensi individual** (dikonfirmasi Firdaus) — ttd digital REALISASI jadi bukti | ✅ diimplementasi |
| `cetak.form03` | PPK, ADMIN, PEMBINA | `{bulan}` → `{bulan, per_status:{...}, total}` — Rekap Taruna Tidak Menerima Makan | ✅ diimplementasi |
| `cetak.form04` | SENAT, PEMBINA, PPK, ADMIN | `{bulan}` → `{bulan, baris:[{tanggal,taruna_aktif,total_porsi,jumlah_biaya,kontrak_ditemukan}], total_taruna_aktif, total_porsi, total_biaya, kontrak_ringkas:[{kontrak_id,penyedia_nama,harga_per_porsi,harga_per_hari_efektif}]}` — Rekapitulasi Bulanan Porsi Makan; **total porsi/hari agregat** (dikonfirmasi Firdaus), tanpa rincian Sarapan/Siang/Malam; `jumlah_biaya` harian = `REALISASI.jml_taruna_makan × harga_per_hari_efektif` (headcount, bukan `porsi_diterima` — konsisten Form-05) | ✅ diimplementasi |
| `cetak.form05` | PEMBINA, PPK, ADMIN | `{tanggal}` → `{titik1_taruna_berhak, titik2_total_pesanan, titik3_total_realisasi, selisih_titik1_titik2, selisih_titik2_titik3, cocok, cek_otomatis}` — BA Rekonsiliasi 3 Titik | ✅ diimplementasi |
| `cetak.form06` | PPK, KPA, ADMIN, OPERATOR_SAKTI | `{bulan}` → `{baris, total_taruna, total_hari_makan, total_nominal, nominal_terbilang, pejabat}` — Verifikasi & Rencana Pembayaran PPK; **ditolak bila REKAP_BULANAN bulan itu belum FINAL** | ✅ diimplementasi (`_terbilang_()` di `03_helpers.gs`) |
| `cetak.form07` | **ADMIN, PPK SAJA** | `{bulan}` → `{pembayaran, baris:[{nit,nama,prodi,tingkat,bank,no_rekening_lengkap,nama_pemilik,nominal,nilai_debet,hari_makan,rekening_lengkap_ada}], total_nominal, biaya_admin_bank, pejabat:{PPK,KPA,DIREKTUR,WADIR3}, rekening_senat:{BNI,BSI}, rekening_penyedia:{BNI,BSI}, rekening_senat_nama:{BNI,BSI}, rekening_penyedia_nama:{BNI,BSI}, kontrak:{no_kontrak,tgl_kontrak,adendum}}` — Permohonan Pemblokiran & Pendebetan Rekening Taruna; sumber PEMBAYARAN+REKAP_BULANAN+`TARUNA_REKENING`+KONTRAK; **rekening_penyedia diambil dari KONTRAK pembayaran (`rek_penyedia_bni/bsi`), fallback Script Property**; rekening_senat tetap Script Property; **ditolak bila belum ada PEMBAYARAN bulan itu**; setiap panggilan mencatat 1 baris AUDIT_LOG (NIT yang rekeningnya terbaca). Taruna bernilai **Rp0 dikecualikan** (tak perlu diblokir/didebet, rekeningnya pun tidak ikut terbaca/diaudit). **`nilai_debet`** (dikonfirmasi Firdaus) = nilai SPM (`nominal`) per taruna DIKURANGI biaya admin bank (`getKebijakanPendebetan().biayaAdminBank`, default Rp10.000, `00_config.gs`) — floor di 0, tidak pernah negatif; inilah nilai yang DIINSTRUKSIKAN ke bank untuk didebet (kolom "Nilai Debet" di form & surat), sedangkan `nominal` tetap nilai SPM penuh (dipakai audit/rekonsiliasi, TIDAK berubah). **Alur surat (dikonfirmasi Firdaus):** setelah dana cair ke rekening masing-masing taruna, **Direktur + Ketua Senat + Wakil Direktur III** memohon ke bank untuk (1) blokir rekening taruna N hari (lama blokir = input manual di halaman cetak), (2) debet `nilai_debet` per orang → **Rekening Senat**, (3) teruskan total → **rekening penyedia** — semua **terpisah per bank (BNI & BSI)** dengan **total per bank saja (TANPA total gabungan lintas bank)**. TTD taruna di kolom terakhir = kuasa mendebet (menggantikan lampiran Kuasa Blokir terpisah). Ditandatangani **Ketua Senat, Wakil Direktur III, Direktur** | ✅ diimplementasi |
| `cetak.form08` | **ADMIN, PPK SAJA** | `{bulan, kegiatan?}` → `{bulan, kegiatan, baris:[{nit,nama,kegiatan,periode,bank,no_rekening_lengkap,nama_pemilik,rekening_lengkap_ada,jml_hari,total_hari_impor,hari_cocok,nilai_per_hari,nominal,disetujui_kajur}], total_nominal, semua_disetujui_kajur}` — Usulan Pembayaran Luar Kampus; tarif dari `BANTUAN_LUAR_KAMPUS.nilai_per_hari`, `jml_hari` dihitung ulang dari STATUS_HARIAN (dikonfirmasi Firdaus) — bukan `total_hari` hasil impor CSV. `disetujui_kajur` per baris + `semua_disetujui_kajur` = flag persetujuan Ketua Jurusan (soft-gate, tak menghentikan cetak) | ✅ diimplementasi |
| `cetak.form09` | SENAT, PPK, ADMIN, OPERATOR_SAKTI | `{bulan}` → `{bulan, penyedia_nama, per_bank:[{bank,jml_taruna,total,rek_senat_sumber,rek_penyedia_tujuan,rek_senat_nama,rek_penyedia_nama}], total_nominal, nominal_terbilang, biaya_admin_bank, pembayaran:{no_spm,tgl_spm,no_sp2d,tgl_sp2d,status}, kontrak:{no_kontrak,tgl_kontrak,adendum}, pejabat:{PPK,KPA,DIREKTUR,WADIR3}}` — Permohonan Pendebetan Rekening Senat → Penyedia (tahap-2 setelah Form-07). Total per bank = SUM(REKAP_BULANAN.nominal DIKURANGI biaya admin bank per taruna, `getKebijakanPendebetan()`, sama kebijakan dengan Form-07; Rp0 dikecualikan) dikelompokkan lewat **bank rekening riil taruna `TARUNA_REKENING.bank`** (HANYA kolom `bank`, bukan nomor → bukan data sensitif §4, tidak di-audit) — **identik dengan total per bank Form 07** (dikonfirmasi Firdaus: potongan admin bank berlaku di kedua form, bukan cuma Form-07), sebab dana yang diteruskan = hasil pendebetan Form 07. Taruna tanpa baris rekening → grup `TANPA_REKENING`. **`rek_penyedia_tujuan` diambil dari KONTRAK (`rek_penyedia_bni/bsi`), fallback Script Property**; rekening Senat (`rek_senat_sumber`) + nama a.n. dari `getRekeningInstansi()` (Script Property `REKENING_INSTANSI`). **Ditolak bila belum ada PEMBAYARAN bulan itu**. Ditandatangani Ketua Senat (mengajukan) + PPK + Mengetahui Direktur & Wadir 3 | ✅ diimplementasi |
| `cetak.form10` | **ADMIN, PPK SAJA** | `{bulan}` → `{bulan, pembayaran:{...}, per_suplier:[{penyedia_id, penyedia_nama, jml_taruna, total_nominal, total_terbilang, kelompok:[{prodi,tingkat,jml_taruna,total_nominal,baris:[{nit,nama,bank,no_rekening_lengkap,nama_pemilik,hari_makan,nominal,rekening_lengkap_ada}]}]}], total_nominal, nominal_terbilang, pejabat:{PPK,KPA,DIREKTUR,WADIR3}}` — Rencana Pengajuan SPM ke KPPN **dipecah per ID suplier** (tiap suplier = 1 lembar SPM DAN 1 file CSV SPAN — TIDAK berubah, tetap wajib satu suplier satu berkas sesuai SOP kontrak), di dalamnya dikelompokkan **prodi + tingkat** (dikonfirmasi Firdaus: angkatan sudah terwakili oleh ID suplier). **Urutan ANTAR lembar suplier** (array `per_suplier`) diurutkan **prodi → tingkat → nama suplier** (dikonfirmasi Firdaus) — bukan alfabetis nama suplier seperti sebelumnya; suplier yang melayani lebih dari satu prodi/tingkat diwakili kelompoknya yang jumlah tarunanya TERBANYAK untuk penentuan urutan ini (praktiknya jarang terjadi, karena satu suplier biasanya hanya melayani satu prodi+tingkat+angkatan). Suplier tanpa `penyedia_id` ("BELUM DITENTUKAN") tetap selalu di paling bawah, apa pun prodi/tingkatnya. Suplier tiap taruna dari `TARUNA_REKENING.penyedia_id`; `penyedia_nama` di-join dari PENYEDIA (kalau ID tak ada di master → frontend tampilkan ID-nya). Taruna bernilai **Rp0 dikecualikan**. Sumber REKAP_BULANAN+TARUNA+`TARUNA_REKENING` (nomor rekening PENUH → **1 baris AUDIT_LOG** tiap panggilan, NIT terbaca saja). **Ditolak bila belum ada PEMBAYARAN bulan itu**. TTD PPK saja. Frontend menyediakan **ekspor CSV format SPM SPAN per suplier** (`NO\|NAMA_SUPPLIER\|NAMA_PEMILIK_REKENING\|NO_REKENING\|JUMLAH_UANG`, pipe, 1 baris/taruna, tanpa BOM/quote) dari data ini — untuk unggah ke KPPN. Frontend juga punya toggle layar "Pisah" per taruna (tidak dikirim ke server) untuk menjadikan taruna manapun SPM tersendiri (masih di bawah suplier yang sama), lihat `frontend/src/pages/cetak/form-10.tsx` | ✅ diimplementasi |

### Rekening lengkap (`TARUNA_REKENING`) — akses terbatas ADMIN/PPK

> Modul `backend/src/22_rekening.gs`. Pengecualian TERBATAS dari aturan
> "rekening taruna hanya 4 digit terakhir" (CLAUDE.md § 4/§ 7) — lihat
> `docs/skema-sheet.md` §16 untuk skema kolom lengkap.

| Action | Role | Payload → Data | Keterangan |
|---|---|---|---|
| `rekening.lihat_lengkap` | **ADMIN, PPK SAJA** | `{nit}` atau `{nit_list}` → `{rekening:[{nit,no_rekening_lengkap,bank,nama_pemilik,penyedia_id,penyedia_nama}]}` | Dipakai internal `cetak.form07`/`cetak.form08`/`cetak.form10` dan modal "🔒 Rekening" (Admin) di `/taruna`. `penyedia_nama` di-join dari PENYEDIA. Setiap panggilan berhasil WAJIB 1 baris `AUDIT_LOG` (`ref_id`=NIT yang dilihat) — **tanpa** nomor rekening di `AUDIT_LOG`. Dibungkus `withLock` walau baca-saja. |
| `rekening.cocokkan` | **ADMIN, PPK SAJA** | `{no_rekening_list, bulan?, bank?}` → `{hasil:[{no_rekening, ditemukan, nit?, nama_pemilik?, bank?}]}` | Arah SEBALIKNYA dari `rekening.lihat_lengkap` (rekening→NIT). Dipakai `/tagihan/impor-debet` — nomor rekening PENUH dari laporan bank (Autotran) dicocokkan EXACT ke `TARUNA_REKENING.no_rekening_lengkap`, bukan tebak nama (nama di laporan bank sering terpotong). `ditemukan=false` untuk nomor yang tak match (tetap tampil di frontend, wajib konfirmasi manual). `AUDIT_LOG` mencatat jumlah dicocokkan/ditemukan + konteks `bulan:bank` — **tanpa** nomor rekening. |
| `rekening.simpan` | **ADMIN SAJA** | `{nit, no_rekening_lengkap, bank, nama_pemilik, penyedia_id?}` → `{nit, bank, nama_pemilik, penyedia_id}` | PPK tidak bisa menulis, supaya input data sensitif tetap satu pintu. `penyedia_id` opsional (FK PENYEDIA, divalidasi) = suplier yang dipasangkan ke rekening — untuk pemecahan SPM per suplier (Form-10); key tak dikirim → nilai lama dipertahankan, `''` mengosongkan. `AUDIT_LOG` mencatat field yang berubah (termasuk `penyedia_id`), bukan nomor rekeningnya. |
| `rekening.simpan_batch` | **ADMIN SAJA** | `{baris:[{nit,no_rekening_lengkap,bank,nama_pemilik,penyedia_id?}]}` → `{disimpan}` | Versi batch `rekening.simpan` — dipakai halaman "Impor Rekening dari Laporan Bank" (`/taruna/impor-rekening`) setelah Admin mencocokkan manual nama di laporan bank (yang biasanya terpotong) ke NIT. Validasi all-or-nothing sebelum menulis (termasuk `penyedia_id` bila diisi); tiap baris tetap diaudit satu-satu. |

### Rekonsiliasi SP2D (`SP2D_MONITORING`) — dibandingkan per kelompok, bukan ditautkan per baris

> Modul `backend/src/23_sp2d.gs`. Lihat `docs/skema-sheet.md` §17 untuk
> alasan lengkap kenapa rekonsiliasi berbasis SUM per kelompok
> (Prodi+Tingkat+Bulan[+Kegiatan]), bukan tautan 1:1 ke baris SP2D. Digabung
> ke halaman **Laporan Bulanan** (`/laporan`) yang sudah ada.

| Action | Role | Payload → Data | Keterangan |
|---|---|---|---|
| `sp2d.import` | PPK, ADMIN | `{kategori:'DALAM_KAMPUS'\|'LUAR_KAMPUS', baris:[{no_spm,nit?,tgl_spm?,no_sp2d?,tgl_sp2d?,jumlah_pembayaran,status_sp2d?,uraian_asli}]}` → `{ditambah, dilewati}` | Dua format CSV didukung (terdeteksi dari header di frontend): (1) agregat — header persis file ekspor OM-SPAN klasik ("No. SPP/SPM", "Uraian SPP/SPM", dst.), `nit` kosong, Prodi/Tingkat/Bulan/Kegiatan diparse dari Uraian; (2) per-taruna ("SPANExt") — `nit` terisi (dicocokkan Admin/PPK dari nama penerima di frontend sebelum kirim), `prodi`/`tingkat` **TIDAK** disimpan (lihat skema §17 — diturunkan via join TARUNA saat rekonsiliasi supaya tidak dobel), `bulan` = bulan makan diparse dari Deskripsi (BUKAN `tgl_sp2d`, karena tanggal cair sering beda bulan dari bulan makan). **HANYA menambah** `no_spm` yang belum ada — baris lama tidak diproses ulang (dikonfirmasi Firdaus). **Dedup GANDA** (`no_spm` DAN `(nit, no_sp2d)` bila keduanya terisi, lihat `_kunciNitSp2d_`) — mencegah taruna+SP2D yang sama masuk dobel walau `no_spm` hasil sintesis (dari nama penerima, beda ejaan/spasi antar-ekspor) kebetulan berbeda; diperiksa juga antar baris dalam satu batch impor. Gagal parse (format apa pun) → `perlu_cek_manual='YA'`, baris tetap masuk. **Sekaligus auto-isi SPM** (§18) — untuk tiap bulan yang tersentuh, `_autoIsiSpmDariSp2d_` (`15_pembayaran.gs`) mengisi `no_spm`/`tgl_spm`/`no_sp2d`/`tgl_sp2d` pada baris SPM yang cocok tak-ambigu (lihat skema §18), silent bila tidak cocok — tetap bisa diisi manual lewat `spm.update`/`spm.set_sp2d`. |
| `sp2d.rekonsiliasi` | PPK, KPA, WADIR3, ADMIN (baca saja) | `{bulan}` → `{bulan, dalam_kampus:[…], luar_kampus:[…], dalam_kampus_per_taruna:[{nit,nama,prodi,tingkat,sistem,sp2d,selisih,cocok,no_sp2d:[],no_spm:[]}], luar_kampus_per_taruna:[{nit,nama,kegiatan,prodi,tingkat,sistem,sp2d,selisih,cocok,no_spm:[]}], cross_check_sp2d:[{no_sp2d,kategori,prodi,tingkat,kegiatan,ada_agregat,ada_rincian,agregat_total,rincian_total,agregat_orang,rincian_orang,selisih_total,total_cocok,orang_cocok}], perlu_cek_manual:[…]}` | `dalam_kampus`/`luar_kampus`: dari baris **agregat** saja (SUM `REKAP_BULANAN`/`BANTUAN_LUAR_KAMPUS` join `TARUNA`, vs SUM baris SP2D tanpa `nit`). `*_per_taruna`: dari baris **ber-`nit`** saja (prodi/tingkat hasil join `TARUNA`); **`no_spm`** (array, per taruna/`nit`+`kegiatan`) dikumpulkan dari baris SP2D_MONITORING ber-`nit` ybs — dipakai tombol "🔧 Koreksi" per baris di UI (`sp2d.koreksi`) supaya bisa memindahkan baris taruna itu ke kategori lain langsung dari tabel per-taruna, tanpa mencarinya dulu di panel Koreksi Baris SP2D generik. **`cross_check_sp2d`**: menautkan baris AGREGAT (Monitoring, acuan total) dengan baris RINCIAN (SPANExt, per taruna) lewat `no_sp2d` (1 SP2D = 1 kelompok tingkat, dikonfirmasi Firdaus) — `total_cocok` = SUM(rincian) == agregat, `orang_cocok` = COUNT(rincian) == "untuk N Orang" agregat; baris tanpa `no_sp2d` (SP2D belum terbit) dilewati. Baris `perlu_cek_manual` ditampilkan terpisah. |
| `sp2d.list` | PPK, ADMIN (baca saja) | `{bulan}` → `{bulan, baris:[{no_spm,kategori,nit,prodi,tingkat,kegiatan,jumlah_pembayaran,no_sp2d,uraian_asli,perlu_cek_manual}]}` | Daftar baris SP2D_MONITORING bulan itu untuk penelusuran & koreksi manual di UI (panel "Koreksi Baris SP2D" di halaman Laporan). |
| `sp2d.koreksi` | PPK, ADMIN | `{no_spm \| no_spm_list:[], kategori, kegiatan?}` → `{dikoreksi, tak_ketemu}` | **Pindahkan baris SP2D yang "salah tempat"** (massal atau per satu transaksi). Update HANYA `kategori`/`kegiatan` + bersihkan `perlu_cek_manual` (koreksi manual = terverifikasi); `DALAM_KAMPUS` → kegiatan dikosongkan. Cocokkan baris via `_kunciNoSpm_` (toleran prefix "Ref No :"). **TIDAK** menyentuh REKAP_BULANAN/PEMBAYARAN/BANTUAN_LUAR_KAMPUS dan **TIDAK** memicu sinkron pembayaran — rekonsiliasi menyesuaikan saat dibaca ulang. `withLock` + 1 `AUDIT_LOG` per baris. |
| `sp2d.cek_dobel` | PPK, ADMIN (baca saja) | `{bulan}` → `{bulan, kelompok:[{nit,nama,no_sp2d,baris:[{no_spm,jumlah_pembayaran,uraian_asli,perlu_cek_manual}]}], jml_kelompok, jml_baris_dihapus}` | **Deteksi baris SP2D_MONITORING dobel** bulan itu — `nit`+`no_sp2d` sama muncul >1× (biasanya `no_spm` hasil sintesis beda ejaan nama saat impor ulang, lolos dari dedup lama). READ-ONLY, dipakai pratinjau sebelum `sp2d.hapus_dobel`. Baris agregat (tanpa `nit`) atau SP2D belum terbit (tanpa `no_sp2d`) tidak diperiksa. |
| `sp2d.hapus_dobel` | PPK, ADMIN | `{bulan}` → `{dihapus, kelompok_dobel:[{nit,nama,no_sp2d,jumlah_dihapus}]}` | **Hapus baris dobel** (kelompok sama seperti `sp2d.cek_dobel`, dihitung ulang server-side — tak percaya daftar dari klien). Baris PERTAMA per (nit,no_sp2d) dipertahankan, sisanya **DIHAPUS** dari `SP2D_MONITORING` — **satu-satunya penghapusan baris data di seluruh backend** (semua koreksi lain hanya `sheetUpdate` in-place, lihat `sheetDeleteRows` di `03_helpers.gs`). 1 `AUDIT_LOG` per baris dihapus (`data_lama`=seluruh isi baris, `data_baru`=null). **TIDAK** menyentuh REKAP_BULANAN/PEMBAYARAN — nominal taruna itu turun otomatis saat rekonsiliasi dibaca ulang. |
| `ppk.kokpit` | PPK, KPA, WADIR3 (baca saja) | `{bulan}` → `{ringkasan:{bulan,target_rekap,terbayar_sp2d,outstanding_tagihan,porsi_dipesan,porsi_dimakan}, tahapan:[{no,label,status:'hijau'\|'kuning'\|'merah'\|'n_a',angka,prasyarat_ok,link}] (9 langkah), tindakan:[{prioritas,apa,kenapa,link}]}` | **Kokpit PPK, murni agregasi READ-ONLY** — tidak menulis apa pun, tidak melewati guard action mana pun (`link` hanya menautkan ke halaman aksi; penegakan tetap di action masing-masing). Memanggil langsung `bayarList`/`spmList`/`sp2dRekonsiliasi`/`tagihanStatusDebet`/`tagihanList` yang sudah ada (bukan re-derive). **Degradasi anggun**: SPM kosong untuk bulan itu (legacy Jan-Mar 2026 atau belum ada PEMBAYARAN) → status `n_a`, BUKAN `merah`; SURAT_PENDEBETAN (§20, masih PARKIR) → langkah 8 selalu `n_a`. `tindakan` diurutkan tenggat-SP-terlewat dulu (prioritas 0). |

### Portal Penyedia (`penyedia.portal`) — rekanan katering eksternal, akses SANGAT terbatas

> Modul `backend/src/24_penyedia_portal.gs`. Role `PENYEDIA` adalah rekanan di
> luar kampus yang login sendiri. **Pagar akses ganda:** (1) router hanya
> mengizinkan akun `PENYEDIA` memanggil action di allowlist `PENYEDIA_ACTIONS`
> (`penyedia.portal`, `auth.logout`, `auth.change_pin`) — TIDAK ikut semantik
> `roles:[]` yang mengekspos data seluruh sistem; (2) handler memakai
> `_hanyaPenyedia_(session)` dan men-scope semua data ke `session.penyedia_id`.

| Action | Role | Payload → Data | Keterangan |
|---|---|---|---|
| `penyedia.portal` | PENYEDIA | `{}` → `{penyedia:{nama,kontak,alamat,status}, kontrak:[{kontrak_id,harga_per_porsi,porsi_per_hari,harga_per_hari_efektif,tgl_mulai,tgl_akhir,status,menu:[{hari,menu_pagi,menu_siang,menu_malam}],lampiran:[{jenis,nama_file}]}], pesanan:[{tgl_makan,jml_taruna,menu,catatan,status}], realisasi:[{tanggal,porsi_diterima,jml_taruna_makan,ketidaksesuaian,tindak_lanjut}], pembayaran:[{bulan,nilai_total,no_spm,tgl_spm,no_sp2d,tgl_sp2d,status,invoice_dikonfirmasi}]}` | Semua data di-scope ke penyedia yang login (via `kontrak_id` miliknya). `pesanan` HANYA status final `DISETUJUI`/`TERKIRIM`, `tgl_makan ≥` hari ini − 7. **SENGAJA TANPA** data per-taruna (nama/NIT), rekening, geotag realisasi, identitas staf internal (created_by/verif_by/approved_by/uploaded_by), dan **TANPA bantuan makan luar kampus** (BANTUAN_LUAR_KAMPUS/SP2D — transfer tunai ke taruna, bukan lewat kontrak penyedia). READ-ONLY (tanpa audit). |

### Ketua Jurusan (`kajur.*`) — luar kampus, scope prodi

> Modul `backend/src/25_ketua_jurusan.gs`. Role `KETUA_JURUSAN` ditautkan ke SATU
> prodi (`PENGGUNA.prodi`). **Pagar akses ganda** (pola sama PENYEDIA): (1) router
> hanya mengizinkan action di allowlist `KETUA_JURUSAN_ACTIONS` (`kajur.*` +
> `auth.logout`/`auth.change_pin`) — TIDAK ikut semantik `roles:[]`; (2) tiap
> handler memakai `_hanyaKajur_(session)` dan men-scope data ke `session.prodi`.
> Ketua Jurusan menginput absen luar kampus taruna prodinya (boleh tanggal
> lampau), menyetujui rekap prodinya (`DRAFT→DISETUJUI_KAJUR`), dan hanya melihat
> REKAP (tanpa nomor rekening). Detail action di tabel Status Harian di atas.

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

### Rekening instansi (Script Property `REKENING_INSTANSI`)

Rekening **Senat** & **Penyedia** per bank (BNI/BSI) + **nama pemilik rekening**
(`senat_nama`/`penyedia_nama`, untuk "a.n." di surat ke bank) untuk dokumen
pendebetan (Form 07 menyebut rekening Senat & Penyedia tujuan; Form 09 sumber
Senat → tujuan Penyedia). **Bukan** rekening taruna (aturan 4-digit § 4 tidak
berlaku). Disimpan di Script Properties (tanpa perubahan skema sheet), dibaca
lewat `getRekeningInstansi()` → `{senat, penyedia, senat_nama, penyedia_nama}`
(tiap map `{BNI, BSI}`). `setRekeningInstansi` **merge per-kunci** (nilai tak
disebut tetap), diisi dari editor GAS:

```js
setRekeningInstansi({ senat:{BNI:'2026715541'}, penyedia:{BNI:'1946986806'}, penyedia_nama:{BNI:'Mukhori'} })
```

Default kosong → dokumen mencetak titik-titik sampai diisi. Pejabat penandatangan
dokumen (`PEJABAT` di `00_config.gs`) kini juga memuat `DIREKTUR` (default =
identitas KPA, konsisten laporan-resmi) dan `WADIR3` (kosong → titik-titik sampai
nama+NIP diisi).

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
