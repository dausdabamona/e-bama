# Uji Terima Pengguna (UAT) — e-BAMA

> Skenario end-to-end **satu siklus bulan penuh** dengan **20 taruna dummy**.
> Dilarang memakai data taruna riil (lihat `docs/go-live.md`). Centang kolom
> **Hasil** (✓/✗), isi **Tanggal**, dan **Paraf** penguji di tiap baris.
> Kalau ada baris ✗, catat di kolom Keterangan dan perbaiki sebelum lanjut.

## Persiapan

| # | Langkah | Hasil | Tanggal | Paraf |
|---|---|---|---|---|
| 0.1 | `setupDatabase()` + `seedAwal()` sudah pernah dijalankan (15 sheet + 5 akun) | ☐ | | |
| 0.2 | Login `admin01` → **Pengguna** → **+ Tambah** → buat `wadir301` (role WADIR3) | ☐ | | |
| 0.3 | Login `admin01` → **Taruna** → **Impor CSV** 20 taruna dummy (pakai `scripts/template-impor-taruna.csv`, ganti NIT/nama) | ☐ | | |
| 0.4 | Cek: 0 baris ditolak karena rekening — semua `rek_mask` 4 digit | ☐ | | |
| 0.5 | `ppk01` → **Akun → Kelola Kontrak & Penyedia** → tambah 1 Penyedia + 1 Kontrak (harga_per_porsi, porsi_per_hari) → **Setujui** | ☐ | | |
| 0.6 | Unggah lampiran **Menu & Nilai Gizi** ke kontrak tsb (PDF atau foto) → tautan Drive bisa dibuka | ☐ | | |

## A. Alur Harian (SOP 5–9) — ulangi 5 hari kerja

| # | Langkah | Hasil | Tanggal | Paraf |
|---|---|---|---|---|
| A.1 | Pembina set 1–2 taruna **status harian** (PESIAR/CUTI/dll) untuk salah satu hari | ☐ | | |
| A.2 | Senat **buat Pesanan** (H-1) → `jml_taruna` otomatis = 20 − status harian hari itu | ☐ | | |
| A.3 | Senat **Simpan & Ajukan** → status `DIAJUKAN` | ☐ | | |
| A.4 | Pembina → **Verifikasi** → **Setujui** → status `DISETUJUI` | ☐ | | |
| A.5 | Senat → **Kirim ke Penyedia** (sebelum H) → status `TERKIRIM` | ☐ | | |
| A.6 | Coba kirim **pada hari-H** (pesanan lain) → **ditolak**, pesan arahkan ke revisi | ☐ | | |
| A.7 | Pembina/Senat → **Realisasi** → isi porsi, ambil foto (≤200KB), geotag | ☐ | | |
| A.8 | Pembina **tanda tangan** (konfirmasi PIN) | ☐ | | |
| A.9 | Senat **tanda tangan** (konfirmasi PIN) → kedua TTD lengkap → rekap ter-update otomatis | ☐ | | |
| — | **Ulangi A.1–A.9 untuk 5 hari berbeda** | ☐ | | |

## B. Rekap & Persetujuan Pencairan (SOP 10 + Wadir 3)

| # | Langkah | Hasil | Tanggal | Paraf |
|---|---|---|---|---|
| B.1 | PPK → **Rekap** → tabel terisi otomatis dari 5 hari realisasi, total nominal integer (tanpa desimal); status `DRAFT` → PPK belum bisa verifikasi (menunggu Wadir 3) | ☐ | | |
| B.2 | Login `wadir301` → **Persetujuan Rekap** → bulan `DRAFT` → **Setujui Rekap** → status `DISETUJUI_WADIR3` | ☐ | | |
| B.3 | PPK → **Verifikasi Rekap** (kini aktif) → status `TERVERIFIKASI_PPK` | ☐ | | |
| B.4 | PPK → **Finalkan Rekap** (centang konfirmasi) → status `FINAL`, edit lanjutan ditolak | ☐ | | |
| B.5 | PPK → **Pembayaran** → **Buat Pembayaran** (rekap `FINAL`) → **berhasil**, `nilai_total` = SUM rekap | ☐ | | |
| B.6 | Sebelum B.4: **Buat Pembayaran** saat status belum `FINAL` → **ditolak**: "belum FINAL — alur: Wadir 3 → PPK verifikasi → PPK finalkan" | ☐ | | |

## C. Pembayaran Penuh (SOP 11–17) — mesin status disederhanakan (DIAJUKAN → SELESAI)

| # | Langkah | Hasil | Tanggal | Paraf |
|---|---|---|---|---|
| C.1 | PPK isi **No. SPM** + tanggal (status tetap `DIAJUKAN`) | ☐ | | |
| C.2 | PPK isi **No. SP2D** + tanggal → status **langsung** `SELESAI` (dana sudah cair ke taruna, tanpa konfirmasi Senat) | ☐ | | |
| C.3 | Kartu "🚨 MENDESAK — Cetak & Kirim Surat Blokir ke Bank" muncul begitu No. SP2D tersimpan → link **Cetak Form 07** | ☐ | | |
| C.4 | Kartu **Cetak Form 09** (Pendebetan Senat → Penyedia) ikut muncul untuk PPK & Senat | ☐ | | |
| C.5 | PPK tetap bisa unggah lampiran (Surat Blokir/Bukti Debet/Invoice) walau status sudah `SELESAI` | ☐ | | |

## D. Gagal Debet & Surat Peringatan (piutang)

| # | Langkah | Hasil | Tanggal | Paraf |
|---|---|---|---|---|
| D.1 | PPK → **Tagihan → + Gagal Debet** → tandai **3 taruna** dari rekap bulan ini, isi sebab | ☐ | | |
| D.2 | Cek: **3 tagihan** tercatat + **3 PDF SP-1** bisa diunduh (link Drive per tagihan) | ☐ | | |
| D.3 | Nomor surat SP-1 berurutan (`B-1/PKPS/SP1/...`, `B-2/...`, `B-3/...`), tidak tabrakan | ☐ | | |
| D.4 | Di sheet `SURAT_PERINGATAN`, mundurkan `tenggat` SP-1 salah satu tagihan ke kemarin | ☐ | | |
| D.5 | Jalankan `eskalasiTagihan()` dari editor GAS → **SP-2 terbit** untuk tagihan itu | ☐ | | |
| D.6 | Jalankan `eskalasiTagihan()` lagi → **tidak terbit ganda** (idempoten) | ☐ | | |
| D.7 | Senat → tagihan lain → **Setor Bukti** (foto + tanggal) | ☐ | | |
| D.8 | PPK → **Verifikasi Setoran** → status `LUNAS` | ☐ | | |
| D.9 | PPK → tagihan ke-3 → **Hapuskan** tanpa catatan → **ditolak** (catatan wajib) | ☐ | | |
| D.10 | PPK isi catatan → **Hapuskan** → status `DIHAPUSKAN` | ☐ | | |

## E. Laporan & Audit

| # | Langkah | Hasil | Tanggal | Paraf |
|---|---|---|---|---|
| E.1 | PPK/KPA → **Laporan** → ringkasan rekap+realisasi+pembayaran+piutang bulan ini tampil benar | ☐ | | |
| E.2 | Tombol **Cetak** → print preview rapi A4 (header/nav tersembunyi) | ☐ | | |
| E.3 | KPA/Wadir3 → **Dashboard** → kartu ringkasan + grafik 6 bulan tampil (boleh nol untuk 5 bulan lain) | ☐ | | |
| E.4 | Admin/PPK/KPA/Wadir3 → **Audit Log** → filter tanggal → semua transisi status di atas tercatat dengan `data_lama`/`data_baru` | ☐ | | |

## F. Offline & PWA (uji dari HP)

| # | Langkah | Hasil | Tanggal | Paraf |
|---|---|---|---|---|
| F.1 | Install sebagai PWA ("Tambahkan ke layar utama") | ☐ | | |
| F.2 | Matikan jaringan → buat 1 pesanan → masuk **Antrian**, toast "disimpan lokal" | ☐ | | |
| F.3 | Nyalakan jaringan → antrian tersinkron otomatis, badge hilang | ☐ | | |
| F.4 | Buka di lebar layar 320px (HP kecil) → tidak ada overflow horizontal | ☐ | | |

## G. Pengesampingan Alur Verifikasi — Pembina Buat Pesanan Sendiri

> Sejak Fitur F: Pembina boleh membuat & langsung mengirim pesanan **tanpa**
> pengajuan Senat (`pesanan.pembina_kirim`, `12_pesanan.gs`) — melewati
> gerbang normal (Senat ajukan → Pembina verifikasi, 2 pihak). Dipakai kalau
> Senat belum/tidak sempat membuat pesanan H-1. Kontrol pengganti: REALISASI
> tetap wajib TTD Pembina **dan** Senat (dua pihak di hilir, lihat A.7–A.9).

| # | Langkah | Hasil | Tanggal | Paraf |
|---|---|---|---|---|
| G.1 | Login `pembina01` → **Pesanan → + Buat** → isi menu, biarkan jumlah otomatis → **Buat & Kirim Langsung ke Penyedia** | ☐ | | |
| G.2 | Cek: pesanan langsung berstatus `TERKIRIM` (BUKAN `DRAFT`/`DIAJUKAN`); `catatan` = "Dibuat & diajukan Pembina tanpa usulan Senat" | ☐ | | |
| G.3 | `AUDIT_LOG`: baris `pesanan.pembina_kirim` — `created_by` dan `verif_by` SAMA (Pembina), tercatat jelas untuk audit Itjen | ☐ | | |
| G.4 | Login Senat → **Pesanan** (bulan yang sama) → kartu pesanan itu menampilkan penanda **"⚠️ Dibuat & dikirim Pembina tanpa usulan Anda"** | ☐ | | |
| G.5 | Ulangi G.1 pada tanggal yang SUDAH punya pesanan Senat berstatus `DRAFT` → hasil: baris yang sama TER-EDIT (bukan baris baru/dobel) | ☐ | | |
| G.6 | Ulangi G.1 pada tanggal yang pesanannya SUDAH `TERKIRIM` (lewat alur normal) → **ditolak**, pesan menyebut Pembina tidak perlu/boleh menimpa | ☐ | | |
| G.7 | Lanjutkan alur Realisasi (A.7–A.9) untuk pesanan hasil G.1 → TTD Pembina **dan** Senat tetap wajib keduanya (tidak ada jalan pintas di realisasi) | ☐ | | |

---

**Kesimpulan UAT:** semua baris ✓ → sistem siap lanjut ke `docs/go-live.md`.
Kalau ada ✗ yang tidak bisa diperbaiki cepat, tunda go-live sampai teratasi.

| Diuji oleh | Tanggal selesai | Tanda tangan |
|---|---|---|
| | | |
