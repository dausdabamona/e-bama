# Format Dokumen Resmi BAMA — Pemetaan ke Modul e-BAMA

> Berkas asli (.docx) di `docs/format-dokumen/`. **Format-format ini adalah acuan
> keluaran cetak/PDF aplikasi** — tata letak keluaran mengikuti form, bukan sebaliknya.
> Nomor dokumen: `....../POLTEK.KP.SRG/....../20....` (diisi berurutan per jenis).

| Form | Nama | Sumber data e-BAMA | Dihasilkan pada | Modul |
|---|---|---|---|---|
| 01 | Rencana & Persetujuan Pemesanan Makan Harian (H-1) | PESANAN + STATUS_HARIAN + KONTRAK | Cetak/PDF dari detail pesanan | TAHAP 6 `/pesanan` |
| 02 | Daftar Hadir / Tanda Terima Makan | TARUNA aktif per tanggal (paraf manual di kertas) | Cetak kosong per tanggal; hasil scan diunggah sebagai LAMPIRAN REALISASI | TAHAP 6 `/realisasi` |
| 03 | Rekap Taruna Tidak Menerima Makan (bulanan) | STATUS_HARIAN + LAMPIRAN surat bukti | Laporan bulanan | TAHAP 7 `/laporan` |
| 04 | Rekapitulasi Bulanan Porsi Makan | PESANAN + REALISASI per tanggal | Laporan bulanan (lampiran Form 06) | TAHAP 7 `/laporan` |
| 05 | BA Rekonsiliasi 3 Titik | (1) TARUNA×hari efektif (2) PESANAN (3) REALISASI | Laporan bulanan, sebelum pembayaran | TAHAP 7 `/laporan` |
| 06 | Verifikasi & Rencana Pembayaran PPK | PEMBAYARAN + REKAP_BULANAN (nilai, terbilang) + checklist | Cetak dari detail pembayaran | TAHAP 7 `/pembayaran` |
| 07 | Permohonan Pemblokiran & Pendebetan Rekening Taruna | PEMBAYARAN + REKAP_BULANAN + `TARUNA_REKENING` (rekening PENUH, di-audit). Taruna Rp0 dikecualikan. **Dipisah per bank (BSI/BNI)**, total per bank saja. Alur: dana cair ke rekening taruna → **Direktur + Ketua Senat + Wadir 3** minta bank blokir N hari → debet per orang ke rekening Senat → teruskan total ke rekening penyedia; TTD taruna = kuasa debet | Cetak `/cetak/form-07` | ✅ diimplementasi (ADMIN/PPK) |
| 08 | Usulan Pembayaran Luar Kampus (PKL/Magang/KPA) | BANTUAN_LUAR_KAMPUS + STATUS_HARIAN + `TARUNA_REKENING` | Cetak `/cetak/form-08` | ✅ diimplementasi (ADMIN/PPK) |
| 09 | Pendebetan Rekening Senat → Penyedia (per bank) | PEMBAYARAN + REKAP_BULANAN + `TARUNA.bank` + `REKENING_INSTANSI` (Script Property). Tahap-2 pembayaran: setelah dana taruna masuk rekening Senat, Senat ajukan debet Senat→Penyedia PER BANK (BNI/BSI). Ditandatangani Ketua Senat + PPK + **Mengetahui Direktur & Wadir 3** | Cetak `/cetak/form-09` | ✅ diimplementasi (SENAT/PPK/ADMIN) |
| 10 | Rencana Pengajuan SPM per Suplier | REKAP_BULANAN + TARUNA + `TARUNA_REKENING` (rekening PENUH + `penyedia_id`, di-audit). **Dipecah per ID suplier** (tiap suplier = 1 lembar SPM), di dalamnya dikelompokkan **prodi + tingkat**. Bayar LS ke rekening taruna. TTD Senat/PPK + **Mengetahui Direktur & Wadir 3** | Cetak `/cetak/form-10` | ✅ diimplementasi (ADMIN/PPK) |

## Catatan penting hasil pembacaan form

1. **Form-01 (SOP langkah 5–8)** menyebut rantai: *Senat merencanakan → Pembina
   memverifikasi → **PPK menyetujui** → Senat menyampaikan ke penyedia H-1.*
   Mesin status PESANAN saat ini: `DRAFT → DIAJUKAN → DISETUJUI (Pembina) →
   TERKIRIM` — **belum ada langkah persetujuan PPK**. ⚠️ MENUNGGU KEPUTUSAN:
   bila disetujui, revisi `skema-sheet.md` (tambah status/kolom) dulu baru kode.
2. **Form-03** memuat status: Penundaan Masa Studi / Cuti / Pesiar / Sakit
   dirawat di rumah / **Kegiatan Luar Kampus (PKL/Magang/KPA)**. Enum
   `STATUS_HARIAN` saat ini belum punya nilai *Kegiatan Luar Kampus*.
   ⚠️ MENUNGGU KEPUTUSAN revisi skema.
3. **Form-01 & 04** merinci porsi per waktu makan (pagi/siang/malam). Data
   e-BAMA menyimpan agregat (`porsi_per_hari` di kontrak); rincian per waktu
   diturunkan `jml_taruna × 1` per waktu saat mencetak.
4. **Form-07**: daftar nomor rekening lengkap taruna adalah **lampiran yang
   dikelola PPK di luar aplikasi** — konsisten dengan aturan `rek_mask`
   (temuan Itjen III). Aplikasi hanya mencetak surat induknya.
5. **Form-02** tetap berbasis paraf kertas; e-BAMA menyimpan hasil scan sebagai
   lampiran realisasi (jenis `FOTO`/`SURAT`) — bukan menggantikan paraf.
6. Penandatangan pada form: PPK Firdaus Dabamona, S.T. (198201032007011002),
   KPA Daniel Heintje Ndahawali, S.Pi., M.Si. (197207172002121003) — sudah
   sesuai `PEJABAT` di `00_config.gs`.
