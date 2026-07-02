# Kontrak API e-BAMA

> ⚠️ **STATUS: DRAF REKONSTRUKSI — WAJIB DIREVIEW.**
> Direkonstruksi dari PROMPT 2–8 karena lampiran asli tidak disertakan.
> Ini **sumber kebenaran API**; kode mengikuti dokumen ini.

## Amplop & Transport

- **Endpoint tunggal**: `POST {VITE_GAS_URL}` (Web App GAS).
- **Content-Type**: `text/plain` berisi JSON (menghindari preflight CORS).
- **Body**: `{ "action": "domain.aksi", "token": "<uuid|null>", "payload": {…} }`
- **Balasan sukses**: `{ "ok": true,  "data": {…} }`
- **Balasan gagal**:  `{ "ok": false, "error": "pesan Bahasa Indonesia" }`
- **Health check**: `GET {VITE_GAS_URL}` → `{ "ok": true, "data": { "app": "e-BAMA", "version": "…" } }`

## Aturan lintas-endpoint

- **Role divalidasi di router** (`ACTION_MAP.roles`), sebelum handler.
- Setiap aksi tulis → `withLock` + baris `AUDIT_LOG`.
- Handler tetap memvalidasi payload (field wajib, tipe, enum) → error jelas.
- Token kedaluwarsa → `{ok:false, error}` → frontend melempar ke login.

---

## Daftar Action

Kolom **Roles** = role yang diizinkan (selain itu ditolak router).
Tahap = tahap implementasi handler.

### Auth — `02_auth.gs` (TAHAP 2)

| Action | Roles | Payload | Data balasan |
|--------|-------|---------|--------------|
| `auth.login` | publik | `{user_id, pin}` | `{token, role, nama}` |
| `auth.logout` | login | `{}` | `{ok}` |
| `auth.change_pin` | login | `{pin_lama, pin_baru}` | `{ok}` |

### Taruna — `10_taruna.gs` (TAHAP 3)

| Action | Roles | Payload | Data balasan |
|--------|-------|---------|--------------|
| `taruna.list` | login | `{status?, prodi?, tingkat?}` | `{taruna: []}` |
| `taruna.upsert` | ADMIN | `{nit, nama, prodi, tingkat, rek_mask, status}` | `{taruna}` |

### Status Harian — `11_status_harian.gs` (TAHAP 3)

| Action | Roles | Payload | Data balasan |
|--------|-------|---------|--------------|
| `status.set` | ADMIN, PEMBINA | `{nit, tanggal, sebab, keterangan?}` | `{status}` |
| `status.list` | login | `{dari, sampai, nit?}` | `{status: []}` |
| `status.batch` | ADMIN, PEMBINA | `{tanggal, sebab, nit: [], keterangan?}` | `{jml}` |

### Pesanan — `12_pesanan.gs` (TAHAP 3)

| Action | Roles | Payload | Data balasan |
|--------|-------|---------|--------------|
| `pesanan.list` | login | `{bulan?}` | `{pesanan: []}` |
| `pesanan.get` | login | `{pesanan_id}` | `{pesanan}` |
| `pesanan.create` | SENAT | `{tgl_makan, menu, jml_taruna?, catatan?}` | `{pesanan}` |
| `pesanan.submit` | SENAT | `{pesanan_id}` | `{pesanan}` |
| `pesanan.verify` | PEMBINA | `{pesanan_id}` | `{pesanan}` |
| `pesanan.return` | PEMBINA | `{pesanan_id, alasan}` | `{pesanan}` |
| `pesanan.kirim` | SENAT | `{pesanan_id}` | `{pesanan}` |
| `pesanan.revisi` | SENAT | `{pesanan_id, menu, jml_taruna?, catatan, lampiran_ba}` | `{pesanan}` |

### Realisasi — `13_realisasi.gs` (TAHAP 3)

| Action | Roles | Payload | Data balasan |
|--------|-------|---------|--------------|
| `realisasi.list` | login | `{bulan?}` | `{realisasi: []}` |
| `realisasi.create` | PEMBINA, SENAT | `{pesanan_id, porsi_diterima, jml_makan, ketidaksesuaian?, tindak_lanjut?, geotag, foto_base64?}` | `{realisasi}` |
| `realisasi.ttd` | PEMBINA, SENAT | `{realisasi_id, pin}` | `{realisasi}` |

### Rekap — `14_rekap.gs` (TAHAP 3)

| Action | Roles | Payload | Data balasan |
|--------|-------|---------|--------------|
| `rekap.get` | PPK, KPA | `{bulan}` | `{rekap: [], total}` |
| `rekap.verify` | PPK | `{bulan}` | `{ok}` |
| `rekap.final` | PPK | `{bulan}` | `{ok}` |

### Pembayaran — `15_pembayaran.gs` (TAHAP 4A)

| Action | Roles | Payload | Data balasan |
|--------|-------|---------|--------------|
| `bayar.list` | PPK, KPA, SENAT | `{bulan?}` | `{pembayaran: []}` |
| `bayar.create` | PPK | `{bulan}` | `{pembayaran}` |
| `bayar.update` | PPK | `{bayar_id, no_spm?, tgl_spm?, no_sp2d?, tgl_sp2d?, lampiran?}` | `{pembayaran}` |
| `bayar.confirm` | SENAT | `{bayar_id}` | `{pembayaran}` |
| `bayar.close` | PPK | `{bayar_id}` | `{pembayaran}` |

### Tagihan — `16_tagihan.gs` (TAHAP 4A)

| Action | Roles | Payload | Data balasan |
|--------|-------|---------|--------------|
| `tagihan.list` | login | `{bulan?, status?}` | `{tagihan: []}` (+ `level_aktif`, `tenggat_aktif`) |
| `tagihan.create` | SENAT, PPK | `{bulan, nit: [], sebab}` | `{tagihan: []}` (SP-1 langsung terbit) |
| `tagihan.setor` | SENAT | `{tagihan_id, tgl_setor, bukti_base64}` | `{tagihan}` |
| `tagihan.verify` | PPK | `{tagihan_id}` | `{tagihan}` |
| `tagihan.waive` | PPK | `{tagihan_id, catatan_hapus}` | `{tagihan}` |
| `tagihan.summary` | PPK, KPA | `{bulan?}` | `{per_level:{0..3:{jumlah,nominal}}, total_outstanding}` |
| `tagihan.regenerate_sp` | PPK | `{tagihan_id}` | `{sp}` |

### Surat Peringatan — `17_surat_peringatan.gs` (TAHAP 4B)

| Action | Roles | Payload | Data balasan |
|--------|-------|---------|--------------|
| `sp.list` | login | `{tagihan_id}` | `{sp: []}` |

> `spTerbitkan(tagihanId, level, session)` adalah fungsi internal (dipanggil
> `tagihan.create`, `eskalasiTagihan`, `tagihan.regenerate_sp`), bukan action.

### Pengguna (Admin) — `02_auth.gs` / setup (TAHAP 7)

| Action | Roles | Payload | Data balasan |
|--------|-------|---------|--------------|
| `pengguna.list` | ADMIN | `{}` | `{pengguna: []}` |
| `pengguna.upsert` | ADMIN | `{user_id, nama, role, status}` | `{pengguna}` |
| `pengguna.reset_pin` | ADMIN | `{user_id}` | `{ok}` (PIN direset ke default) |

### Audit — `03_helpers.gs` (TAHAP 7)

| Action | Roles | Payload | Data balasan |
|--------|-------|---------|--------------|
| `audit.list` | PPK, KPA | `{dari?, sampai?, user_id?, aksi?}` | `{log: []}` |

---

## Ringkasan mesin status (rujukan cepat)

- **PESANAN**: `DRAFT → DIAJUKAN → (DIKEMBALIKAN | DISETUJUI) → TERKIRIM`
- **REKAP_BULANAN**: `DRAFT → TERVERIFIKASI_PPK → FINAL`
- **PEMBAYARAN**: `DIAJUKAN → SP2D_TERBIT → DITRANSFER → DIKONFIRMASI → SELESAI`
- **TAGIHAN**: `TERTAGIH → LUNAS | DIHAPUSKAN | ESKALASI_MANUAL`
- **SP**: eskalasi `1 → 2 → 3 → ESKALASI_MANUAL` (tenggat 7/7/3 hari)
