# Migrasi Data Taruna — SI-BUMATA → e-BAMA

> ⚠️ **Aturan mutlak:** nomor rekening lengkap **DILARANG** masuk e-BAMA
> (temuan Itjen III). Konversi ke 4 digit terakhir dilakukan **DI LUAR e-BAMA**
> — di spreadsheet lokal Anda sendiri, **sebelum** file CSV diimpor.
> Data taruna riil **tidak boleh** masuk sebelum seluruh `docs/go-live.md`
> tuntas (lihat aturan main proyek).

## 1. Ekspor dari SI-BUMATA (MySQL)

Via phpMyAdmin atau `mysql` CLI, ekspor kolom yang relevan saja:

```sql
SELECT
  nit,
  nama,
  prodi,
  tingkat,
  kelas,
  bank,
  rekening,        -- KOLOM SENSITIF — akan dikonversi di langkah 2, JANGAN ikut ke CSV final
  status
FROM taruna
WHERE status = 'AKTIF'
ORDER BY nama;
```

Simpan hasilnya sebagai `taruna-mentah.csv` di **komputer lokal Anda** (bukan
folder yang tersinkron ke sistem manapun selain penyimpanan pribadi Anda).

## 2. Konversi rekening → 4 digit terakhir (WAJIB, di luar e-BAMA)

Buka `taruna-mentah.csv` di Excel/Google Sheets **lokal** (jangan upload ke
Drive bersama dulu). Di kolom baru `rek`, gunakan rumus:

```
=RIGHT(TEXT(F2,"0"), 4)
```

(ganti `F2` dengan sel kolom `rekening`). Salin ke seluruh baris, lalu
**paste as values** (Ctrl+Shift+V) supaya rumus tidak menunjuk ke rekening asli.

**Setelah itu, HAPUS kolom `rekening` asli dari file kerja** — jangan sampai
ikut ter-export ke CSV final. Arsip nomor rekening lengkap **tetap dipegang
PPK secara terpisah, di luar sistem** (sesuai kebijakan pasca-temuan Itjen III).

## 3. Susun CSV final sesuai format impor Admin

Kolom wajib: `nit, nama, rek`. Opsional: `prodi, tingkat, kelas, bank, status`.

```csv
nit,nama,prodi,tingkat,kelas,bank,rek,status
2024001,Contoh Nama Satu,TPI,1,A,BNI,4821,AKTIF
2024002,Contoh Nama Dua,TBP,2,B,BSI,1197,AKTIF
```

Contoh lengkap: `scripts/template-impor-taruna.csv` (isi data dummy — **ganti
seluruhnya** dengan data asli sebelum dipakai, jangan pakai sebagai lampiran
final).

## 4. Impor via aplikasi (Admin)

1. Login `admin01` (atau akun Admin produksi) → **Taruna → Impor CSV**.
2. Pilih file CSV final dari langkah 3.
3. **Periksa tabel pratinjau** — kolom Status per baris:
   - Baris **OK** (hijau) → siap diimpor.
   - Baris **bermasalah** (merah, dengan pesan) → jangan lanjut sebelum
     diperbaiki. Kemungkinan penyebab paling sering: kolom `rek` masih berisi
     nomor rekening lengkap (>4 digit angka) — **ini sengaja ditolak sistem**.
4. Klik **Impor N Taruna Valid**.
5. Hapus `taruna-mentah.csv` dan file kerja Excel dari langkah 2 — nomor
   rekening lengkap tidak boleh tertinggal di file mana pun setelah migrasi
   selesai.

## 5. Verifikasi pasca-impor

| # | Cek | Hasil |
|---|---|---|
| 1 | Jumlah baris di **Taruna** (aplikasi) = jumlah baris AKTIF di SI-BUMATA | ☐ |
| 2 | Spot-check 5 NIT acak: nama, prodi, tingkat, kelas cocok dengan sumber | ☐ |
| 3 | Semua `rek_mask` di sheet `TARUNA` berformat `••••1234` (4 digit, tidak lebih) | ☐ |
| 4 | Tidak ada file CSV/Excel berisi rekening lengkap tersisa di komputer/Drive | ☐ |
| 5 | Login uji dengan 2–3 taruna acak (bila taruna juga punya akun) berhasil | ☐ |

Setelah semua ✓, lanjut ke `docs/go-live.md`.
