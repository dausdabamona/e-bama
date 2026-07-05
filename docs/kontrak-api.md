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
| `kontrak.list` | semua login | |
| `kontrak.get` | semua login | `{kontrak_id}` → `{kontrak, lampiran}` |
| `kontrak.upsert` | PPK | hanya boleh diubah selama `DRAFT` |
| `kontrak.approve` | PPK | `DRAFT → DISETUJUI_PPK` (SOP no. 4) |
| `kontrak.lampiran_upload` | PPK | `{kontrak_id, berkas:{base64,nama_file,jenis}}` — menu & nilai gizi (`jenis=MENU_GIZI`), BA penunjukan (`BA`), notulen (`NOTULEN`); boleh kapan saja |
| `menu.list` | semua login | `{kontrak_id}` → `{menu: [...]}` urut Senin→Minggu |
| `menu.upsert` | PPK | `{kontrak_id, hari, menu_pagi, menu_siang, menu_malam}` — menu mingguan terjadwal (referensi hari-dalam-minggu, bukan snapshot tanggal); kunci gabungan (kontrak_id, hari) |
| `pengguna.list` / `pengguna.upsert` / `pengguna.reset_pin` | ADMIN | `pengguna.upsert` menerima `penyedia_id` — **wajib & harus valid** bila `role=PENYEDIA` (menautkan akun ke satu penyedia), dipaksa kosong untuk role lain |

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
| `realisasi.ttd` | PEMBINA, SENAT | mengisi `ttd_{role}_at` miliknya (konfirmasi kata sandi ulang, field payload tetap `pin`); kedua ttd terisi → otomatis `rekapUpdate(tanggal)` |
| `realisasi.list` | semua login | |

### Rekap Bulanan (SOP no. 10)

| Action | Role | Keterangan |
|---|---|---|
| `rekap.get` | PPK, KPA, WADIR3 | per bulan |
| `rekap.approve_wadir3` | WADIR3 | `DRAFT → DISETUJUI_WADIR3` — **persetujuan PALING AWAL** atas rekap; angka belum beku |
| `rekap.verify` | PPK | `DISETUJUI_WADIR3 → TERVERIFIKASI_PPK` — PPK memeriksa hasil yang sudah disetujui Wadir 3 |
| `rekap.final` | PPK | `TERVERIFIKASI_PPK → FINAL` — **PPK finalkan (langkah TERAKHIR)**: angka BEKU, dasar SPM, siap dibayar; update berikutnya ditolak; syarat `bayar.create` |
| `rekap.input_historis` | PPK, ADMIN | `{bulan, biaya_per_hari, baris:[{nit,hari_makan,hari_tidak_makan?}]}` — migrasi bulan pra-aplikasi (mis. Januari–Juni sebelum e-BAMA aktif), TANPA Pesanan/Realisasi harian palsu; `biaya_per_hari` = satu angka Rp/hari (bukan harga_per_porsi × porsi_per_hari) karena rate historis bisa beda per kelompok — panggil berkali-kali per kelompok rate untuk bulan yang sama; tolak bila bulan itu sudah punya baris bukan `DRAFT`; jejak sumber di AUDIT_LOG (`sumber: INPUT_HISTORIS_PRA_APLIKASI`), lanjut alur normal `rekap.approve_wadir3 → rekap.verify → rekap.final` |

> **Urutan persetujuan (dikonfirmasi Firdaus):** Wadir 3 menyetujui DULU, baru PPK
> verifikasi lalu finalkan. Prinsipnya PPK di posisi TERAKHIR — menerima hasil
> yang sudah disetujui untuk dinyatakan siap dibayar. Angka beku saat PPK finalkan.

`rekapUpdate(tanggal)` internal (bukan action publik): incremental per hari, uang integer.

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
> `sp2d.import` (auto) atau `bayar.sync` (manual).

| Action | Role | Keterangan |
|---|---|---|
| `bayar.create` | PPK | syarat REKAP bulan tsb `FINAL` (setelah Wadir 3 setujui → PPK verifikasi → PPK finalkan); `nilai_total` = SUM(nominal) snapshot |
| `bayar.update` | PPK | isi no_spm/tgl_spm, no_sp2d/tgl_sp2d; No. SP2D terisi → status **langsung `SELESAI`**; lampiran surat blokir / bukti debet / invoice (bisa diunggah kapan saja). "Wakil" manual / fallback — cara utama ke `SELESAI` adalah lewat kelengkapan `SP2D_MONITORING` + `bayar.sync` |
| `bayar.sync` | PPK | `{bulan}` → tandai `SELESAI` bila PEMBAYARAN bulan itu masih `DIAJUKAN` DAN `_rincianSp2dDalamKampus_(bulan).lengkap`; kalau belum lengkap → error berisi jumlah kelompok yang belum cocok. Untuk kasus SP2D diunggah **sebelum** `bayar.create` (auto-sync di `sp2d.import` tak sempat menemukan barisnya) |
| `bayar.close` | PPK | fallback manual → `SELESAI`; **bukan bagian alur normal** — hanya untuk baris historis yang masih berstatus lama (`SP2D_TERBIT`/`DITRANSFER`/`DIKONFIRMASI`) dari sebelum penyederhanaan ini |
| `bayar.list` / `bayar.get` | PPK, KPA, SENAT, WADIR3 | balasan diperkaya `sp2d_rincian` + `sp2d_lengkap` + `sp2d_perlu_cek_manual` (LIVE dari `SP2D_MONITORING`) |

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
| `cetak.form01` | SENAT, PEMBINA, PPK, ADMIN | `{tgl_makan}` → `{pesanan, kontrak, jml_status_harian, dibuat_oleh_nama, diverifikasi_oleh_nama, verif_at}` — Rencana & Persetujuan Pemesanan Harian (H-1) | ✅ diimplementasi |
| `cetak.form02` | PEMBINA, PPK, ADMIN | `{tanggal}` → `{tanggal, taruna:[{nit,nama,prodi,tingkat,kelas}], jml_taruna, realisasi}` — Daftar Hadir/Tanda Terima Makan; **tanpa presensi individual** (dikonfirmasi Firdaus) — ttd digital REALISASI jadi bukti | ✅ diimplementasi |
| `cetak.form03` | PPK, ADMIN, PEMBINA | `{bulan}` → `{bulan, per_status:{...}, total}` — Rekap Taruna Tidak Menerima Makan | ✅ diimplementasi |
| `cetak.form04` | SENAT, PEMBINA, PPK, ADMIN | `{bulan}` → `{bulan, baris:[{tanggal,taruna_aktif,total_porsi,jumlah_biaya,kontrak_ditemukan}], total_taruna_aktif, total_porsi, total_biaya, kontrak_ringkas}` — Rekapitulasi Bulanan Porsi Makan; **total porsi/hari agregat** (dikonfirmasi Firdaus), tanpa rincian Sarapan/Siang/Malam | ✅ diimplementasi |
| `cetak.form05` | PEMBINA, PPK, ADMIN | `{tanggal}` → `{titik1_taruna_berhak, titik2_total_pesanan, titik3_total_realisasi, selisih_titik1_titik2, selisih_titik2_titik3, cocok, cek_otomatis}` — BA Rekonsiliasi 3 Titik | ✅ diimplementasi |
| `cetak.form06` | PPK, KPA, ADMIN | `{bulan}` → `{baris, total_taruna, total_hari_makan, total_nominal, nominal_terbilang, pejabat}` — Verifikasi & Rencana Pembayaran PPK; **ditolak bila REKAP_BULANAN bulan itu belum FINAL** | ✅ diimplementasi (`_terbilang_()` di `03_helpers.gs`) |
| `cetak.form07` | **ADMIN, PPK SAJA** | `{bulan}` → `{pembayaran, baris:[{nit,nama,prodi,tingkat,bank,no_rekening_lengkap,nama_pemilik,nominal,hari_makan,rekening_lengkap_ada}], total_nominal, pejabat:{PPK,KPA,DIREKTUR,WADIR3}, rekening_senat:{BNI,BSI}, rekening_penyedia:{BNI,BSI}, rekening_senat_nama:{BNI,BSI}, rekening_penyedia_nama:{BNI,BSI}}` — Permohonan Pemblokiran & Pendebetan Rekening Taruna; sumber PEMBAYARAN+REKAP_BULANAN+`TARUNA_REKENING`; **ditolak bila belum ada PEMBAYARAN bulan itu**; setiap panggilan mencatat 1 baris AUDIT_LOG (NIT yang rekeningnya terbaca). Taruna bernilai **Rp0 dikecualikan** (tak perlu diblokir/didebet, rekeningnya pun tidak ikut terbaca/diaudit). **Alur surat (dikonfirmasi Firdaus):** setelah dana cair ke rekening masing-masing taruna, **Direktur + Ketua Senat + Wakil Direktur III** memohon ke bank untuk (1) blokir rekening taruna N hari (lama blokir = input manual di halaman cetak), (2) debet nilai per orang → **Rekening Senat**, (3) teruskan total → **rekening penyedia** — semua **terpisah per bank (BNI & BSI)** dengan **total per bank saja (TANPA total gabungan lintas bank)**. TTD taruna di kolom terakhir = kuasa mendebet (menggantikan lampiran Kuasa Blokir terpisah). Ditandatangani **Ketua Senat, Wakil Direktur III, Direktur** | ✅ diimplementasi |
| `cetak.form08` | **ADMIN, PPK SAJA** | `{bulan, kegiatan?}` → `{bulan, kegiatan, baris:[{nit,nama,kegiatan,periode,bank,no_rekening_lengkap,nama_pemilik,rekening_lengkap_ada,jml_hari,total_hari_impor,hari_cocok,nilai_per_hari,nominal}], total_nominal}` — Usulan Pembayaran Luar Kampus; tarif dari `BANTUAN_LUAR_KAMPUS.nilai_per_hari`, `jml_hari` dihitung ulang dari STATUS_HARIAN (dikonfirmasi Firdaus) — bukan `total_hari` hasil impor CSV | ✅ diimplementasi |
| `cetak.form09` | SENAT, PPK, ADMIN | `{bulan}` → `{bulan, penyedia_nama, per_bank:[{bank,jml_taruna,total,rek_senat_sumber,rek_penyedia_tujuan,rek_senat_nama,rek_penyedia_nama}], total_nominal, nominal_terbilang, pembayaran:{no_spm,tgl_spm,no_sp2d,tgl_sp2d,status}, pejabat:{PPK,KPA,DIREKTUR,WADIR3}}` — Permohonan Pendebetan Rekening Senat → Penyedia (tahap-2 setelah Form-07). Total per bank = SUM(REKAP_BULANAN.nominal) di-join `TARUNA.bank`; rekening Senat & Penyedia dari `getRekeningInstansi()` (Script Property `REKENING_INSTANSI`, bukan rekening taruna → tidak baca `TARUNA_REKENING`). **Ditolak bila belum ada PEMBAYARAN bulan itu**. Ditandatangani Ketua Senat (mengajukan) + PPK + Mengetahui Direktur & Wadir 3 | ✅ diimplementasi |
| `cetak.form10` | **ADMIN, PPK SAJA** | `{bulan}` → `{bulan, pembayaran:{...}, per_suplier:[{penyedia_id, penyedia_nama, jml_taruna, total_nominal, total_terbilang, kelompok:[{prodi,tingkat,jml_taruna,total_nominal,baris:[{nit,nama,bank,no_rekening_lengkap,nama_pemilik,hari_makan,nominal,rekening_lengkap_ada}]}]}], total_nominal, nominal_terbilang, pejabat:{PPK,KPA,DIREKTUR,WADIR3}}` — Rencana Pengajuan SPM ke KPPN **dipecah per ID suplier** (tiap suplier = 1 lembar SPM), di dalamnya dikelompokkan **prodi + tingkat** (dikonfirmasi Firdaus: angkatan sudah terwakili oleh ID suplier). Suplier tiap taruna dari `TARUNA_REKENING.penyedia_id`; `penyedia_nama` di-join dari PENYEDIA (kalau ID tak ada di master → frontend tampilkan ID-nya). Taruna tanpa suplier masuk grup "BELUM DITENTUKAN" (paling bawah). Taruna bernilai **Rp0 dikecualikan**. Sumber REKAP_BULANAN+TARUNA+`TARUNA_REKENING` (nomor rekening PENUH → **1 baris AUDIT_LOG** tiap panggilan, NIT terbaca saja). **Ditolak bila belum ada PEMBAYARAN bulan itu**. TTD Senat/PPK + Mengetahui Direktur & Wadir 3 | ✅ diimplementasi |

### Rekening lengkap (`TARUNA_REKENING`) — akses terbatas ADMIN/PPK

> Modul `backend/src/22_rekening.gs`. Pengecualian TERBATAS dari aturan
> "rekening taruna hanya 4 digit terakhir" (CLAUDE.md § 4/§ 7) — lihat
> `docs/skema-sheet.md` §16 untuk skema kolom lengkap.

| Action | Role | Payload → Data | Keterangan |
|---|---|---|---|
| `rekening.lihat_lengkap` | **ADMIN, PPK SAJA** | `{nit}` atau `{nit_list}` → `{rekening:[{nit,no_rekening_lengkap,bank,nama_pemilik,penyedia_id,penyedia_nama}]}` | Dipakai internal `cetak.form07`/`cetak.form08`/`cetak.form10` dan modal "🔒 Rekening" (Admin) di `/taruna`. `penyedia_nama` di-join dari PENYEDIA. Setiap panggilan berhasil WAJIB 1 baris `AUDIT_LOG` (`ref_id`=NIT yang dilihat) — **tanpa** nomor rekening di `AUDIT_LOG`. Dibungkus `withLock` walau baca-saja. |
| `rekening.simpan` | **ADMIN SAJA** | `{nit, no_rekening_lengkap, bank, nama_pemilik, penyedia_id?}` → `{nit, bank, nama_pemilik, penyedia_id}` | PPK tidak bisa menulis, supaya input data sensitif tetap satu pintu. `penyedia_id` opsional (FK PENYEDIA, divalidasi) = suplier yang dipasangkan ke rekening — untuk pemecahan SPM per suplier (Form-10); key tak dikirim → nilai lama dipertahankan, `''` mengosongkan. `AUDIT_LOG` mencatat field yang berubah (termasuk `penyedia_id`), bukan nomor rekeningnya. |
| `rekening.simpan_batch` | **ADMIN SAJA** | `{baris:[{nit,no_rekening_lengkap,bank,nama_pemilik,penyedia_id?}]}` → `{disimpan}` | Versi batch `rekening.simpan` — dipakai halaman "Impor Rekening dari Laporan Bank" (`/taruna/impor-rekening`) setelah Admin mencocokkan manual nama di laporan bank (yang biasanya terpotong) ke NIT. Validasi all-or-nothing sebelum menulis (termasuk `penyedia_id` bila diisi); tiap baris tetap diaudit satu-satu. |

### Rekonsiliasi SP2D (`SP2D_MONITORING`) — dibandingkan per kelompok, bukan ditautkan per baris

> Modul `backend/src/23_sp2d.gs`. Lihat `docs/skema-sheet.md` §17 untuk
> alasan lengkap kenapa rekonsiliasi berbasis SUM per kelompok
> (Prodi+Tingkat+Bulan[+Kegiatan]), bukan tautan 1:1 ke baris SP2D. Digabung
> ke halaman **Laporan Bulanan** (`/laporan`) yang sudah ada.

| Action | Role | Payload → Data | Keterangan |
|---|---|---|---|
| `sp2d.import` | PPK, ADMIN | `{kategori:'DALAM_KAMPUS'\|'LUAR_KAMPUS', baris:[{no_spm,nit?,tgl_spm?,no_sp2d?,tgl_sp2d?,jumlah_pembayaran,status_sp2d?,uraian_asli}]}` → `{ditambah, dilewati}` | Dua format CSV didukung (terdeteksi dari header di frontend): (1) agregat — header persis file ekspor OM-SPAN klasik ("No. SPP/SPM", "Uraian SPP/SPM", dst.), `nit` kosong, Prodi/Tingkat/Bulan/Kegiatan diparse dari Uraian; (2) per-taruna ("SPANExt") — `nit` terisi (dicocokkan Admin/PPK dari nama penerima di frontend sebelum kirim), `prodi`/`tingkat` **TIDAK** disimpan (lihat skema §17 — diturunkan via join TARUNA saat rekonsiliasi supaya tidak dobel), `bulan` = bulan makan diparse dari Deskripsi (BUKAN `tgl_sp2d`, karena tanggal cair sering beda bulan dari bulan makan). **HANYA menambah** `no_spm` yang belum ada — baris lama tidak diproses ulang (dikonfirmasi Firdaus). Gagal parse (format apa pun) → `perlu_cek_manual='YA'`, baris tetap masuk. |
| `sp2d.rekonsiliasi` | PPK, KPA, WADIR3, ADMIN (baca saja) | `{bulan}` → `{bulan, dalam_kampus:[…], luar_kampus:[…], dalam_kampus_per_taruna:[…], luar_kampus_per_taruna:[…], cross_check_sp2d:[{no_sp2d,kategori,prodi,tingkat,kegiatan,ada_agregat,ada_rincian,agregat_total,rincian_total,agregat_orang,rincian_orang,selisih_total,total_cocok,orang_cocok}], perlu_cek_manual:[…]}` | `dalam_kampus`/`luar_kampus`: dari baris **agregat** saja (SUM `REKAP_BULANAN`/`BANTUAN_LUAR_KAMPUS` join `TARUNA`, vs SUM baris SP2D tanpa `nit`). `*_per_taruna`: dari baris **ber-`nit`** saja (prodi/tingkat hasil join `TARUNA`). **`cross_check_sp2d`**: menautkan baris AGREGAT (Monitoring, acuan total) dengan baris RINCIAN (SPANExt, per taruna) lewat `no_sp2d` (1 SP2D = 1 kelompok tingkat, dikonfirmasi Firdaus) — `total_cocok` = SUM(rincian) == agregat, `orang_cocok` = COUNT(rincian) == "untuk N Orang" agregat; baris tanpa `no_sp2d` (SP2D belum terbit) dilewati. Baris `perlu_cek_manual` ditampilkan terpisah. |

### Portal Penyedia (`penyedia.portal`) — rekanan katering eksternal, akses SANGAT terbatas

> Modul `backend/src/24_penyedia_portal.gs`. Role `PENYEDIA` adalah rekanan di
> luar kampus yang login sendiri. **Pagar akses ganda:** (1) router hanya
> mengizinkan akun `PENYEDIA` memanggil action di allowlist `PENYEDIA_ACTIONS`
> (`penyedia.portal`, `auth.logout`, `auth.change_pin`) — TIDAK ikut semantik
> `roles:[]` yang mengekspos data seluruh sistem; (2) handler memakai
> `_hanyaPenyedia_(session)` dan men-scope semua data ke `session.penyedia_id`.

| Action | Role | Payload → Data | Keterangan |
|---|---|---|---|
| `penyedia.portal` | PENYEDIA | `{}` → `{penyedia:{nama,kontak,alamat,status}, kontrak:[{kontrak_id,harga_per_porsi,porsi_per_hari,tgl_mulai,tgl_akhir,status,menu:[{hari,menu_pagi,menu_siang,menu_malam}],lampiran:[{jenis,nama_file}]}], pesanan:[{tgl_makan,jml_taruna,menu,catatan,status}], realisasi:[{tanggal,porsi_diterima,jml_taruna_makan,ketidaksesuaian,tindak_lanjut}], pembayaran:[{bulan,nilai_total,no_spm,tgl_spm,no_sp2d,tgl_sp2d,status,invoice_dikonfirmasi}]}` | Semua data di-scope ke penyedia yang login (via `kontrak_id` miliknya). `pesanan` HANYA status final `DISETUJUI`/`TERKIRIM`, `tgl_makan ≥` hari ini − 7. **SENGAJA TANPA** data per-taruna (nama/NIT), rekening, geotag realisasi, identitas staf internal (created_by/verif_by/approved_by/uploaded_by), dan **TANPA bantuan makan luar kampus** (BANTUAN_LUAR_KAMPUS/SP2D — transfer tunai ke taruna, bukan lewat kontrak penyedia). READ-ONLY (tanpa audit). |

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
