# Checklist Go-Live — e-BAMA

> Selesaikan **semua** baris di bawah, berurutan, sebelum e-BAMA dipakai untuk
> data & transaksi riil. Jangan lompat langkah. Centang + isi tanggal/paraf.

## 1. Keamanan akun

| # | Langkah | Hasil | Tanggal | Paraf |
|---|---|---|---|---|
| 1.1 | Ganti PIN **semua** akun produksi dari default `123456` (Akun → Ganti PIN, per pengguna login sendiri) | ☐ | | |
| 1.2 | Nonaktifkan/hapus akun seed uji coba yang tidak dipakai produksi (Admin → Pengguna → Nonaktifkan) | ☐ | | |
| 1.3 | Pastikan setiap akun riil (PPK, KPA, Wadir 3, Senat, Pembina, Admin) sudah dibuat dengan nama & role benar | ☐ | | |
| 1.4 | Cek Script Properties `SALT` ada dan tidak dibagikan ke siapa pun | ☐ | | |

## 2. Deployment produksi

| # | Langkah | Hasil | Tanggal | Paraf |
|---|---|---|---|---|
| 2.1 | Buat **deployment baru** khusus produksi (bukan pakai deployment/versi yang dipakai testing) — Deploy → Manage deployments → New deployment | ☐ | | |
| 2.2 | Deployment produksi: **Execute as = Me**, **Who has access = Anyone** | ☐ | | |
| 2.3 | Catat URL `/exec` produksi baru, update `VITE_GAS_URL` di: `frontend/.env`, `frontend/src/lib/api.ts` (fallback), dan repo variable GitHub Actions | ☐ | | |
| 2.4 | `npm run build` bersih lalu deploy ulang GitHub Pages dengan URL produksi | ☐ | | |
| 2.5 | Uji health check (`doGet`) dan login dari domain produksi `dausdabamona.github.io/e-bama/` — bukan URL test | ☐ | | |
| 2.6 | Simpan/arsipkan Script ID + URL deployment lama (untuk referensi), tandai jelas "TEST — jangan dipakai lagi" | ☐ | | |

## 3. Trigger otomatis

| # | Langkah | Hasil | Tanggal | Paraf |
|---|---|---|---|---|
| 3.1 | Jalankan `pasangTrigger()` dari editor GAS (eskalasi SP harian, jam sesuai `CONFIG.SP.JAM_TRIGGER`) | ☐ | | |
| 3.2 | Jalankan `pasangTriggerBackup()` dari editor GAS (backup mingguan, Minggu 02.00) | ☐ | | |
| 3.3 | **Besok paginya**, cek tab **Triggers** (jam ⏰ di editor GAS) → Execution log → `eskalasiTagihan` benar-benar berjalan otomatis | ☐ | | |
| 3.4 | Setelah backup mingguan pertama berjalan, cek folder Drive `e-BAMA/BACKUP` berisi 1 salinan spreadsheet | ☐ | | |

## 4. Uji di lapangan

| # | Langkah | Hasil | Tanggal | Paraf |
|---|---|---|---|---|
| 4.1 | Uji dari **HP Android low-end sungguhan** (bukan HP tim IT), jaringan **seluler Sorong** (bukan wifi kantor) | ☐ | | |
| 4.2 | Instal sebagai PWA, coba offline→online sekali di lapangan | ☐ | | |
| 4.3 | Foto realisasi & geotag berhasil di kondisi sinyal lemah | ☐ | | |
| 4.4 | Senat & Pembina riil (bukan tim IT) mencoba alur pesanan→realisasi sendiri, catat kesulitan yang muncul | ☐ | | |

## 5. Migrasi data taruna

| # | Langkah | Hasil | Tanggal | Paraf |
|---|---|---|---|---|
| 5.1 | Ikuti `scripts/migrasi-taruna.md` — konversi rekening ke 4 digit **di luar sistem** | ☐ | | |
| 5.2 | Impor data taruna riil via Admin → Taruna → Impor CSV | ☐ | | |
| 5.3 | Verifikasi: **nol** baris dengan indikasi rekening lengkap masuk sistem (cek sheet `TARUNA`, kolom `rek_mask` semua `••••nnnn`) | ☐ | | |
| 5.4 | Hapus semua file kerja migrasi yang sempat berisi rekening lengkap | ☐ | | |

## 6. Paralel run & pensiun SI-BUMATA

| # | Langkah | Hasil | Tanggal | Paraf |
|---|---|---|---|---|
| 6.1 | Jadwalkan **paralel run minimal 1 bulan penuh**: e-BAMA & SI-BUMATA jalan bersamaan, bandingkan hasil rekap/pembayaran | ☐ | | |
| 6.2 | Selesai 1 siklus bulan paralel tanpa selisih signifikan | ☐ | | |
| 6.3 | Keputusan tertulis (memo/SK) **tanggal pensiun SI-BUMATA**, ditandatangani KPA/PPK | ☐ | | |
| 6.4 | Arsipkan data historis SI-BUMATA (bukan dihapus) sebelum akses dicabut | ☐ | | |

---

## Ringkasan tanda tangan persetujuan go-live

| Peran | Nama | Tanggal | Tanda tangan |
|---|---|---|---|
| PPK | | | |
| KPA | | | |
| Wadir 3 | | | |
