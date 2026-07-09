/**
 * e-bama-bundle.gs — GABUNGAN seluruh backend/src/*.gs (auto-generated, JANGAN
 * edit langsung — edit file sumber di backend/src/ lalu regenerasi bundle ini).
 * Dipakai kalau clasp tidak tersedia: tempel isi file ini sebagai satu file
 * .gs tunggal di editor Apps Script.
 */

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 00_config.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
/**
 * 00_config.gs — Konstanta global e-BAMA (satu-satunya tempat konfigurasi)
 *
 * Berisi: SHEETS (nama sheet), ROLES, ENUM (nilai enum per kolom), PEJABAT,
 * APP_INFO, serta kebijakan SP dengan pola OVERRIDE via Script Properties.
 *
 * POLA OVERRIDE KEBIJAKAN SP:
 * - _CONFIG_SP_DEFAULT = default (di kode). TIDAK dibaca langsung modul lain.
 * - Bila Script Properties memuat SP_TENGGAT_HARI / SP_PENANDATANGAN /
 *   SP_JAM_TRIGGER (JSON), nilai itu MENGGANTIKAN default (merge per-kunci).
 * - getKebijakanSP()  : satu-satunya pintu baca kebijakan (dipakai 17 & 20).
 * - setKebijakanSP(o) : ubah kebijakan dari editor GAS (simpan ke properties).
 *
 * Nilai kebijakan = KEBIJAKAN INTERNAL, boleh diubah tanpa menyentuh kode.
 */

// ── Identitas aplikasi (dipakai doGet health check) ─────────────────────────
var APP_INFO = { nama: 'e-BAMA', versi: '1.0.0' };

// ── Nama sheet (kunci; tidak ada string literal nama sheet di file lain) ────
var SHEETS = {
  PENGGUNA:         'PENGGUNA',
  TARUNA:           'TARUNA',
  PENYEDIA:         'PENYEDIA',
  KONTRAK:          'KONTRAK',
  MENU_KONTRAK:     'MENU_KONTRAK',
  STATUS_HARIAN:    'STATUS_HARIAN',
  PESANAN:          'PESANAN',
  REALISASI:        'REALISASI',
  PEMBAYARAN:       'PEMBAYARAN',
  TAGIHAN:          'TAGIHAN',
  SURAT_PERINGATAN: 'SURAT_PERINGATAN',
  LAMPIRAN:         'LAMPIRAN',
  AUDIT_LOG:        'AUDIT_LOG',
  REKAP_BULANAN:    'REKAP_BULANAN',
  BANTUAN_LUAR_KAMPUS: 'BANTUAN_LUAR_KAMPUS',
  TARUNA_REKENING:  'TARUNA_REKENING',
  SP2D_MONITORING:  'SP2D_MONITORING',
  SPM:              'SPM'
};

// ── Role pengguna ───────────────────────────────────────────────────────────
var ROLES = {
  KPA:      'KPA',
  PPK:      'PPK',
  STAF_PPK: 'STAF_PPK',       // staf administrasi PPK — cermin penuh hak PPK KECUALI bayar.create (komit anggaran tetap PPK); boleh beberapa akun
  SENAT:    'SENAT',
  PEMBINA:  'PEMBINA',
  ADMIN:    'ADMIN',
  WADIR3:   'WADIR3',
  BAAK:     'BAAK',
  PENYEDIA: 'PENYEDIA',       // rekanan katering eksternal — akses portal terbatas (lihat 01_router.gs PENYEDIA_ACTIONS)
  KETUA_JURUSAN: 'KETUA_JURUSAN', // ketua jurusan/prodi — input absen luar kampus + approve rekap prodinya (scope prodi; lihat 01_router.gs KETUA_JURUSAN_ACTIONS)
  OPERATOR_SAKTI: 'OPERATOR_SAKTI' // operator input SPM ke SAKTI — read-only cetak.form06/form09 saja (lihat 01_router.gs OPERATOR_SAKTI_ACTIONS)
};

// ── Nilai enum per kolom (rujukan validasi dropdown & pengecekan handler) ────
var ENUM = {
  AKTIF_STATUS:      ['AKTIF', 'NONAKTIF'],                 // PENGGUNA/TARUNA/PENYEDIA.status
  ROLE:              ['KPA', 'PPK', 'STAF_PPK', 'SENAT', 'PEMBINA', 'ADMIN', 'WADIR3', 'BAAK', 'PENYEDIA', 'KETUA_JURUSAN', 'OPERATOR_SAKTI'],
  BANK:              ['BNI', 'BSI'],                        // TARUNA.bank
  KONTRAK_STATUS:    ['DRAFT', 'DISETUJUI_PPK'],
  BLK_STATUS:        ['DRAFT', 'DISETUJUI_KAJUR'],          // BANTUAN_LUAR_KAMPUS.status (persetujuan Ketua Jurusan)
  HARI:              ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'], // MENU_KONTRAK.hari
  STATUS_HARIAN:     ['PESIAR', 'CUTI', 'SAKIT_RUMAH', 'PENUNDAAN_STUDI', 'TANPA_KETERANGAN',
                      'KEGIATAN_LUAR_KAMPUS', 'PKL_1', 'PKL_2', 'PKL_3', 'KPA', 'MAGANG', 'PTB'],
  PESANAN_STATUS:    ['DRAFT', 'DIAJUKAN', 'DIKEMBALIKAN', 'DISETUJUI', 'TERKIRIM'],
  // Disederhanakan (dikonfirmasi Firdaus): No. SP2D terisi = dana SUDAH cair ke
  // rekening taruna → langsung SELESAI, tanpa konfirmasi Senat/tutup manual
  // terpisah. Pendebetan taruna→Senat→Penyedia tetap jalan lewat dokumen
  // cetak terpisah (Form-07/09, lihat 21_cetak.gs) — tidak lagi dilacak di
  // sini. Nilai lama (SP2D_TERBIT/DITRANSFER/DIKONFIRMASI) TIDAK dipakai lagi
  // untuk baris baru, tapi baris historis yang kadung memilikinya tetap valid
  // dibaca (bukan divalidasi ulang saat baca).
  PEMBAYARAN_STATUS: ['DIAJUKAN', 'SELESAI'],
  TAGIHAN_STATUS:    ['TERTAGIH', 'LUNAS', 'DIHAPUSKAN', 'ESKALASI_MANUAL'],
  TAGIHAN_SEBAB:     ['GAGAL_DEBET', 'SALDO_KURANG', 'REKENING_BERMASALAH'],
  // Alur persetujuan (dikonfirmasi Firdaus): DRAFT → DISETUJUI_WADIR3 (Wadir 3
  // menyetujui dulu) → TERVERIFIKASI_PPK (PPK verifikasi) → FINAL (PPK finalkan,
  // angka BEKU & gerbang bayar.create). Prinsip: PPK menerima hasil pekerjaan
  // yang sudah disetujui untuk dinyatakan siap dibayar (di posisi terakhir).
  REKAP_STATUS:      ['DRAFT', 'DISETUJUI_WADIR3', 'TERVERIFIKASI_PPK', 'FINAL'],
  SP_TTD:            ['PPK', 'KPA'],                        // SURAT_PERINGATAN.ditandatangani_oleh
  SP_GENERATED:      ['SISTEM', 'MANUAL'],
  LAMPIRAN_REFTYPE:  ['KONTRAK', 'STATUS_HARIAN', 'PESANAN', 'REALISASI',
                      'PEMBAYARAN', 'TAGIHAN', 'SP'],
  LAMPIRAN_JENIS:    ['FOTO', 'SURAT', 'BA', 'INVOICE', 'BUKTI_SETOR',
                      'BUKTI_DEBET', 'MENU_GIZI', 'NOTULEN', 'BUKTI_TERUSKAN_PENYEDIA', 'LAINNYA'],
  SP2D_KATEGORI:     ['DALAM_KAMPUS', 'LUAR_KAMPUS'],        // SP2D_MONITORING.kategori
  // SPM (§18 skema-sheet.md) — header kelompok authored (beda dari SP2D_MONITORING
  // yang imported). Nilai kategori SENGAJA sama persis dengan SP2D_KATEGORI (dua
  // konsep yang memang identik: DALAM_KAMPUS/LUAR_KAMPUS), didefinisikan terpisah
  // supaya SPM tidak diam-diam ikut berubah kalau SP2D_KATEGORI direvisi nanti.
  SPM_KATEGORI:      ['DALAM_KAMPUS', 'LUAR_KAMPUS'],
  // Tidak ada DITOLAK (dikonfirmasi Firdaus) — SPM yang dikembalikan/ditolak KPPN
  // cukup diedit ulang (no_spm/tgl_spm) selama status belum SP2D_TERBIT.
  SPM_STATUS:        ['DRAFT', 'DIAJUKAN', 'SP2D_TERBIT'],
  // Ownership Taruna — Fitur 1 Piket Verifikasi Makan (REALISASI.piket_kualitas)
  REALISASI_KUALITAS: ['BAIK', 'CUKUP', 'KURANG']
};

// Status harian yang tergolong "kegiatan luar kampus" — taruna berhak BANTUAN
// makan luar kampus (dihitung di Form-08). Subset dari ENUM.STATUS_HARIAN;
// PESIAR/CUTI/SAKIT_RUMAH/PENUNDAAN_STUDI TIDAK termasuk (tidak dapat bantuan).
var STATUS_LUAR_KAMPUS = ['KEGIATAN_LUAR_KAMPUS', 'PKL_1', 'PKL_2', 'PKL_3', 'KPA', 'MAGANG', 'PTB'];

// ── Data pejabat penandatangan surat ────────────────────────────────────────
// DIREKTUR: di Poltek KP Sorong Direktur merangkap KPA (lihat laporan-resmi.tsx),
// jadi default = identitas KPA. WADIR3: nama belum tersedia → kosong (tercetak
// titik-titik oleh TtdKolom) sampai diisi. Ubah di sini bila berbeda.
var PEJABAT = {
  PPK:      { nama: 'Firdaus Dabamona, S.T.',                nip: '198201032007011002' },
  KPA:      { nama: 'Daniel Heintje Ndahawali, S.Pi., M.Si.', nip: '197207172002121003' },
  DIREKTUR: { nama: 'Daniel Heintje Ndahawali, S.Pi., M.Si.', nip: '197207172002121003' },
  WADIR3:   { nama: '', nip: '' }
};

// ── Rekening instansi (Senat & Penyedia) per bank — untuk dokumen pendebetan ──
// BUKAN rekening taruna (aturan 4-digit § 4 tidak berlaku di sini). Disimpan di
// Script Properties (bukan sheet) supaya tanpa perubahan skema. Isi sekali lewat
// setRekeningInstansi() dari editor GAS. Dua bank (BNI/BSI): alur debet paralel
// taruna BSI→Senat BSI→Penyedia BSI; idem BNI.
// Rekening instansi per bank + NAMA pemilik rekening (a.n.) untuk surat ke bank.
// senat_nama/penyedia_nama opsional — mis. penyedia_nama.BNI = 'Mukhori'.
var _REKENING_INSTANSI_GRUP = ['senat', 'penyedia', 'senat_nama', 'penyedia_nama'];
var _REKENING_INSTANSI_DEFAULT = {
  // Rekening Senat Taruna (tujuan pendebetan dari rekening taruna) — dikonfirmasi Firdaus.
  senat:         { BNI: '2026715541', BSI: '7339443046' },
  penyedia:      { BNI: '', BSI: '' },
  senat_nama:    { BNI: '', BSI: '' },
  penyedia_nama: { BNI: '', BSI: '' }
};

/** getRekeningInstansi() — rekening instansi efektif (default ← override Script Properties). */
function getRekeningInstansi() {
  var d = _REKENING_INSTANSI_DEFAULT;
  var out = {};
  _REKENING_INSTANSI_GRUP.forEach(function (grp) { out[grp] = { BNI: d[grp].BNI, BSI: d[grp].BSI }; });
  var raw = PropertiesService.getScriptProperties().getProperty('REKENING_INSTANSI');
  if (raw) {
    var o = JSON.parse(raw);
    _REKENING_INSTANSI_GRUP.forEach(function (grp) {
      if (o[grp]) {
        if (o[grp].BNI !== undefined) out[grp].BNI = o[grp].BNI;
        if (o[grp].BSI !== undefined) out[grp].BSI = o[grp].BSI;
      }
    });
  }
  return out;
}

/**
 * setRekeningInstansi(obj) — isi/ubah rekening instansi dari editor GAS. Merge
 * per-kunci (nilai yang tak disebut tetap seperti sebelumnya). Contoh:
 *   setRekeningInstansi({ senat:{BNI:'2026715541'},
 *                         penyedia:{BNI:'1946986806'}, penyedia_nama:{BNI:'Mukhori'} })
 */
function setRekeningInstansi(obj) {
  var cur = getRekeningInstansi();
  _REKENING_INSTANSI_GRUP.forEach(function (grp) {
    if (obj && obj[grp]) {
      if (obj[grp].BNI !== undefined) cur[grp].BNI = obj[grp].BNI;
      if (obj[grp].BSI !== undefined) cur[grp].BSI = obj[grp].BSI;
    }
  });
  PropertiesService.getScriptProperties().setProperty('REKENING_INSTANSI', JSON.stringify(cur));
  return cur;
}

// ── Saklar libur pesanan otomatis (Fitur D, 20_trigger.gs) ──────────────────
// Rentang tanggal [mulai, akhir] (inklusif) di mana trigger 21:00 TIDAK boleh
// membuat pesanan otomatis (libur semester/hari libur) — tanpa ini, salin-
// persis + auto-kirim akan mengirim pesanan "hantu" penuh selama libur.
// Disimpan Script Properties (bukan sheet, tanpa perubahan skema).

/** getLiburAutoPesanan() → array {mulai:'YYYY-MM-DD', akhir:'YYYY-MM-DD'}. */
function getLiburAutoPesanan() {
  var raw = PropertiesService.getScriptProperties().getProperty('LIBUR_AUTO_PESANAN');
  return raw ? JSON.parse(raw) : [];
}

/**
 * setLiburAutoPesanan([{mulai:'2026-06-15',akhir:'2026-07-15'}, ...]) — GANTI
 * seluruh daftar (bukan merge — daftar libur biasanya diatur ulang per
 * semester). Panggil dari editor GAS. Contoh mengosongkan: setLiburAutoPesanan([]).
 */
function setLiburAutoPesanan(rentang) {
  var bersih = (rentang || []).map(function (r) {
    return { mulai: String(r.mulai || ''), akhir: String(r.akhir || '') };
  });
  PropertiesService.getScriptProperties().setProperty('LIBUR_AUTO_PESANAN', JSON.stringify(bersih));
  return bersih;
}

/** true bila tgl ('YYYY-MM-DD') masuk salah satu rentang libur aktif. */
function _tanggalLiburAutoPesanan_(tgl) {
  return getLiburAutoPesanan().some(function (r) { return r.mulai <= tgl && tgl <= r.akhir; });
}

// ── Kebijakan SP (DEFAULT — jangan dibaca langsung; pakai getKebijakanSP) ────
var _CONFIG_SP_DEFAULT = {
  TENGGAT_HARI:  { '1': 7, '2': 7, '3': 3 }, // hari kalender per level SP
  PENANDATANGAN: { '1': 'PPK', '2': 'PPK', '3': 'KPA' },
  JAM_TRIGGER:   6                            // 06.00 WIT eskalasi harian
};

/**
 * getKebijakanSP() — kebijakan SP efektif (default ← override Script Properties).
 * SATU-SATUNYA cara modul lain (17_surat_peringatan, 20_trigger) membaca kebijakan.
 */
function getKebijakanSP() {
  var p = PropertiesService.getScriptProperties();
  // Salinan default agar tidak mengubah objek konstanta.
  var sp = {
    TENGGAT_HARI:  { '1': _CONFIG_SP_DEFAULT.TENGGAT_HARI['1'],
                     '2': _CONFIG_SP_DEFAULT.TENGGAT_HARI['2'],
                     '3': _CONFIG_SP_DEFAULT.TENGGAT_HARI['3'] },
    PENANDATANGAN: { '1': _CONFIG_SP_DEFAULT.PENANDATANGAN['1'],
                     '2': _CONFIG_SP_DEFAULT.PENANDATANGAN['2'],
                     '3': _CONFIG_SP_DEFAULT.PENANDATANGAN['3'] },
    JAM_TRIGGER:   _CONFIG_SP_DEFAULT.JAM_TRIGGER
  };
  var t = p.getProperty('SP_TENGGAT_HARI');
  if (t) { var ot = JSON.parse(t); for (var k1 in ot) sp.TENGGAT_HARI[k1] = ot[k1]; }
  var pn = p.getProperty('SP_PENANDATANGAN');
  if (pn) { var op = JSON.parse(pn); for (var k2 in op) sp.PENANDATANGAN[k2] = op[k2]; }
  var j = p.getProperty('SP_JAM_TRIGGER');
  if (j !== null && j !== '') sp.JAM_TRIGGER = JSON.parse(j);
  return sp;
}

/**
 * setKebijakanSP(obj) — ubah kebijakan SP dari editor GAS.
 * Contoh: setKebijakanSP({ TENGGAT_HARI: {'3': 5}, JAM_TRIGGER: 7 })
 * Hanya kunci yang disertakan yang ditimpa (merge per-kunci di getKebijakanSP).
 */
function setKebijakanSP(obj) {
  var p = PropertiesService.getScriptProperties();
  if (!obj) return getKebijakanSP();
  if (obj.TENGGAT_HARI  !== undefined) p.setProperty('SP_TENGGAT_HARI',  JSON.stringify(obj.TENGGAT_HARI));
  if (obj.PENANDATANGAN !== undefined) p.setProperty('SP_PENANDATANGAN', JSON.stringify(obj.PENANDATANGAN));
  if (obj.JAM_TRIGGER   !== undefined) p.setProperty('SP_JAM_TRIGGER',   JSON.stringify(obj.JAM_TRIGGER));
  return getKebijakanSP();
}

// ── Kebijakan Verifikasi Pesanan by-Exception (DEFAULT) ──────────────────────
// autoLolosRutin: pesanan RUTIN (sama dgn kemarin) auto-DISETUJUI→TERKIRIM,
// tanpa antrian Pembina. ambangSelisih: toleransi |jml_taruna - kemarin| yang
// masih dianggap RUTIN (default 0 = perubahan berapa pun dianggap anomali).
var _CONFIG_VERIFIKASI_DEFAULT = { autoLolosRutin: true, ambangSelisih: 0 };

/** getKebijakanVerifikasi() — SATU-SATUNYA cara 12_pesanan.gs membaca kebijakan ini. */
function getKebijakanVerifikasi() {
  var p = PropertiesService.getScriptProperties();
  var v = { autoLolosRutin: _CONFIG_VERIFIKASI_DEFAULT.autoLolosRutin, ambangSelisih: _CONFIG_VERIFIKASI_DEFAULT.ambangSelisih };
  var raw = p.getProperty('KEBIJAKAN_VERIFIKASI');
  if (raw) {
    var o = JSON.parse(raw);
    if (o.autoLolosRutin !== undefined) v.autoLolosRutin = !!o.autoLolosRutin;
    if (o.ambangSelisih !== undefined) v.ambangSelisih = Number(o.ambangSelisih) || 0;
  }
  return v;
}

/**
 * setKebijakanVerifikasi({autoLolosRutin?, ambangSelisih?}) — ubah kebijakan
 * dari editor GAS. Hanya kunci yang disertakan yang ditimpa.
 */
function setKebijakanVerifikasi(obj) {
  var v = getKebijakanVerifikasi();
  if (obj && obj.autoLolosRutin !== undefined) v.autoLolosRutin = !!obj.autoLolosRutin;
  if (obj && obj.ambangSelisih !== undefined) v.ambangSelisih = Number(obj.ambangSelisih) || 0;
  PropertiesService.getScriptProperties().setProperty('KEBIJAKAN_VERIFIKASI', JSON.stringify(v));
  return v;
}

// ── Kebijakan Tagihan (DEFAULT) ───────────────────────────────────────────
// toleransiSelisihTransfer: selisih (nominal - nilai_transfer) dalam Rupiah
// yang MASIH dianggap lunas penuh tanpa catatan piutang (potongan biaya
// transfer antarbank, dsb). Di ATAS ambang ini, sisanya dicatat sebagai
// piutang kurang bayar utk ditagihkan pada pendebetan bulan berikutnya
// (dikonfirmasi Firdaus) — TIDAK memblokir LUNAS, cuma soal catatan.
var _CONFIG_TAGIHAN_DEFAULT = { toleransiSelisihTransfer: 20000 };

/** getKebijakanTagihan() — SATU-SATUNYA cara 16_tagihan.gs membaca kebijakan ini. */
function getKebijakanTagihan() {
  var p = PropertiesService.getScriptProperties();
  var v = { toleransiSelisihTransfer: _CONFIG_TAGIHAN_DEFAULT.toleransiSelisihTransfer };
  var raw = p.getProperty('KEBIJAKAN_TAGIHAN');
  if (raw) {
    var o = JSON.parse(raw);
    if (o.toleransiSelisihTransfer !== undefined) v.toleransiSelisihTransfer = Number(o.toleransiSelisihTransfer) || 0;
  }
  return v;
}

/**
 * setKebijakanTagihan({toleransiSelisihTransfer?}) — ubah kebijakan dari
 * editor GAS. Hanya kunci yang disertakan yang ditimpa.
 */
function setKebijakanTagihan(obj) {
  var v = getKebijakanTagihan();
  if (obj && obj.toleransiSelisihTransfer !== undefined) v.toleransiSelisihTransfer = Number(obj.toleransiSelisihTransfer) || 0;
  PropertiesService.getScriptProperties().setProperty('KEBIJAKAN_TAGIHAN', JSON.stringify(v));
  return v;
}

// ── Kebijakan Pendebetan Bank — Form-07 (DEFAULT) ────────────────────────────
// biayaAdminBank: potongan tetap per taruna yang dikenakan bank saat mendebet
// rekening taruna → Rekening Senat. Nilai yang diinstruksikan ke bank untuk
// didebet di Form-07 (Usulan Penahanan & Pendebetan Bank) = nominal SPM per
// taruna DIKURANGI biaya ini (dikonfirmasi Firdaus) — floor di 0, tidak
// pernah negatif. HANYA memengaruhi tampilan/cetak Form-07; REKAP_BULANAN,
// TAGIHAN.nominal, dan nilai SPM/SP2D TETAP nilai penuh (snapshot resmi),
// tidak diubah oleh kebijakan ini.
var _CONFIG_PENDEBETAN_DEFAULT = { biayaAdminBank: 10000 };

/** getKebijakanPendebetan() — SATU-SATUNYA cara 21_cetak.gs membaca kebijakan ini. */
function getKebijakanPendebetan() {
  var v = { biayaAdminBank: _CONFIG_PENDEBETAN_DEFAULT.biayaAdminBank };
  var raw = PropertiesService.getScriptProperties().getProperty('KEBIJAKAN_PENDEBETAN');
  if (raw) {
    var o = JSON.parse(raw);
    if (o.biayaAdminBank !== undefined) v.biayaAdminBank = Math.max(0, Number(o.biayaAdminBank) || 0);
  }
  return v;
}

/**
 * setKebijakanPendebetan({biayaAdminBank?}) — ubah kebijakan dari editor GAS.
 * Hanya kunci yang disertakan yang ditimpa.
 */
function setKebijakanPendebetan(obj) {
  var v = getKebijakanPendebetan();
  if (obj && obj.biayaAdminBank !== undefined) v.biayaAdminBank = Math.max(0, Number(obj.biayaAdminBank) || 0);
  PropertiesService.getScriptProperties().setProperty('KEBIJAKAN_PENDEBETAN', JSON.stringify(v));
  return v;
}

// ── Standar Gizi (Ownership Taruna — Fitur 1 Piket & Fitur 2 Transparansi) ───
// SATU sumber daftar komponen gizi standar per menu — dipakai BERSAMA oleh
// checklist verifikasi piket (REALISASI.piket_gizi, tahap berikutnya) dan
// halaman papan "Menu Hari Ini" (read-only), supaya keduanya selalu konsisten
// (tidak didefinisikan dua kali di dua tempat berbeda).
var _CONFIG_GIZI_DEFAULT = { komponen: ['Karbohidrat', 'Protein', 'Sayur', 'Buah'] };

/** getKebijakanGizi() — SATU-SATUNYA cara modul lain membaca standar gizi ini. */
function getKebijakanGizi() {
  var raw = PropertiesService.getScriptProperties().getProperty('KEBIJAKAN_GIZI');
  if (raw) {
    var o = JSON.parse(raw);
    if (o && Array.isArray(o.komponen) && o.komponen.length) {
      return { komponen: o.komponen.map(String) };
    }
  }
  return { komponen: _CONFIG_GIZI_DEFAULT.komponen.slice() };
}

/**
 * setKebijakanGizi({komponen}) — ubah daftar komponen gizi dari editor GAS.
 * GANTI seluruh daftar (bukan merge per-kunci — daftar komponen biasanya
 * diatur ulang sekaligus, bukan ditambal satu-satu). Contoh:
 *   setKebijakanGizi({komponen:['Karbohidrat','Protein','Sayur','Buah','Susu']})
 */
function setKebijakanGizi(obj) {
  var komponen = (obj && Array.isArray(obj.komponen) && obj.komponen.length)
    ? obj.komponen.map(String) : _CONFIG_GIZI_DEFAULT.komponen.slice();
  PropertiesService.getScriptProperties().setProperty('KEBIJAKAN_GIZI', JSON.stringify({ komponen: komponen }));
  return { komponen: komponen };
}

// ── Kebijakan Piket Verifikasi Makan (Ownership Taruna — Fitur 1b) ──────────
// wajib:false (default) — verifikasi piket OPSIONAL, tidak menghalangi
// Pembina/Senat mengirim realisasi tanpa piket. true → piket_nit WAJIB diisi
// saat realisasi.create (dikonfirmasi Firdaus: tunable, bukan dipaksa langsung).
var _CONFIG_PIKET_DEFAULT = { wajib: false };

/** getKebijakanPiket() — SATU-SATUNYA cara 13_realisasi.gs membaca kebijakan ini. */
function getKebijakanPiket() {
  var raw = PropertiesService.getScriptProperties().getProperty('KEBIJAKAN_PIKET');
  var v = { wajib: _CONFIG_PIKET_DEFAULT.wajib };
  if (raw) {
    var o = JSON.parse(raw);
    if (o && o.wajib !== undefined) v.wajib = !!o.wajib;
  }
  return v;
}

/** setKebijakanPiket({wajib}) — ubah kebijakan dari editor GAS. */
function setKebijakanPiket(obj) {
  var v = getKebijakanPiket();
  if (obj && obj.wajib !== undefined) v.wajib = !!obj.wajib;
  PropertiesService.getScriptProperties().setProperty('KEBIJAKAN_PIKET', JSON.stringify(v));
  return v;
}

// ── Komponen Menu — Penerimaan Barang Senat ──────────────────────────────────
// SATU sumber daftar item menu nyata (Nasi/Sayur/Lauk/Buah/Minuman) yang
// dicentang Senat saat serah-terima per waktu makan (Pagi/Siang/Malam) — BEDA
// dari getKebijakanGizi() yang berisi KATEGORI gizi (Karbohidrat/Protein/dst)
// dipakai checklist piket di titik MAKAN. Penerimaan Senat mengecek
// kelengkapan & jumlah ITEM di titik SERAH-TERIMA — momen & aktor beda, boleh
// disamakan satker nanti bila dikehendaki, untuk sekarang terpisah
// (dikonfirmasi Firdaus). "Ikan" digabung ke "Lauk" (dulu dobel — Ikan itu
// sendiri sejenis lauk), "Minuman" ditambahkan (kadang teh/susu/dst, jumlahnya
// tetap dicatat sama seperti item lain, jenisnya TIDAK dirinci per sesi).
var _CONFIG_KOMPONEN_MENU_DEFAULT = { komponen: ['Nasi', 'Sayur', 'Lauk', 'Buah', 'Minuman'] };

/** getKebijakanKomponenMenu() — SATU-SATUNYA cara 13_realisasi.gs membaca daftar ini. */
function getKebijakanKomponenMenu() {
  var raw = PropertiesService.getScriptProperties().getProperty('KEBIJAKAN_KOMPONEN_MENU');
  if (raw) {
    var o = JSON.parse(raw);
    if (o && Array.isArray(o.komponen) && o.komponen.length) {
      return { komponen: o.komponen.map(String) };
    }
  }
  return { komponen: _CONFIG_KOMPONEN_MENU_DEFAULT.komponen.slice() };
}

/**
 * setKebijakanKomponenMenu({komponen}) — ubah daftar komponen menu dari editor
 * GAS. GANTI seluruh daftar (bukan merge — biasanya diatur ulang sekaligus).
 * Contoh: setKebijakanKomponenMenu({komponen:['Nasi','Sayur','Lauk','Buah','Minuman','Kerupuk']})
 */
function setKebijakanKomponenMenu(obj) {
  var komponen = (obj && Array.isArray(obj.komponen) && obj.komponen.length)
    ? obj.komponen.map(String) : _CONFIG_KOMPONEN_MENU_DEFAULT.komponen.slice();
  PropertiesService.getScriptProperties().setProperty('KEBIJAKAN_KOMPONEN_MENU', JSON.stringify({ komponen: komponen }));
  return { komponen: komponen };
}

// ── Kebijakan Rekap Bulanan (Redesign Tahap 1) ──────────────────────────────
// ambangOutlier: selisih (hari_makan_maks_grup - hari_makan taruna) di ATAS
// nilai ini ditandai KUNING "cek" di tampilan rekap (outlier relatif ke teman
// se-grup Prodi+Tingkat) — TIDAK memengaruhi cara REKAP_BULANAN dihitung,
// murni penanda tampilan (dikonfirmasi Firdaus).
var _CONFIG_REKAP_DEFAULT = { ambangOutlier: 3 };

/** getKebijakanRekap() — SATU-SATUNYA cara 14_rekap.gs membaca kebijakan ini. */
function getKebijakanRekap() {
  var raw = PropertiesService.getScriptProperties().getProperty('KEBIJAKAN_REKAP');
  var v = { ambangOutlier: _CONFIG_REKAP_DEFAULT.ambangOutlier };
  if (raw) {
    var o = JSON.parse(raw);
    if (o && o.ambangOutlier !== undefined) v.ambangOutlier = Number(o.ambangOutlier) || 0;
  }
  return v;
}

/** setKebijakanRekap({ambangOutlier}) — ubah kebijakan dari editor GAS. */
function setKebijakanRekap(obj) {
  var v = getKebijakanRekap();
  if (obj && obj.ambangOutlier !== undefined) v.ambangOutlier = Number(obj.ambangOutlier) || 0;
  PropertiesService.getScriptProperties().setProperty('KEBIJAKAN_REKAP', JSON.stringify(v));
  return v;
}

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 01_router.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
/**
 * 01_router.gs — Titik masuk Web App (doPost/doGet) + tabel routing
 *
 * Amplop: request {action, token, payload} → {ok:true,data} / {ok:false,error}.
 * Role diperiksa DI SINI (ACTION_MAP), bukan di frontend.
 * Frontend mengirim POST Content-Type text/plain berisi JSON (hindari preflight CORS).
 */

/**
 * Tabel routing. Tiap entri:
 *   { handler: fn(payload, session), public?: true, roles?: [ ... ] }
 *   - public:true   → tanpa token (hanya auth.login)
 *   - roles: []     → semua pengguna login boleh
 *   - roles: [...]  → hanya role tsb
 * Handler domain (taruna, pesanan, dst.) didaftarkan bertahap TAHAP 3–4.
 */
var ACTION_MAP = {
  // Auth (TAHAP 2)
  'auth.login':       { handler: authLogin,      public: true },
  'auth.logout':      { handler: authLogout,     roles: [] },
  'auth.change_pin':  { handler: authChangePin,  roles: [] },

  // Master (TAHAP 3)
  'taruna.list':      { handler: tarunaList,     roles: [] },
  'taruna.upsert':    { handler: tarunaUpsert,   roles: ['ADMIN', 'BAAK'] },
  'penyedia.list':    { handler: penyediaList,   roles: [] },
  'penyedia.upsert':  { handler: penyediaUpsert, roles: ['ADMIN', 'PPK', 'STAF_PPK'] },
  'kontrak.list':     { handler: kontrakList,    roles: [] },
  'kontrak.get':      { handler: kontrakGet,     roles: [] },
  'kontrak.upsert':   { handler: kontrakUpsert,  roles: ['PPK', 'STAF_PPK'] },
  'kontrak.approve':  { handler: kontrakApprove, roles: ['PPK', 'STAF_PPK'] },
  'kontrak.lampiran_upload': { handler: kontrakLampiranUpload, roles: ['PPK', 'STAF_PPK'] },
  'menu.list':        { handler: menuList,       roles: [] },
  'menu.upsert':      { handler: menuUpsert,     roles: ['PPK', 'STAF_PPK'] },
  // Ownership Taruna Fitur 2a — papan "Menu Hari Ini", read-only, nol data sensitif
  'menu.hari_ini':    { handler: menuHariIni,    roles: ['SENAT', 'PEMBINA'] },

  // Status harian (TAHAP 3)
  'status.set':       { handler: statusSet,      roles: ['ADMIN', 'PEMBINA', 'BAAK'] },
  'status.batch':     { handler: statusBatch,    roles: ['ADMIN', 'PEMBINA', 'BAAK'] },
  'status.list':      { handler: statusList,     roles: [] },
  'status.tandai_kembali': { handler: statusTandaiKembali, roles: ['ADMIN', 'PEMBINA', 'BAAK'] },

  // Ketua Jurusan (luar kampus) — role KETUA_JURUSAN, scope prodi (25_ketua_jurusan.gs)
  'kajur.taruna_list':  { handler: kajurTarunaList,  roles: ['KETUA_JURUSAN'] },
  'kajur.status_set':   { handler: kajurStatusSet,   roles: ['KETUA_JURUSAN'] },
  'kajur.status_batch': { handler: kajurStatusBatch, roles: ['KETUA_JURUSAN'] },
  'kajur.rekap':        { handler: kajurRekap,       roles: ['KETUA_JURUSAN'] },
  'kajur.approve':      { handler: kajurApprove,     roles: ['KETUA_JURUSAN'] },

  // Pesanan (TAHAP 3)
  'pesanan.list':     { handler: pesananList,    roles: [] },
  'pesanan.get':      { handler: pesananGet,     roles: [] },
  // Surat Pesanan Makan ke Penyedia (cetak) — internal login mana pun; TANPA
  // rupiah (lihat 12_pesanan.gs), TIDAK di PENYEDIA_ACTIONS (portal penyedia
  // tidak boleh menarik data pesanan bebas lewat action ini).
  'pesanan.surat_penyedia': { handler: pesananSuratPenyedia, roles: [] },
  'pesanan.create':   { handler: pesananCreate,  roles: ['SENAT'] },
  'pesanan.submit':   { handler: pesananSubmit,  roles: ['SENAT'] },
  'pesanan.verify':   { handler: pesananVerify,  roles: ['PEMBINA'] },
  'pesanan.return':   { handler: pesananReturn,  roles: ['PEMBINA'] },
  'pesanan.kirim':    { handler: pesananKirim,   roles: ['SENAT'] },
  'pesanan.revisi':   { handler: pesananRevisi,  roles: ['SENAT'] },
  // Fitur F: Pembina buat & ajukan sendiri tanpa Senat (satu langkah,
  // langsung TERKIRIM) — lihat catatan lengkap di 12_pesanan.gs.
  'pesanan.pembina_kirim': { handler: pesananPembinaKirim, roles: ['PEMBINA'] },
  // Verifikasi by-Exception (1c/1d): bulk-approve pesanan rutin sekaligus,
  // dipakai saat kebijakan autoLolosRutin=false — lihat 12_pesanan.gs.
  'pesanan.bulk_approve_rutin': { handler: pesananBulkApproveRutin, roles: ['PEMBINA'] },
  'pesanan.antrian_verifikasi': { handler: pesananAntrianVerifikasi, roles: ['PEMBINA'] },

  // Realisasi (TAHAP 3)
  'realisasi.list':   { handler: realisasiList,  roles: [] },
  'realisasi.create': { handler: realisasiCreate, roles: ['PEMBINA', 'SENAT'] },
  'realisasi.ttd':    { handler: realisasiTtd,   roles: ['PEMBINA', 'SENAT'] },
  // Ownership Taruna Fitur 1b/2b — baca kebijakan piket + standar gizi
  'realisasi.kebijakan_piket': { handler: realisasiKebijakanPiket, roles: [] },
  // Penerimaan Barang Senat — checklist per waktu makan × komponen, BUKAN Penyedia
  'realisasi.penerimaan': { handler: realisasiPenerimaan, roles: ['SENAT', 'PEMBINA', 'ADMIN'] },
  'realisasi.kebijakan_penerimaan': { handler: realisasiKebijakanPenerimaan, roles: [] },
  // Rekap kelengkapan Penerimaan Barang (Tahap 5, opsional) — baca murni, bahan evaluasi penyedia
  'realisasi.rekap_penerimaan': { handler: realisasiRekapPenerimaan, roles: ['PPK', 'STAF_PPK', 'KPA', 'WADIR3', 'SENAT'] },

  // Rekap bulanan (TAHAP 3 + gerbang Wadir 3)
  // SENAT/PEMBINA baca saja (halaman /rekap-ringkas, tanpa nominal di frontend)
  'rekap.get':        { handler: rekapGet,       roles: ['PPK', 'STAF_PPK', 'KPA', 'WADIR3', 'SENAT', 'PEMBINA'] },
  'rekap.verify':     { handler: rekapVerify,    roles: ['PPK', 'STAF_PPK'] },
  'rekap.final':      { handler: rekapFinal,     roles: ['PPK', 'STAF_PPK'] },
  'rekap.approve_wadir3': { handler: rekapApproveWadir3, roles: ['WADIR3'] },
  'rekap.batal_wadir3': { handler: rekapBatalWadir3, roles: ['WADIR3'] },
  'rekap.input_historis': { handler: rekapInputHistoris, roles: ['PPK', 'STAF_PPK', 'ADMIN'] },
  // rekap.harian: rekonsiliasi 3 titik HARIAN per Prodi+Tingkat, read-only —
  // internal login mana pun (pola sama seperti taruna.list), TIDAK di
  // PENYEDIA_ACTIONS/KETUA_JURUSAN_ACTIONS jadi otomatis dikecualikan.
  'rekap.harian':     { handler: rekapHarian,    roles: [] },

  // Pembayaran (TAHAP 4A)
  'bayar.list':       { handler: bayarList,      roles: ['PPK', 'STAF_PPK', 'KPA', 'SENAT', 'WADIR3'] },
  'bayar.get':        { handler: bayarGet,       roles: ['PPK', 'STAF_PPK', 'KPA', 'SENAT', 'WADIR3'] },
  // bayar.create: KOMIT ANGGARAN — TETAP PPK-ONLY (dikecualikan dari STAF_PPK
  // atas permintaan Firdaus; staf menyiapkan semua, PPK yang menekan "Buat Pembayaran").
  'bayar.create':     { handler: bayarCreate,    roles: ['PPK'] },
  'bayar.update':     { handler: bayarUpdate,    roles: ['PPK', 'STAF_PPK'] },
  // bayar.sync: tandai SELESAI dari kelengkapan SP2D_MONITORING (relasi 1:N) —
  // pelengkap auto-sync di sp2d.import; lihat 15_pembayaran.gs
  'bayar.sync':       { handler: bayarSync,      roles: ['PPK', 'STAF_PPK'] },
  // bayar.close: fallback manual (baris historis status lama) — bukan alur normal, lihat 15_pembayaran.gs
  'bayar.close':      { handler: bayarClose,     roles: ['PPK', 'STAF_PPK'] },

  // SPM (§18 skema-sheet.md) — header kelompok Prodi+Tingkat+Suplier, authored,
  // beda provenance dari sp2d.* (imported). Baca lebih longgar (pola bayar.*/
  // sp2d.rekonsiliasi), tulis PPK/ADMIN saja. TIDAK masuk PENYEDIA_ACTIONS.
  'spm.list':         { handler: spmList,        roles: ['PPK', 'STAF_PPK', 'KPA', 'SENAT', 'WADIR3', 'ADMIN'] },
  'spm.update':       { handler: spmUpdate,      roles: ['PPK', 'STAF_PPK', 'ADMIN'] },
  'spm.set_sp2d':     { handler: spmSetSp2d,     roles: ['PPK', 'STAF_PPK', 'ADMIN'] },
  'spm.regenerate':   { handler: spmRegenerate,  roles: ['PPK', 'STAF_PPK', 'ADMIN'] },
  'spm.anggota':      { handler: spmAnggota,     roles: ['PPK', 'STAF_PPK', 'ADMIN'] },
  'spm.split':        { handler: spmSplit,       roles: ['PPK', 'STAF_PPK', 'ADMIN'] },
  'spm.gabung':       { handler: spmGabung,      roles: ['PPK', 'STAF_PPK', 'ADMIN'] },

  // Tagihan gagal debet (TAHAP 4A)
  'tagihan.create':   { handler: tagihanCreate,  roles: ['SENAT', 'PPK', 'STAF_PPK'] },
  'tagihan.list':     { handler: tagihanList,    roles: [] },
  'tagihan.summary':  { handler: tagihanSummary, roles: ['PPK', 'STAF_PPK', 'KPA', 'WADIR3'] },
  // Laporan status debet taruna→Senat per taruna (berhasil/gagal) — baca saja,
  // tanpa rekening lengkap, akses sama seperti tagihan.summary + SENAT.
  'tagihan.status_debet': { handler: tagihanStatusDebet, roles: ['PPK', 'STAF_PPK', 'SENAT', 'KPA', 'WADIR3'] },
  'tagihan.setor':    { handler: tagihanSetor,   roles: ['SENAT', 'PEMBINA', 'ADMIN', 'PPK', 'STAF_PPK'] },
  // Verifikasi ganda TANPA urutan peran tetap — siapa pun di antara 4 role
  // boleh jadi verifikator 1 ATAU 2, ASAL dua orang (user_id) berbeda.
  'tagihan.verifikasi': { handler: tagihanVerifikasi, roles: ['SENAT', 'PEMBINA', 'ADMIN', 'PPK', 'STAF_PPK'] },
  'tagihan.waive':    { handler: tagihanWaive,   roles: ['PPK', 'STAF_PPK'] },
  'tagihan.regenerate_sp': { handler: tagihanRegenerateSp, roles: ['PPK', 'STAF_PPK'] },
  // Tandai batch tagihan LUNAS yang dananya sudah diteruskan ke penyedia —
  // TERPISAH dari jalur SP2D/SPM. Akses sama seperti tagihan.setor/verifikasi.
  'tagihan.teruskan_penyedia': { handler: tagihanTeruskanPenyedia, roles: ['SENAT', 'PEMBINA', 'ADMIN', 'PPK', 'STAF_PPK'] },

  // Surat peringatan (TAHAP 4B)
  'sp.list':          { handler: spList,         roles: [] },
  'sp.cetak_massal':  { handler: spCetakMassal,  roles: ['PPK', 'STAF_PPK', 'ADMIN'] },

  // Master pengguna (TAHAP 7 — Admin)
  'pengguna.list':      { handler: penggunaList,     roles: ['ADMIN'] },
  'pengguna.upsert':    { handler: penggunaUpsert,   roles: ['ADMIN'] },
  'pengguna.reset_pin': { handler: penggunaResetPin, roles: ['ADMIN'] },

  // Laporan & Audit (TAHAP 7)
  'laporan.bulanan':  { handler: laporanBulanan, roles: ['PPK', 'STAF_PPK', 'KPA', 'WADIR3', 'ADMIN'] },
  'laporan.resmi':    { handler: laporanResmi,   roles: ['PPK', 'STAF_PPK', 'KPA', 'WADIR3', 'ADMIN'] },

  // Bantuan Luar Kampus (PKL/Magang/KPA/PTB) — TAHAP migrasi
  'blk.list':         { handler: blkList,   roles: ['PPK', 'STAF_PPK', 'ADMIN', 'KPA', 'WADIR3'] },
  'blk.import':       { handler: blkImport, roles: ['PPK', 'STAF_PPK', 'ADMIN'] },
  'audit.list':       { handler: auditList,      roles: ['ADMIN', 'PPK', 'STAF_PPK', 'KPA', 'WADIR3'] },

  // Cetak Form Manual SOP (TAHAP cetak)
  'cetak.form01':     { handler: cetakForm01, roles: ['SENAT', 'PEMBINA', 'PPK', 'STAF_PPK', 'ADMIN'] },
  'cetak.form02':     { handler: cetakForm02, roles: ['PEMBINA', 'PPK', 'STAF_PPK', 'ADMIN'] },
  'cetak.form03':     { handler: cetakForm03, roles: ['PPK', 'STAF_PPK', 'ADMIN', 'PEMBINA'] },
  'cetak.form04':     { handler: cetakForm04, roles: ['SENAT', 'PEMBINA', 'PPK', 'STAF_PPK', 'ADMIN'] },
  'cetak.form05':     { handler: cetakForm05, roles: ['PEMBINA', 'PPK', 'STAF_PPK', 'ADMIN'] },
  'cetak.form06':     { handler: cetakForm06, roles: ['PPK', 'STAF_PPK', 'KPA', 'ADMIN', 'OPERATOR_SAKTI'] },
  'cetak.form07':     { handler: cetakForm07, roles: ['ADMIN', 'PPK', 'STAF_PPK'] },
  'cetak.blokir_gagal_debet': { handler: cetakBlokirGagalDebet, roles: ['ADMIN', 'PPK', 'STAF_PPK'] },
  'cetak.form08':     { handler: cetakForm08, roles: ['ADMIN', 'PPK', 'STAF_PPK'] },
  'cetak.form09':     { handler: cetakForm09, roles: ['SENAT', 'PPK', 'STAF_PPK', 'ADMIN', 'OPERATOR_SAKTI'] },
  'cetak.form10':     { handler: cetakForm10, roles: ['ADMIN', 'PPK', 'STAF_PPK'] },

  // Rekening lengkap (TARUNA_REKENING) — TAHAP SENSITIF, lihat CLAUDE.md § 4/§ 7
  'rekening.lihat_lengkap': { handler: rekeningLihatLengkap, roles: ['ADMIN', 'PPK', 'STAF_PPK'] },
  'rekening.cocokkan':      { handler: rekeningCocokkan,     roles: ['ADMIN', 'PPK', 'STAF_PPK'] },
  'rekening.simpan':        { handler: rekeningSimpan,       roles: ['ADMIN'] },
  'rekening.simpan_batch':  { handler: rekeningSimpanBatch,  roles: ['ADMIN'] },

  // Rekonsiliasi SP2D (Monitoring SP2D OM-SPAN vs data sistem)
  'sp2d.import':        { handler: sp2dImport,        roles: ['PPK', 'STAF_PPK', 'ADMIN'] },
  'sp2d.rekonsiliasi':  { handler: sp2dRekonsiliasi,  roles: ['PPK', 'STAF_PPK', 'KPA', 'WADIR3', 'ADMIN'] },
  'sp2d.list':          { handler: sp2dList,          roles: ['PPK', 'STAF_PPK', 'ADMIN'] },
  'sp2d.koreksi':       { handler: sp2dKoreksi,       roles: ['PPK', 'STAF_PPK', 'ADMIN'] },
  'sp2d.cek_dobel':     { handler: sp2dCekDobel,      roles: ['PPK', 'STAF_PPK', 'ADMIN'] },
  'sp2d.hapus_dobel':   { handler: sp2dHapusDobel,    roles: ['PPK', 'STAF_PPK', 'ADMIN'] },

  // Kokpit PPK — agregasi baca murni, tidak menulis apa pun
  'ppk.kokpit':         { handler: ppkKokpit,         roles: ['PPK', 'STAF_PPK', 'KPA', 'WADIR3'] },

  // Portal Penyedia (rekanan eksternal) — akses SANGAT terbatas, lihat PENYEDIA_ACTIONS
  'penyedia.portal':    { handler: penyediaPortal,    roles: ['PENYEDIA'] }
};

/**
 * Allowlist action untuk role PENYEDIA (rekanan eksternal).
 *
 * PENTING: banyak action ber-`roles:[]` berarti "semua pengguna login" dan
 * mengekspos data seluruh sistem (taruna.list memuat rek_mask, pesanan.list
 * seluruh pesanan, penyedia.list seluruh rekanan, dst). Kalau akun PENYEDIA
 * ikut semantik `roles:[]`, ia bisa membaca SEMUA itu. Maka: akun PENYEDIA
 * HANYA boleh memanggil action di allowlist ini — apa pun isi `roles`-nya.
 * Semua data yang dilihatnya di-scope ke session.penyedia_id di handler.
 */
var PENYEDIA_ACTIONS = {
  'penyedia.portal': true,
  'auth.logout':     true,
  'auth.change_pin': true
};

/**
 * Allowlist role KETUA_JURUSAN — sama semangatnya dengan PENYEDIA_ACTIONS:
 * banyak action ber-`roles:[]` mengekspos data seluruh sistem, jadi Ketua Jurusan
 * HANYA boleh memanggil action di sini (apa pun isi `roles`-nya). Semua data
 * yang dilihatnya di-scope ke session.prodi di handler (25_ketua_jurusan.gs).
 */
var KETUA_JURUSAN_ACTIONS = {
  'kajur.taruna_list':  true,
  'kajur.status_set':   true,
  'kajur.status_batch': true,
  'kajur.rekap':        true,
  'kajur.approve':      true,
  'auth.logout':        true,
  'auth.change_pin':    true
};

/**
 * Allowlist role OPERATOR_SAKTI — sama semangatnya dengan PENYEDIA_ACTIONS/
 * KETUA_JURUSAN_ACTIONS: operator input SPM ke SAKTI HANYA boleh baca dua
 * dokumen cetak ini (tidak ada rekening penuh di keduanya), TIDAK ikut
 * semantik roles:[] yang mengekspos data seluruh sistem.
 */
var OPERATOR_SAKTI_ACTIONS = {
  'cetak.form06':    true,
  'cetak.form09':    true,
  'auth.logout':     true,
  'auth.change_pin': true
};

/** Health check. */
function doGet(e) {
  return _json_({ ok: true, data: { app: APP_INFO.nama, version: APP_INFO.versi } });
}

/** Titik masuk semua aksi. */
function doPost(e) {
  var action = '';
  try {
    var body = (e && e.postData && e.postData.contents) ? JSON.parse(e.postData.contents) : {};
    action = body.action || '';
    var token = body.token || '';
    var payload = body.payload || {};

    var def = ACTION_MAP[action];
    if (!def) return _json_({ ok: false, error: 'Aksi tidak dikenal: ' + action });

    var session = null;
    if (!def.public) {
      session = validateToken(token);
      if (!session) return _json_({ ok: false, error: 'Sesi tidak valid atau kedaluwarsa. Silakan login ulang.' });
      // Pagar khusus PENYEDIA: HANYA action di allowlist — TIDAK ikut semantik
      // roles:[] ("semua login") yang mengekspos data seluruh sistem.
      if (session.role === ROLES.PENYEDIA && !PENYEDIA_ACTIONS[action]) {
        return _json_({ ok: false, error: 'Anda tidak berwenang melakukan aksi ini.' });
      }
      // Pagar khusus KETUA_JURUSAN: HANYA action di allowlist (scope prodi di handler).
      if (session.role === ROLES.KETUA_JURUSAN && !KETUA_JURUSAN_ACTIONS[action]) {
        return _json_({ ok: false, error: 'Anda tidak berwenang melakukan aksi ini.' });
      }
      // Pagar khusus OPERATOR_SAKTI: HANYA action di allowlist (Form-06/Form-09 saja).
      if (session.role === ROLES.OPERATOR_SAKTI && !OPERATOR_SAKTI_ACTIONS[action]) {
        return _json_({ ok: false, error: 'Anda tidak berwenang melakukan aksi ini.' });
      }
      if (def.roles && def.roles.length > 0 && def.roles.indexOf(session.role) < 0) {
        return _json_({ ok: false, error: 'Anda tidak berwenang melakukan aksi ini.' });
      }
    }

    var data = def.handler(payload, session);
    return _json_({ ok: true, data: data });

  } catch (err) {
    // Error terduga (userFacing) → pesan asli; selain itu → generik tanpa stack trace.
    var pesan = (err && err.userFacing) ? err.message : 'Terjadi kesalahan server';
    try { auditLog(null, 'ERROR', 'ACTION', action, null, { pesan: String(err && err.message || err) }); } catch (e2) {}
    return _json_({ ok: false, error: pesan });
  }
}

/** Bungkus objek → respons JSON. */
function _json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 02_auth.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
/**
 * 02_auth.gs — Autentikasi & sesi (token 24 jam) + master pengguna (Admin)
 *
 * SALT & hash memakai _getSalt_() / _sha256Hex_() (99_setup.gs).
 * ACTION: auth.login, auth.logout, auth.change_pin,
 *         pengguna.list, pengguna.upsert, pengguna.reset_pin
 */

var _PIN_DEFAULT_ = '123456';       // kata sandi reset default (wajib diganti pengguna)
var _TOKEN_TTL_MS_ = 24 * 60 * 60 * 1000;
var _LOGIN_MAX_GAGAL_ = 5;
var _LOGIN_BLOKIR_DETIK_ = 15 * 60; // 15 menit

/** Login → {token, role, nama}. Rate limit 5x gagal → blokir 15 menit. */
function authLogin(payload) {
  var uid = (payload && payload.user_id != null) ? String(payload.user_id).trim() : '';
  var pin = (payload && payload.pin != null) ? String(payload.pin) : '';
  if (!uid || !pin) throw _fail_('user_id dan kata sandi wajib diisi.');

  var cache = CacheService.getScriptCache();
  var fkey = 'fail_' + uid;
  var fails = parseInt(cache.get(fkey) || '0', 10);
  if (fails >= _LOGIN_MAX_GAGAL_) throw _fail_('Terlalu banyak percobaan. Coba lagi 15 menit.');

  var u = sheetRead(SHEETS.PENGGUNA, function (r) { return String(r.user_id) === uid; })[0];
  var hash = _sha256Hex_(pin + _getSalt_());
  var cocok = u && String(u.pin_hash) === hash;

  if (!cocok || (u && u.status === 'NONAKTIF')) {
    cache.put(fkey, String(fails + 1), _LOGIN_BLOKIR_DETIK_);
    if (u && u.status === 'NONAKTIF') throw _fail_('Akun nonaktif. Hubungi Admin.');
    throw _fail_('user_id atau kata sandi salah.');
  }

  cache.remove(fkey);
  var token = Utilities.getUuid();
  var exp = new Date(Date.now() + _TOKEN_TTL_MS_);
  sheetUpdate(SHEETS.PENGGUNA, 'user_id', uid, { token: token, token_exp: exp });
  auditLog({ user_id: uid }, 'auth.login', 'PENGGUNA', uid, null, { login: true });
  return { token: token, role: u.role, nama: u.nama };
}

/** Validasi token → session {user_id, nama, role, penyedia_id} atau null. */
function validateToken(token) {
  if (!token) return null;
  var u = sheetRead(SHEETS.PENGGUNA, function (r) { return String(r.token) === String(token); })[0];
  if (!u || u.status === 'NONAKTIF') return null;
  var exp = u.token_exp;
  var expMs = (exp instanceof Date) ? exp.getTime() : (exp ? new Date(exp).getTime() : 0);
  if (!expMs || expMs < Date.now()) return null;
  // penyedia_id hanya terisi untuk role PENYEDIA — dipakai row-level scoping di penyedia.portal.
  // prodi hanya terisi untuk role KETUA_JURUSAN — scope input absen & rekap luar kampus per prodi.
  return {
    user_id: u.user_id, nama: u.nama, role: u.role,
    penyedia_id: String(u.penyedia_id || ''), prodi: String(u.prodi || '')
  };
}

/**
 * _hanyaPenyedia_(session) — pagar tambahan di DALAM handler portal rekanan.
 * Mirror _hanyaAdminPPK_: proteksi tidak boleh bergantung SATU-SATUNYA pada
 * router. Wajib role PENYEDIA DAN punya penyedia_id tertaut (kalau kosong,
 * akun salah konfigurasi → tolak, jangan bocorkan data penyedia lain).
 */
function _hanyaPenyedia_(session) {
  if (!session || session.role !== ROLES.PENYEDIA) throw _fail_('Khusus akun penyedia.');
  if (!session.penyedia_id) throw _fail_('Akun penyedia belum tertaut ke data penyedia. Hubungi Admin.');
  return session.penyedia_id;
}

/**
 * _hanyaKajur_(session) — pagar tambahan di DALAM handler Ketua Jurusan (mirror
 * _hanyaPenyedia_). Wajib role KETUA_JURUSAN DAN punya `prodi` tertaut (kalau
 * kosong → akun salah konfigurasi, tolak supaya tak melihat/mengubah prodi lain).
 * Mengembalikan prodi untuk dipakai sebagai filter scope.
 */
function _hanyaKajur_(session) {
  if (!session || session.role !== ROLES.KETUA_JURUSAN) throw _fail_('Khusus akun Ketua Jurusan.');
  if (!session.prodi) throw _fail_('Akun Ketua Jurusan belum tertaut ke prodi. Hubungi Admin.');
  return session.prodi;
}

/**
 * _hanyaAdminPPK_(session) — pagar tambahan di DALAM handler (bukan pengganti
 * ACTION_MAP.roles di router). Dipakai handler yang menyentuh data sangat
 * sensitif (rekening lengkap) supaya proteksi tidak bergantung SATU-SATUNYA
 * pada konfigurasi router — kalau suatu saat roles di ACTION_MAP salah/kosong,
 * handler tetap menolak sendiri.
 */
function _hanyaAdminPPK_(session) {
  // STAF_PPK ikut PPK (lihat rekening lengkap utk Form-07/08/10) — mencerminkan
  // hak PPK. Input rekening (rekening.simpan) TETAP ADMIN saja (gate terpisah).
  if (!session || (session.role !== ROLES.ADMIN && session.role !== ROLES.PPK && session.role !== ROLES.STAF_PPK)) {
    throw _fail_('Anda tidak berwenang mengakses data rekening lengkap.');
  }
}

/** Logout → hapus token. */
function authLogout(payload, session) {
  sheetUpdate(SHEETS.PENGGUNA, 'user_id', session.user_id, { token: '', token_exp: '' });
  auditLog(session, 'auth.logout', 'PENGGUNA', session.user_id, null, null);
  return { ok: true };
}

/**
 * Ganti kata sandi (payload {pin_lama, pin_baru}; kunci payload tetap `pin_*`
 * demi kompatibilitas kontrak API — nilainya kini kata sandi bebas, bukan
 * PIN 6 digit). pin_lama wajib benar; pin_baru minimal 6 karakter (boleh
 * huruf/angka/simbol). Kolom penyimpanan tetap `pin_hash` (SHA-256 sama seperti
 * sebelumnya) — kata sandi lama 6-digit tetap valid tanpa reset.
 */
function authChangePin(payload, session) {
  var lama = (payload && payload.pin_lama != null) ? String(payload.pin_lama) : '';
  var baru = (payload && payload.pin_baru != null) ? String(payload.pin_baru) : '';
  if (baru.length < 6) throw _fail_('Kata sandi baru minimal 6 karakter.');
  var salt = _getSalt_();
  var u = sheetRead(SHEETS.PENGGUNA, function (r) { return String(r.user_id) === String(session.user_id); })[0];
  if (!u) throw _fail_('Pengguna tidak ditemukan.');
  if (String(u.pin_hash) !== _sha256Hex_(lama + salt)) throw _fail_('Kata sandi lama salah.');
  sheetUpdate(SHEETS.PENGGUNA, 'user_id', session.user_id, { pin_hash: _sha256Hex_(baru + salt) });
  auditLog(session, 'auth.change_pin', 'PENGGUNA', session.user_id, null, null);
  return { ok: true };
}

// ── Master pengguna (Admin) ──────────────────────────────────────────────────

/** Daftar pengguna (tanpa pin_hash & token). */
function penggunaList(payload, session) {
  var rows = sheetRead(SHEETS.PENGGUNA);
  return {
    pengguna: rows.map(function (u) {
      return { user_id: u.user_id, nama: u.nama, role: u.role, status: u.status, penyedia_id: String(u.penyedia_id || ''), prodi: String(u.prodi || '') };
    })
  };
}

/**
 * Validasi & normalisasi penyedia_id sesuai role.
 * - role PENYEDIA: penyedia_id WAJIB & harus ada di sheet PENYEDIA.
 * - role lain: penyedia_id DIPAKSA kosong (akun internal tak boleh tertaut penyedia).
 */
function _penyediaIdUntukRole_(role, penyediaIdRaw) {
  if (role !== ROLES.PENYEDIA) return '';
  var pid = String(penyediaIdRaw || '').trim();
  if (!pid) throw _fail_('penyedia_id wajib diisi untuk akun role PENYEDIA.');
  var ada = sheetRead(SHEETS.PENYEDIA, function (r) { return String(r.penyedia_id) === pid; })[0];
  if (!ada) throw _fail_('Penyedia tidak ditemukan: ' + pid);
  return pid;
}

/**
 * Validasi & normalisasi prodi sesuai role.
 * - role KETUA_JURUSAN: prodi WAJIB (nilai bebas string prodi, mis. "TPI"); harus
 *   cocok dengan salah satu nilai TARUNA.prodi supaya scope-nya bermakna.
 * - role lain: prodi DIPAKSA kosong.
 */
function _prodiUntukRole_(role, prodiRaw) {
  if (role !== ROLES.KETUA_JURUSAN) return '';
  var prodi = String(prodiRaw || '').trim();
  if (!prodi) throw _fail_('prodi wajib diisi untuk akun role KETUA_JURUSAN.');
  var ada = sheetRead(SHEETS.TARUNA, function (r) { return String(r.prodi) === prodi; })[0];
  if (!ada) throw _fail_('Prodi tidak ditemukan pada data taruna: ' + prodi);
  return prodi;
}

/** Tambah/ubah pengguna. Pengguna baru → PIN default. */
function penggunaUpsert(payload, session) {
  var uid = (payload && payload.user_id != null) ? String(payload.user_id).trim() : '';
  var nama = (payload && payload.nama != null) ? String(payload.nama).trim() : '';
  var role = payload && payload.role;
  var status = (payload && payload.status) ? String(payload.status) : 'AKTIF';
  if (!uid) throw _fail_('user_id wajib diisi.');
  if (!nama) throw _fail_('nama wajib diisi.');
  if (ENUM.ROLE.indexOf(role) < 0) throw _fail_('role tidak valid.');
  if (ENUM.AKTIF_STATUS.indexOf(status) < 0) throw _fail_('status tidak valid.');
  var penyediaId = _penyediaIdUntukRole_(role, payload && payload.penyedia_id);
  var prodi = _prodiUntukRole_(role, payload && payload.prodi);

  var ada = sheetRead(SHEETS.PENGGUNA, function (r) { return String(r.user_id) === uid; })[0];
  if (ada) {
    var patch = { nama: nama, role: role, status: status, penyedia_id: penyediaId, prodi: prodi };
    var baru = sheetUpdate(SHEETS.PENGGUNA, 'user_id', uid, patch);
    auditLog(session, 'pengguna.upsert', 'PENGGUNA', uid,
      { nama: ada.nama, role: ada.role, status: ada.status, penyedia_id: String(ada.penyedia_id || ''), prodi: String(ada.prodi || '') }, patch);
    return { pengguna: { user_id: uid, nama: baru.nama, role: baru.role, status: baru.status, penyedia_id: penyediaId, prodi: prodi } };
  }
  sheetAppend(SHEETS.PENGGUNA, {
    user_id: uid, nama: nama, role: role,
    pin_hash: _sha256Hex_(_PIN_DEFAULT_ + _getSalt_()),
    token: '', token_exp: '', penyedia_id: penyediaId, status: status, prodi: prodi
  });
  auditLog(session, 'pengguna.upsert', 'PENGGUNA', uid, null, { nama: nama, role: role, status: status, penyedia_id: penyediaId, prodi: prodi });
  return { pengguna: { user_id: uid, nama: nama, role: role, status: status, penyedia_id: penyediaId, prodi: prodi } };
}

/** Reset PIN pengguna ke default. */
function penggunaResetPin(payload, session) {
  var uid = (payload && payload.user_id != null) ? String(payload.user_id).trim() : '';
  if (!uid) throw _fail_('user_id wajib diisi.');
  var u = sheetRead(SHEETS.PENGGUNA, function (r) { return String(r.user_id) === uid; })[0];
  if (!u) throw _fail_('Pengguna tidak ditemukan.');
  sheetUpdate(SHEETS.PENGGUNA, 'user_id', uid, {
    pin_hash: _sha256Hex_(_PIN_DEFAULT_ + _getSalt_()), token: '', token_exp: ''
  });
  auditLog(session, 'pengguna.reset_pin', 'PENGGUNA', uid, null, { reset: true });
  return { ok: true };
}

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 03_helpers.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
/**
 * 03_helpers.gs — Utilitas I/O sheet, lock, audit, lampiran (dipakai semua modul)
 *
 * Spreadsheet target diambil via _getSpreadsheet_() (99_setup.gs): SPREADSHEET_ID
 * di Script Properties (standalone) atau spreadsheet terikat (bound).
 */

// ── Error yang aman ditampilkan ke pengguna (bukan bug tak terduga) ─────────
/** Buat Error dengan pesan Bahasa Indonesia yang boleh dikirim ke klien. */
function _fail_(msg) {
  var e = new Error(msg);
  e.userFacing = true;
  return e;
}

// ── Lock reentrant (aman untuk pemanggilan withLock bersarang) ──────────────
var _LOCK_STATE = { depth: 0, lock: null };

/** Bungkus fungsi tulis dalam LockService. Reentrant dalam satu eksekusi. */
function withLock(fn) {
  if (_LOCK_STATE.depth > 0) {           // sudah memegang lock → jalankan langsung
    _LOCK_STATE.depth++;
    try { return fn(); } finally { _LOCK_STATE.depth--; }
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw _fail_('Sistem sedang sibuk, coba lagi sebentar.');
  _LOCK_STATE.lock = lock;
  _LOCK_STATE.depth = 1;
  try { return fn(); }
  finally { _LOCK_STATE.depth = 0; _LOCK_STATE.lock = null; lock.releaseLock(); }
}

// ── I/O sheet ───────────────────────────────────────────────────────────────

/** Ambil sheet by nama atau lempar error. */
function _sheet_(name) {
  var sh = _getSpreadsheet_().getSheetByName(name);
  if (!sh) throw _fail_('Sheet tidak ditemukan: ' + name + '. Jalankan setupDatabase().');
  return sh;
}

/** Baca sheet → array objek (header snake_case → key). filterFn opsional. */
function sheetRead(name, filterFn) {
  var sh = _sheet_(name);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var lastCol = sh.getLastColumn();
  var values = sh.getRange(1, 1, last, lastCol).getValues();
  var headers = values[0];
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) obj[headers[j]] = values[i][j];
    if (!filterFn || filterFn(obj)) out.push(obj);
  }
  return out;
}

/** Tambah satu baris (dibungkus withLock). Mengembalikan objek yang ditulis. */
function sheetAppend(name, obj) {
  return withLock(function () {
    var sh = _sheet_(name);
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var row = headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
    sh.appendRow(row);
    return obj;
  });
}

/**
 * Perbarui baris pertama yang keyCol == keyVal dengan patch (dibungkus withLock).
 * Mengembalikan objek baris hasil merge, atau null bila tidak ditemukan.
 */
function sheetUpdate(name, keyCol, keyVal, patch) {
  return withLock(function () {
    var sh = _sheet_(name);
    var last = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var keyIdx = headers.indexOf(keyCol);
    if (keyIdx < 0) throw _fail_('Kolom kunci tidak ada: ' + keyCol);
    if (last < 2) return null;
    var data = sh.getRange(2, 1, last - 1, lastCol).getValues();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][keyIdx]) === String(keyVal)) {
        var rowNum = i + 2;
        for (var h = 0; h < headers.length; h++) {
          if (patch.hasOwnProperty(headers[h])) {
            sh.getRange(rowNum, h + 1).setValue(patch[headers[h]]);
          }
        }
        var merged = {};
        var newRow = sh.getRange(rowNum, 1, 1, lastCol).getValues()[0];
        for (var k = 0; k < headers.length; k++) merged[headers[k]] = newRow[k];
        return merged;
      }
    }
    return null;
  });
}

/**
 * Hapus baris-baris yang nilai keyCol-nya termasuk dalam keyVals (dibungkus
 * withLock). Kembalikan array objek baris yang DIHAPUS (untuk AUDIT_LOG
 * pemanggil — sheetDeleteRows sendiri TIDAK mencatat audit, supaya pemanggil
 * bebas menentukan detail aksi/ref_id per baris). Satu-satunya penghapusan
 * baris data di codebase ini (semua "koreksi" lain hanya sheetUpdate in-place)
 * — dipakai HATI-HATI, hanya untuk kasus dobel yang benar-benar keliru
 * (lihat sp2dHapusDobel, 23_sp2d.gs). Hapus dari baris TERBAWAH ke ATAS supaya
 * indeks baris yang belum diproses tidak bergeser.
 */
function sheetDeleteRows(name, keyCol, keyVals) {
  var set = {};
  (keyVals || []).forEach(function (v) { set[String(v)] = true; });
  return withLock(function () {
    var sh = _sheet_(name);
    var last = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var keyIdx = headers.indexOf(keyCol);
    if (keyIdx < 0) throw _fail_('Kolom kunci tidak ada: ' + keyCol);
    if (last < 2) return [];
    var data = sh.getRange(2, 1, last - 1, lastCol).getValues();
    var dihapus = [];
    for (var i = data.length - 1; i >= 0; i--) {
      if (!set[String(data[i][keyIdx])]) continue;
      var obj = {};
      for (var h = 0; h < headers.length; h++) obj[headers[h]] = data[i][h];
      dihapus.unshift(obj);
      sh.deleteRow(i + 2);
    }
    return dihapus;
  });
}

// ── Audit ────────────────────────────────────────────────────────────────────

/** Catat satu baris AUDIT_LOG (append-only). data_lama/data_baru → JSON string. */
function auditLog(session, aksi, refType, refId, dataLama, dataBaru) {
  var uid = (session && session.user_id) ? session.user_id : 'SISTEM';
  sheetAppend(SHEETS.AUDIT_LOG, {
    timestamp: new Date(),
    user_id: uid,
    aksi: aksi || '',
    ref_type: refType || '',
    ref_id: refId || '',
    data_lama: (dataLama !== undefined && dataLama !== null) ? JSON.stringify(dataLama) : '',
    data_baru: (dataBaru !== undefined && dataBaru !== null) ? JSON.stringify(dataBaru) : ''
  });
}

// ── ID generator (counter per prefix di Script Properties) ──────────────────

/** Kembalikan ID berikutnya, format PREFIX-000001. Serial via withLock. */
function nextId(prefix) {
  return withLock(function () {
    var p = PropertiesService.getScriptProperties();
    var key = 'CTR_' + prefix;
    var cur = parseInt(p.getProperty(key) || '0', 10) + 1;
    p.setProperty(key, String(cur));
    return prefix + '-' + ('000000' + cur).slice(-6);
  });
}

// ── Lampiran (Drive polymorphic) ────────────────────────────────────────────

/** Tebak MIME dari ekstensi nama file (fallback octet-stream). */
function _mimeDariNama_(nama) {
  var n = String(nama || '').toLowerCase();
  if (/\.pdf$/.test(n)) return 'application/pdf';
  if (/\.(jpg|jpeg)$/.test(n)) return 'image/jpeg';
  if (/\.png$/.test(n)) return 'image/png';
  if (/\.(xls|xlsx)$/.test(n)) return 'application/vnd.ms-excel';
  if (/\.(doc|docx)$/.test(n)) return 'application/msword';
  return 'application/octet-stream';
}

/**
 * Simpan berkas base64 ke Drive + catat baris LAMPIRAN. Maks 5 MB.
 * SP → folder FOLDER_SP; selain itu → FOLDER_LAMPIRAN.
 * Mengembalikan {lamp_id, drive_file_id}.
 */
function lampiranSave(session, refType, refId, jenis, base64, namaFile) {
  var p = PropertiesService.getScriptProperties();
  var folderId = (refType === 'SP') ? p.getProperty('FOLDER_SP') : p.getProperty('FOLDER_LAMPIRAN');
  if (!folderId) throw _fail_('Folder Drive belum disiapkan. Jalankan setupFolderDrive().');
  if (!base64) throw _fail_('Berkas kosong.');
  var bytes = Utilities.base64Decode(base64);
  if (bytes.length > 5 * 1024 * 1024) throw _fail_('Ukuran berkas melebihi 5 MB.');
  var blob = Utilities.newBlob(bytes, _mimeDariNama_(namaFile), namaFile || 'berkas');
  var file = DriveApp.getFolderById(folderId).createFile(blob);
  var lampId = nextId('LMP');
  sheetAppend(SHEETS.LAMPIRAN, {
    lamp_id: lampId,
    ref_type: refType,
    ref_id: refId,
    jenis: jenis,
    drive_file_id: file.getId(),
    nama_file: namaFile || '',
    uploaded_by: (session && session.user_id) ? session.user_id : 'SISTEM',
    timestamp: new Date()
  });
  return { lamp_id: lampId, drive_file_id: file.getId() };
}

/** Daftar lampiran untuk (ref_type, ref_id). */
function lampiranList(refType, refId) {
  return sheetRead(SHEETS.LAMPIRAN, function (r) {
    return String(r.ref_type) === String(refType) && String(r.ref_id) === String(refId);
  });
}

// ── Terbilang (angka → teks Indonesia) ───────────────────────────────────────
// Dipakai Form 06 (nominal pembayaran wajib tercetak dalam huruf). Diimplementasikan
// di backend (bukan frontend) supaya satu-satunya sumber logika terbilang konsisten
// dipakai form cetak lain di masa depan tanpa duplikasi kode di kedua sisi.
var _SATUAN_TERBILANG_ = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];

/** Rekursif: ubah bilangan bulat non-negatif → teks Indonesia (tanpa akhiran "rupiah"). */
function _terbilang_(n) {
  n = Math.floor(Math.abs(n));
  if (n < 12) return _SATUAN_TERBILANG_[n];
  if (n < 20) return _terbilang_(n - 10) + ' belas';
  if (n < 100) return _terbilang_(Math.floor(n / 10)) + ' puluh' + (n % 10 !== 0 ? ' ' + _terbilang_(n % 10) : '');
  if (n < 200) return 'seratus' + (n - 100 !== 0 ? ' ' + _terbilang_(n - 100) : '');
  if (n < 1000) return _terbilang_(Math.floor(n / 100)) + ' ratus' + (n % 100 !== 0 ? ' ' + _terbilang_(n % 100) : '');
  if (n < 2000) return 'seribu' + (n - 1000 !== 0 ? ' ' + _terbilang_(n - 1000) : '');
  if (n < 1000000) return _terbilang_(Math.floor(n / 1000)) + ' ribu' + (n % 1000 !== 0 ? ' ' + _terbilang_(n % 1000) : '');
  if (n < 1000000000) return _terbilang_(Math.floor(n / 1000000)) + ' juta' + (n % 1000000 !== 0 ? ' ' + _terbilang_(n % 1000000) : '');
  if (n < 1000000000000) return _terbilang_(Math.floor(n / 1000000000)) + ' miliar' + (n % 1000000000 !== 0 ? ' ' + _terbilang_(n % 1000000000) : '');
  return _terbilang_(Math.floor(n / 1000000000000)) + ' triliun' + (n % 1000000000000 !== 0 ? ' ' + _terbilang_(n % 1000000000000) : '');
}

/** Bungkus _terbilang_ jadi kalimat nominal rupiah baku, huruf awal kapital. */
function _terbilangRupiah_(n) {
  n = Math.round(Number(n) || 0);
  var teks = n === 0 ? 'nol' : (n < 0 ? 'minus ' + _terbilang_(n) : _terbilang_(n));
  teks = teks + ' rupiah';
  return teks.charAt(0).toUpperCase() + teks.slice(1);
}

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 05_master.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
/**
 * 05_master.gs — Master data penyedia & kontrak + util domain bersama
 *
 * ACTION: penyedia.list, penyedia.upsert (Admin, PPK),
 *         kontrak.list, kontrak.upsert (PPK), kontrak.approve (PPK),
 *         menu.list, menu.upsert (PPK) — menu mingguan terjadwal per kontrak
 *
 * Lampiran kontrak (menu & nilai gizi, BA penunjukan, notulen) → LAMPIRAN ref_type=KONTRAK.
 * Setiap aksi tulis → withLock + auditLog.
 */

// ── Util domain bersama (dipakai modul 10–16) ───────────────────────────────

/** Normalisasi nilai sel tanggal → string 'yyyy-MM-dd'. */
function _tglStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var s = String(v || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return s; // biarkan apa adanya bila bukan pola tanggal
  return s.slice(0, 10);
}

/** Bulan 'yyyy-MM' dari tanggal (Date/string). */
function _bulanStr_(v) { return _tglStr_(v).slice(0, 7); }

/** Tanggal hari ini 'yyyy-MM-dd' (zona waktu skrip = Asia/Jayapura). */
function _todayStr_() { return _tglStr_(new Date()); }

// Nama hari (indeks getDay(): 0=Minggu..6=Sabtu) — SAMA PERSIS dengan
// NAMA_HARI di frontend (pesanan-buat.tsx) supaya komposisi pengantaran
// (Malam hari-D + Pagi/Siang hari D+1) konsisten di kedua sisi.
var _NAMA_HARI_ = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];

/**
 * Nama hari (SENIN..MINGGU) dari 'YYYY-MM-DD' — parse komponen y/m/d LOKAL
 * (bukan `new Date(string)`, yang ditafsir UTC dan bisa tergeser sehari
 * tergantung timezone eksekusi) lalu `new Date(y, m-1, d)` murni kalender,
 * tidak terpengaruh timezone. Kembalikan '' bila format tidak valid.
 */
function _hariDalamMinggu_(tgl) {
  var p = String(tgl || '').split('-').map(function (s) { return parseInt(s, 10); });
  if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return '';
  return _NAMA_HARI_[new Date(p[0], p[1] - 1, p[2]).getDay()];
}

/** Tanggal 'YYYY-MM-DD' digeser n hari — komponen lokal, lihat _hariDalamMinggu_. */
function _tambahHari_(tgl, n) {
  var p = String(tgl || '').split('-').map(function (s) { return parseInt(s, 10); });
  if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return tgl;
  var d = new Date(p[0], p[1] - 1, p[2] + n);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

/** Validasi & konversi integer ≥0 (uang/jumlah). Tolak pecahan — aturan uang integer. */
function _int_(v, nama) {
  var n = Number(v);
  if (!isFinite(n) || Math.floor(n) !== n || n < 0) throw _fail_(nama + ' harus bilangan bulat ≥ 0.');
  return n;
}

/** Validasi pola tanggal 'yyyy-MM-dd'. */
function _wajibTgl_(v, nama) {
  var s = String(v || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw _fail_(nama + ' wajib format YYYY-MM-DD.');
  return s;
}

/** Validasi pola bulan 'yyyy-MM'. */
function _wajibBulan_(v, nama) {
  var s = String(v || '').trim();
  if (!/^\d{4}-\d{2}$/.test(s)) throw _fail_(nama + ' wajib format YYYY-MM.');
  return s;
}

/** Daftar tanggal 'yyyy-MM-dd' dari `dari` s.d. `sampai` inklusif. Maks 186 hari (±6 bulan). */
function _daftarTanggal_(dari, sampai) {
  if (sampai < dari) throw _fail_('tgl_akhir tidak boleh sebelum tanggal.');
  var out = [];
  var d = new Date(dari + 'T00:00:00');
  var akhir = new Date(sampai + 'T00:00:00');
  while (d <= akhir) {
    out.push(_tglStr_(d));
    d.setDate(d.getDate() + 1);
    if (out.length > 186) throw _fail_('Rentang tanggal maksimal 186 hari.');
  }
  return out;
}

/**
 * Normalisasi mask 4 digit terakhir (rek_mask / npwp_mask).
 * Terima '1234', '••••1234', '****1234' → simpan '••••1234'.
 * TOLAK bila memuat >4 digit angka (indikasi nomor lengkap — dilarang masuk sistem).
 */
function _mask4_(v, nama) {
  var s = String(v || '').trim();
  if (!s) throw _fail_(nama + ' wajib diisi.');
  var digit = s.replace(/\D/g, '');
  if (digit.length > 4) throw _fail_(nama + ' hanya boleh 4 digit terakhir — nomor lengkap DILARANG masuk sistem.');
  if (digit.length < 4) throw _fail_(nama + ' harus tepat 4 digit terakhir.');
  return '••••' + digit;
}

/** Kontrak aktif (DISETUJUI_PPK, tgl_mulai ≤ tanggal ≤ tgl_akhir) atau error. */
function _kontrakAktifPada_(tanggal) {
  var t = _tglStr_(tanggal);
  var rows = sheetRead(SHEETS.KONTRAK, function (r) {
    return r.status === 'DISETUJUI_PPK' && _tglStr_(r.tgl_mulai) <= t && t <= _tglStr_(r.tgl_akhir);
  });
  if (!rows.length) throw _fail_('Tidak ada kontrak aktif (DISETUJUI_PPK) pada tanggal ' + t + '.');
  return rows[0];
}

/**
 * Tarif harian per taruna dari kontrak — utamakan `harga_per_hari` (model
 * baru sejak migrasi harga per-porsi → per-hari, dikonfirmasi Firdaus);
 * fallback ke `harga_per_porsi × porsi_per_hari` untuk kontrak lama yang
 * belum diisi ulang. Satu sumber kebenaran — semua konsumer (rekap, cetak
 * Form-01/04, portal Penyedia, Laporan Resmi) pakai helper ini/field
 * `harga_per_hari_efektif` turunannya, tidak menghitung ulang sendiri.
 */
function _hargaPerHariKontrak_(kontrak) {
  var hariRp = _int_(kontrak.harga_per_hari || 0, 'harga_per_hari');
  if (hariRp > 0) return hariRp;
  var harga = _int_(kontrak.harga_per_porsi || 0, 'harga_per_porsi');
  var porsi = _int_(kontrak.porsi_per_hari || 0, 'porsi_per_hari');
  return harga * porsi;
}

// ── Penyedia ────────────────────────────────────────────────────────────────

/** Daftar penyedia. */
function penyediaList(payload, session) {
  return { penyedia: sheetRead(SHEETS.PENYEDIA) };
}

/** Tambah/ubah penyedia. Baru → penyedia_id PNY-000001. */
function penyediaUpsert(payload, session) {
  var nama = String((payload && payload.nama) || '').trim();
  if (!nama) throw _fail_('nama penyedia wajib diisi.');
  var status = (payload && payload.status) ? String(payload.status) : 'AKTIF';
  if (ENUM.AKTIF_STATUS.indexOf(status) < 0) throw _fail_('status tidak valid.');
  var npwp = _mask4_(payload.npwp_mask, 'npwp_mask');
  var obj = {
    nama: nama,
    kontak: String((payload && payload.kontak) || ''),
    alamat: String((payload && payload.alamat) || ''),
    npwp_mask: npwp,
    status: status
  };

  var id = payload && payload.penyedia_id;
  if (id) {
    var lama = sheetRead(SHEETS.PENYEDIA, function (r) { return String(r.penyedia_id) === String(id); })[0];
    if (!lama) throw _fail_('Penyedia tidak ditemukan: ' + id);
    sheetUpdate(SHEETS.PENYEDIA, 'penyedia_id', id, obj);
    auditLog(session, 'penyedia.upsert', 'PENYEDIA', id, lama, obj);
    obj.penyedia_id = id;
    return { penyedia: obj };
  }
  obj.penyedia_id = nextId('PNY');
  sheetAppend(SHEETS.PENYEDIA, obj);
  auditLog(session, 'penyedia.upsert', 'PENYEDIA', obj.penyedia_id, null, obj);
  return { penyedia: obj };
}

// ── Kontrak ─────────────────────────────────────────────────────────────────

/** Sisipkan harga_per_hari_efektif (lihat _hargaPerHariKontrak_) ke baris kontrak. */
function _kontrakDenganTarifEfektif_(k) {
  return Object.assign({}, k, { harga_per_hari_efektif: _hargaPerHariKontrak_(k) });
}

/** Daftar kontrak. */
function kontrakList(payload, session) {
  return { kontrak: sheetRead(SHEETS.KONTRAK).map(_kontrakDenganTarifEfektif_) };
}

/** Detail kontrak + lampiran (menu & nilai gizi, BA penunjukan, notulen). */
function kontrakGet(payload, session) {
  var id = String((payload && payload.kontrak_id) || '').trim();
  var k = sheetRead(SHEETS.KONTRAK, function (r) { return String(r.kontrak_id) === id; })[0];
  if (!k) throw _fail_('Kontrak tidak ditemukan: ' + id);
  return { kontrak: _kontrakDenganTarifEfektif_(k), lampiran: lampiranList('KONTRAK', id) };
}

/** Tambah/ubah kontrak (hanya selama DRAFT). Baru → KTR-000001, status DRAFT. */
function kontrakUpsert(payload, session) {
  var pid = String((payload && payload.penyedia_id) || '').trim();
  if (!pid) throw _fail_('penyedia_id wajib diisi.');
  var penyedia = sheetRead(SHEETS.PENYEDIA, function (r) { return String(r.penyedia_id) === pid; })[0];
  if (!penyedia) throw _fail_('Penyedia tidak ditemukan: ' + pid);

  var obj = {
    penyedia_id: pid,
    // harga_per_hari = tarif utama (rupiah/taruna/hari) sejak migrasi harga per-porsi
    // → per-hari. harga_per_porsi sudah OPSIONAL (legacy/fallback, lihat
    // _hargaPerHariKontrak_) — form Tambah/Ubah Kontrak tidak lagi memintanya, tapi
    // TETAP dikirim (pass-through nilai lama) supaya kontrak lama yang masih
    // mengandalkan fallback tidak tertimpa jadi 0 (sheetUpdate = patch per-kolom).
    harga_per_hari: _int_(payload.harga_per_hari, 'harga_per_hari'),
    harga_per_porsi: _int_(payload.harga_per_porsi || 0, 'harga_per_porsi'),
    porsi_per_hari: _int_(payload.porsi_per_hari, 'porsi_per_hari'),
    tgl_mulai: _wajibTgl_(payload.tgl_mulai, 'tgl_mulai'),
    tgl_akhir: _wajibTgl_(payload.tgl_akhir, 'tgl_akhir'),
    // Data dokumen kontrak riil (semua opsional). Rekening penyedia = nomor PENUH
    // (payee bisnis, bukan rekening pribadi taruna) → dipakai Form-07/09.
    no_kontrak: String((payload && payload.no_kontrak) || '').trim(),
    tgl_kontrak: (payload && payload.tgl_kontrak) ? _wajibTgl_(payload.tgl_kontrak, 'tgl_kontrak') : '',
    adendum: String((payload && payload.adendum) || '').trim(),
    rek_penyedia_bni: String((payload && payload.rek_penyedia_bni) || '').replace(/\D/g, ''),
    rek_penyedia_bsi: String((payload && payload.rek_penyedia_bsi) || '').replace(/\D/g, '')
  };
  if (obj.tgl_mulai > obj.tgl_akhir) throw _fail_('tgl_mulai tidak boleh setelah tgl_akhir.');

  var id = payload && payload.kontrak_id;
  if (id) {
    var lama = sheetRead(SHEETS.KONTRAK, function (r) { return String(r.kontrak_id) === String(id); })[0];
    if (!lama) throw _fail_('Kontrak tidak ditemukan: ' + id);
    if (lama.status !== 'DRAFT') throw _fail_('Kontrak berstatus ' + lama.status + ' — hanya DRAFT yang boleh diubah.');
    sheetUpdate(SHEETS.KONTRAK, 'kontrak_id', id, obj);
    auditLog(session, 'kontrak.upsert', 'KONTRAK', id, lama, obj);
    obj.kontrak_id = id;
    return { kontrak: obj };
  }
  obj.kontrak_id = nextId('KTR');
  obj.status = 'DRAFT';
  obj.approved_by = '';
  obj.approved_at = '';
  sheetAppend(SHEETS.KONTRAK, obj);
  auditLog(session, 'kontrak.upsert', 'KONTRAK', obj.kontrak_id, null, obj);
  return { kontrak: obj };
}

/** Setujui kontrak: DRAFT → DISETUJUI_PPK (SOP no. 4). */
function kontrakApprove(payload, session) {
  var id = String((payload && payload.kontrak_id) || '').trim();
  if (!id) throw _fail_('kontrak_id wajib diisi.');
  var lama = sheetRead(SHEETS.KONTRAK, function (r) { return String(r.kontrak_id) === id; })[0];
  if (!lama) throw _fail_('Kontrak tidak ditemukan: ' + id);
  if (lama.status !== 'DRAFT') throw _fail_('Kontrak berstatus ' + lama.status + ', tidak bisa disetujui.');
  var patch = { status: 'DISETUJUI_PPK', approved_by: session.user_id, approved_at: new Date() };
  sheetUpdate(SHEETS.KONTRAK, 'kontrak_id', id, patch);
  auditLog(session, 'kontrak.approve', 'KONTRAK', id, { status: lama.status }, { status: 'DISETUJUI_PPK' });
  return { kontrak_id: id, status: 'DISETUJUI_PPK' };
}

/**
 * Unggah lampiran kontrak (menu & nilai gizi, BA penunjukan, notulen rapat).
 * Payload {kontrak_id, berkas:{base64, nama_file, jenis}}. Boleh kapan saja
 * (DRAFT maupun DISETUJUI_PPK) — dokumen pendukung bisa menyusul.
 */
function kontrakLampiranUpload(payload, session) {
  var id = String((payload && payload.kontrak_id) || '').trim();
  var k = sheetRead(SHEETS.KONTRAK, function (r) { return String(r.kontrak_id) === id; })[0];
  if (!k) throw _fail_('Kontrak tidak ditemukan: ' + id);
  var berkas = payload && payload.berkas;
  if (!berkas || !berkas.base64) throw _fail_('Berkas wajib diisi.');
  var jenis = berkas.jenis || 'LAINNYA';
  if (ENUM.LAMPIRAN_JENIS.indexOf(jenis) < 0) throw _fail_('jenis lampiran tidak valid.');
  var hasil = lampiranSave(session, 'KONTRAK', id, jenis, berkas.base64, berkas.nama_file);
  auditLog(session, 'kontrak.lampiran_upload', 'KONTRAK', id, null, { jenis: jenis, lamp_id: hasil.lamp_id });
  return hasil;
}

// ── Menu Kontrak ──────────────────────────────────────────────────────────────
// Menu mingguan terjadwal (referensi hari-dalam-minggu, BUKAN snapshot per
// tanggal). Terpisah dari kolom bebas PESANAN.menu yang diisi Senat per hari.

/** Menu mingguan 1 kontrak, urut Senin→Minggu. */
function menuList(payload, session) {
  var kid = String((payload && payload.kontrak_id) || '').trim();
  if (!kid) throw _fail_('kontrak_id wajib diisi.');
  var rows = sheetRead(SHEETS.MENU_KONTRAK, function (r) { return String(r.kontrak_id) === kid; });
  rows.sort(function (a, b) { return ENUM.HARI.indexOf(a.hari) - ENUM.HARI.indexOf(b.hari); });
  return { menu: rows };
}

/**
 * "Menu Hari Ini" (Ownership Taruna Fitur 2a) — Pagi/Siang/Malam tanggal
 * tertentu (default hari ini) dari MENU_KONTRAK kontrak aktif, standar gizi
 * (getKebijakanGizi), dan status verifikasi piket REALISASI tanggal itu bila
 * sudah ada. READ-ONLY murni, NOL data sensitif (tanpa rupiah/rekening/
 * daftar per-taruna) — cocok ditayangkan di papan ruang makan bersama.
 *
 * Komposisi antaran SAMA PERSIS dengan pesananCreate/pesananSuratPenyedia:
 * satu PESANAN.tgl_makan=D mengantar Malam(D) + Pagi/Siang(D+1). Jadi utk
 * TANGGAL T: Malam(T) dari baris MENU_KONTRAK hari=dayOfWeek(T); Pagi/Siang(T)
 * dari baris MENU_KONTRAK hari=dayOfWeek(T-1) (antaran "kemarin", D+1-nya
 * adalah T). Tanpa kontrak aktif → menu kosong (`ada_kontrak:false`), TIDAK error
 * (papan tetap tampil, cuma menu belum ada).
 */
function menuHariIni(payload, session) {
  var tanggal = (payload && payload.tanggal) ? _wajibTgl_(payload.tanggal, 'tanggal') : _todayStr_();

  var kontrak = null;
  try { kontrak = _kontrakAktifPada_(tanggal); } catch (e) { kontrak = null; }

  var menu = { pagi: '', siang: '', malam: '' };
  if (kontrak) {
    var menuRows = sheetRead(SHEETS.MENU_KONTRAK, function (r) { return String(r.kontrak_id) === String(kontrak.kontrak_id); });
    var hariIni = _hariDalamMinggu_(tanggal);
    var hariKemarin = _hariDalamMinggu_(_tambahHari_(tanggal, -1));
    var rowMalam = menuRows.filter(function (r) { return r.hari === hariIni; })[0];
    var rowPagiSiang = menuRows.filter(function (r) { return r.hari === hariKemarin; })[0];
    menu.malam = rowMalam ? String(rowMalam.menu_malam || '') : '';
    menu.pagi = rowPagiSiang ? String(rowPagiSiang.menu_pagi || '') : '';
    menu.siang = rowPagiSiang ? String(rowPagiSiang.menu_siang || '') : '';
  }

  // Status piket tanggal ini bila SUDAH ADA (ambil realisasi ber-piket_at
  // terbaru — satu tanggal bisa >1 realisasi kalau >1 pesanan hari itu).
  var terverifikasi = sheetRead(SHEETS.REALISASI, function (r) {
    return _tglStr_(r.tanggal) === tanggal && r.piket_nit;
  }).sort(function (a, b) { return new Date(b.piket_at) - new Date(a.piket_at); })[0];

  var piket = terverifikasi ? {
    menu_sesuai: Boolean(terverifikasi.piket_menu_sesuai),
    porsi_cukup: Boolean(terverifikasi.piket_porsi_cukup),
    kualitas: String(terverifikasi.piket_kualitas || ''),
    gizi: String(terverifikasi.piket_gizi || '').split(',').filter(function (g) { return g; })
  } : null;

  return {
    tanggal: tanggal, ada_kontrak: Boolean(kontrak),
    menu: menu, standar_gizi: getKebijakanGizi().komponen, piket: piket
  };
}

/** Tambah/ubah menu 1 hari untuk kontrak (PPK). Kunci gabungan: kontrak_id + hari. */
function menuUpsert(payload, session) {
  var kid = String((payload && payload.kontrak_id) || '').trim();
  if (!kid) throw _fail_('kontrak_id wajib diisi.');
  var k = sheetRead(SHEETS.KONTRAK, function (r) { return String(r.kontrak_id) === kid; })[0];
  if (!k) throw _fail_('Kontrak tidak ditemukan: ' + kid);

  var hari = String((payload && payload.hari) || '').trim().toUpperCase();
  if (ENUM.HARI.indexOf(hari) < 0) throw _fail_('hari tidak valid: ' + hari);

  var obj = {
    kontrak_id: kid,
    hari: hari,
    menu_pagi: String((payload && payload.menu_pagi) || '').trim(),
    menu_siang: String((payload && payload.menu_siang) || '').trim(),
    menu_malam: String((payload && payload.menu_malam) || '').trim()
  };

  var lama = sheetRead(SHEETS.MENU_KONTRAK, function (r) {
    return String(r.kontrak_id) === kid && String(r.hari) === hari;
  })[0];

  if (lama) {
    sheetUpdate(SHEETS.MENU_KONTRAK, 'menu_id', lama.menu_id, obj);
    auditLog(session, 'menu.upsert', 'MENU_KONTRAK', lama.menu_id, lama, obj);
    obj.menu_id = lama.menu_id;
    return { menu: obj };
  }
  obj.menu_id = nextId('MNU');
  sheetAppend(SHEETS.MENU_KONTRAK, obj);
  auditLog(session, 'menu.upsert', 'MENU_KONTRAK', obj.menu_id, null, obj);
  return { menu: obj };
}

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 10_taruna.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
/**
 * 10_taruna.gs — Master data taruna
 *
 * ACTION: taruna.list (semua login), taruna.upsert (Admin)
 *
 * rek_mask HANYA 4 digit terakhir (••••1234) — nomor rekening lengkap
 * DILARANG masuk sistem (validasi _mask4_ menolak >4 digit angka).
 * Setiap aksi tulis → withLock + auditLog.
 */

/** Daftar taruna, filter opsional {status?, prodi?, tingkat?, kelas?}. */
function tarunaList(payload, session) {
  var f = payload || {};
  var rows = sheetRead(SHEETS.TARUNA, function (r) {
    if (f.status && String(r.status) !== String(f.status)) return false;
    if (f.prodi && String(r.prodi) !== String(f.prodi)) return false;
    if (f.tingkat && String(r.tingkat) !== String(f.tingkat)) return false;
    if (f.kelas && String(r.kelas) !== String(f.kelas)) return false;
    return true;
  });
  return { taruna: rows };
}

/** Tambah/ubah taruna (kunci: nit). */
function tarunaUpsert(payload, session) {
  var nit = String((payload && payload.nit) || '').trim();
  if (!nit) throw _fail_('nit wajib diisi.');
  var nama = String((payload && payload.nama) || '').trim();
  if (!nama) throw _fail_('nama wajib diisi.');
  var bank = String((payload && payload.bank) || '').trim();
  if (ENUM.BANK.indexOf(bank) < 0) throw _fail_('bank harus salah satu: ' + ENUM.BANK.join(' / '));
  var status = (payload && payload.status) ? String(payload.status) : 'AKTIF';
  if (ENUM.AKTIF_STATUS.indexOf(status) < 0) throw _fail_('status tidak valid.');

  var obj = {
    nama: nama,
    prodi: String((payload && payload.prodi) || ''),
    tingkat: String((payload && payload.tingkat) || ''),
    kelas: String((payload && payload.kelas) || ''),
    bank: bank,
    rek_mask: _mask4_(payload.rek_mask, 'rek_mask'),
    status: status
  };

  var lama = sheetRead(SHEETS.TARUNA, function (r) { return String(r.nit) === nit; })[0];
  if (lama) {
    sheetUpdate(SHEETS.TARUNA, 'nit', nit, obj);
    auditLog(session, 'taruna.upsert', 'TARUNA', nit, lama, obj);
  } else {
    obj.nit = nit;
    sheetAppend(SHEETS.TARUNA, obj);
    auditLog(session, 'taruna.upsert', 'TARUNA', nit, null, obj);
  }
  obj.nit = nit;
  return { taruna: obj };
}

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 11_status_harian.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
/**
 * 11_status_harian.gs — Status harian taruna yang TIDAK berhak makan di kampus
 * (SOP: Peringatan no. 2). Enum: PESIAR / CUTI / SAKIT_RUMAH / PENUNDAAN_STUDI /
 * TANPA_KETERANGAN / KEGIATAN_LUAR_KAMPUS / PKL_1 / PKL_2 / PKL_3 / KPA /
 * MAGANG / PTB. Yang tergolong kegiatan luar kampus (dapat bantuan makan luar
 * kampus) ada di STATUS_LUAR_KAMPUS (00_config.gs) — dipakai Form-08.
 * TANPA_KETERANGAN (absen tanpa alasan resmi) TIDAK termasuk STATUS_LUAR_KAMPUS
 * — tidak berhak bantuan apa pun, sama seperti Pesiar/Cuti/Sakit/Penundaan
 * Studi. Tanpa mekanisme peringatan/eskalasi otomatis (dikonfirmasi Firdaus,
 * berbeda dari SURAT_PERINGATAN §7 yang murni soal tagihan) — begitu taruna
 * masuk kembali, cukup berhenti input status ini, tanpa aksi tambahan.
 *
 * ACTION: status.set (Admin, Pembina), status.batch (Admin, Pembina),
 *         status.list (semua login)
 *
 * Unik per (tanggal, nit) — upsert. Surat pendukung → LAMPIRAN ref_type=STATUS_HARIAN.
 * Setiap aksi tulis → withLock + auditLog.
 *
 * `tgl_akhir` (opsional, status.set/status.batch) → isi rentang tanggal
 * sekaligus (satu baris STATUS_HARIAN per hari, lihat _daftarTanggal_ di
 * 05_master.gs) — mis. cuti 2 minggu tidak perlu diinput per hari.
 */

/** Upsert internal satu (tanggal, nit). Kembalikan {status_id, aksi:'BARU'|'UBAH'}. */
function _statusUpsert_(session, tanggal, nit, status) {
  if (ENUM.STATUS_HARIAN.indexOf(status) < 0) {
    throw _fail_('status harus salah satu: ' + ENUM.STATUS_HARIAN.join(' / '));
  }
  var taruna = sheetRead(SHEETS.TARUNA, function (r) { return String(r.nit) === String(nit); })[0];
  if (!taruna) throw _fail_('Taruna tidak ditemukan: ' + nit);

  var ada = sheetRead(SHEETS.STATUS_HARIAN, function (r) {
    return _tglStr_(r.tanggal) === tanggal && String(r.nit) === String(nit);
  })[0];

  if (ada) {
    sheetUpdate(SHEETS.STATUS_HARIAN, 'status_id', ada.status_id,
      { status: status, input_by: session.user_id, timestamp: new Date() });
    auditLog(session, 'status.set', 'STATUS_HARIAN', ada.status_id,
      { status: ada.status }, { status: status, tanggal: tanggal, nit: nit });
    return { status_id: ada.status_id, aksi: 'UBAH' };
  }
  var id = nextId('STH');
  sheetAppend(SHEETS.STATUS_HARIAN, {
    status_id: id, tanggal: tanggal, nit: nit, status: status,
    input_by: session.user_id, timestamp: new Date()
  });
  auditLog(session, 'status.set', 'STATUS_HARIAN', id, null,
    { status: status, tanggal: tanggal, nit: nit });
  return { status_id: id, aksi: 'BARU' };
}

/**
 * Set status satu taruna. Payload {tanggal, nit, status, berkas?, tgl_akhir?}.
 * `tgl_akhir` opsional → isi rentang tanggal, satu baris STATUS_HARIAN per hari
 * (mis. cuti 2 minggu sekali input, bukan per hari).
 */
function statusSet(payload, session) {
  var tanggal = _wajibTgl_(payload && payload.tanggal, 'tanggal');
  var nit = String((payload && payload.nit) || '').trim();
  if (!nit) throw _fail_('nit wajib diisi.');
  var status = String((payload && payload.status) || '');
  var daftarTgl = (payload && payload.tgl_akhir)
    ? _daftarTanggal_(tanggal, _wajibTgl_(payload.tgl_akhir, 'tgl_akhir'))
    : [tanggal];

  var hasil = daftarTgl.map(function (t) { return _statusUpsert_(session, t, nit, status); });

  // Surat pendukung opsional: berkas {base64, nama_file, jenis?} → tautkan ke entri pertama
  if (payload.berkas && payload.berkas.base64) {
    lampiranSave(session, 'STATUS_HARIAN', hasil[0].status_id,
      payload.berkas.jenis || 'SURAT', payload.berkas.base64, payload.berkas.nama_file);
  }
  return hasil.length === 1 ? hasil[0] : { jml: hasil.length };
}

/** Input massal: {tanggal, status, nit: [], berkas?, tgl_akhir?}. Mis. satu kelas pesiar (atau rentang tanggal). */
function statusBatch(payload, session) {
  var tanggal = _wajibTgl_(payload && payload.tanggal, 'tanggal');
  var daftar = (payload && payload.nit) || [];
  if (!daftar.length) throw _fail_('nit harus berupa daftar minimal 1 taruna.');
  var status = String((payload && payload.status) || '');
  var daftarTgl = (payload && payload.tgl_akhir)
    ? _daftarTanggal_(tanggal, _wajibTgl_(payload.tgl_akhir, 'tgl_akhir'))
    : [tanggal];

  var hasil = [];
  daftar.forEach(function (nit) {
    daftarTgl.forEach(function (t) {
      hasil.push(_statusUpsert_(session, t, String(nit).trim(), status));
    });
  });
  if (payload.berkas && payload.berkas.base64 && hasil.length) {
    // Satu surat pendukung untuk batch → tautkan ke entri pertama
    lampiranSave(session, 'STATUS_HARIAN', hasil[0].status_id,
      payload.berkas.jenis || 'SURAT', payload.berkas.base64, payload.berkas.nama_file);
  }
  return { jml: hasil.length };
}

/** Daftar status per rentang tanggal: {dari, sampai, nit?}. */
function statusList(payload, session) {
  var dari = _wajibTgl_(payload && payload.dari, 'dari');
  var sampai = _wajibTgl_(payload && payload.sampai, 'sampai');
  var nit = payload && payload.nit;
  var rows = sheetRead(SHEETS.STATUS_HARIAN, function (r) {
    var t = _tglStr_(r.tanggal);
    if (t < dari || t > sampai) return false;
    if (nit && String(r.nit) !== String(nit)) return false;
    return true;
  });
  rows.forEach(function (r) { r.tanggal = _tglStr_(r.tanggal); });
  return { status: rows };
}

/**
 * Batalkan sisa hari status taruna sejak tanggal tertentu (default hari ini)
 * — dipakai saat taruna KEMBALI LEBIH CEPAT dari `tgl_akhir` yang sudah
 * diinput. `status.set`/`status.batch` menulis satu baris STATUS_HARIAN per
 * hari di muka; tanpa aksi ini, sisa hari ke depan tetap tercatat "di luar"
 * di rekap/dashboard walau taruna sudah kembali. Hanya menghapus baris ke
 * DEPAN (>= tanggal_kembali) — riwayat yang sudah lewat TIDAK diubah.
 * Payload {nit, tanggal_kembali?}.
 */
function statusTandaiKembali(payload, session) {
  var nit = String((payload && payload.nit) || '').trim();
  if (!nit) throw _fail_('nit wajib diisi.');
  var tanggalKembali = (payload && payload.tanggal_kembali)
    ? _wajibTgl_(payload.tanggal_kembali, 'tanggal_kembali') : _todayStr_();
  if (tanggalKembali < _todayStr_()) {
    throw _fail_('tanggal_kembali tidak boleh sebelum hari ini (riwayat tidak diubah).');
  }

  var target = sheetRead(SHEETS.STATUS_HARIAN, function (r) {
    return String(r.nit) === nit && _tglStr_(r.tanggal) >= tanggalKembali;
  });
  if (!target.length) return { jml_dibatalkan: 0 };

  var dihapus = sheetDeleteRows(SHEETS.STATUS_HARIAN, 'status_id', target.map(function (r) { return r.status_id; }));
  auditLog(session, 'status.tandai_kembali', 'STATUS_HARIAN', nit,
    { baris: dihapus.map(function (r) { return { tanggal: _tglStr_(r.tanggal), status: r.status }; }) },
    { tanggal_kembali: tanggalKembali });
  return { jml_dibatalkan: dihapus.length };
}

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 12_pesanan.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
/**
 * 12_pesanan.gs — Pesanan makan Pre-Order H-1 (SOP no. 5–7)
 * Mesin status: DRAFT → DIAJUKAN → (DIKEMBALIKAN | DISETUJUI) → TERKIRIM
 *
 * Catatan koreksi: PPK TIDAK menyetujui pesanan harian — PPK menyetujui
 * REKAP_BULANAN (lihat 14_rekap.gs). Pembina adalah satu-satunya verifikator
 * pesanan sebelum dikirim ke penyedia.
 *
 * ACTION: pesanan.list, pesanan.get (semua login),
 *         pesanan.create/submit/kirim/revisi (Senat),
 *         pesanan.verify/return (Pembina)
 *
 * jml_taruna = SNAPSHOT (taruna AKTIF − STATUS_HARIAN tgl tsb); koreksi manual
 * wajib catatan. Transisi ilegal → error eksplisit.
 * Setiap aksi tulis → withLock + auditLog.
 */

/** Ambil pesanan by id atau error. */
function _pesanan_(id) {
  var p = sheetRead(SHEETS.PESANAN, function (r) { return String(r.pesanan_id) === String(id); })[0];
  if (!p) throw _fail_('Pesanan tidak ditemukan: ' + id);
  return p;
}

/** Hitung otomatis jml_taruna utk tanggal: taruna AKTIF − yang berstatus harian. */
function _hitungJmlTaruna_(tanggal) {
  var aktif = {};
  sheetRead(SHEETS.TARUNA, function (r) { return r.status === 'AKTIF'; })
    .forEach(function (r) { aktif[String(r.nit)] = true; });
  var tidakMakan = {};
  sheetRead(SHEETS.STATUS_HARIAN, function (r) { return _tglStr_(r.tanggal) === tanggal; })
    .forEach(function (r) { if (aktif[String(r.nit)]) tidakMakan[String(r.nit)] = true; });
  return Object.keys(aktif).length - Object.keys(tidakMakan).length;
}

/**
 * _pesananAnomali_(p) — Fitur "Verifikasi by-Exception" (1a): bandingkan
 * pesanan `p` dgn most-recent prior PESANAN non-DIKEMBALIKAN (tgl_makan lebih
 * awal) utk menentukan RUTIN vs ANOMALI. Anomali bila SALAH SATU:
 *  - |jml_taruna - jml_kemarin| > ambangSelisih (kebijakan; default 0);
 *  - catatan terisi (jml_taruna di-override manual dari angka otomatis);
 *  - STATUS_HARIAN tgl itu berubah sejak snapshot (recompute _hitungJmlTaruna_
 *    sekarang ≠ p.jml_taruna, TANPA catatan yg menjelaskan bedanya).
 * Tanpa pesanan pembanding sama sekali (pertama kali) → dianggap ANOMALI
 * (butuh mata Pembina, bukan diloloskan diam-diam krn tak ada dasar bandingan).
 * Murni baca — tidak mengubah data, aman dipanggil berkali-kali.
 */
function _pesananAnomali_(p) {
  var tgl = _tglStr_(p.tgl_makan);
  var jml = _int_(p.jml_taruna, 'jml_taruna');
  var catatan = String(p.catatan || '').trim();
  var kebijakan = getKebijakanVerifikasi();

  var prior = sheetRead(SHEETS.PESANAN, function (r) {
    return String(r.pesanan_id) !== String(p.pesanan_id) && r.status !== 'DIKEMBALIKAN' && _tglStr_(r.tgl_makan) < tgl;
  }).sort(function (a, b) { return _tglStr_(b.tgl_makan).localeCompare(_tglStr_(a.tgl_makan)); })[0];
  var jmlKemarin = prior ? _int_(prior.jml_taruna, 'jml_taruna') : null;
  var selisih = (jmlKemarin === null) ? null : (jml - jmlKemarin);

  var jmlAutoSaatIni = _hitungJmlTaruna_(tgl);
  var statusBerubah = !catatan && jmlAutoSaatIni !== jml;

  var alasan = [];
  var label;
  if (jmlKemarin === null) {
    alasan.push('Tidak ada pesanan sebelumnya untuk dibandingkan');
    label = 'TIDAK ADA PEMBANDING';
  } else if (selisih === 0) {
    label = 'SAMA';
  } else {
    label = (selisih > 0 ? 'NAIK +' : 'TURUN -') + Math.abs(selisih);
    if (Math.abs(selisih) > kebijakan.ambangSelisih) {
      alasan.push(label + ' dari kemarin (' + jmlKemarin + ')');
    }
  }
  if (catatan) {
    alasan.push('Override manual: ' + catatan);
    label = 'OVERRIDE MANUAL';
  }
  if (statusBerubah) {
    alasan.push('STATUS_HARIAN berubah sejak snapshot (hitung ulang=' + jmlAutoSaatIni + ', tercatat=' + jml + ')');
    label = 'STATUS BERUBAH';
  }

  return {
    anomali: jmlKemarin === null || alasan.length > 0,
    label: label,
    jml_kemarin: jmlKemarin,
    selisih: selisih,
    jml_auto_saat_ini: jmlAutoSaatIni,
    alasan: alasan.join('; ')
  };
}

/** Daftar pesanan, filter {bulan?}. */
function pesananList(payload, session) {
  var bulan = payload && payload.bulan;
  var rows = sheetRead(SHEETS.PESANAN, function (r) {
    return !bulan || _bulanStr_(r.tgl_makan) === bulan;
  });
  rows.forEach(function (r) { r.tgl_makan = _tglStr_(r.tgl_makan); });
  return { pesanan: rows };
}

/**
 * Antrian verifikasi Pembina + info anomali per pesanan (1d). Hanya baris
 * DIAJUKAN. Bila `autoLolosRutin` aktif, antrian ini SECARA ALAMI hanya
 * berisi pesanan ANOMALI (yang rutin sudah auto-lolos di pesanan.submit) —
 * bila nonaktif, berisi SEMUA (rutin+anomali) dengan label masing-masing,
 * dipakai UI utk menampilkan delta vs kemarin & tombol "Setujui semua yang
 * rutin" (pesanan.bulk_approve_rutin).
 */
function pesananAntrianVerifikasi(payload, session) {
  var kebijakan = getKebijakanVerifikasi();
  var diajukan = sheetRead(SHEETS.PESANAN, function (r) { return r.status === 'DIAJUKAN'; });
  var antrian = diajukan.map(function (p) {
    var a = _pesananAnomali_(p);
    var salin = {};
    Object.keys(p).forEach(function (k) { salin[k] = p[k]; });
    salin.tgl_makan = _tglStr_(p.tgl_makan);
    salin.anomali = a.anomali;
    salin.label = a.label;
    salin.alasan = a.alasan;
    salin.jml_kemarin = a.jml_kemarin;
    salin.selisih = a.selisih;
    return salin;
  }).sort(function (x, y) { return String(x.tgl_makan).localeCompare(String(y.tgl_makan)); });
  return { kebijakan: { autoLolosRutin: !!kebijakan.autoLolosRutin }, antrian: antrian };
}

/** Detail pesanan + lampiran. */
function pesananGet(payload, session) {
  var p = _pesanan_(payload && payload.pesanan_id);
  p.tgl_makan = _tglStr_(p.tgl_makan);
  return { pesanan: p, lampiran: lampiranList('PESANAN', p.pesanan_id) };
}

/**
 * pesanan.surat_penyedia {pesanan_id | tgl_makan} — bahan cetak "Surat Pesanan
 * Makan" untuk PENYEDIA/katering, READ-ONLY, TANPA rupiah apa pun (beda dari
 * Form-01 yang untuk internal & memuat harga — lihat catatan modul cetak).
 *
 * Komposisi pengantaran & rakitan menu SAMA PERSIS dengan logika frontend saat
 * pesanan.create (komposisiPesanan, pesanan-buat.tsx): Malam hari-D + Pagi &
 * Siang hari D+1, dari MENU_KONTRAK kontrak_id pesanan itu.
 *
 * Jumlah porsi per kelompok DITURUNKAN ulang dari TARUNA(AKTIF) − STATUS_HARIAN
 * tanggal itu (subset sama seperti _hitungJmlTaruna_) — TAPI angka yang
 * MENGIKAT tetap `PESANAN.jml_taruna` (snapshot 📸, bisa dikoreksi manual PPK/
 * Senat dgn catatan). Bila derivasi ≠ snapshot, `selisih_derivasi` diisi
 * (BUKAN didiamkan) supaya penyedia & pencetak sama-sama tahu ada koreksi
 * manual, tapi baris TOTAL yang dicetak tetap angka mengikat.
 */
function pesananSuratPenyedia(payload, session) {
  var p = (payload && payload.pesanan_id)
    ? _pesanan_(payload.pesanan_id)
    : sheetRead(SHEETS.PESANAN, function (r) {
        return _tglStr_(r.tgl_makan) === _wajibTgl_(payload && payload.tgl_makan, 'tgl_makan');
      })[0];
  if (!p) throw _fail_('Pesanan tidak ditemukan.');
  var tgl = _tglStr_(p.tgl_makan);

  var hariMalam = _hariDalamMinggu_(tgl);
  var hariPagiSiang = _hariDalamMinggu_(_tambahHari_(tgl, 1));
  var menuHari = sheetRead(SHEETS.MENU_KONTRAK, function (r) { return String(r.kontrak_id) === String(p.kontrak_id); });
  var menuMalamRow = menuHari.filter(function (r) { return r.hari === hariMalam; })[0];
  var menuPagiSiangRow = menuHari.filter(function (r) { return r.hari === hariPagiSiang; })[0];

  var tidakMakan = {};
  sheetRead(SHEETS.STATUS_HARIAN, function (r) { return _tglStr_(r.tanggal) === tgl; })
    .forEach(function (r) { tidakMakan[String(r.nit)] = true; });

  var kelompok = {};
  sheetRead(SHEETS.TARUNA, function (r) { return r.status === 'AKTIF' && !tidakMakan[String(r.nit)]; })
    .forEach(function (t) {
      var kunci = (t.prodi || '') + '|' + (t.tingkat || '');
      if (!kelompok[kunci]) kelompok[kunci] = { prodi: t.prodi || '', tingkat: t.tingkat || '', jml: 0 };
      kelompok[kunci].jml++;
    });
  var porsiPerKelompok = Object.keys(kelompok).map(function (k) { return kelompok[k]; })
    .sort(function (a, b) { return a.prodi.localeCompare(b.prodi) || a.tingkat.localeCompare(b.tingkat); });
  var totalDerivasi = porsiPerKelompok.reduce(function (s, k) { return s + k.jml; }, 0);
  var totalMengikat = _int_(p.jml_taruna, 'jml_taruna');

  return {
    pesanan_id: p.pesanan_id, tgl_makan: tgl,
    komposisi: {
      malam: { hari: hariMalam }, pagi: { hari: hariPagiSiang }, siang: { hari: hariPagiSiang }
    },
    menu: {
      malam: menuMalamRow ? String(menuMalamRow.menu_malam || '') : '',
      pagi: menuPagiSiangRow ? String(menuPagiSiangRow.menu_pagi || '') : '',
      siang: menuPagiSiangRow ? String(menuPagiSiangRow.menu_siang || '') : ''
    },
    porsi_per_kelompok: porsiPerKelompok,
    total: totalMengikat,
    total_derivasi: totalDerivasi,
    selisih_derivasi: totalMengikat - totalDerivasi,
    catatan: String(p.catatan || '')
  };
}

/** Buat pesanan DRAFT. Payload {tgl_makan, menu, jml_taruna?, catatan?}. */
function pesananCreate(payload, session) {
  var tgl = _wajibTgl_(payload && payload.tgl_makan, 'tgl_makan');
  var menu = String((payload && payload.menu) || '').trim();
  if (!menu) throw _fail_('menu wajib diisi.');

  // Satu pesanan per hari (DIKEMBALIKAN tidak menghalangi buat ulang)
  var dobel = sheetRead(SHEETS.PESANAN, function (r) {
    return _tglStr_(r.tgl_makan) === tgl && r.status !== 'DIKEMBALIKAN';
  })[0];
  if (dobel) throw _fail_('Sudah ada pesanan untuk ' + tgl + ' (' + dobel.pesanan_id + ', status ' + dobel.status + ').');

  var kontrak = _kontrakAktifPada_(tgl);
  var jmlAuto = _hitungJmlTaruna_(tgl);
  var jml = jmlAuto;
  var catatan = String((payload && payload.catatan) || '').trim();
  if (payload.jml_taruna !== undefined && payload.jml_taruna !== null && payload.jml_taruna !== '') {
    jml = _int_(payload.jml_taruna, 'jml_taruna');
    if (jml !== jmlAuto && !catatan) {
      throw _fail_('jml_taruna (' + jml + ') berbeda dari hitungan otomatis (' + jmlAuto + ') — catatan wajib diisi.');
    }
  }

  var obj = {
    pesanan_id: nextId('PSN'),
    tgl_makan: tgl,
    kontrak_id: kontrak.kontrak_id,
    jml_taruna: jml,             // SNAPSHOT — momen penulisan tercatat di AUDIT_LOG
    menu: menu,
    catatan: catatan,
    status: 'DRAFT',
    created_by: session.user_id,
    verif_by: '', verif_at: '', revisi_dari: ''
  };
  sheetAppend(SHEETS.PESANAN, obj);
  auditLog(session, 'pesanan.create', 'PESANAN', obj.pesanan_id, null,
    { tgl_makan: tgl, jml_taruna: jml, jml_otomatis: jmlAuto, kontrak_id: kontrak.kontrak_id });
  return { pesanan: obj, jml_otomatis: jmlAuto };
}

/**
 * pesanan.pembina_kirim {tgl_makan, menu, jml_taruna?} — Pembina membuat &
 * langsung mengajukan pesanan TANPA usulan Senat (dikonfirmasi Firdaus:
 * dipakai kalau Senat belum/tidak membuat pesanan). BEDA dari alur normal
 * (create→submit→verify→kirim, 4 langkah lintas 2 peran) — di sini SATU
 * langkah: created_by = verif_by = Pembina yang sama (maker-checker melebur,
 * terekam jelas di AUDIT_LOG untuk ditelusuri Itjen), status LANGSUNG
 * TERKIRIM. `catatan` WAJIB memuat frasa tetap di bawah — dipakai frontend
 * (pesanan-list.tsx) untuk menandai/"menotifikasi" Senat baris mana yang
 * dibuat tanpa sepengetahuan mereka (tanpa infrastruktur notifikasi
 * terpisah — aplikasi ini belum punya push/email).
 *
 * Kontrol pengganti (karena verifikasi Pembina-lain dilewati): REALISASI
 * tetap WAJIB ttd Pembina DAN Senat (dua pihak di hilir tidak berubah).
 *
 * Idempoten/precedence: PESANAN unik per tgl_makan. Bila SUDAH ada baris
 * (dari Senat/Pembina/Sistem) berstatus DRAFT/DIAJUKAN → EDIT baris itu
 * (bukan duplikat). Bila sudah DISETUJUI/TERKIRIM (alur normal sudah
 * berjalan) → TOLAK, Pembina tidak perlu/boleh menimpanya.
 */
var _CATATAN_PEMBINA_KIRIM_ = 'Dibuat & diajukan Pembina tanpa usulan Senat';

function pesananPembinaKirim(payload, session) {
  var tgl = _wajibTgl_(payload && payload.tgl_makan, 'tgl_makan');
  var menu = String((payload && payload.menu) || '').trim();
  if (!menu) throw _fail_('menu wajib diisi.');

  var existing = sheetRead(SHEETS.PESANAN, function (r) {
    return _tglStr_(r.tgl_makan) === tgl && r.status !== 'DIKEMBALIKAN';
  })[0];
  if (existing && (existing.status === 'DISETUJUI' || existing.status === 'TERKIRIM')) {
    throw _fail_('Pesanan ' + tgl + ' sudah berstatus ' + existing.status +
      ' (alur normal sudah berjalan) — tidak perlu/boleh dibuat ulang oleh Pembina.');
  }

  var jmlAuto = _hitungJmlTaruna_(tgl);
  var jml = jmlAuto;
  if (payload.jml_taruna !== undefined && payload.jml_taruna !== null && payload.jml_taruna !== '') {
    jml = _int_(payload.jml_taruna, 'jml_taruna');
  }

  if (existing) {
    var patch = {
      menu: menu, jml_taruna: jml, catatan: _CATATAN_PEMBINA_KIRIM_,
      status: 'TERKIRIM', created_by: session.user_id,
      verif_by: session.user_id, verif_at: new Date()
    };
    sheetUpdate(SHEETS.PESANAN, 'pesanan_id', existing.pesanan_id, patch);
    auditLog(session, 'pesanan.pembina_kirim', 'PESANAN', existing.pesanan_id,
      { status: existing.status, created_by: existing.created_by }, patch);
    return { pesanan_id: existing.pesanan_id, status: 'TERKIRIM', jml_otomatis: jmlAuto };
  }

  var kontrak = _kontrakAktifPada_(tgl);
  var obj = {
    pesanan_id: nextId('PSN'),
    tgl_makan: tgl,
    kontrak_id: kontrak.kontrak_id,
    jml_taruna: jml,
    menu: menu,
    catatan: _CATATAN_PEMBINA_KIRIM_,
    status: 'TERKIRIM',
    created_by: session.user_id,
    verif_by: session.user_id, verif_at: new Date(), revisi_dari: ''
  };
  sheetAppend(SHEETS.PESANAN, obj);
  auditLog(session, 'pesanan.pembina_kirim', 'PESANAN', obj.pesanan_id, null,
    { tgl_makan: tgl, jml_taruna: jml, jml_otomatis: jmlAuto, kontrak_id: kontrak.kontrak_id });
  return { pesanan_id: obj.pesanan_id, status: 'TERKIRIM', jml_otomatis: jmlAuto };
}

/** Transisi status generik dengan validasi. */
function _pesananTransisi_(session, id, dariStatus, keStatus, aksi, patchTambahan) {
  var p = _pesanan_(id);
  if (p.status !== dariStatus) {
    throw _fail_('Pesanan berstatus ' + p.status + ', tidak bisa ' + aksi + ' (butuh ' + dariStatus + ').');
  }
  var patch = { status: keStatus };
  if (patchTambahan) for (var k in patchTambahan) patch[k] = patchTambahan[k];
  sheetUpdate(SHEETS.PESANAN, 'pesanan_id', id, patch);
  auditLog(session, 'pesanan.' + aksi, 'PESANAN', id, { status: p.status }, patch);
  return p;
}

/**
 * Catatan tetap (sentinel, pola sama _CATATAN_PEMBINA_KIRIM_) yang menandai
 * pesanan RUTIN diloloskan otomatis — dipakai frontend (pesanan-list.tsx)
 * untuk label kartu, sama seperti Fitur F. TIDAK menimpa catatan override
 * manual manapun (kalau catatan sudah terisi, _pesananAnomali_ SELALU
 * menganggapnya ANOMALI, jadi jalur auto-lolos tak pernah tercapai —
 * catatan di sini dijamin kosong sebelum ditimpa).
 */
var _CATATAN_AUTO_LOLOS_ = 'Auto-lolos: rutin (sama dengan kemarin)';

/**
 * DRAFT → DIAJUKAN (hanya pembuat). Fitur "Verifikasi by-Exception" (1c):
 * bila kebijakan `autoLolosRutin` aktif (default) DAN pesanan ini RUTIN
 * (lihat _pesananAnomali_), langsung lanjutkan DIAJUKAN → TERKIRIM otomatis
 * (verif_by='SISTEM') — TIDAK menunggu antrian Pembina. Hanya pesanan
 * ANOMALI yang tetap di DIAJUKAN (masuk antrian verifikasi manual Pembina,
 * tak berubah). Bila `autoLolosRutin` mati, semua pesanan tetap di DIAJUKAN
 * seperti sebelumnya (Pembina bisa memakai pesanan.bulk_approve_rutin utk
 * meloloskan yang rutin secara massal).
 */
function pesananSubmit(payload, session) {
  var p = _pesanan_(payload && payload.pesanan_id);
  if (String(p.created_by) !== String(session.user_id)) {
    throw _fail_('Hanya pembuat pesanan yang boleh mengajukan.');
  }
  _pesananTransisi_(session, p.pesanan_id, 'DRAFT', 'DIAJUKAN', 'submit', null);

  var kebijakan = getKebijakanVerifikasi();
  if (kebijakan.autoLolosRutin) {
    var diajukan = _pesanan_(p.pesanan_id);
    var anomali = _pesananAnomali_(diajukan);
    if (!anomali.anomali) {
      sheetUpdate(SHEETS.PESANAN, 'pesanan_id', p.pesanan_id, {
        status: 'TERKIRIM', verif_by: 'SISTEM', verif_at: new Date(), catatan: _CATATAN_AUTO_LOLOS_
      });
      auditLog(null, 'pesanan.auto_lolos', 'PESANAN', p.pesanan_id,
        { status: 'DIAJUKAN' }, { status: 'TERKIRIM', verif_by: 'SISTEM', label: anomali.label });
      return { pesanan_id: p.pesanan_id, status: 'TERKIRIM', auto_lolos: true, label: anomali.label };
    }
  }
  return { pesanan_id: p.pesanan_id, status: 'DIAJUKAN', auto_lolos: false };
}

/**
 * Bulk-approve (Pembina): setujui SEMUA pesanan DIAJUKAN yang RUTIN
 * sekaligus — satu ketuk. Dipakai saat kebijakan `autoLolosRutin`=false
 * (semua pesanan tetap masuk antrian dulu, Pembina meloloskan yang rutin
 * secara massal alih-alih satu-satu). RUTIN/ANOMALI dihitung ULANG di
 * backend (tak percaya daftar dari klien) — anomali dilewati, tetap di
 * antrian manual. `verif_by` = Pembina yang mengeklik (BUKAN 'SISTEM' —
 * ini aksi manual, walau meloloskan banyak sekaligus).
 */
function pesananBulkApproveRutin(payload, session) {
  var daftarDiajukan = sheetRead(SHEETS.PESANAN, function (r) { return r.status === 'DIAJUKAN'; });
  var hasil = [];
  daftarDiajukan.forEach(function (p) {
    var anomali = _pesananAnomali_(p);
    if (anomali.anomali) return; // anomali → lewati, tetap di antrian manual
    sheetUpdate(SHEETS.PESANAN, 'pesanan_id', p.pesanan_id, {
      status: 'TERKIRIM', verif_by: session.user_id, verif_at: new Date()
    });
    auditLog(session, 'pesanan.bulk_approve_rutin', 'PESANAN', p.pesanan_id,
      { status: 'DIAJUKAN' }, { status: 'TERKIRIM', label: anomali.label });
    hasil.push({ pesanan_id: p.pesanan_id, label: anomali.label });
  });
  return { disetujui: hasil.length, detail: hasil };
}

/** DIAJUKAN → DISETUJUI (Pembina, SOP no. 6). */
function pesananVerify(payload, session) {
  var id = payload && payload.pesanan_id;
  _pesananTransisi_(session, id, 'DIAJUKAN', 'DISETUJUI', 'verify',
    { verif_by: session.user_id, verif_at: new Date() });
  return { pesanan_id: id, status: 'DISETUJUI' };
}

/** DIAJUKAN → DIKEMBALIKAN (Pembina, alasan wajib). */
function pesananReturn(payload, session) {
  var id = payload && payload.pesanan_id;
  var alasan = String((payload && payload.alasan) || '').trim();
  if (!alasan) throw _fail_('alasan pengembalian wajib diisi.');
  var p = _pesanan_(id);
  // Skema tidak punya kolom alasan tersendiri → catat di catatan + AUDIT_LOG
  var catatan = (p.catatan ? p.catatan + ' | ' : '') + 'DIKEMBALIKAN: ' + alasan;
  _pesananTransisi_(session, id, 'DIAJUKAN', 'DIKEMBALIKAN', 'return', { catatan: catatan });
  return { pesanan_id: id, status: 'DIKEMBALIKAN' };
}

/** DISETUJUI → TERKIRIM (Senat), hanya ≤ H-1 dari tgl_makan. */
function pesananKirim(payload, session) {
  var id = payload && payload.pesanan_id;
  var p = _pesanan_(id);
  if (_todayStr_() >= _tglStr_(p.tgl_makan)) {
    throw _fail_('Pengiriman hanya boleh H-1 atau lebih awal dari tgl_makan. ' +
      'Untuk perubahan setelah terkirim gunakan pesanan.revisi dengan BA perubahan.');
  }
  _pesananTransisi_(session, id, 'DISETUJUI', 'TERKIRIM', 'kirim', null);
  return { pesanan_id: id, status: 'TERKIRIM' };
}

/**
 * Revisi setelah TERKIRIM (SOP 7b): buat pesanan BARU ber-revisi_dari.
 * Payload {pesanan_id, menu?, jml_taruna?, catatan, berkas} — berkas BA WAJIB.
 */
function pesananRevisi(payload, session) {
  var asal = _pesanan_(payload && payload.pesanan_id);
  if (asal.status !== 'TERKIRIM') {
    throw _fail_('Revisi hanya untuk pesanan TERKIRIM (status sekarang: ' + asal.status + ').');
  }
  var catatan = String((payload && payload.catatan) || '').trim();
  if (!catatan) throw _fail_('catatan alasan revisi wajib diisi.');
  if (!payload.berkas || !payload.berkas.base64) {
    throw _fail_('Lampiran BA perubahan wajib disertakan (berkas.base64).');
  }

  var jml = (payload.jml_taruna !== undefined && payload.jml_taruna !== null && payload.jml_taruna !== '')
    ? _int_(payload.jml_taruna, 'jml_taruna') : asal.jml_taruna;

  var obj = {
    pesanan_id: nextId('PSN'),
    tgl_makan: _tglStr_(asal.tgl_makan),
    kontrak_id: asal.kontrak_id,
    jml_taruna: jml,
    menu: String((payload && payload.menu) || asal.menu),
    catatan: catatan,
    status: 'TERKIRIM', // revisi menggantikan pesanan terkirim, disahkan BA perubahan
    created_by: session.user_id,
    verif_by: '', verif_at: '',
    revisi_dari: asal.pesanan_id
  };
  sheetAppend(SHEETS.PESANAN, obj);
  lampiranSave(session, 'PESANAN', obj.pesanan_id, 'BA', payload.berkas.base64,
    payload.berkas.nama_file || ('BA-perubahan-' + obj.pesanan_id + '.pdf'));
  auditLog(session, 'pesanan.revisi', 'PESANAN', obj.pesanan_id,
    { revisi_dari: asal.pesanan_id, jml_lama: asal.jml_taruna },
    { jml_taruna: jml, menu: obj.menu });
  return { pesanan: obj };
}

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 13_realisasi.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
/**
 * 13_realisasi.gs — Realisasi penyediaan makan harian (SOP no. 8–9)
 *
 * ACTION: realisasi.list (semua login),
 *         realisasi.create (Pembina, Senat),
 *         realisasi.ttd (Pembina, Senat — konfirmasi PIN),
 *         realisasi.kebijakan_piket (semua login — baca kebijakan piket & standar gizi),
 *         realisasi.penerimaan (Senat, Pembina, Admin — checklist Penerimaan Barang Senat),
 *         realisasi.kebijakan_penerimaan (semua login — baca daftar komponen menu),
 *         realisasi.rekap_penerimaan (PPK, KPA, WADIR3, Senat — baca, rekap kelengkapan)
 *
 * Pesanan wajib TERKIRIM. Foto → LAMPIRAN ref_type=REALISASI jenis=FOTO.
 * Kedua ttd terisi → otomatis rekapUpdate(tanggal).
 * Setiap aksi tulis → withLock + auditLog.
 *
 * Ownership Taruna Fitur 1b (Piket Verifikasi Makan): realisasi.create
 * menerima field piket_* OPSIONAL (lihat _piketKolom_) — MENAMBAH bukti dari
 * sisi taruna piket, TIDAK mengubah ttd Pembina/Senat/foto/geotag di atas.
 * Piket diisi lewat perangkat bersama Pembina/Senat, TANPA akun/login taruna
 * sendiri — NIT divalidasi ke roster TARUNA (dikonfirmasi Firdaus).
 *
 * Penerimaan Barang Senat: realisasi.penerimaan menyimpan checklist
 * kelengkapan+jumlah komponen menu NYATA per waktu makan (kolom `penerimaan`,
 * JSON) — TERPISAH dari checklist piket (beda momen: serah-terima vs makan;
 * beda konsep: item menu vs kategori gizi). Decouple dari realisasi.ttd —
 * bisa diisi kapan saja setelah baris REALISASI ada, tidak menunggu ttd.
 */

/** Ambil realisasi by id atau error. */
function _realisasi_(id) {
  var r = sheetRead(SHEETS.REALISASI, function (x) { return String(x.real_id) === String(id); })[0];
  if (!r) throw _fail_('Realisasi tidak ditemukan: ' + id);
  return r;
}

/**
 * Kebijakan piket + standar gizi efektif — dipakai blok "Verifikasi Piket
 * Taruna" di form realisasi (checklist gizi & status wajib/opsional) dan
 * halaman papan "Menu Hari Ini" (Ownership Taruna Fitur 2, tahap lanjutan).
 */
function realisasiKebijakanPiket(payload, session) {
  return { wajib: getKebijakanPiket().wajib, komponen_gizi: getKebijakanGizi().komponen };
}

/**
 * Standar komponen menu efektif — dipakai blok "Penerimaan Barang" di form
 * realisasi (checklist per waktu makan × komponen, Tahap 4).
 */
function realisasiKebijakanPenerimaan(payload, session) {
  return { komponen: getKebijakanKomponenMenu().komponen };
}

var _WAKTU_MAKAN_ = ['pagi', 'siang', 'malam'];

var _KETERANGAN_PENERIMAAN_MAKS_ = 60;

/**
 * Validasi & normalisasi struktur `penerimaan` → {pagi,siang,malam:
 * [{komponen,ada,jumlah,keterangan}]}. `komponen` WAJIB ada di
 * getKebijakanKomponenMenu() (00_config.gs); `jumlah` bilangan bulat ≥ 0;
 * kunci waktu di luar pagi/siang/malam ditolak (cegah typo diam-diam
 * kehilangan data). `keterangan` OPSIONAL, bebas isi (mis. jenis lauk nyata:
 * "Ikan"/"Ayam"/"Tempe"/"Kerupuk") — dipotong 60 karakter, TIDAK dikunci enum
 * karena variasinya banyak & sengaja fleksibel per hari (dikonfirmasi Firdaus).
 */
function _validasiPenerimaan_(input) {
  if (!input || typeof input !== 'object') throw _fail_('penerimaan wajib berupa objek {pagi, siang, malam}.');
  Object.keys(input).forEach(function (k) {
    if (_WAKTU_MAKAN_.indexOf(k) < 0) throw _fail_('Waktu makan tidak dikenal: ' + k + ' (harus pagi/siang/malam).');
  });

  var komponenValid = getKebijakanKomponenMenu().komponen;
  var hasil = {};
  _WAKTU_MAKAN_.forEach(function (waktu) {
    var baris = Array.isArray(input[waktu]) ? input[waktu] : [];
    hasil[waktu] = baris.map(function (b) {
      var komponen = String((b && b.komponen) || '');
      if (komponenValid.indexOf(komponen) < 0) throw _fail_('Komponen tidak dikenal (' + waktu + '): ' + komponen);
      var jumlah = _int_((b && b.jumlah) || 0, 'jumlah (' + waktu + ' ' + komponen + ')');
      var keterangan = String((b && b.keterangan) || '').trim().slice(0, _KETERANGAN_PENERIMAAN_MAKS_);
      return { komponen: komponen, ada: Boolean(b && b.ada), jumlah: jumlah, keterangan: keterangan };
    });
  });
  return hasil;
}

/**
 * Simpan checklist Penerimaan Barang Senat. Payload {real_id? , pesanan_id?,
 * penerimaan}. Realisasi TERKAIT harus SUDAH ADA (dibuat via realisasi.create)
 * — dicari via real_id bila diberikan, kalau tidak via pesanan_id. TERPISAH
 * dari realisasi.ttd (decouple — boleh diisi Senat kapan saja setelah baris
 * REALISASI ada, sebelum ATAU sesudah ttd, tanpa menunggu jml_taruna_makan
 * "final"). Role SENAT (utama)/PEMBINA/ADMIN.
 */
function realisasiPenerimaan(payload, session) {
  var r;
  if (payload && payload.real_id) {
    r = _realisasi_(payload.real_id);
  } else if (payload && payload.pesanan_id) {
    r = sheetRead(SHEETS.REALISASI, function (x) { return String(x.pesanan_id) === String(payload.pesanan_id); })[0];
    if (!r) throw _fail_('Realisasi untuk pesanan ini belum dibuat — buat realisasi.create dulu.');
  } else {
    throw _fail_('real_id atau pesanan_id wajib diisi.');
  }

  var penerimaan = _validasiPenerimaan_(payload && payload.penerimaan);
  sheetUpdate(SHEETS.REALISASI, 'real_id', r.real_id, { penerimaan: JSON.stringify(penerimaan) });
  auditLog(session, 'realisasi.penerimaan', 'REALISASI', r.real_id, null, { penerimaan: penerimaan });
  return { real_id: r.real_id, penerimaan: penerimaan };
}

/**
 * Rekap kelengkapan Penerimaan Barang (Tahap 5, opsional) — turunan MURNI
 * baca (parse `REALISASI.penerimaan`), TIDAK menulis apa pun. Payload
 * {bulan, penyedia_id?} — penyedia_id menyaring lewat PESANAN.kontrak_id →
 * KONTRAK.penyedia_id. Per komponen: `persen_lengkap` (berapa % realisasi
 * yang mencentang ADA), `kali_tidak_ada`, `total_selisih` (SUM porsi_diterima
 * − jumlah tercatat, hanya saat ADA — indikasi kurang KUANTITAS meski
 * komponennya ada). Bahan evaluasi penyedia (dikonfirmasi Firdaus).
 */
function realisasiRekapPenerimaan(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var penyediaId = payload && payload.penyedia_id ? String(payload.penyedia_id) : '';

  var pesananPenyedia = {};
  if (penyediaId) {
    var kontrakPenyedia = {};
    sheetRead(SHEETS.KONTRAK, function (k) { return String(k.penyedia_id) === penyediaId; })
      .forEach(function (k) { kontrakPenyedia[String(k.kontrak_id)] = true; });
    sheetRead(SHEETS.PESANAN, function (p) { return Boolean(kontrakPenyedia[String(p.kontrak_id)]); })
      .forEach(function (p) { pesananPenyedia[String(p.pesanan_id)] = true; });
  }

  var baris = sheetRead(SHEETS.REALISASI, function (r) {
    if (_bulanStr_(r.tanggal) !== bulan) return false;
    if (penyediaId && !pesananPenyedia[String(r.pesanan_id)]) return false;
    return true;
  });

  var komponenValid = getKebijakanKomponenMenu().komponen;
  var stat = {};
  komponenValid.forEach(function (k) { stat[k] = { kaliAda: 0, kaliCatat: 0, totalJumlah: 0, totalSelisih: 0 }; });

  var totalRealisasi = 0;
  baris.forEach(function (r) {
    if (!r.penerimaan) return;
    var p;
    try { p = JSON.parse(r.penerimaan); } catch (e) { return; }
    var punyaData = _WAKTU_MAKAN_.some(function (w) { return Array.isArray(p[w]) && p[w].length > 0; });
    if (!punyaData) return;
    totalRealisasi++;
    var porsi = Number(r.porsi_diterima) || 0;
    _WAKTU_MAKAN_.forEach(function (w) {
      (Array.isArray(p[w]) ? p[w] : []).forEach(function (b) {
        var s = stat[b.komponen];
        if (!s) return; // komponen lama di luar kebijakan saat ini → lewati
        s.kaliCatat++;
        if (b.ada) {
          s.kaliAda++;
          s.totalJumlah += Number(b.jumlah) || 0;
          s.totalSelisih += Math.max(0, porsi - (Number(b.jumlah) || 0));
        }
      });
    });
  });

  var perKomponen = komponenValid.map(function (k) {
    var s = stat[k];
    return {
      komponen: k, kali_ada: s.kaliAda, kali_tidak_ada: s.kaliCatat - s.kaliAda,
      persen_lengkap: s.kaliCatat > 0 ? Math.round((s.kaliAda / s.kaliCatat) * 100) : 0,
      total_jumlah: s.totalJumlah, total_selisih: s.totalSelisih
    };
  });

  var totalCatat = perKomponen.reduce(function (s, k) { return s + k.kali_ada + k.kali_tidak_ada; }, 0);
  var totalAda = perKomponen.reduce(function (s, k) { return s + k.kali_ada; }, 0);
  var palingKurang = perKomponen.slice().sort(function (a, b) { return b.kali_tidak_ada - a.kali_tidak_ada; })[0];

  return {
    bulan: bulan, total_realisasi: totalRealisasi, per_komponen: perKomponen,
    persen_lengkap_keseluruhan: totalCatat > 0 ? Math.round((totalAda / totalCatat) * 100) : 0,
    komponen_paling_sering_kurang: (palingKurang && palingKurang.kali_tidak_ada > 0) ? palingKurang.komponen : ''
  };
}

/** Daftar realisasi, filter {bulan?}. */
function realisasiList(payload, session) {
  var bulan = payload && payload.bulan;
  var rows = sheetRead(SHEETS.REALISASI, function (r) {
    return !bulan || _bulanStr_(r.tanggal) === bulan;
  });
  rows.forEach(function (r) { r.tanggal = _tglStr_(r.tanggal); });
  return { realisasi: rows };
}

/**
 * Siapkan & validasi kolom piket_* dari payload {piket_nit?, piket_menu_sesuai?,
 * piket_porsi_cukup?, piket_kualitas?, piket_gizi?[], piket_catatan?}.
 * OPSIONAL secara default (getKebijakanPiket().wajib) — kosong semua bila
 * piket_nit tidak diisi & tidak wajib. NIT WAJIB ada di roster TARUNA; nama
 * didenormalisasi dari situ (untuk cetak, tanpa join ulang). piket_kualitas
 * WAJIB salah satu ENUM.REALISASI_KUALITAS begitu piket_nit diisi — checkbox
 * menu_sesuai/porsi_cukup boleh dibiarkan tak dicentang (FALSE tetap sah).
 */
function _piketKolom_(payload) {
  var kosong = {
    piket_nit: '', piket_nama: '', piket_menu_sesuai: false, piket_porsi_cukup: false,
    piket_kualitas: '', piket_gizi: '', piket_catatan: '', piket_at: ''
  };
  var nit = String((payload && payload.piket_nit) || '').trim();
  if (!nit) {
    if (getKebijakanPiket().wajib) throw _fail_('Verifikasi piket wajib diisi (kebijakan aktif).');
    return kosong;
  }

  var taruna = sheetRead(SHEETS.TARUNA, function (t) { return String(t.nit) === nit; })[0];
  if (!taruna) throw _fail_('NIT piket tidak ditemukan di roster taruna: ' + nit);

  var kualitas = String((payload && payload.piket_kualitas) || '');
  if (ENUM.REALISASI_KUALITAS.indexOf(kualitas) < 0) {
    throw _fail_('piket_kualitas harus salah satu: ' + ENUM.REALISASI_KUALITAS.join(' / '));
  }

  var standarGizi = getKebijakanGizi().komponen;
  var gizi = Array.isArray(payload.piket_gizi) ? payload.piket_gizi.map(String) : [];
  gizi.forEach(function (g) {
    if (standarGizi.indexOf(g) < 0) throw _fail_('Komponen gizi tidak dikenal: ' + g);
  });

  return {
    piket_nit: nit, piket_nama: taruna.nama,
    piket_menu_sesuai: Boolean(payload.piket_menu_sesuai),
    piket_porsi_cukup: Boolean(payload.piket_porsi_cukup),
    piket_kualitas: kualitas,
    piket_gizi: gizi.join(','),
    piket_catatan: String((payload && payload.piket_catatan) || ''),
    piket_at: new Date()
  };
}

/**
 * Catat realisasi harian. Payload:
 * {pesanan_id, porsi_diterima, jml_taruna_makan, ketidaksesuaian?, tindak_lanjut?,
 *  geotag_lat, geotag_lng, berkas?, piket_nit?, piket_menu_sesuai?, piket_porsi_cukup?,
 *  piket_kualitas?, piket_gizi?, piket_catatan?}  — berkas = foto dokumentasi (jenis FOTO);
 *  piket_* opsional (lihat _piketKolom_), TIDAK memengaruhi bukti ttd/foto/geotag.
 */
function realisasiCreate(payload, session) {
  var p = _pesanan_(payload && payload.pesanan_id);
  if (p.status !== 'TERKIRIM') {
    throw _fail_('Realisasi hanya untuk pesanan TERKIRIM (status sekarang: ' + p.status + ').');
  }
  var dobel = sheetRead(SHEETS.REALISASI, function (r) {
    return String(r.pesanan_id) === String(p.pesanan_id);
  })[0];
  if (dobel) throw _fail_('Realisasi untuk pesanan ini sudah ada: ' + dobel.real_id);

  var lat = Number(payload.geotag_lat);
  var lng = Number(payload.geotag_lng);
  if (!isFinite(lat) || !isFinite(lng)) throw _fail_('geotag_lat dan geotag_lng wajib berupa angka.');

  var obj = {
    real_id: nextId('REL'),
    pesanan_id: p.pesanan_id,
    tanggal: _tglStr_(p.tgl_makan),
    porsi_diterima: _int_(payload.porsi_diterima, 'porsi_diterima'),
    jml_taruna_makan: _int_(payload.jml_taruna_makan, 'jml_taruna_makan'),
    ketidaksesuaian: String((payload && payload.ketidaksesuaian) || ''),
    tindak_lanjut: String((payload && payload.tindak_lanjut) || ''),
    geotag_lat: lat,
    geotag_lng: lng,
    ttd_pembina_at: '', ttd_senat_at: ''
  };
  Object.assign(obj, _piketKolom_(payload));
  sheetAppend(SHEETS.REALISASI, obj);

  // Foto close-up (kualitas) — dipertahankan sebagai `berkas` demi kompatibel
  // dengan payload lama. Foto wide-shot (kuantitas porsi, Fitur E) opsional
  // di `berkas_wide` — baris LAMPIRAN kedua, TIDAK perlu kolom/skema baru
  // (LAMPIRAN memang sudah mendukung banyak baris per ref_id).
  if (payload.berkas && payload.berkas.base64) {
    lampiranSave(session, 'REALISASI', obj.real_id, 'FOTO',
      payload.berkas.base64, payload.berkas.nama_file || (obj.real_id + '-closeup.jpg'));
  }
  if (payload.berkas_wide && payload.berkas_wide.base64) {
    lampiranSave(session, 'REALISASI', obj.real_id, 'FOTO',
      payload.berkas_wide.base64, payload.berkas_wide.nama_file || (obj.real_id + '-wide.jpg'));
  }
  auditLog(session, 'realisasi.create', 'REALISASI', obj.real_id, null, {
    pesanan_id: p.pesanan_id, tanggal: obj.tanggal,
    porsi_diterima: obj.porsi_diterima, jml_taruna_makan: obj.jml_taruna_makan,
    piket_nit: obj.piket_nit
  });
  return { realisasi: obj };
}

/**
 * Tanda tangan digital (konfirmasi kata sandi ulang). Payload {real_id, pin} —
 * kunci `pin` dipertahankan demi kompatibilitas kontrak, nilainya kata sandi
 * pemilik sesi (kredensial yang sama dengan login).
 * PEMBINA mengisi ttd_pembina_at, SENAT mengisi ttd_senat_at.
 * Kedua ttd terisi → rekapUpdate(tanggal) otomatis.
 */
function realisasiTtd(payload, session) {
  var r = _realisasi_(payload && payload.real_id);

  // Konfirmasi kata sandi pemilik sesi
  var pin = (payload && payload.pin != null) ? String(payload.pin) : '';
  var u = sheetRead(SHEETS.PENGGUNA, function (x) { return String(x.user_id) === String(session.user_id); })[0];
  if (!u || String(u.pin_hash) !== _sha256Hex_(pin + _getSalt_())) {
    throw _fail_('Kata sandi salah — tanda tangan dibatalkan.');
  }

  var kolom;
  if (session.role === 'PEMBINA') kolom = 'ttd_pembina_at';
  else if (session.role === 'SENAT') kolom = 'ttd_senat_at';
  else throw _fail_('Hanya Pembina atau Senat yang menandatangani realisasi.');

  if (r[kolom]) throw _fail_('Anda (' + session.role + ') sudah menandatangani realisasi ini.');

  var patch = {};
  patch[kolom] = new Date();
  sheetUpdate(SHEETS.REALISASI, 'real_id', r.real_id, patch);
  auditLog(session, 'realisasi.ttd', 'REALISASI', r.real_id, null,
    { kolom: kolom, tanggal: _tglStr_(r.tanggal) });

  // Cek kelengkapan ttd → picu rekap incremental
  var baru = _realisasi_(r.real_id);
  var lengkap = Boolean(baru.ttd_pembina_at) && Boolean(baru.ttd_senat_at);
  if (lengkap) rekapUpdate(_tglStr_(baru.tanggal));

  return { real_id: r.real_id, ttd: kolom, lengkap: lengkap };
}

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 14_rekap.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
/**
 * 14_rekap.gs — REKAP_BULANAN: materialized view incremental (SOP no. 10)
 * Status: DRAFT → DISETUJUI_WADIR3 (Wadir 3) → TERVERIFIKASI_PPK (PPK verifikasi)
 *          → FINAL (PPK finalkan; beku, dasar SPM, siap dibayar)
 *
 * ACTION: rekap.get (PPK, KPA), rekap.verify (PPK), rekap.final (PPK),
 *         rekap.approve_wadir3 / rekap.batal_wadir3 (WADIR3),
 *         rekap.input_historis (PPK, Admin) — migrasi bulan pra-aplikasi
 * INTERNAL: rekapUpdate(tanggal) — dipanggil realisasi.ttd, BUKAN action publik.
 *
 * Uang selalu integer rupiah: nominal = hari_makan × harga_per_hari (tarif
 * kontrak, lihat _hargaPerHariKontrak_ di 05_master.gs — fallback ke
 * harga_per_porsi × porsi_per_hari untuk kontrak lama yang belum diisi ulang).
 * Setelah FINAL semua update bulan tsb DITOLAK.
 */

/**
 * rekapUpdate(tanggal) — hitung ulang bulan berjalan secara incremental.
 * hari_makan  = jumlah hari realisasi SAH (kedua ttd) bulan itu MINUS hari
 *               taruna berstatus harian; hari_tidak_makan = hari berstatus.
 * Ditulis batch per baris (bukan 247 update terpisah) demi kuota GAS 6 menit.
 */
function rekapUpdate(tanggal) {
  var bulan = _bulanStr_(tanggal);
  var kontrak = _kontrakAktifPada_(tanggal);
  var hargaPerHari = _hargaPerHariKontrak_(kontrak);

  // Hari-hari realisasi sah pada bulan tsb
  var hariSah = {};
  sheetRead(SHEETS.REALISASI, function (r) {
    return _bulanStr_(r.tanggal) === bulan && r.ttd_pembina_at && r.ttd_senat_at;
  }).forEach(function (r) { hariSah[_tglStr_(r.tanggal)] = true; });
  var jmlHariSah = Object.keys(hariSah).length;

  // Status harian per taruna pada bulan tsb
  var statusPerNit = {};
  sheetRead(SHEETS.STATUS_HARIAN, function (r) { return _bulanStr_(r.tanggal) === bulan; })
    .forEach(function (r) {
      var nit = String(r.nit);
      if (!statusPerNit[nit]) statusPerNit[nit] = {};
      statusPerNit[nit][_tglStr_(r.tanggal)] = true;
    });

  var tarunaAktif = sheetRead(SHEETS.TARUNA, function (r) { return r.status === 'AKTIF'; });

  return withLock(function () {
    var sh = _sheet_(SHEETS.REKAP_BULANAN);
    var lastCol = sh.getLastColumn();
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var last = sh.getLastRow();
    var data = last >= 2 ? sh.getRange(2, 1, last - 1, lastCol).getValues() : [];

    var iBulan = headers.indexOf('bulan'), iNit = headers.indexOf('nit'),
        iStatus = headers.indexOf('status');

    // Peta baris bulan berjalan; tolak bila ada yang FINAL
    var barisNit = {};
    for (var i = 0; i < data.length; i++) {
      if (_bulanStr_(data[i][iBulan]) !== bulan) continue;
      if (String(data[i][iStatus]) === 'FINAL') {
        throw _fail_('Rekap bulan ' + bulan + ' sudah FINAL — update ditolak.');
      }
      barisNit[String(data[i][iNit])] = i + 2; // nomor baris sheet
    }

    var barisBaru = [];
    tarunaAktif.forEach(function (t) {
      var nit = String(t.nit);
      var st = statusPerNit[nit] || {};
      // hari tidak makan yang relevan = status pada hari yang ADA realisasi sah
      var tidak = 0;
      for (var tgl in st) if (hariSah[tgl]) tidak++;
      var makan = jmlHariSah - tidak;
      var nominal = Math.round(makan * hargaPerHari); // integer rupiah

      var nilai = {};
      nilai.bulan = bulan; nilai.nit = nit;
      nilai.hari_makan = makan; nilai.hari_tidak_makan = tidak;
      nilai.nominal = nominal; nilai.status = 'DRAFT';
      nilai.verif_by = ''; nilai.verif_at = '';

      if (barisNit[nit]) {
        var row = headers.map(function (h) { return nilai[h] !== undefined ? nilai[h] : ''; });
        sh.getRange(barisNit[nit], 1, 1, lastCol).setValues([row]);
      } else {
        barisBaru.push(headers.map(function (h) { return nilai[h] !== undefined ? nilai[h] : ''; }));
      }
    });
    if (barisBaru.length) {
      sh.getRange(sh.getLastRow() + 1, 1, barisBaru.length, lastCol).setValues(barisBaru);
    }

    auditLog(null, 'rekap.update', 'REKAP_BULANAN', bulan, null,
      { hari_sah: jmlHariSah, taruna: tarunaAktif.length, harga_per_hari: hargaPerHari });
    return { bulan: bulan, hari_sah: jmlHariSah, taruna: tarunaAktif.length };
  });
}

/** Baris rekap satu bulan. */
function _rekapBulan_(bulan) {
  var rows = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  if (!rows.length) throw _fail_('Belum ada rekap untuk bulan ' + bulan + '.');
  return rows;
}

/**
 * rekap.get {bulan} → baris + total (PPK, KPA).
 * D = hari realisasi sah bulan itu (hari_makan + hari_tidak_makan per baris —
 * konstan untuk semua taruna AKTIF sejak recompute rekapUpdate terakhir).
 * ambang_outlier dari getKebijakanRekap() — dipakai frontend untuk penanda
 * anomali (Redesign Rekap Bulanan), TIDAK memengaruhi hitungan nominal.
 */
function rekapGet(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var rows = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  var total = 0;
  rows.forEach(function (r) { total += _int_(r.nominal || 0, 'nominal'); });
  var d = rows.length ? (_int_(rows[0].hari_makan || 0, 'hari_makan') + _int_(rows[0].hari_tidak_makan || 0, 'hari_tidak_makan')) : 0;
  return { rekap: rows, total: total, bulan: bulan, D: d, ambang_outlier: getKebijakanRekap().ambangOutlier };
}

/** Ubah status semua baris satu bulan (verify/final). */
function _rekapSetStatus_(session, bulan, dari, ke, aksi) {
  var rows = _rekapBulan_(bulan);
  rows.forEach(function (r) {
    if (String(r.status) !== dari) {
      throw _fail_('Ada baris rekap berstatus ' + r.status + ' — seluruh bulan harus ' + dari + ' untuk ' + aksi + '.');
    }
  });
  return withLock(function () {
    var sh = _sheet_(SHEETS.REKAP_BULANAN);
    var lastCol = sh.getLastColumn();
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var last = sh.getLastRow();
    var data = last >= 2 ? sh.getRange(2, 1, last - 1, lastCol).getValues() : [];
    var iBulan = headers.indexOf('bulan'), iStatus = headers.indexOf('status'),
        iBy = headers.indexOf('verif_by'), iAt = headers.indexOf('verif_at');
    var n = 0;
    for (var i = 0; i < data.length; i++) {
      if (_bulanStr_(data[i][iBulan]) !== bulan) continue;
      sh.getRange(i + 2, iStatus + 1).setValue(ke);
      sh.getRange(i + 2, iBy + 1).setValue(session.user_id);
      sh.getRange(i + 2, iAt + 1).setValue(new Date());
      n++;
    }
    auditLog(session, 'rekap.' + aksi, 'REKAP_BULANAN', bulan, { status: dari }, { status: ke, baris: n });
    return { bulan: bulan, status: ke, baris: n };
  });
}

/**
 * DISETUJUI_WADIR3 → TERVERIFIKASI_PPK (PPK verifikasi). PPK memeriksa hasil
 * yang sudah disetujui Wadir 3 — langkah kedua dari akhir sebelum finalisasi.
 */
function rekapVerify(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  return _rekapSetStatus_(session, bulan, 'DISETUJUI_WADIR3', 'TERVERIFIKASI_PPK', 'verify');
}

/**
 * TERVERIFIKASI_PPK → FINAL (PPK finalkan — angka BEKU, dasar SPM, siap dibayar).
 * Langkah TERAKHIR: PPK menyatakan hasil siap dibayar (gerbang bayar.create).
 */
function rekapFinal(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  return _rekapSetStatus_(session, bulan, 'TERVERIFIKASI_PPK', 'FINAL', 'final');
}

/**
 * DRAFT → DISETUJUI_WADIR3 (Wadir 3): persetujuan PALING AWAL atas rekap yang
 * baru tersusun, SEBELUM PPK memverifikasi & memfinalkan. Angka BELUM beku di
 * sini (baru beku saat PPK finalkan) — Wadir 3 menyetujui substansi hasil, lalu
 * diteruskan ke PPK. Prinsip: PPK di posisi terakhir (menerima hasil siap bayar).
 */
function rekapApproveWadir3(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  return _rekapSetStatus_(session, bulan, 'DRAFT', 'DISETUJUI_WADIR3', 'approve_wadir3');
}

/**
 * DISETUJUI_WADIR3 → DRAFT (Wadir 3 batalkan persetujuan — mis. salah klik,
 * atau ternyata ada koreksi hari makan yang perlu diperbaiki dulu sebelum
 * disetujui ulang). HANYA bisa dibatalkan selama PPK BELUM memverifikasi
 * (_rekapSetStatus_ menolak kalau status sudah bukan DISETUJUI_WADIR3, jadi
 * TERVERIFIKASI_PPK/FINAL otomatis tertutup dari pembatalan ini).
 */
function rekapBatalWadir3(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  return _rekapSetStatus_(session, bulan, 'DISETUJUI_WADIR3', 'DRAFT', 'batal_wadir3');
}

/**
 * rekap.input_historis (PPK, Admin) — migrasi bulan yang SUDAH BERJALAN sebelum
 * e-BAMA ada (mis. Januari–Juni), TANPA Pesanan/Realisasi harian palsu.
 * Payload {bulan, biaya_per_hari, baris:[{nit, hari_makan, hari_tidak_makan?}]}.
 * `biaya_per_hari` = satu angka Rp/hari per taruna (cermin dokumen kertas —
 * bukan harga_per_porsi × porsi_per_hari, karena rate historis bisa beda per
 * kelompok, mis. tingkat 3 beda dari tingkat 1–2). Panggil action ini SEKALI
 * PER KELOMPOK RATE dalam bulan yang sama kalau ratenya tidak seragam — baris
 * ditulis per-nit jadi aman dipanggil berkali-kali untuk bulan yang sama.
 * Ditulis batch (bukan per-baris) demi kuota GAS. Ditolak bila bulan itu sudah
 * punya baris berstatus selain DRAFT (mencegah menimpa rekap yang sedang berjalan
 * lewat alur normal). Jejak sumber tercatat di AUDIT_LOG, BUKAN kolom sheet baru.
 */
function rekapInputHistoris(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var biayaPerHari = _int_(payload && payload.biaya_per_hari, 'biaya_per_hari');
  var baris = (payload && payload.baris) || [];
  if (!baris.length) throw _fail_('baris tidak boleh kosong.');

  var existing = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  existing.forEach(function (r) {
    if (String(r.status) !== 'DRAFT') {
      throw _fail_('Rekap bulan ' + bulan + ' sudah berstatus ' + r.status + ' — tidak bisa diimpor historis lagi.');
    }
  });

  var tarunaValid = {};
  sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaValid[String(t.nit)] = true; });

  return withLock(function () {
    var sh = _sheet_(SHEETS.REKAP_BULANAN);
    var lastCol = sh.getLastColumn();
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var last = sh.getLastRow();
    var data = last >= 2 ? sh.getRange(2, 1, last - 1, lastCol).getValues() : [];
    var iBulan = headers.indexOf('bulan'), iNit = headers.indexOf('nit');

    var barisNit = {};
    for (var i = 0; i < data.length; i++) {
      if (_bulanStr_(data[i][iBulan]) !== bulan) continue;
      barisNit[String(data[i][iNit])] = i + 2; // nomor baris sheet
    }

    var barisBaru = [];
    var n = 0;
    baris.forEach(function (b) {
      var nit = String((b && b.nit) || '').trim();
      if (!nit) throw _fail_('nit wajib diisi pada setiap baris.');
      if (!tarunaValid[nit]) throw _fail_('Taruna tidak ditemukan: ' + nit);
      var makan = _int_(b.hari_makan, 'hari_makan');
      var tidak = _int_(b.hari_tidak_makan || 0, 'hari_tidak_makan');
      var nominal = Math.round(makan * biayaPerHari);

      var nilai = {
        bulan: bulan, nit: nit, hari_makan: makan, hari_tidak_makan: tidak,
        nominal: nominal, status: 'DRAFT', verif_by: '', verif_at: ''
      };
      var row = headers.map(function (h) { return nilai[h] !== undefined ? nilai[h] : ''; });
      if (barisNit[nit]) {
        sh.getRange(barisNit[nit], 1, 1, lastCol).setValues([row]);
      } else {
        barisBaru.push(row);
      }
      n++;
    });
    if (barisBaru.length) {
      sh.getRange(sh.getLastRow() + 1, 1, barisBaru.length, lastCol).setValues(barisBaru);
    }

    auditLog(session, 'rekap.input_historis', 'REKAP_BULANAN', bulan, null, {
      baris: n, biaya_per_hari: biayaPerHari,
      sumber: 'INPUT_HISTORIS_PRA_APLIKASI'
    });
    return { bulan: bulan, baris: n };
  });
}

/**
 * rekap.harian {tanggal} — rekonsiliasi 3 titik HARIAN per Prodi+Tingkat,
 * READ-ONLY (tanpa withLock, tanpa efek samping). Beda dari REKAP_BULANAN
 * (materialized view bulanan): dihitung LIVE dari TARUNA+STATUS_HARIAN untuk
 * SATU tanggal, dikelompokkan Prodi+Tingkat supaya langsung terbaca per kelas
 * — pelengkap tampilan modul Taruna + dasar cetak "Rekapitulasi Harian Taruna".
 *
 * "Tidak makan" = STATUS_HARIAN ∈ {PESIAR, CUTI, SAKIT_RUMAH, PENUNDAAN_STUDI, TANPA_KETERANGAN}.
 * "Luar kampus" = STATUS_HARIAN ∈ STATUS_LUAR_KAMPUS (00_config.gs, berhak
 * BANTUAN_LUAR_KAMPUS, bukan makan di kampus). "Makan" = aktif − keduanya —
 * subset yang sama seperti _hitungJmlTaruna_ (12_pesanan.gs)/cetakForm02.
 *
 * `realisasi` (opsional) = rekonsiliasi ke PESANAN.jml_taruna vs
 * REALISASI.jml_taruna_makan tanggal itu — null bila belum ada salah satunya.
 */
function rekapHarian(payload, session) {
  var tgl = _wajibTgl_(payload && payload.tanggal, 'tanggal');

  var tarunaAktif = sheetRead(SHEETS.TARUNA, function (r) { return r.status === 'AKTIF'; });
  var statusHari = {};
  sheetRead(SHEETS.STATUS_HARIAN, function (r) { return _tglStr_(r.tanggal) === tgl; })
    .forEach(function (r) { statusHari[String(r.nit)] = String(r.status); });

  var kelompok = {};
  function _grupHarian_(prodi, tingkat) {
    var kunci = (prodi || '') + '|' + (tingkat || '');
    if (!kelompok[kunci]) {
      kelompok[kunci] = { prodi: prodi || '', tingkat: tingkat || '', aktif: 0, tidak_makan: 0, luar_kampus: 0, makan: 0 };
    }
    return kelompok[kunci];
  }

  tarunaAktif.forEach(function (t) {
    var g = _grupHarian_(t.prodi, t.tingkat);
    g.aktif++;
    var st = statusHari[String(t.nit)];
    if (!st) { g.makan++; }
    else if (STATUS_LUAR_KAMPUS.indexOf(st) >= 0) { g.luar_kampus++; }
    else { g.tidak_makan++; }
  });

  var perKelompok = Object.keys(kelompok).map(function (k) { return kelompok[k]; })
    .sort(function (a, b) { return a.prodi.localeCompare(b.prodi) || a.tingkat.localeCompare(b.tingkat); });

  var total = { aktif: 0, tidak_makan: 0, luar_kampus: 0, makan: 0 };
  perKelompok.forEach(function (g) {
    total.aktif += g.aktif; total.tidak_makan += g.tidak_makan;
    total.luar_kampus += g.luar_kampus; total.makan += g.makan;
  });

  var pesanan = sheetRead(SHEETS.PESANAN, function (r) { return _tglStr_(r.tgl_makan) === tgl; })[0];
  var realisasi = sheetRead(SHEETS.REALISASI, function (r) { return _tglStr_(r.tanggal) === tgl; })[0];
  var rekonsiliasiHarian = null;
  if (pesanan && realisasi) {
    var dipesan = _int_(pesanan.jml_taruna, 'jml_taruna');
    var dimakan = _int_(realisasi.jml_taruna_makan, 'jml_taruna_makan');
    rekonsiliasiHarian = { dipesan: dipesan, dimakan: dimakan, selisih: dipesan - dimakan };
  }

  return { tanggal: tgl, per_kelompok: perKelompok, total: total, realisasi: rekonsiliasiHarian };
}

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 15_pembayaran.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
/**
 * 15_pembayaran.gs — Pembayaran LS via KPPN (SOP no. 11–17)
 *
 * Mesin status DISEDERHANAKAN (dikonfirmasi Firdaus): DIAJUKAN → SELESAI.
 * No. SP2D terisi = dana SUDAH cair ke rekening taruna (SP2D dari KPPN,
 * mekanisme LS) → pembayaran OTOMATIS SELESAI saat itu juga, TANPA langkah
 * konfirmasi Senat atau tutup manual terpisah. Pendebetan 2 tahap
 * (taruna→Senat→Penyedia) TETAP berjalan — tapi lewat DOKUMEN CETAK terpisah
 * (Form-07 lalu Form-09, lihat 21_cetak.gs), yang TIDAK mengunci/menunggu
 * status PEMBAYARAN ini. Begitu No. SP2D diketahui, mencetak & mengirim
 * Form-07 ke bank jadi MENDESAK (uang sudah cair, jendela blokir singkat).
 *
 * ACTION: bayar.list, bayar.get (PPK, KPA, Senat), bayar.create, bayar.update,
 * bayar.sync (PPK). bayar.close tersisa sebagai fallback manual (mis. baris
 * historis yang masih berstatus lama SP2D_TERBIT/DITRANSFER/DIKONFIRMASI dari
 * sebelum penyederhanaan ini) — bukan bagian alur normal lagi.
 *
 * RELASI 1:N dengan SP2D_MONITORING — satu baris PEMBAYARAN (per bulan) mewakili
 * BANYAK SP2D nyata: KPPN menerbitkan satu SP2D per kelompok Prodi+Tingkat (mis.
 * Januari 2026 = 10 SP2D). Field no_spm/no_sp2d di sheet ini cuma "wakil" untuk
 * input manual/fallback — rincian SP2D sebenarnya TIDAK disalin ke sini, tapi
 * diturunkan LIVE dari SP2D_MONITORING lewat _rincianSp2dDalamKampus_ (23_sp2d.gs)
 * dan ditempel di bayar.list/bayar.get sebagai sp2d_rincian + sp2d_lengkap.
 * Begitu SEMUA kelompok Prodi+Tingkat (yang REKAP-nya >0) punya SP2D yang SUM-nya
 * cocok, pembayaran OTOMATIS SELESAI — dijalankan otomatis dari sp2d.import
 * (_sinkronkanPembayaranDariSp2d_) atau manual lewat bayar.sync (untuk kasus SP2D
 * kadung diunggah SEBELUM bayar.create dibuat).
 *
 * nilai_total = SNAPSHOT SUM(nominal) REKAP_BULANAN FINAL — beku setelah ditulis.
 * Lampiran (surat blokir, bukti debet, invoice) → LAMPIRAN ref_type=PEMBAYARAN.
 * Setiap aksi tulis → withLock + auditLog. Uang integer rupiah.
 */

/** Ambil pembayaran by id atau error. */
function _bayar_(id) {
  var b = sheetRead(SHEETS.PEMBAYARAN, function (r) { return String(r.bayar_id) === String(id); })[0];
  if (!b) throw _fail_('Pembayaran tidak ditemukan: ' + id);
  return b;
}

/** Kontrak DISETUJUI_PPK yang periodenya beririsan dengan bulan. */
function _kontrakBulan_(bulan) {
  var awal = bulan + '-01', akhir = bulan + '-31';
  var rows = sheetRead(SHEETS.KONTRAK, function (r) {
    return r.status === 'DISETUJUI_PPK' &&
      _tglStr_(r.tgl_mulai) <= akhir && _tglStr_(r.tgl_akhir) >= awal;
  });
  if (!rows.length) throw _fail_('Tidak ada kontrak DISETUJUI_PPK untuk bulan ' + bulan + '.');
  return rows[0];
}

/**
 * Tempel rincian SP2D LIVE + anak SPM ke satu baris pembayaran (tanpa mengubah
 * data tersimpan). sp2d_rincian/sp2d_lengkap = jalur LEGACY (live-derive dari
 * SP2D_MONITORING via _rincianSp2dDalamKampus_, 23_sp2d.gs) — dipertahankan
 * HANYA untuk bulan sebelum SPM aktif (Jan-Mar 2026, lihat docs/skema-sheet.md
 * §9). `spm` = baris SPM (§18) anak bayar_id ini — KOSONG untuk bulan legacy
 * (tidak digenerate retroaktif), TERISI untuk bulan baru. Frontend membedakan
 * tampilan lama vs baru dari ada/tidaknya array `spm`.
 */
function _bayarDenganSp2d_(b) {
  var bln = _bulanStr_(b.bulan);
  var r = _rincianSp2dDalamKampus_(bln);
  var salin = {};
  Object.keys(b).forEach(function (k) { salin[k] = b[k]; });
  // Normalisasi bulan sebelum dikirim ke klien — sheet bisa auto-tertafsir
  // Date, membuat frontend (yang mencocokkan string 'YYYY-MM' persis) gagal
  // menemukan pembayaran yang BARU DIBUAT (tampak seperti tidak berefek).
  salin.bulan = bln;
  salin.sp2d_rincian = r.kelompok;
  salin.sp2d_lengkap = r.lengkap;
  salin.sp2d_perlu_cek_manual = r.perlu_cek_manual;
  salin.spm = sheetRead(SHEETS.SPM, function (s) { return String(s.bayar_id) === String(b.bayar_id); });
  return salin;
}

/** Daftar pembayaran, filter {bulan?} — diperkaya rincian SP2D live. */
function bayarList(payload, session) {
  var bulan = payload && payload.bulan;
  // _bulanStr_ (BUKAN String() polos) — kolom bulan bisa auto-tertafsir Date
  // oleh Google Sheets; String(Date) tidak pernah sama dengan 'YYYY-MM' (lihat
  // catatan sama di 23_sp2d.gs) — bikin pembayaran yang BARU DIBUAT langsung
  // "hilang" dari daftar (tampak seperti bayar.create tidak berefek).
  var rows = sheetRead(SHEETS.PEMBAYARAN, function (r) {
    return !bulan || _bulanStr_(r.bulan) === bulan;
  });
  return { pembayaran: rows.map(_bayarDenganSp2d_) };
}

/** Detail pembayaran + lampiran + rincian SP2D live. */
function bayarGet(payload, session) {
  var b = _bayar_(payload && payload.bayar_id);
  return { pembayaran: _bayarDenganSp2d_(b), lampiran: lampiranList('PEMBAYARAN', b.bayar_id) };
}

/**
 * Buat pembayaran: syarat rekap bulan FINAL (PPK finalkan = siap bayar);
 * nilai_total = SUM(nominal) snapshot. Kolom no_spm/tgl_spm/no_sp2d/tgl_sp2d/
 * konfirmasi_senat_at TIDAK diisi lagi (legacy, lihat docs/skema-sheet.md §9)
 * — begitu baris PEMBAYARAN dibuat, LANGSUNG generate baris SPM (§18) anaknya
 * lewat _generateSpmDalamKampus_ (satu per kelompok Prodi+Tingkat+Suplier).
 * Dibungkus withLock utuh (bukan cuma tiap sheetAppend) — cek dobel + generate
 * SPM harus atomik, reentrant jadi aman bersarang dgn lock sheetAppend sendiri.
 */
function bayarCreate(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');

  return withLock(function () {
    var rekap = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
    if (!rekap.length) throw _fail_('Belum ada rekap untuk bulan ' + bulan + '.');
    rekap.forEach(function (r) {
      if (String(r.status) !== 'FINAL') {
        throw _fail_('Rekap bulan ' + bulan + ' belum FINAL (status sekarang ' + r.status +
          ') — alur: Wadir 3 setujui → PPK verifikasi → PPK finalkan, baru pembayaran bisa dibuat.');
      }
    });

    // _bulanStr_ (bukan String() polos) — lihat catatan di bayarList di atas.
    var dobel = sheetRead(SHEETS.PEMBAYARAN, function (r) { return _bulanStr_(r.bulan) === bulan; })[0];
    if (dobel) throw _fail_('Pembayaran bulan ' + bulan + ' sudah ada: ' + dobel.bayar_id);

    var total = 0;
    rekap.forEach(function (r) { total += _int_(r.nominal || 0, 'nominal'); });
    var kontrak = _kontrakBulan_(bulan);

    var obj = {
      bayar_id: nextId('BYR'),
      bulan: bulan,
      kontrak_id: kontrak.kontrak_id,
      nilai_total: total,          // SNAPSHOT — beku, momen penulisan di AUDIT_LOG
      status: 'DIAJUKAN'
    };
    sheetAppend(SHEETS.PEMBAYARAN, obj);
    auditLog(session, 'bayar.create', 'PEMBAYARAN', obj.bayar_id, null,
      { bulan: bulan, nilai_total: total, kontrak_id: kontrak.kontrak_id });

    var spm = _generateSpmDalamKampus_(bulan, obj.bayar_id, session);
    return { pembayaran: obj, spm: spm };
  });
}

/**
 * Isi SPM/SP2D — begitu No. SP2D terisi (dana SUDAH cair ke rekening taruna),
 * status LANGSUNG SELESAI (dikonfirmasi Firdaus — lihat catatan modul).
 * Payload {bayar_id, no_spm?, tgl_spm?, no_sp2d?, tgl_sp2d?, berkas?}.
 */
function bayarUpdate(payload, session) {
  var b = _bayar_(payload && payload.bayar_id);
  if (b.status === 'SELESAI') {
    throw _fail_('Pembayaran berstatus SELESAI — tidak bisa diubah lagi.');
  }

  var patch = {};
  if (payload.no_spm !== undefined) patch.no_spm = String(payload.no_spm);
  if (payload.tgl_spm) patch.tgl_spm = _wajibTgl_(payload.tgl_spm, 'tgl_spm');
  if (payload.no_sp2d !== undefined) patch.no_sp2d = String(payload.no_sp2d);
  if (payload.tgl_sp2d) patch.tgl_sp2d = _wajibTgl_(payload.tgl_sp2d, 'tgl_sp2d');

  // No. SP2D terisi = dana SUDAH cair ke rekening taruna → langsung SELESAI.
  var statusBaru = b.status;
  if (b.status === 'DIAJUKAN' && (patch.no_sp2d || b.no_sp2d)) statusBaru = 'SELESAI';
  if (statusBaru !== b.status) patch.status = statusBaru;

  if (Object.keys(patch).length) {
    sheetUpdate(SHEETS.PEMBAYARAN, 'bayar_id', b.bayar_id, patch);
    auditLog(session, 'bayar.update', 'PEMBAYARAN', b.bayar_id, { status: b.status }, patch);
  }
  if (payload.berkas && payload.berkas.base64) {
    var jenis = payload.berkas.jenis || 'SURAT';
    if (ENUM.LAMPIRAN_JENIS.indexOf(jenis) < 0) throw _fail_('jenis lampiran tidak valid.');
    lampiranSave(session, 'PEMBAYARAN', b.bayar_id, jenis, payload.berkas.base64, payload.berkas.nama_file);
  }
  return { bayar_id: b.bayar_id, status: statusBaru };
}

/**
 * PPK: tutup manual → SELESAI. BUKAN bagian alur normal lagi (alur normal
 * sudah otomatis lewat bayarUpdate saat No. SP2D diisi) — fallback untuk
 * baris historis yang kadung berstatus lama (SP2D_TERBIT/DITRANSFER/
 * DIKONFIRMASI) dari sebelum penyederhanaan mesin status ini.
 */
function bayarClose(payload, session) {
  var b = _bayar_(payload && payload.bayar_id);
  if (b.status === 'SELESAI') throw _fail_('Pembayaran sudah SELESAI.');
  sheetUpdate(SHEETS.PEMBAYARAN, 'bayar_id', b.bayar_id, { status: 'SELESAI' });
  auditLog(session, 'bayar.close', 'PEMBAYARAN', b.bayar_id, { status: b.status }, { status: 'SELESAI' });
  return { bayar_id: b.bayar_id, status: 'SELESAI' };
}

/**
 * Sinkronkan status PEMBAYARAN dari kelengkapan SP2D_MONITORING. Kalau ada
 * pembayaran bulan `bulan` yang masih DIAJUKAN DAN semua SP2D-nya sudah lengkap
 * (_rincianSp2dDalamKampus_(bulan).lengkap), tandai SELESAI + audit.
 *
 * SENGAJA TIDAK melempar error (return {ok, alasan}) supaya aman dipanggil
 * silent dari sp2dImport (23_sp2d.gs) — kegagalan sinkron (mis. SP2D belum
 * lengkap) BUKAN kegagalan impor. `sumber` ('AUTO_IMPOR'/'MANUAL') dicatat di
 * audit untuk jejak asal transisi. Dibungkus withLock sendiri (reentrant-safe,
 * 03_helpers.gs) supaya aman baik dipanggil dari dalam lock sp2dImport maupun
 * langsung dari action bayarSync.
 */
function _sinkronkanPembayaranDariSp2d_(bulan, session, sumber) {
  var bln = _bulanStr_(bulan);
  return withLock(function () {
    var b = sheetRead(SHEETS.PEMBAYARAN, function (r) { return _bulanStr_(r.bulan) === bln; })[0];
    if (!b) return { ok: false, alasan: 'Belum ada pembayaran untuk bulan ' + bln + '.' };
    if (b.status !== 'DIAJUKAN') return { ok: false, alasan: 'Pembayaran ' + b.bayar_id + ' berstatus ' + b.status + ', tidak disinkronkan.' };

    var rincian = _rincianSp2dDalamKampus_(bln);
    if (!rincian.lengkap) {
      var belum = rincian.kelompok.filter(function (k) { return k.sistem > 0 && !k.cocok; }).length;
      return { ok: false, alasan: 'SP2D belum lengkap: ' + belum + ' kelompok Prodi+Tingkat belum cocok.' };
    }

    sheetUpdate(SHEETS.PEMBAYARAN, 'bayar_id', b.bayar_id, { status: 'SELESAI' });
    auditLog(session, 'bayar.sync', 'PEMBAYARAN', b.bayar_id,
      { status: b.status }, { status: 'SELESAI', sumber: sumber || 'AUTO_IMPOR' });
    return { ok: true, bayar_id: b.bayar_id, status: 'SELESAI' };
  });
}

/**
 * PPK: sinkronkan manual status pembayaran dari SP2D_MONITORING. Untuk kasus
 * SP2D kadung diunggah SEBELUM bayar.create dibuat (auto-sync di sp2dImport tak
 * sempat menemukan barisnya). Payload {bulan}. Kalau belum lengkap → error
 * dengan alasan (bukan silent).
 */
function bayarSync(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var hasil = _sinkronkanPembayaranDariSp2d_(bulan, session, 'MANUAL');
  if (!hasil.ok) throw _fail_(hasil.alasan);
  return { bayar_id: hasil.bayar_id, status: hasil.status };
}

/* ═══════════════════════════════════════════════════════════════════════
 * SPM (§18 skema-sheet.md) — header kelompok AUTHORED, kategori DALAM_KAMPUS.
 * Beda provenance dari SP2D_MONITORING (23_sp2d.gs, imported): SPM ditulis
 * satker (PPK) SEBELUM SP2D terbit, lalu diisi hasilnya begitu SP2D terbit
 * (1 SPM = 1 SP2D, dikonfirmasi Firdaus). SPM kategori LUAR_KAMPUS digenerate
 * dari action terpisah spm.generate_luar_kampus (lihat 19_bantuan_luar_kampus.gs).
 * ═══════════════════════════════════════════════════════════════════════ */

/** Ambil satu baris SPM by id atau error. */
function _spm_(id) {
  var s = sheetRead(SHEETS.SPM, function (r) { return String(r.spm_id) === String(id); })[0];
  if (!s) throw _fail_('SPM tidak ditemukan: ' + id);
  return s;
}

/**
 * Generate baris SPM kategori DALAM_KAMPUS untuk satu bulan/bayar_id, satu
 * baris per kelompok (prodi, tingkat, penyedia_id) dari REKAP_BULANAN bulan
 * itu (nominal > 0 saja — taruna yang tidak makan bulan ini tidak masuk grup
 * mana pun, sama seperti Form-10). Satu suplier SELALU melayani satu kelompok
 * prodi+tingkat utuh (dikonfirmasi Firdaus), jadi kelompok ini otomatis = satu
 * SP2D KPPN (1:1, lihat §18). MENOLAK bila ada taruna ber-REKAP nominal>0 yang
 * TARUNA_REKENING.penyedia_id-nya kosong/tak terdaftar — split per suplier
 * tidak boleh menghasilkan grup "suplier kosong" (pesan menyebut NIT/nama).
 */
function _generateSpmDalamKampus_(bulan, bayarId, session) {
  var rekapRows = sheetRead(SHEETS.REKAP_BULANAN, function (r) {
    return _bulanStr_(r.bulan) === bulan && _int_(r.nominal || 0, 'nominal') > 0;
  });

  var tarunaByNit = {};
  sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });
  var nitList = rekapRows.map(function (r) { return String(r.nit); });
  var rekeningByNit = {};
  sheetRead(SHEETS.TARUNA_REKENING, function (r) { return nitList.indexOf(String(r.nit)) >= 0; })
    .forEach(function (r) { rekeningByNit[String(r.nit)] = r; });

  var tanpaSuplier = [];
  rekapRows.forEach(function (r) {
    var rek = rekeningByNit[String(r.nit)];
    if (!rek || !rek.penyedia_id) {
      var t = tarunaByNit[String(r.nit)] || {};
      tanpaSuplier.push(String(r.nit) + (t.nama ? (' (' + t.nama + ')') : ''));
    }
  });
  if (tanpaSuplier.length) {
    throw _fail_('Tidak bisa membuat SPM — taruna berikut belum punya suplier ' +
      '(penyedia_id di TARUNA_REKENING) padahal ber-REKAP bulan ' + bulan + ': ' +
      tanpaSuplier.join(', ') + '. Lengkapi dulu lewat rekening.simpan.');
  }

  var kelompok = {};
  rekapRows.forEach(function (r) {
    var t = tarunaByNit[String(r.nit)] || {};
    var rek = rekeningByNit[String(r.nit)];
    var kunci = (t.prodi || '') + '|' + (t.tingkat || '') + '|' + rek.penyedia_id;
    if (!kelompok[kunci]) {
      kelompok[kunci] = { prodi: t.prodi || '', tingkat: t.tingkat || '', penyedia_id: rek.penyedia_id, nominal: 0 };
    }
    kelompok[kunci].nominal += _int_(r.nominal || 0, 'nominal');
  });

  var dibuat = [];
  Object.keys(kelompok).sort().forEach(function (k) {
    var g = kelompok[k];
    var obj = {
      spm_id: nextId('SPM'), kategori: 'DALAM_KAMPUS', bayar_id: bayarId, bulan: bulan,
      prodi: g.prodi, tingkat: g.tingkat, penyedia_id: g.penyedia_id,
      kegiatan: '', pembayaran_ke: '', periode: '',
      nominal: g.nominal, no_spm: '', tgl_spm: '', no_sp2d: '', tgl_sp2d: '',
      status: 'DRAFT'
    };
    sheetAppend(SHEETS.SPM, obj);
    dibuat.push(obj);
  });

  auditLog(session, 'spm.generate', 'SPM', bayarId, null,
    { kategori: 'DALAM_KAMPUS', bulan: bulan, jumlah: dibuat.length });
  return dibuat;
}

/**
 * Bila SEMUA SPM anak bayarId (kategori DALAM_KAMPUS) sudah SP2D_TERBIT,
 * tandai PEMBAYARAN SELESAI (+ audit). Dipanggil dari spmSetSp2d. Silent
 * (tidak melempar error) bila belum lengkap atau PEMBAYARAN sudah SELESAI.
 */
function _cekSelesaikanPembayaranDariSpm_(bayarId, session) {
  var anak = sheetRead(SHEETS.SPM, function (r) {
    return String(r.bayar_id) === String(bayarId) && r.kategori === 'DALAM_KAMPUS';
  });
  if (!anak.length || !anak.every(function (r) { return r.status === 'SP2D_TERBIT'; })) return;
  var b = sheetRead(SHEETS.PEMBAYARAN, function (r) { return String(r.bayar_id) === String(bayarId); })[0];
  if (!b || b.status !== 'DIAJUKAN') return;
  sheetUpdate(SHEETS.PEMBAYARAN, 'bayar_id', bayarId, { status: 'SELESAI' });
  auditLog(session, 'bayar.sync', 'PEMBAYARAN', bayarId,
    { status: b.status }, { status: 'SELESAI', sumber: 'SPM_LENGKAP' });
}

/**
 * Auto-isi no_spm/tgl_spm/no_sp2d/tgl_sp2d pada baris SPM dari data
 * SP2D_MONITORING yang baru diimpor (`sp2d.import`, 23_sp2d.gs) — dipanggil
 * OTOMATIS tiap impor selesai (kedua kategori), supaya PPK tidak perlu ketik
 * ulang nomor SPM yang sebenarnya sudah ada di file Monitoring SPP/SPM/SP2D
 * (OM-SPAN). Matching TANPA AMBIGU saja — kalau tidak ketemu/ambigu,
 * DILEWATI (silent) dan tetap bisa diisi manual lewat spm.update/spm.set_sp2d:
 * - DALAM_KAMPUS: kunci (bulan, prodi, tingkat) — satu suplier SELALU
 *   melayani satu kelompok prodi+tingkat utuh (dikonfirmasi Firdaus), jadi
 *   kelompok = tepat SATU SPM/SP2D (§18 skema-sheet.md). Baris agregat
 *   Monitoring utk kunci itu harus PERSIS SATU (0 atau >1 = ambigu/re-impor
 *   ganda → dilewati).
 * - LUAR_KAMPUS: kunci (bulan, prodi, tingkat, kegiatan) TAPI hanya bila
 *   kunci itu JUGA punya PERSIS SATU baris SPM (`pembayaran_ke`/tahap tidak
 *   bisa dibedakan dari teks Uraian Monitoring) — kalau >1 SPM berbagi kunci
 *   yang sama, dilewati (dikonfirmasi Firdaus).
 * SPM berstatus SP2D_TERBIT (beku) TIDAK disentuh. Mengikuti mesin status
 * spmUpdate/spmSetSp2d (DRAFT→DIAJUKAN saat no_spm terisi, DIAJUKAN→
 * SP2D_TERBIT saat no_sp2d terisi) + trigger _cekSelesaikanPembayaranDariSpm_
 * yang sama. SENGAJA silent/tidak melempar — kegagalan cocok BUKAN kegagalan
 * impor. withLock sendiri (reentrant-safe, 03_helpers.gs).
 */
function _autoIsiSpmDariSp2d_(bulan, session, sumber) {
  var bln = _bulanStr_(bulan);
  return withLock(function () {
    var spmBulan = sheetRead(SHEETS.SPM, function (r) {
      return _bulanStr_(r.bulan) === bln && r.status !== 'SP2D_TERBIT';
    });
    if (!spmBulan.length) return { jml_diisi: 0 };

    var monBulan = sheetRead(SHEETS.SP2D_MONITORING, function (r) {
      return _bulanStr_(r.bulan) === bln && !r.nit && r.perlu_cek_manual !== 'YA';
    });

    var dalamPerKunci = {};
    monBulan.filter(function (r) { return r.kategori === 'DALAM_KAMPUS'; }).forEach(function (r) {
      var k = String(r.prodi) + '|' + String(r.tingkat);
      (dalamPerKunci[k] = dalamPerKunci[k] || []).push(r);
    });

    var luarPerKunci = {};
    monBulan.filter(function (r) { return r.kategori === 'LUAR_KAMPUS'; }).forEach(function (r) {
      var k = String(r.prodi) + '|' + String(r.tingkat) + '|' + String(r.kegiatan);
      (luarPerKunci[k] = luarPerKunci[k] || []).push(r);
    });
    var jmlSpmLuarPerKunci = {};
    spmBulan.filter(function (r) { return r.kategori === 'LUAR_KAMPUS'; }).forEach(function (r) {
      var k = String(r.prodi) + '|' + String(r.tingkat) + '|' + String(r.kegiatan);
      jmlSpmLuarPerKunci[k] = (jmlSpmLuarPerKunci[k] || 0) + 1;
    });

    var jmlDiisi = 0;
    spmBulan.forEach(function (s) {
      var kandidat = null;
      if (s.kategori === 'DALAM_KAMPUS') {
        var arrD = dalamPerKunci[String(s.prodi) + '|' + String(s.tingkat)];
        if (arrD && arrD.length === 1) kandidat = arrD[0];
      } else if (s.kategori === 'LUAR_KAMPUS') {
        var kL = String(s.prodi) + '|' + String(s.tingkat) + '|' + String(s.kegiatan);
        var arrL = luarPerKunci[kL];
        if (arrL && arrL.length === 1 && jmlSpmLuarPerKunci[kL] === 1) kandidat = arrL[0];
      }
      if (!kandidat) return;

      var noSpmBaru = String(kandidat.no_spm || '').trim();
      var tglSpmBaru = _tglStr_(kandidat.tgl_spm || '');
      var noSp2dBaru = String(kandidat.no_sp2d || '').trim();
      var tglSp2dBaru = _tglStr_(kandidat.tgl_sp2d || '');

      var patch = {};
      if (noSpmBaru && noSpmBaru !== String(s.no_spm || '')) patch.no_spm = noSpmBaru;
      if (tglSpmBaru && tglSpmBaru !== _tglStr_(s.tgl_spm || '')) patch.tgl_spm = tglSpmBaru;
      if (noSp2dBaru && noSp2dBaru !== String(s.no_sp2d || '')) patch.no_sp2d = noSp2dBaru;
      if (tglSp2dBaru && tglSp2dBaru !== _tglStr_(s.tgl_sp2d || '')) patch.tgl_sp2d = tglSp2dBaru;

      var statusBaru = s.status;
      if (statusBaru === 'DRAFT' && (patch.no_spm || s.no_spm)) statusBaru = 'DIAJUKAN';
      if (statusBaru === 'DIAJUKAN' && (patch.no_sp2d || s.no_sp2d)) statusBaru = 'SP2D_TERBIT';
      if (statusBaru !== s.status) patch.status = statusBaru;

      if (!Object.keys(patch).length) return;

      sheetUpdate(SHEETS.SPM, 'spm_id', s.spm_id, patch);
      auditLog(session, 'spm.auto_isi', 'SPM', s.spm_id,
        { no_spm: s.no_spm, tgl_spm: s.tgl_spm, no_sp2d: s.no_sp2d, tgl_sp2d: s.tgl_sp2d, status: s.status },
        { no_spm: patch.no_spm, tgl_spm: patch.tgl_spm, no_sp2d: patch.no_sp2d, tgl_sp2d: patch.tgl_sp2d,
          status: patch.status, sumber: sumber || 'AUTO_IMPOR' });
      jmlDiisi++;

      if (statusBaru === 'SP2D_TERBIT' && s.kategori === 'DALAM_KAMPUS' && s.bayar_id) {
        _cekSelesaikanPembayaranDariSpm_(s.bayar_id, session);
      }
    });

    return { jml_diisi: jmlDiisi };
  });
}

/**
 * spm.list {bulan?, bayar_id?, kategori?} — daftar SPM (kedua kategori).
 * Diperkaya `penyedia_nama` (join PENYEDIA, khusus DALAM_KAMPUS yang punya
 * penyedia_id) supaya UI tak perlu tampilkan ID mentah.
 */
function spmList(payload, session) {
  var f = payload || {};
  var rows = sheetRead(SHEETS.SPM, function (r) {
    if (f.bulan && _bulanStr_(r.bulan) !== f.bulan) return false;
    if (f.bayar_id && String(r.bayar_id) !== String(f.bayar_id)) return false;
    if (f.kategori && String(r.kategori) !== f.kategori) return false;
    return true;
  });
  var penyediaById = {};
  sheetRead(SHEETS.PENYEDIA).forEach(function (p) { penyediaById[String(p.penyedia_id)] = p; });
  rows = rows.map(function (r) {
    var p = r.penyedia_id ? penyediaById[String(r.penyedia_id)] : null;
    return Object.assign({}, r, { penyedia_nama: p ? (p.nama || '') : '' });
  });
  return { spm: rows };
}

/**
 * spm.update {spm_id, no_spm?, tgl_spm?, status?} — isi nomor SPM & ajukan
 * (DRAFT→DIAJUKAN, nominal & kunci kelompok beku begitu DIAJUKAN — lihat
 * _generateSpmDalamKampus_/spm.generate_luar_kampus, tidak ada mekanisme
 * ubah nominal di sini). SELAMA status ≠ SP2D_TERBIT, no_spm/tgl_spm boleh
 * diedit ulang berkali-kali (menangani SPM ditolak/dikembalikan KPPN — tidak
 * ada status DITOLAK terpisah, dikonfirmasi Firdaus).
 */
function spmUpdate(payload, session) {
  var s = _spm_(payload && payload.spm_id);
  if (s.status === 'SP2D_TERBIT') {
    throw _fail_('SPM ' + s.spm_id + ' sudah SP2D_TERBIT — tidak bisa diubah lagi.');
  }

  var patch = {};
  if (payload.no_spm !== undefined) patch.no_spm = String(payload.no_spm);
  if (payload.tgl_spm) patch.tgl_spm = _wajibTgl_(payload.tgl_spm, 'tgl_spm');
  if (payload.status !== undefined && payload.status !== s.status) {
    if (payload.status === 'DIAJUKAN' && s.status === 'DRAFT') {
      patch.status = 'DIAJUKAN';
    } else {
      throw _fail_('Transisi status SPM tidak valid: ' + s.status + ' → ' + payload.status + '.');
    }
  }

  if (Object.keys(patch).length) {
    sheetUpdate(SHEETS.SPM, 'spm_id', s.spm_id, patch);
    auditLog(session, 'spm.update', 'SPM', s.spm_id,
      { no_spm: s.no_spm, tgl_spm: s.tgl_spm, status: s.status }, patch);
  }
  return { spm_id: s.spm_id, status: patch.status || s.status };
}

/**
 * spm.set_sp2d {spm_id, no_sp2d, tgl_sp2d} — isi hasil SP2D (1:1 dgn SPM) →
 * status SP2D_TERBIT. Syarat: SPM harus sudah DIAJUKAN (KPPN tidak menerbitkan
 * SP2D untuk SPM yang belum diajukan). Untuk kategori DALAM_KAMPUS, begitu
 * SEMUA SPM bulan itu SP2D_TERBIT, PEMBAYARAN induknya otomatis SELESAI.
 */
function spmSetSp2d(payload, session) {
  var s = _spm_(payload && payload.spm_id);
  if (s.status !== 'DIAJUKAN') {
    throw _fail_('SPM ' + s.spm_id + ' harus berstatus DIAJUKAN dulu (status sekarang ' + s.status + ').');
  }
  var noSp2d = String((payload && payload.no_sp2d) || '').trim();
  if (!noSp2d) throw _fail_('no_sp2d wajib diisi.');
  var tglSp2d = _wajibTgl_(payload && payload.tgl_sp2d, 'tgl_sp2d');

  var patch = { no_sp2d: noSp2d, tgl_sp2d: tglSp2d, status: 'SP2D_TERBIT' };
  sheetUpdate(SHEETS.SPM, 'spm_id', s.spm_id, patch);
  auditLog(session, 'spm.set_sp2d', 'SPM', s.spm_id, { status: s.status }, patch);

  if (s.kategori === 'DALAM_KAMPUS' && s.bayar_id) {
    _cekSelesaikanPembayaranDariSpm_(s.bayar_id, session);
  }
  return { spm_id: s.spm_id, status: 'SP2D_TERBIT' };
}

/**
 * spm.anggota {spm_id} — daftar taruna dalam satu baris SPM, sumber checklist
 * utk spm.split. Kalau `nit_anggota` SUDAH terisi (baris hasil split atau
 * sisa induk setelah displit) → pakai itu langsung. Kalau KOSONG (grup
 * natural, belum pernah displit) → derive PERSIS seperti
 * _generateSpmDalamKampus_: REKAP_BULANAN (bulan, nominal>0) join
 * TARUNA_REKENING.penyedia_id + TARUNA, filter (prodi, tingkat, penyedia_id)
 * sesuai baris SPM ini. HANYA kategori DALAM_KAMPUS (LUAR_KAMPUS belum
 * didukung split — tanpa suplier, kuncinya beda).
 */
function spmAnggota(payload, session) {
  var s = _spm_(payload && payload.spm_id);
  if (s.kategori !== 'DALAM_KAMPUS') {
    throw _fail_('spm.anggota baru mendukung kategori DALAM_KAMPUS.');
  }

  var tarunaByNit = {};
  sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });

  // Normalkan bulan SPM → 'YYYY-MM'. Kolom bulan bisa terbaca sebagai Date
  // (sel diformat tanggal) — kalau dibandingkan mentah, filter REKAP tak pernah
  // cocok → daftar anggota kosong (0 taruna). spmList sudah menormalkan; di sini
  // dulu belum, itulah sebab modal "Pisahkan Taruna" tampil kosong.
  var blnSpm = _bulanStr_(s.bulan);
  var rekapRows = sheetRead(SHEETS.REKAP_BULANAN, function (r) {
    return _bulanStr_(r.bulan) === blnSpm && _int_(r.nominal || 0, 'nominal') > 0;
  });
  var nominalByNit = {};
  rekapRows.forEach(function (r) { nominalByNit[String(r.nit)] = _int_(r.nominal || 0, 'nominal'); });

  var nitAnggota = String(s.nit_anggota || '').split(',').map(function (v) { return v.trim(); }).filter(Boolean);
  var nitList = nitAnggota.length ? nitAnggota : _nitAlamiDalamKampus_(blnSpm, s.prodi, s.tingkat, s.penyedia_id, rekapRows, tarunaByNit);

  var anggota = nitList.map(function (nit) {
    var t = tarunaByNit[nit] || {};
    return { nit: nit, nama: t.nama || '', nominal: nominalByNit[nit] || 0 };
  }).sort(function (a, b2) { return (a.nama || '').localeCompare(b2.nama || ''); });

  var total = anggota.reduce(function (sum, a) { return sum + a.nominal; }, 0);
  return { spm_id: s.spm_id, anggota: anggota, total_nominal: total };
}

/**
 * NIT taruna yang NATURAL menjadi anggota kelompok (bulan, prodi, tingkat,
 * penyedia_id) DALAM_KAMPUS — TANPA memandang nit_anggota sama sekali (murni
 * dari REKAP_BULANAN × TARUNA_REKENING × TARUNA, sama seperti
 * _generateSpmDalamKampus_). Dipakai spmAnggota (grup belum displit) DAN
 * spmGabung (cek apakah gabungan kembali jadi grup ALAMI utuh, utk keputusan
 * kosongkan nit_anggota lagi). `rekapRows`/`tarunaByNit` opsional (dipakai
 * ulang oleh pemanggil yang sudah baca sheet-nya, hindari baca dobel).
 */
function _nitAlamiDalamKampus_(bulan, prodi, tingkat, penyediaId, rekapRows, tarunaByNit) {
  // Normalkan bulan → 'YYYY-MM' (bisa dipanggil dgn Date dari kolom sheet, mis.
  // dari spmGabung yang meneruskan a.bulan mentah). _bulanStr_ pada 'YYYY-MM'
  // mengembalikannya apa adanya, pada Date mengubahnya ke 'YYYY-MM'.
  bulan = _bulanStr_(bulan);
  if (!rekapRows) {
    rekapRows = sheetRead(SHEETS.REKAP_BULANAN, function (r) {
      return _bulanStr_(r.bulan) === bulan && _int_(r.nominal || 0, 'nominal') > 0;
    });
  }
  if (!tarunaByNit) {
    tarunaByNit = {};
    sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });
  }
  var rekeningByNit = {};
  sheetRead(SHEETS.TARUNA_REKENING, function (r) { return String(r.penyedia_id) === String(penyediaId); })
    .forEach(function (r) { rekeningByNit[String(r.nit)] = r; });
  return rekapRows
    .filter(function (r) {
      var t = tarunaByNit[String(r.nit)] || {};
      return (t.prodi || '') === prodi && (t.tingkat || '') === tingkat && rekeningByNit[String(r.nit)];
    })
    .map(function (r) { return String(r.nit); });
}

/**
 * spm.split {spm_id, nit_list} — keluarkan sebagian taruna dari satu baris
 * SPM jadi baris SPM BARU tersendiri, tetap dalam kelompok (kunci) yang
 * sama — dipakai kalau PPK perlu mengajukan sebagian taruna terpisah ke
 * KPPN. HANYA kategori DALAM_KAMPUS, HANYA selama status DRAFT (snapshot
 * beku sesuai §5 CLAUDE.md — sama seperti spmUpdate/spmRegenerate). Efek
 * DISENGAJA (bukan bug, lihat §18 skema-sheet.md): _autoIsiSpmDariSp2d_
 * otomatis MELEWATI grup ini begitu >1 baris berbagi kunci sama — PPK isi
 * no_spm/no_sp2d manual per pecahan lewat spm.update/spm.set_sp2d.
 */
function spmSplit(payload, session) {
  var s = _spm_(payload && payload.spm_id);
  if (s.kategori !== 'DALAM_KAMPUS') {
    throw _fail_('spm.split baru mendukung kategori DALAM_KAMPUS.');
  }
  if (s.status !== 'DRAFT') {
    throw _fail_('SPM ' + s.spm_id + ' berstatus ' + s.status + ' — hanya SPM DRAFT yang bisa dipecah.');
  }
  var nitList = ((payload && payload.nit_list) || []).map(function (v) { return String(v).trim(); }).filter(Boolean);
  if (!nitList.length) throw _fail_('nit_list wajib diisi minimal 1 NIT.');

  return withLock(function () {
    var info = spmAnggota({ spm_id: s.spm_id }, session);
    var anggotaByNit = {};
    info.anggota.forEach(function (a) { anggotaByNit[a.nit] = a; });

    var takDikenal = nitList.filter(function (nit) { return !anggotaByNit[nit]; });
    if (takDikenal.length) {
      throw _fail_('NIT berikut bukan anggota SPM ini: ' + takDikenal.join(', '));
    }
    if (nitList.length >= info.anggota.length) {
      throw _fail_('Tidak bisa memisahkan SELURUH anggota — minimal 1 taruna harus tersisa di SPM asal.');
    }

    var nitSisaSet = {};
    info.anggota.forEach(function (a) { nitSisaSet[a.nit] = true; });
    nitList.forEach(function (nit) { delete nitSisaSet[nit]; });
    var nitSisa = Object.keys(nitSisaSet);

    var nominalPecahan = nitList.reduce(function (sum, nit) { return sum + (anggotaByNit[nit].nominal || 0); }, 0);
    var nominalSisa = s.nominal - nominalPecahan;

    var spmBaru = {
      spm_id: nextId('SPM'), kategori: s.kategori, bayar_id: s.bayar_id, bulan: s.bulan,
      prodi: s.prodi, tingkat: s.tingkat, penyedia_id: s.penyedia_id,
      kegiatan: s.kegiatan || '', pembayaran_ke: s.pembayaran_ke || '', periode: s.periode || '',
      nominal: nominalPecahan, no_spm: '', tgl_spm: '', no_sp2d: '', tgl_sp2d: '',
      status: 'DRAFT', nit_anggota: nitList.join(','), induk_spm_id: s.spm_id
    };
    sheetAppend(SHEETS.SPM, spmBaru);
    sheetUpdate(SHEETS.SPM, 'spm_id', s.spm_id, { nominal: nominalSisa, nit_anggota: nitSisa.join(',') });

    auditLog(session, 'spm.split', 'SPM', s.spm_id,
      { nominal: s.nominal, nit_anggota: s.nit_anggota || '' },
      { spm_asal: { spm_id: s.spm_id, nominal: nominalSisa, nit_anggota: nitSisa.join(',') },
        spm_baru: { spm_id: spmBaru.spm_id, nominal: nominalPecahan, nit_anggota: nitList.join(',') } });

    return {
      spm_asal: { spm_id: s.spm_id, nominal: nominalSisa, nit_anggota: nitSisa.join(',') },
      spm_baru: spmBaru
    };
  });
}

/**
 * spm.gabung {spm_id_a, spm_id_b} — kebalikan spm.split, dipakai utk koreksi
 * kalau salah pisah. HANYA selama KEDUA baris masih DRAFT dan berbagi kunci
 * kelompok (kategori+bayar_id+prodi+tingkat+penyedia_id+kegiatan+
 * pembayaran_ke) yang PERSIS sama. Baris yang dipertahankan: yang TANPA
 * induk_spm_id (baris asli); kalau keduanya punya induk, pertahankan spm_id
 * yang dibuat lebih dulu. `nit_anggota` digabung eksplisit — KECUALI kalau
 * gabungan itu PERSIS sama dengan keanggotaan ALAMI grup (`DALAM_KAMPUS`
 * saja, lihat _nitAlamiDalamKampus_), dalam hal ini `nit_anggota` dikosongkan
 * lagi supaya baris kembali "natural" (rapi, konsisten dgn tampilan sebelum
 * pernah displit) — tetap sah kalau di kasus lain (LUAR_KAMPUS, atau gabungan
 * sebagian) `nit_anggota` tersisa terisi eksplisit, lihat §18 skema-sheet.md.
 */
function spmGabung(payload, session) {
  var idA = payload && payload.spm_id_a, idB = payload && payload.spm_id_b;
  if (!idA || !idB) throw _fail_('spm_id_a dan spm_id_b wajib diisi.');
  if (String(idA) === String(idB)) throw _fail_('spm_id_a dan spm_id_b tidak boleh sama.');

  return withLock(function () {
    var a = _spm_(idA), b = _spm_(idB);
    if (a.status !== 'DRAFT' || b.status !== 'DRAFT') {
      throw _fail_('Kedua SPM harus berstatus DRAFT untuk digabungkan (status sekarang: ' +
        a.spm_id + '=' + a.status + ', ' + b.spm_id + '=' + b.status + ').');
    }
    var kunciSama = a.kategori === b.kategori && String(a.bayar_id) === String(b.bayar_id) &&
      a.prodi === b.prodi && a.tingkat === b.tingkat &&
      String(a.penyedia_id || '') === String(b.penyedia_id || '') &&
      String(a.kegiatan || '') === String(b.kegiatan || '') &&
      String(a.pembayaran_ke || '') === String(b.pembayaran_ke || '');
    if (!kunciSama) {
      throw _fail_('Kedua SPM bukan pasangan kelompok yang sama — tidak bisa digabungkan.');
    }

    var nitA = String(a.nit_anggota || '').split(',').map(function (v) { return v.trim(); }).filter(Boolean);
    var nitB = String(b.nit_anggota || '').split(',').map(function (v) { return v.trim(); }).filter(Boolean);
    var tumpangTindih = nitA.filter(function (nit) { return nitB.indexOf(nit) >= 0; });
    if (tumpangTindih.length) {
      throw _fail_('Anggota kedua SPM tumpang tindih (data tidak konsisten): ' + tumpangTindih.join(', '));
    }

    var tahan = !a.induk_spm_id ? a : (!b.induk_spm_id ? b : (a.spm_id < b.spm_id ? a : b));
    var hapus = tahan.spm_id === a.spm_id ? b : a;
    var nitGabung = nitA.concat(nitB);
    var nominalGabung = a.nominal + b.nominal;

    var nitGabungFinal = nitGabung;
    if (a.kategori === 'DALAM_KAMPUS') {
      var nitAlami = _nitAlamiDalamKampus_(a.bulan, a.prodi, a.tingkat, a.penyedia_id);
      var samaAlami = nitGabung.length === nitAlami.length &&
        nitGabung.slice().sort().join(',') === nitAlami.slice().sort().join(',');
      if (samaAlami) nitGabungFinal = [];
    }

    sheetUpdate(SHEETS.SPM, 'spm_id', tahan.spm_id, { nominal: nominalGabung, nit_anggota: nitGabungFinal.join(',') });
    sheetDeleteRows(SHEETS.SPM, 'spm_id', [hapus.spm_id]);

    auditLog(session, 'spm.gabung', 'SPM', tahan.spm_id,
      { spm_a: { spm_id: a.spm_id, nominal: a.nominal, nit_anggota: a.nit_anggota || '' },
        spm_b: { spm_id: b.spm_id, nominal: b.nominal, nit_anggota: b.nit_anggota || '' } },
      { spm_id: tahan.spm_id, nominal: nominalGabung, nit_anggota: nitGabungFinal.join(','), spm_dihapus: hapus.spm_id });

    return { spm_id: tahan.spm_id, nominal: nominalGabung, nit_anggota: nitGabungFinal.join(','), spm_dihapus: hapus.spm_id };
  });
}

/**
 * spm.regenerate {bayar_id} — re-derive SPM DALAM_KAMPUS dari REKAP_BULANAN
 * terbaru (mis. rekap dikoreksi setelah SPM dibuat, sebelum diajukan). HANYA
 * boleh selama SEMUA SPM grup itu masih DRAFT — kalau ada yang sudah
 * DIAJUKAN/SP2D_TERBIT, nominal & kunci kelompoknya sudah beku, regenerate
 * ditolak supaya tidak menghapus SPM yang sudah diajukan ke KPPN. DITOLAK
 * JUGA bila grup itu sudah pernah displit (spm.split) — ada baris
 * induk_spm_id terisi ATAU >1 baris berbagi kunci grup yang sama —
 * gabungkan dulu lewat spm.gabung.
 */
function spmRegenerate(payload, session) {
  var bayarId = payload && payload.bayar_id;
  if (!bayarId) throw _fail_('bayar_id wajib diisi.');
  var b = _bayar_(bayarId);

  return withLock(function () {
    var lama = sheetRead(SHEETS.SPM, function (r) {
      return String(r.bayar_id) === String(bayarId) && r.kategori === 'DALAM_KAMPUS';
    });
    var belumDraft = lama.filter(function (r) { return r.status !== 'DRAFT'; });
    if (belumDraft.length) {
      throw _fail_('Tidak bisa regenerate — ' + belumDraft.length + ' SPM sudah diajukan/cair: ' +
        belumDraft.map(function (r) { return r.spm_id; }).join(', '));
    }

    var sudahDisplit = lama.some(function (r) { return !!r.induk_spm_id; });
    if (!sudahDisplit) {
      var kunciCount = {};
      lama.forEach(function (r) {
        var k = r.prodi + '|' + r.tingkat + '|' + r.penyedia_id;
        kunciCount[k] = (kunciCount[k] || 0) + 1;
      });
      sudahDisplit = Object.keys(kunciCount).some(function (k) { return kunciCount[k] > 1; });
    }
    if (sudahDisplit) {
      throw _fail_('Ada SPM yang sudah dipecah (spm.split) — gabungkan dulu (spm.gabung) sebelum membuat ulang dari Rekap.');
    }

    var idLama = lama.map(function (r) { return r.spm_id; });
    if (idLama.length) {
      sheetDeleteRows(SHEETS.SPM, 'spm_id', idLama);
      lama.forEach(function (r) { auditLog(session, 'spm.regenerate', 'SPM', r.spm_id, r, null); });
    }
    var baru = _generateSpmDalamKampus_(b.bulan, bayarId, session);
    return { dihapus: idLama.length, dibuat: baru.length, spm: baru };
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 16_tagihan.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
/**
 * 16_tagihan.gs — Piutang gagal debet rekening taruna
 * Status: TERTAGIH → LUNAS | DIHAPUSKAN | ESKALASI_MANUAL
 *
 * ACTION: tagihan.create (Senat, PPK), tagihan.list (semua login),
 *         tagihan.summary (PPK, KPA), tagihan.setor (Senat/Pembina/Admin/PPK),
 *         tagihan.verifikasi (Senat/Pembina/Admin/PPK — verifikasi 1 & 2),
 *         tagihan.waive (PPK), tagihan.teruskan_penyedia (Senat/Pembina/Admin/PPK
 *         — tandai batch LUNAS yang dananya sudah diteruskan ke penyedia,
 *         TERPISAH dari jalur SP2D/SPM)
 *
 * nominal = SNAPSHOT dari REKAP_BULANAN FINAL. tagihan_id = TGH-{yyyymm}-{nit}.
 * Level SP aktif TIDAK disimpan — dibaca MAX(level) dari SURAT_PERINGATAN.
 * tagihan.create LANGSUNG menerbitkan SP-1.
 *
 * Pelunasan verifikasi GANDA (dikonfirmasi Firdaus, direvisi): siapa pun di
 * antara 4 role (Senat/Pembina/Admin/PPK) boleh mengunggah bukti (`tagihan.setor`)
 * MAUPUN memverifikasi (`tagihan.verifikasi`) — bukan alur berurutan per-peran
 * lagi. Syaratnya cuma satu: dua verifikasi harus berasal dari DUA ORANG
 * BERBEDA (user_id), peran boleh sama (mis. dua staf Pembina berbeda orang
 * tetap sah). Verifikator kedua memicu LUNAS + menghapus SP yang tgl_terbit-nya
 * lebih baru dari tgl_setor (taruna sudah bayar sebelum SP itu terbit — SP tak
 * berdasar). Kolom sheet `verif_pembina_oleh` (nama lama) kini menyimpan
 * verifikator PERTAMA generik — lihat docs/skema-sheet.md §10.
 * Setiap aksi tulis → withLock + auditLog + invalidasi cache.
 */

var _CACHE_TAGIHAN_ = 'tagihan_join_v1';

/** Hapus cache daftar tagihan (dipanggil setiap aksi tulis tagihan/SP). */
function _tagihanCacheClear_() {
  CacheService.getScriptCache().remove(_CACHE_TAGIHAN_);
}

/** Ambil tagihan by id atau error. */
function _tagihan_(id) {
  var t = sheetRead(SHEETS.TAGIHAN, function (r) { return String(r.tagihan_id) === String(id); })[0];
  if (!t) throw _fail_('Tagihan tidak ditemukan: ' + id);
  return t;
}

/** Join tagihan + level_aktif/tenggat_aktif dari SURAT_PERINGATAN (cache 60 detik). */
function _tagihanJoin_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(_CACHE_TAGIHAN_);
  if (hit) return JSON.parse(hit);

  var spPerTagihan = {};
  sheetRead(SHEETS.SURAT_PERINGATAN).forEach(function (s) {
    var key = String(s.tagihan_id);
    var lv = Number(s.level) || 0;
    if (!spPerTagihan[key] || lv > spPerTagihan[key].level) {
      spPerTagihan[key] = { level: lv, tenggat: _tglStr_(s.tenggat) };
    }
  });

  var rows = sheetRead(SHEETS.TAGIHAN).map(function (t) {
    var sp = spPerTagihan[String(t.tagihan_id)];
    var bukti = lampiranList('TAGIHAN', t.tagihan_id).filter(function (l) { return l.jenis === 'BUKTI_SETOR'; })[0];
    var nominal = Number(t.nominal) || 0;
    var nilaiTransfer = Number(t.nilai_transfer) || 0;
    return {
      tagihan_id: t.tagihan_id, bulan: _bulanStr_(t.bulan), nit: t.nit,
      nominal: nominal, sebab: t.sebab, status: t.status,
      tgl_setor: _tglStr_(t.tgl_setor), diverifikasi_oleh: t.diverifikasi_oleh,
      catatan_hapus: t.catatan_hapus,
      // Nama kolom sheet `verif_pembina_oleh` legacy — di JSON diekspos generik
      // sebagai verif_1_oleh (verifikator PERTAMA, bisa peran apa saja).
      verif_1_oleh: String(t.verif_pembina_oleh || ''),
      verif_2_oleh: String(t.verif_2_oleh || ''),
      nilai_transfer: nilaiTransfer,
      // Selisih (nominal - nilai_transfer) — DIHITUNG, bukan disimpan. >0 =
      // kurang bayar, dipakai frontend bandingkan dgn kebijakan.toleransiSelisihTransfer
      // dari tagihanList() (lihat getKebijakanTagihan, 00_config.gs).
      selisih_transfer: nominal - nilaiTransfer,
      bukti_setor_drive_file_id: bukti ? bukti.drive_file_id : '',
      level_aktif: sp ? sp.level : 0,
      tenggat_aktif: sp ? sp.tenggat : '',
      // Penerusan dana LUNAS ke penyedia — TERPISAH dari SP2D/SPM (jalur
      // pembayaran utama). Uang tagih-ulang gagal debet ini dikumpulkan di
      // rekening Senat lalu diteruskan manual (biasanya per-batch); kosong =
      // belum diteruskan (lihat tagihan.teruskan_penyedia).
      tgl_diteruskan_penyedia: _tglStr_(t.tgl_diteruskan_penyedia)
    };
  });
  try { cache.put(_CACHE_TAGIHAN_, JSON.stringify(rows), 60); } catch (e) { /* cache >100KB → lewati */ }
  return rows;
}

/**
 * Catat gagal debet batch: {bulan, nit: [], sebab}.
 * Syarat rekap FINAL; nominal snapshot; tolak duplikat; SP-1 langsung terbit.
 */
function tagihanCreate(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var daftar = (payload && payload.nit) || [];
  if (!daftar.length) throw _fail_('nit harus berupa daftar minimal 1 taruna.');
  var sebab = String((payload && payload.sebab) || '');
  if (ENUM.TAGIHAN_SEBAB.indexOf(sebab) < 0) {
    throw _fail_('sebab harus salah satu: ' + ENUM.TAGIHAN_SEBAB.join(' / '));
  }

  var rekap = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  if (!rekap.length) throw _fail_('Belum ada rekap untuk bulan ' + bulan + '.');
  var rekapNit = {};
  rekap.forEach(function (r) {
    // Angka beku HANYA saat FINAL (PPK finalkan, langkah terakhir). DISETUJUI_WADIR3
    // kini langkah AWAL (angka belum beku) → tidak lagi dianggap dasar nominal beku.
    if (r.status !== 'FINAL') {
      throw _fail_('Rekap bulan ' + bulan + ' belum FINAL — tagihan butuh dasar nominal beku (PPK finalkan dulu).');
    }
    rekapNit[String(r.nit)] = r;
  });

  var yyyymm = bulan.replace('-', '');
  var hasil = [];
  daftar.forEach(function (nitRaw) {
    var nit = String(nitRaw).trim();
    var r = rekapNit[nit];
    if (!r) throw _fail_('Taruna ' + nit + ' tidak ada di rekap bulan ' + bulan + '.');
    var id = 'TGH-' + yyyymm + '-' + nit;
    var dobel = sheetRead(SHEETS.TAGIHAN, function (x) { return String(x.tagihan_id) === id; })[0];
    if (dobel) throw _fail_('Tagihan sudah ada: ' + id + ' (duplikat bulan+nit ditolak).');

    var obj = {
      tagihan_id: id, bulan: bulan, nit: nit,
      nominal: _int_(r.nominal, 'nominal'),  // SNAPSHOT dari rekap FINAL
      sebab: sebab, status: 'TERTAGIH',
      tgl_setor: '', diverifikasi_oleh: '', catatan_hapus: ''
    };
    sheetAppend(SHEETS.TAGIHAN, obj);
    auditLog(session, 'tagihan.create', 'TAGIHAN', id, null,
      { bulan: bulan, nit: nit, nominal: obj.nominal, sebab: sebab });

    // SP-1 terbit saat tagihan dicatat (lewati bila sudah ada — aman diulang)
    var adaSp1 = sheetRead(SHEETS.SURAT_PERINGATAN, function (s) {
      return String(s.tagihan_id) === id && Number(s.level) === 1;
    })[0];
    var sp = adaSp1 ? { sp_id: adaSp1.sp_id, no_surat: adaSp1.no_surat }
                    : spTerbitkan(id, 1, session);
    hasil.push({ tagihan_id: id, nominal: obj.nominal, sp1: sp });
  });

  _tagihanCacheClear_();
  return { tagihan: hasil };
}

/**
 * Daftar tagihan + level_aktif + tenggat_aktif + selisih_transfer. Filter
 * {bulan?, status?}. `kebijakan` disertakan supaya frontend bisa menandai
 * tagihan LUNAS dgn selisih_transfer di atas toleransi sebagai piutang
 * kurang bayar (dikonfirmasi Firdaus — lihat getKebijakanTagihan).
 */
function tagihanList(payload, session) {
  var f = payload || {};
  var rows = _tagihanJoin_().filter(function (t) {
    if (f.bulan && t.bulan !== f.bulan) return false;
    if (f.status && t.status !== f.status) return false;
    return true;
  });
  return { tagihan: rows, kebijakan: getKebijakanTagihan() };
}

/**
 * Dashboard piutang: {per_level: {0..3:{jumlah,nominal}}, total_outstanding,
 * belum_disetor, sudah_disetor_menunggu_verifikasi_1, verifikasi_1x,
 * lunas_belum_diteruskan, lunas_sudah_diteruskan, eskalasi_manual,
 * per_bulan: {'YYYY-MM': {ember sama persis di atas}}}.
 *
 * `per_bulan` = status gagal debet dipecah PER BULAN (ember yang sama:
 * berapa lunas/belum lunas, verifikasi 1x, siap diteruskan ke penyedia,
 * sudah diteruskan) — dipakai frontend menampilkan ringkasan mini di tiap
 * grup bulan. Field top-level tetap agregat SEMUA bulan (tak berubah).
 *
 * `per_level` HANYA tagihan TERTAGIH (SP-1/2/3 murni, masih dalam proses SP
 * normal) — TIDAK termasuk ESKALASI_MANUAL (dipisah, lihat di bawah), supaya
 * semantiknya jelas: per_level = masih diproses lewat SP, eskalasi_manual =
 * sudah keluar dari proses SP (penanganan di luar sistem).
 *
 * Tiap tagihan TERTAGIH jatuh ke TEPAT SATU dari tiga bucket berikut
 * (dikonfirmasi Firdaus, urutan tahap):
 * - `belum_disetor` = TERTAGIH, dana BELUM masuk rekening Senat sama sekali
 *   (`tgl_setor` kosong) — tahap PALING AWAL.
 * - `sudah_disetor_menunggu_verifikasi_1` = dana SUDAH MASUK ke rekening
 *   Senat (`tgl_setor` terisi) tapi BELUM disentuh verifikator sama sekali.
 * - `verifikasi_1x` = sudah lolos verifikator PERTAMA, tinggal menunggu
 *   verifikator KEDUA (yang memicu LUNAS).
 * `lunas_belum_diteruskan` = dana taruna yang SUDAH lunas ditagih tapi BELUM
 * diteruskan ke penyedia — inilah angka "utang Poltek ke penyedia" dari
 * jalur tagih-ulang ini (terpisah dari SP2D/SPM), lihat tagihan.teruskan_penyedia.
 * `eskalasi_manual` = tagihan yang sudah lewat tenggat SP-3 dan ditandai
 * `eskalasiTagihan()` (20_trigger.gs) — piutang PALING telat/berisiko,
 * penanganan di luar sistem (sanksi akademik/pemanggilan). Nominalnya TETAP
 * masuk `total_outstanding` (belum lunas) walau dipisah dari `per_level`.
 *
 * Cross-check (dokumentasi, BUKAN assert runtime): karena tiap tagihan
 * TERTAGIH jatuh ke tepat satu dari 3 bucket tahap di atas, dan tiap tagihan
 * ESKALASI_MANUAL jatuh ke `eskalasi_manual` saja, maka SELALU berlaku:
 *   belum_disetor.jumlah + sudah_disetor_menunggu_verifikasi_1.jumlah
 *     + verifikasi_1x.jumlah + eskalasi_manual.jumlah
 *   === per_level[0].jumlah + per_level[1].jumlah + per_level[2].jumlah
 *     + per_level[3].jumlah + eskalasi_manual.jumlah
 * — PPK bisa cross-check jumlah ini tanpa buka daftar detail.
 */
function tagihanSummary(payload, session) {
  // Satu set ember (bucket) kosong — dipakai untuk agregat global MAUPUN
  // tiap bulan, supaya logika pengelompokan tidak diduplikasi.
  function emberKosong() {
    return {
      per_level: { 0: { jumlah: 0, nominal: 0 }, 1: { jumlah: 0, nominal: 0 },
                   2: { jumlah: 0, nominal: 0 }, 3: { jumlah: 0, nominal: 0 } },
      total_outstanding: 0,
      belum_disetor: { jumlah: 0, nominal: 0 },
      sudah_disetor_menunggu_verifikasi_1: { jumlah: 0, nominal: 0 },
      verifikasi_1x: { jumlah: 0, nominal: 0 },
      lunas_belum_diteruskan: { jumlah: 0, nominal: 0 },
      lunas_sudah_diteruskan: { jumlah: 0, nominal: 0 },
      eskalasi_manual: { jumlah: 0, nominal: 0 }
    };
  }
  // Masukkan satu tagihan ke tepat satu ember (lihat dok fungsi di atas).
  function tambah(b, t) {
    if (t.status === 'TERTAGIH') {
      var lv = Math.min(Math.max(t.level_aktif, 0), 3);
      b.per_level[lv].jumlah++; b.per_level[lv].nominal += t.nominal;
      b.total_outstanding += t.nominal;
      if (t.verif_1_oleh) {
        b.verifikasi_1x.jumlah++; b.verifikasi_1x.nominal += t.nominal;
      } else if (t.tgl_setor) {
        b.sudah_disetor_menunggu_verifikasi_1.jumlah++; b.sudah_disetor_menunggu_verifikasi_1.nominal += t.nominal;
      } else {
        b.belum_disetor.jumlah++; b.belum_disetor.nominal += t.nominal;
      }
    } else if (t.status === 'ESKALASI_MANUAL') {
      b.total_outstanding += t.nominal;
      b.eskalasi_manual.jumlah++; b.eskalasi_manual.nominal += t.nominal;
    } else if (t.status === 'LUNAS') {
      var nilai = t.nilai_transfer || t.nominal;
      if (t.tgl_diteruskan_penyedia) { b.lunas_sudah_diteruskan.jumlah++; b.lunas_sudah_diteruskan.nominal += nilai; }
      else { b.lunas_belum_diteruskan.jumlah++; b.lunas_belum_diteruskan.nominal += nilai; }
    }
  }

  var global = emberKosong();
  var perBulan = {}; // { '2026-07': ember, ... } — status gagal debet PER BULAN
  _tagihanJoin_().forEach(function (t) {
    tambah(global, t);
    var bln = _bulanStr_(t.bulan);
    if (!perBulan[bln]) perBulan[bln] = emberKosong();
    tambah(perBulan[bln], t);
  });

  global.per_bulan = perBulan;
  return global;
}

/**
 * tagihan.teruskan_penyedia {tagihan_id_list:[], berkas:{base64,nama_file}}
 * — tandai tagihan LUNAS yang dananya SUDAH diteruskan dari rekening Senat
 * ke penyedia. TERPISAH dari SP2D/SPM (jalur pembayaran utama LS) — ini
 * khusus dana hasil tagih-ulang gagal debet, biasanya diteruskan sekaligus
 * per-batch (mis. akhir bulan). Bukti transfer WAJIB, satu lampiran
 * ditautkan ke entri PERTAMA (pola sama seperti statusBatch,
 * 11_status_harian.gs) — bukan satu bukti per taruna.
 * Role sama seperti aksi tagihan lain (Senat/Pembina/Admin/PPK).
 */
function tagihanTeruskanPenyedia(payload, session) {
  var daftar = (payload && payload.tagihan_id_list) || [];
  if (!daftar.length) throw _fail_('tagihan_id_list wajib diisi minimal 1.');
  if (!payload.berkas || !payload.berkas.base64) throw _fail_('Bukti transfer ke penyedia wajib dilampirkan (berkas.base64).');

  return withLock(function () {
    var baris = daftar.map(function (id) { return _tagihan_(id); });
    var invalid = baris.filter(function (t) {
      return t.status !== 'LUNAS' || _tglStr_(t.tgl_diteruskan_penyedia);
    });
    if (invalid.length) {
      throw _fail_('Hanya tagihan berstatus LUNAS dan belum pernah diteruskan yang bisa dipilih — cek ulang: ' +
        invalid.map(function (t) { return t.tagihan_id; }).join(', '));
    }

    var tgl = _todayStr_();
    var total = 0;
    baris.forEach(function (t) {
      sheetUpdate(SHEETS.TAGIHAN, 'tagihan_id', t.tagihan_id, { tgl_diteruskan_penyedia: tgl });
      auditLog(session, 'tagihan.teruskan_penyedia', 'TAGIHAN', t.tagihan_id,
        { tgl_diteruskan_penyedia: '' }, { tgl_diteruskan_penyedia: tgl });
      total += Number(t.nilai_transfer) || Number(t.nominal) || 0;
    });
    lampiranSave(session, 'TAGIHAN', baris[0].tagihan_id, 'BUKTI_TERUSKAN_PENYEDIA',
      payload.berkas.base64, payload.berkas.nama_file || ('teruskan-penyedia-' + tgl + '.jpg'));
    _tagihanCacheClear_();
    return { jml_diteruskan: baris.length, total_nominal: total, tgl_diteruskan_penyedia: tgl };
  });
}

/**
 * Lapor setoran/transfer ke rekening Senat: {tagihan_id, tgl_setor, berkas}
 * — bukti (screenshot/foto transfer) WAJIB, status tetap TERTAGIH. Role
 * SENAT/PEMBINA/ADMIN/PPK (dikonfirmasi Firdaus — keempatnya boleh unggah).
 */
function tagihanSetor(payload, session) {
  var t = _tagihan_(payload && payload.tagihan_id);
  if (t.status !== 'TERTAGIH') throw _fail_('Tagihan berstatus ' + t.status + ', tidak menerima setoran.');
  var tgl = _wajibTgl_(payload && payload.tgl_setor, 'tgl_setor');
  if (!payload.berkas || !payload.berkas.base64) throw _fail_('Bukti setor wajib dilampirkan (berkas.base64).');

  lampiranSave(session, 'TAGIHAN', t.tagihan_id, 'BUKTI_SETOR',
    payload.berkas.base64, payload.berkas.nama_file || ('setor-' + t.tagihan_id + '.jpg'));
  sheetUpdate(SHEETS.TAGIHAN, 'tagihan_id', t.tagihan_id, { tgl_setor: tgl });
  auditLog(session, 'tagihan.setor', 'TAGIHAN', t.tagihan_id, null, { tgl_setor: tgl });
  _tagihanCacheClear_();
  return { tagihan_id: t.tagihan_id, tgl_setor: tgl, status: 'TERTAGIH' };
}

/**
 * Verifikasi pelunasan {tagihan_id, nilai_transfer} — siapa pun di antara
 * SENAT/PEMBINA/ADMIN/PPK (dikonfirmasi Firdaus, direvisi dari alur
 * berurutan Pembina→PPK/Admin: sekarang peran bebas, yang wajib cuma DUA
 * ORANG BERBEDA — dua staf Pembina berlainan orang pun sah). Tanda sudah
 * diverifikasi ADALAH memasukkan `nilai_transfer` (nominal yang ia lihat
 * BENAR-BENAR masuk ke rekening Senat, dibaca dari mutasi bank).
 *
 * `nilai_transfer` TIDAK WAJIB sama dengan `nominal` tagihan (dikonfirmasi
 * Firdaus, direvisi dari validasi ketat sebelumnya) — dunia nyata sering beda
 * (potongan biaya transfer antarbank, taruna kurang bayar, dst). `nominal`
 * tagihan (snapshot REKAP_BULANAN FINAL) TETAP TIDAK BERUBAH untuk keperluan
 * pelaporan; `nilai_transfer` cuma mencatat realisasi transfer sesungguhnya
 * — selisihnya tetap terlihat di data untuk rekonsiliasi, TIDAK memblokir
 * pelunasan. Satu-satunya syarat nilai: harus > 0 (bilangan bulat).
 *
 * Selisih (nominal - nilai_transfer) di ATAS `getKebijakanTagihan().
 * toleransiSelisihTransfer` (default Rp20.000, dikonfirmasi Firdaus) TETAP
 * memicu LUNAS seperti biasa, TAPI dicatat sebagai `piutang_kurang_bayar` di
 * AUDIT_LOG saat verifikasi kedua — jejak utk PPK menagih sisanya pada
 * pendebetan bulan berikutnya (proses tagih ulang tetap manual via
 * `tagihan.create` bulan depan, TIDAK otomatis — nominal tagihan baru wajib
 * berbasis REKAP_BULANAN FINAL bulan itu, yang belum ada saat ini).
 *
 * Verifikasi PERTAMA: catat sebagai verifikator 1 — kolom sheet lama
 * `verif_pembina_oleh` kini generik (lihat docs/skema-sheet.md §10), status
 * TETAP TERTAGIH. Verifikasi KEDUA — user_id WAJIB beda dari verifikator
 * pertama — memicu LUNAS.
 *
 * Efek samping WAJIB saat LUNAS: SP mana pun milik tagihan ini yang
 * `tgl_terbit` LEBIH BARU dari `tgl_setor` (taruna sudah bayar SEBELUM SP
 * itu terbit → SP jadi tak berdasar) DIHAPUS dari SURAT_PERINGATAN (bukan
 * cuma diabaikan), supaya riwayat SP tidak menyesatkan. SP yang terbit
 * PADA/SEBELUM tgl_setor tetap dipertahankan (riwayat sah, taruna memang telat).
 */
function tagihanVerifikasi(payload, session) {
  var t = _tagihan_(payload && payload.tagihan_id);
  if (t.status !== 'TERTAGIH') throw _fail_('Tagihan berstatus ' + t.status + ', tidak bisa diverifikasi.');
  var bukti = lampiranList('TAGIHAN', t.tagihan_id).filter(function (l) { return l.jenis === 'BUKTI_SETOR'; });
  if (!bukti.length) throw _fail_('Belum ada bukti setor — verifikasi ditolak.');

  var nilai = _int_(payload && payload.nilai_transfer, 'nilai_transfer');
  if (nilai <= 0) throw _fail_('Nilai transferan harus lebih dari 0.');

  var v1 = String(t.verif_pembina_oleh || '').trim();
  if (!v1) {
    sheetUpdate(SHEETS.TAGIHAN, 'tagihan_id', t.tagihan_id,
      { verif_pembina_oleh: session.user_id, nilai_transfer: nilai });
    auditLog(session, 'tagihan.verifikasi', 'TAGIHAN', t.tagihan_id,
      { verif_1_oleh: '' }, { verif_1_oleh: session.user_id, nilai_transfer: nilai });
    _tagihanCacheClear_();
    return { tagihan_id: t.tagihan_id, status: 'TERTAGIH', verif_ke: 1, verif_1_oleh: session.user_id };
  }
  if (v1 === session.user_id) {
    throw _fail_('Anda sudah memverifikasi tagihan ini sebagai verifikator pertama — perlu orang KEDUA yang berbeda untuk memicu LUNAS.');
  }

  sheetUpdate(SHEETS.TAGIHAN, 'tagihan_id', t.tagihan_id,
    { verif_2_oleh: session.user_id, nilai_transfer: nilai, status: 'LUNAS', diverifikasi_oleh: session.user_id });

  var idHapus = [];
  var tglBayar = _tglStr_(t.tgl_setor);
  if (tglBayar) {
    var spSemua = sheetRead(SHEETS.SURAT_PERINGATAN, function (s) { return String(s.tagihan_id) === String(t.tagihan_id); });
    idHapus = spSemua.filter(function (s) { return _tglStr_(s.tgl_terbit) > tglBayar; }).map(function (s) { return s.sp_id; });
    if (idHapus.length) sheetDeleteRows(SHEETS.SURAT_PERINGATAN, 'sp_id', idHapus);
  }

  // Selisih (kurang bayar) di atas toleransi → catat di AUDIT_LOG sebagai jejak
  // piutang yang perlu ditagihkan lagi pada pendebetan bulan depan (dikonfirmasi
  // Firdaus) — TIDAK memblokir LUNAS, cuma jejak; nilai aktualnya tetap terbaca
  // dari selisih_transfer (nominal - nilai_transfer) di tagihan.list.
  var selisih = Number(t.nominal) - nilai;
  var piutangKurang = selisih > getKebijakanTagihan().toleransiSelisihTransfer ? selisih : 0;

  auditLog(session, 'tagihan.verifikasi', 'TAGIHAN', t.tagihan_id,
    { status: t.status },
    { status: 'LUNAS', verif_2_oleh: session.user_id, sp_dihapus: idHapus, piutang_kurang_bayar: piutangKurang });
  _tagihanCacheClear_();
  return {
    tagihan_id: t.tagihan_id, status: 'LUNAS', verif_ke: 2, verif_2_oleh: session.user_id,
    sp_dihapus: idHapus, piutang_kurang_bayar: piutangKurang
  };
}

/**
 * tagihan.status_debet {bulan} — laporan status debet taruna→Senat PER
 * TARUNA, READ-ONLY. Membandingkan seluruh taruna ber-REKAP nominal>0
 * bulan itu (dasar permohonan debet, sama seperti cetakForm07) dengan
 * baris TAGIHAN bulan yang sama.
 *
 * Taruna TANPA baris TAGIHAN → `BERHASIL` — ini INFERENSI (absennya
 * kegagalan tercatat), BUKAN konfirmasi positif dari bank; sistem memang
 * tidak punya integrasi bank utk mengonfirmasi sukses secara aktif (lihat
 * catatan modul). Taruna BER-TAGIHAN → `GAGAL`, apa pun status
 * penyelesaiannya (`status_tagihan`: TERTAGIH/LUNAS/DIHAPUSKAN/
 * ESKALASI_MANUAL tetap dihitung "gagal debet awal" — penyelesaiannya
 * ditampilkan terpisah, tidak mengubah status_debet jadi BERHASIL lagi).
 */
function tagihanStatusDebet(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');

  var rekap = sheetRead(SHEETS.REKAP_BULANAN, function (r) {
    return _bulanStr_(r.bulan) === bulan && _int_(r.nominal || 0, 'nominal') > 0;
  });
  if (!rekap.length) throw _fail_('Belum ada rekap bernominal untuk bulan ' + bulan + '.');

  var tarunaByNit = {};
  sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });

  var tagihanByNit = {};
  _tagihanJoin_().filter(function (t) { return t.bulan === bulan; })
    .forEach(function (t) { tagihanByNit[String(t.nit)] = t; });

  var baris = rekap.map(function (r) {
    var nit = String(r.nit);
    var t = tarunaByNit[nit] || {};
    var tg = tagihanByNit[nit];
    return {
      nit: nit, nama: t.nama || '', prodi: t.prodi || '', tingkat: t.tingkat || '',
      nominal: _int_(r.nominal, 'nominal'),
      status_debet: tg ? 'GAGAL' : 'BERHASIL',
      tagihan_id: tg ? tg.tagihan_id : '',
      sebab: tg ? tg.sebab : '',
      status_tagihan: tg ? tg.status : ''
    };
  }).sort(function (a, b) {
    return (a.prodi || '').localeCompare(b.prodi || '') || (a.tingkat || '').localeCompare(b.tingkat || '') ||
      (a.nama || '').localeCompare(b.nama || '');
  });

  var jmlGagal = baris.filter(function (b) { return b.status_debet === 'GAGAL'; }).length;
  return {
    bulan: bulan, baris: baris,
    total_taruna: baris.length, jml_berhasil: baris.length - jmlGagal, jml_gagal: jmlGagal
  };
}

/** PPK hapus tagihan: catatan_hapus WAJIB → DIHAPUSKAN. */
function tagihanWaive(payload, session) {
  var t = _tagihan_(payload && payload.tagihan_id);
  if (t.status !== 'TERTAGIH') throw _fail_('Tagihan berstatus ' + t.status + ', tidak bisa dihapuskan.');
  var catatan = String((payload && payload.catatan_hapus) || '').trim();
  if (!catatan) throw _fail_('catatan_hapus WAJIB diisi untuk penghapusan tagihan.');

  sheetUpdate(SHEETS.TAGIHAN, 'tagihan_id', t.tagihan_id,
    { status: 'DIHAPUSKAN', catatan_hapus: catatan });
  auditLog(session, 'tagihan.waive', 'TAGIHAN', t.tagihan_id,
    { status: t.status }, { status: 'DIHAPUSKAN', catatan_hapus: catatan });
  _tagihanCacheClear_();
  return { tagihan_id: t.tagihan_id, status: 'DIHAPUSKAN' };
}

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 17_surat_peringatan.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
/**
 * 17_surat_peringatan.gs — Surat Peringatan SP-1/2/3 + generate PDF
 *
 * Kebijakan (tenggat, penandatangan) via getKebijakanSP() — DILARANG baca CONFIG langsung.
 * No surat: B-{urut}/PKPS/SP{level}/{bulan-romawi}/{tahun} — counter per level, tak pernah mundur.
 * PDF: copy template Doc (TPL_SP1/2/3 di Script Properties) → replace placeholder →
 *      export PDF ke FOLDER_SP → hapus copy → append SURAT_PERINGATAN + LAMPIRAN + AUDIT_LOG.
 *
 * ACTION: sp.list (semua login), tagihan.regenerate_sp (PPK)
 * INTERNAL: spTerbitkan(tagihanId, level, session|null)
 * SEKALI JALAN: buatTemplateSP() — buat 3 Doc template + simpan ID ke properties.
 */

var _BULAN_ID_ = ['Januari','Februari','Maret','April','Mei','Juni',
                  'Juli','Agustus','September','Oktober','November','Desember'];
var _ROMAWI_ = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];

/** Format 'Rp1.234.567'. */
function _rupiah_(n) {
  return 'Rp' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** '2026-07' → 'Juli 2026'; '2026-07-04' → '4 Juli 2026'. */
function _tglIndo_(s) {
  var t = _tglStr_(s);
  var p = t.split('-');
  if (p.length === 2) return _BULAN_ID_[Number(p[1]) - 1] + ' ' + p[0];
  return Number(p[2]) + ' ' + _BULAN_ID_[Number(p[1]) - 1] + ' ' + p[0];
}

/** Terbilang bilangan bulat Bahasa Indonesia (tanpa 'rupiah'). */
function terbilang(n) {
  n = Math.floor(Number(n) || 0);
  if (n === 0) return 'nol';
  var satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  function t(x) {
    if (x < 12) return satuan[x];
    if (x < 20) return t(x - 10) + ' belas';
    if (x < 100) return t(Math.floor(x / 10)) + ' puluh' + (x % 10 ? ' ' + t(x % 10) : '');
    if (x < 200) return 'seratus' + (x % 100 ? ' ' + t(x % 100) : '');
    if (x < 1000) return t(Math.floor(x / 100)) + ' ratus' + (x % 100 ? ' ' + t(x % 100) : '');
    if (x < 2000) return 'seribu' + (x % 1000 ? ' ' + t(x % 1000) : '');
    if (x < 1000000) return t(Math.floor(x / 1000)) + ' ribu' + (x % 1000 ? ' ' + t(x % 1000) : '');
    if (x < 1000000000) return t(Math.floor(x / 1000000)) + ' juta' + (x % 1000000 ? ' ' + t(x % 1000000) : '');
    return t(Math.floor(x / 1000000000)) + ' miliar' + (x % 1000000000 ? ' ' + t(x % 1000000000) : '');
  }
  return t(n);
}

/** Terbilang rupiah: 1234567 → 'satu juta dua ratus ... enam puluh tujuh rupiah'. */
function terbilangRupiah(n) { return terbilang(n) + ' rupiah'; }

/** Nomor surat: B-{urut}/PKPS/SP{level}/{romawi}/{tahun}. Counter per level. */
function _noSuratSP_(level) {
  var raw = nextId('NOSP' + level);                 // NOSP1-000007
  var urut = parseInt(raw.split('-')[1], 10);
  var now = new Date();
  var romawi = _ROMAWI_[now.getMonth()];
  return 'B-' + urut + '/PKPS/SP' + level + '/' + romawi + '/' + now.getFullYear();
}

/** Ganti satu placeholder {{KEY}} di body Doc. */
function _ganti_(body, key, val) {
  body.replaceText('\\{\\{' + key + '\\}\\}', String(val));
}

/**
 * Terbitkan SP level 1/2/3 untuk sebuah tagihan.
 * session null → generated_by SISTEM (trigger); selain itu MANUAL dicatat user.
 * Mengembalikan {sp_id, no_surat, tenggat, drive_file_id}.
 */
function spTerbitkan(tagihanId, level, session) {
  level = Number(level);
  if ([1, 2, 3].indexOf(level) < 0) throw _fail_('Level SP harus 1, 2, atau 3.');
  var t = _tagihan_(tagihanId);
  var taruna = sheetRead(SHEETS.TARUNA, function (r) { return String(r.nit) === String(t.nit); })[0];
  if (!taruna) throw _fail_('Taruna tidak ditemukan: ' + t.nit);

  var sp = getKebijakanSP();
  var p = PropertiesService.getScriptProperties();
  var tplId = p.getProperty('TPL_SP' + level);
  if (!tplId) throw _fail_('Template SP' + level + ' belum ada. Jalankan buatTemplateSP() sekali dari editor.');
  var folderSpId = p.getProperty('FOLDER_SP');
  if (!folderSpId) throw _fail_('FOLDER_SP belum ada. Jalankan setupFolderDrive().');

  var rolePenandatangan = sp.PENANDATANGAN[String(level)];     // 'PPK' | 'KPA'
  var pejabat = PEJABAT[rolePenandatangan];
  var noSurat = _noSuratSP_(level);
  var today = _todayStr_();
  var tenggat = _tglStr_(new Date(Date.now() + Number(sp.TENGGAT_HARI[String(level)]) * 86400000));
  var rekSenat = p.getProperty('REK_SENAT') || '(nomor rekening Senat — set Script Property REK_SENAT)';

  // ── Generate PDF dari template ────────────────────────────────────────────
  var namaFile = 'SP' + level + '_' + t.tagihan_id + '_' + today;
  var copy = DriveApp.getFileById(tplId).makeCopy(namaFile);
  var doc = DocumentApp.openById(copy.getId());
  var body = doc.getBody();
  _ganti_(body, 'NO_SURAT', noSurat);
  _ganti_(body, 'TGL_SURAT', _tglIndo_(today));
  _ganti_(body, 'NAMA', taruna.nama);
  _ganti_(body, 'NIT', taruna.nit);
  _ganti_(body, 'PRODI_TINGKAT', taruna.prodi + ' Tingkat ' + taruna.tingkat);
  _ganti_(body, 'BULAN', _tglIndo_(String(t.bulan)));
  _ganti_(body, 'NOMINAL', _rupiah_(t.nominal));
  _ganti_(body, 'NOMINAL_TERBILANG', terbilangRupiah(t.nominal));
  _ganti_(body, 'REK_SENAT', rekSenat);
  _ganti_(body, 'TENGGAT', _tglIndo_(tenggat));
  _ganti_(body, 'PENANDATANGAN_NAMA', pejabat.nama);
  _ganti_(body, 'PENANDATANGAN_NIP', pejabat.nip);
  doc.saveAndClose();

  var pdf = DriveApp.getFolderById(folderSpId)
    .createFile(copy.getAs('application/pdf')).setName(namaFile + '.pdf');
  copy.setTrashed(true); // hapus copy Doc, simpan PDF saja

  // ── Catat SURAT_PERINGATAN (append-only) + LAMPIRAN + AUDIT ───────────────
  var spId = nextId('SP');
  var generatedBy = session ? 'MANUAL' : 'SISTEM';
  sheetAppend(SHEETS.SURAT_PERINGATAN, {
    sp_id: spId, tagihan_id: t.tagihan_id, level: level, no_surat: noSurat,
    tgl_terbit: today, tenggat: tenggat,
    ditandatangani_oleh: rolePenandatangan, generated_by: generatedBy
  });
  sheetAppend(SHEETS.LAMPIRAN, {
    lamp_id: nextId('LMP'), ref_type: 'SP', ref_id: spId, jenis: 'SURAT',
    drive_file_id: pdf.getId(), nama_file: namaFile + '.pdf',
    uploaded_by: session ? session.user_id : 'SISTEM', timestamp: new Date()
  });
  auditLog(session, 'sp.terbit', 'SP', spId, null, {
    tagihan_id: t.tagihan_id, level: level, no_surat: noSurat,
    tenggat: tenggat, generated_by: generatedBy
  });
  _tagihanCacheClear_();
  return { sp_id: spId, no_surat: noSurat, tenggat: tenggat, drive_file_id: pdf.getId() };
}

/** Riwayat SP per tagihan (+ link PDF). */
function spList(payload, session) {
  var id = String((payload && payload.tagihan_id) || '').trim();
  if (!id) throw _fail_('tagihan_id wajib diisi.');
  var rows = sheetRead(SHEETS.SURAT_PERINGATAN, function (s) { return String(s.tagihan_id) === id; });
  rows.forEach(function (s) {
    s.tgl_terbit = _tglStr_(s.tgl_terbit);
    s.tenggat = _tglStr_(s.tenggat);
    var pdf = lampiranList('SP', s.sp_id)[0];
    s.drive_file_id = pdf ? pdf.drive_file_id : '';
  });
  return { sp: rows };
}

/** PPK: terbitkan ulang PDF level aktif — no_surat BARU, baris baru, MANUAL. */
function tagihanRegenerateSp(payload, session) {
  var t = _tagihan_(payload && payload.tagihan_id);
  var maxLevel = 0;
  sheetRead(SHEETS.SURAT_PERINGATAN, function (s) { return String(s.tagihan_id) === String(t.tagihan_id); })
    .forEach(function (s) { if (Number(s.level) > maxLevel) maxLevel = Number(s.level); });
  if (!maxLevel) throw _fail_('Tagihan ini belum punya SP — tidak ada yang bisa diterbitkan ulang.');
  var hasil = spTerbitkan(t.tagihan_id, maxLevel, session);
  return { sp: hasil, level: maxLevel };
}

/**
 * sp.cetak_massal {bulan?} — data untuk CETAK MASSAL surat SP-1 di aplikasi
 * (halaman React /cetak/sp1), READ-ONLY. Mengumpulkan tagihan TERTAGIH yang
 * level aktifnya masih SP-1, memakai NOMOR SURAT SP-1 yang SUDAH terbit di
 * SURAT_PERINGATAN (TIDAK membuat nomor baru — beda dari tagihan.regenerate_sp).
 * Frontend memfilter di layar (belum setor / semua) & mencetak sekaligus.
 * Surat SP hanya memuat nominal + rekening Senat (BUKAN rekening taruna), jadi
 * tanpa audit khusus & boleh di-cache (beda dari Form-07/08/10). Bila `bulan`
 * diisi, hanya bulan itu; kosong = semua bulan. Roles: PPK/STAF_PPK/ADMIN.
 */
function spCetakMassal(payload, session) {
  var bulanFilter = payload && payload.bulan ? _bulanStr_(payload.bulan) : '';

  // SP-1 per tagihan — kalau pernah diterbitkan ulang, ambil yang tgl_terbit
  // paling baru (no_surat terbaru yang sah).
  var sp1ByTagihan = {};
  sheetRead(SHEETS.SURAT_PERINGATAN, function (s) { return Number(s.level) === 1; })
    .forEach(function (s) {
      var id = String(s.tagihan_id);
      var tgl = _tglStr_(s.tgl_terbit);
      var ada = sp1ByTagihan[id];
      if (!ada || tgl >= ada.tgl_terbit) {
        sp1ByTagihan[id] = { no_surat: s.no_surat, tgl_terbit: tgl, tenggat: _tglStr_(s.tenggat) };
      }
    });

  var tarunaByNit = {};
  sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });

  var daftar = [];
  _tagihanJoin_().forEach(function (t) {
    if (t.status !== 'TERTAGIH' || t.level_aktif !== 1) return;   // hanya yg masih SP-1
    if (bulanFilter && t.bulan !== bulanFilter) return;
    var sp = sp1ByTagihan[String(t.tagihan_id)];
    if (!sp) return;                                              // belum ada SP-1 tercatat
    var tr = tarunaByNit[String(t.nit)] || {};
    daftar.push({
      nit: String(t.nit), nama: tr.nama || '', prodi: tr.prodi || '', tingkat: tr.tingkat || '',
      bulan: t.bulan, nominal: t.nominal,
      no_surat: sp.no_surat, tgl_terbit: sp.tgl_terbit, tenggat: sp.tenggat,
      sudah_setor: !!t.tgl_setor
    });
  });

  daftar.sort(function (a, b) {
    return (a.prodi || '').localeCompare(b.prodi || '') ||
           (a.tingkat || '').localeCompare(b.tingkat || '') ||
           (a.nama || '').localeCompare(b.nama || '');
  });

  var kb = getKebijakanSP();
  var pej = PEJABAT[kb.PENANDATANGAN['1']] || PEJABAT.PPK;
  var rekSenat = PropertiesService.getScriptProperties().getProperty('REK_SENAT') ||
    '(nomor rekening Senat — set Script Property REK_SENAT)';

  return {
    bulan_filter: bulanFilter,
    rek_senat: rekSenat,
    penandatangan: { nama: pej.nama, nip: pej.nip },
    daftar: daftar
  };
}

/**
 * SEKALI JALAN dari editor: buat 3 Google Doc template SP di FOLDER_TEMPLATE
 * berisi struktur surat + seluruh placeholder. Kop & redaksi dirapikan manual
 * oleh Firdaus di Doc — kop mengikuti tata naskah satker.
 * Idempotent: template yang sudah ada tidak dibuat ulang.
 */
function buatTemplateSP() {
  var p = PropertiesService.getScriptProperties();
  var folderId = p.getProperty('FOLDER_TEMPLATE');
  if (!folderId) throw new Error('FOLDER_TEMPLATE belum ada. Jalankan setupFolderDrive() dulu.');
  var folder = DriveApp.getFolderById(folderId);

  var judulLevel = {
    1: 'SURAT PERINGATAN PERTAMA (SP-1)',
    2: 'SURAT PERINGATAN KEDUA (SP-2)',
    3: 'SURAT PERINGATAN KETIGA (SP-3)'
  };

  [1, 2, 3].forEach(function (lv) {
    var key = 'TPL_SP' + lv;
    var adaId = p.getProperty(key);
    if (adaId) {
      try { DriveApp.getFileById(adaId); Logger.log(key + ' sudah ada, dilewati.'); return; }
      catch (e) { /* file terhapus → buat ulang */ }
    }
    var doc = DocumentApp.create('TEMPLATE_SP' + lv + '_e-BAMA');
    var body = doc.getBody();
    body.appendParagraph('[KOP SURAT SATKER — rapikan sesuai tata naskah]')
      .setHeading(DocumentApp.ParagraphHeading.NORMAL);
    body.appendParagraph('');
    body.appendParagraph(judulLevel[lv]).setHeading(DocumentApp.ParagraphHeading.HEADING2)
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    body.appendParagraph('Nomor: {{NO_SURAT}}').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    body.appendParagraph('');
    body.appendParagraph('Sorong, {{TGL_SURAT}}');
    body.appendParagraph('');
    body.appendParagraph('Kepada Yth.');
    body.appendParagraph('{{NAMA}} (NIT {{NIT}})');
    body.appendParagraph('{{PRODI_TINGKAT}}');
    body.appendParagraph('di tempat');
    body.appendParagraph('');
    body.appendParagraph('Berdasarkan hasil pemantauan pembayaran Bantuan Uang Makan (BAMA) ' +
      'bulan {{BULAN}}, tercatat kewajiban Saudara yang belum terselesaikan (gagal auto-debet) ' +
      'sebesar {{NOMINAL}} ({{NOMINAL_TERBILANG}}).');
    body.appendParagraph('');
    body.appendParagraph('Sehubungan dengan itu, Saudara diminta menyetorkan kewajiban tersebut ke ' +
      'rekening Senat {{REK_SENAT}} selambat-lambatnya tanggal {{TENGGAT}}.' +
      (lv === 3 ? ' Apabila hingga tenggat tersebut tidak diselesaikan, penanganan dilanjutkan ' +
      'di luar sistem sesuai ketentuan (sanksi akademik / pemanggilan).' : ''));
    body.appendParagraph('');
    body.appendParagraph('Demikian surat peringatan ini disampaikan untuk dilaksanakan.');
    body.appendParagraph('');
    body.appendParagraph('{{PENANDATANGAN_NAMA}}').setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
    body.appendParagraph('NIP {{PENANDATANGAN_NIP}}').setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
    doc.saveAndClose();

    // Pindahkan ke FOLDER_TEMPLATE
    var file = DriveApp.getFileById(doc.getId());
    file.moveTo(folder);
    p.setProperty(key, doc.getId());
    Logger.log(key + ' dibuat: ' + doc.getId());
  });
  Logger.log('buatTemplateSP() selesai — rapikan kop & redaksi langsung di Doc.');
}

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 18_laporan.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
/**
 * 18_laporan.gs — Laporan bulanan (SOP 17–19) & Audit Log
 *
 * ACTION: laporan.bulanan (PPK, KPA), laporan.resmi (PPK, KPA, WADIR3),
 *         audit.list (Admin, PPK, KPA)
 */

/** Ringkasan satu bulan: rekap + realisasi + pembayaran + piutang. */
function laporanBulanan(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');

  var rekap = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  var totalHariMakan = 0, totalNominal = 0, statusRekap = rekap.length ? rekap[0].status : '';
  rekap.forEach(function (r) {
    totalHariMakan += Number(r.hari_makan) || 0;
    totalNominal += Number(r.nominal) || 0;
    if (r.status !== statusRekap) statusRekap = 'CAMPURAN';
  });

  var realisasi = sheetRead(SHEETS.REALISASI, function (r) { return _bulanStr_(r.tanggal) === bulan; });
  var hariSah = {}, jmlKetidaksesuaian = 0;
  realisasi.forEach(function (r) {
    if (r.ttd_pembina_at && r.ttd_senat_at) hariSah[_tglStr_(r.tanggal)] = true;
    if (r.ketidaksesuaian) jmlKetidaksesuaian++;
  });

  // _bulanStr_ (bukan String() polos) — kolom bulan bisa auto-tertafsir Date
  // oleh Google Sheets (lihat catatan sama di 23_sp2d.gs/15_pembayaran.gs).
  var bayar = sheetRead(SHEETS.PEMBAYARAN, function (r) { return _bulanStr_(r.bulan) === bulan; })[0] || null;

  var tagihan = sheetRead(SHEETS.TAGIHAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  var perStatus = {};
  var totalOutstanding = 0;
  tagihan.forEach(function (t) {
    perStatus[t.status] = (perStatus[t.status] || 0) + 1;
    if (t.status === 'TERTAGIH') totalOutstanding += Number(t.nominal) || 0;
  });

  return {
    bulan: bulan,
    rekap: { jml_taruna: rekap.length, total_hari_makan: totalHariMakan, total_nominal: totalNominal, status: statusRekap },
    realisasi: { jml_hari_sah: Object.keys(hariSah).length, jml_ketidaksesuaian: jmlKetidaksesuaian, jml_catatan: realisasi.length },
    pembayaran: bayar ? {
      bayar_id: bayar.bayar_id, status: bayar.status, nilai_total: Number(bayar.nilai_total) || 0,
      no_spm: bayar.no_spm, no_sp2d: bayar.no_sp2d
    } : null,
    tagihan: { jumlah: tagihan.length, per_status: perStatus, total_outstanding: totalOutstanding }
  };
}

/**
 * laporan.resmi (PPK, KPA, WADIR3) — data untuk format "Laporan Bulanan
 * Pemantauan dan Evaluasi Bantuan Biaya Makan" resmi (acuan Itjen/KKP).
 * Hanya mencakup bagian DALAM KAMPUS yang datanya sudah dilacak e-BAMA —
 * bagian Luar Kampus/Pengusulan/DIPA-SK tidak ada di sini, diisi manual
 * di halaman cetak (lihat frontend pages/laporan/laporan-resmi.tsx).
 */
function laporanResmi(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var awal = bulan + '-01', akhir = bulan + '-31';

  var tarunaByNit = {};
  var jmlAktif = 0;
  sheetRead(SHEETS.TARUNA).forEach(function (t) {
    tarunaByNit[String(t.nit)] = t;
    if (t.status === 'AKTIF') jmlAktif++;
  });

  var kontrakBulan = sheetRead(SHEETS.KONTRAK, function (r) {
    return r.status === 'DISETUJUI_PPK' && _tglStr_(r.tgl_mulai) <= akhir && _tglStr_(r.tgl_akhir) >= awal;
  })[0] || null;

  var rekap = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  var penerima = rekap.map(function (r) {
    var t = tarunaByNit[String(r.nit)] || {};
    var hariMakan = _int_(r.hari_makan || 0, 'hari_makan');
    var nominal = _int_(r.nominal || 0, 'nominal');
    return {
      nit: String(r.nit), nama: t.nama || '', prodi: t.prodi || '', status: t.status || '',
      rek_mask: t.rek_mask || '', hari_makan: hariMakan, nominal: nominal,
      per_hari: hariMakan ? Math.round(nominal / hariMakan) : 0
    };
  });
  var totalHariMakan = 0, totalNominal = 0;
  penerima.forEach(function (p) { totalHariMakan += p.hari_makan; totalNominal += p.nominal; });

  var realisasi = sheetRead(SHEETS.REALISASI, function (r) { return _bulanStr_(r.tanggal) === bulan; });
  var hariSah = {};
  var ketidaksesuaian = [];
  realisasi.forEach(function (r) {
    if (r.ttd_pembina_at && r.ttd_senat_at) hariSah[_tglStr_(r.tanggal)] = true;
    if (r.ketidaksesuaian) {
      ketidaksesuaian.push({ tanggal: _tglStr_(r.tanggal), catatan: r.ketidaksesuaian, tindak_lanjut: r.tindak_lanjut });
    }
  });

  var pesanan = sheetRead(SHEETS.PESANAN, function (r) { return _bulanStr_(r.tgl_makan) === bulan; });
  var porsiDipesan = 0;
  pesanan.forEach(function (p) { porsiDipesan += _int_(p.jml_taruna || 0, 'jml_taruna'); });
  var porsiTerealisasi = 0;
  realisasi.forEach(function (r) { porsiTerealisasi += _int_(r.porsi_diterima || 0, 'porsi_diterima'); });

  // _bulanStr_ (bukan String() polos) — lihat catatan sama di atas.
  var bayar = sheetRead(SHEETS.PEMBAYARAN, function (r) { return _bulanStr_(r.bulan) === bulan; })[0] || null;
  var tagihan = sheetRead(SHEETS.TAGIHAN, function (r) { return _bulanStr_(r.bulan) === bulan; });

  return {
    bulan: bulan,
    jml_taruna_aktif: jmlAktif,
    kontrak: kontrakBulan ? {
      kontrak_id: kontrakBulan.kontrak_id,
      harga_per_porsi: _int_(kontrakBulan.harga_per_porsi, 'harga_per_porsi'),
      porsi_per_hari: _int_(kontrakBulan.porsi_per_hari, 'porsi_per_hari'),
      harga_per_hari_efektif: _hargaPerHariKontrak_(kontrakBulan)
    } : null,
    penerima: penerima,
    total_hari_makan: totalHariMakan,
    total_nominal: totalNominal,
    jml_hari_efektif: Object.keys(hariSah).length,
    porsi_dipesan: porsiDipesan,
    porsi_terealisasi: porsiTerealisasi,
    ketidaksesuaian: ketidaksesuaian,
    pembayaran: bayar,
    jml_gagal_transfer: tagihan.length,
    pejabat: PEJABAT
  };
}

/** Daftar AUDIT_LOG, filter {dari?, sampai?, user_id?, aksi?}. Dibatasi 500 baris terbaru. */
function auditList(payload, session) {
  var f = payload || {};
  var rows = sheetRead(SHEETS.AUDIT_LOG, function (r) {
    var t = (r.timestamp instanceof Date)
      ? Utilities.formatDate(r.timestamp, Session.getScriptTimeZone(), 'yyyy-MM-dd')
      : String(r.timestamp).slice(0, 10);
    if (f.dari && t < f.dari) return false;
    if (f.sampai && t > f.sampai) return false;
    if (f.user_id && String(r.user_id) !== String(f.user_id)) return false;
    if (f.aksi && String(r.aksi).indexOf(f.aksi) < 0) return false;
    return true;
  });
  rows.forEach(function (r) {
    r.timestamp = (r.timestamp instanceof Date)
      ? Utilities.formatDate(r.timestamp, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
      : String(r.timestamp);
  });
  rows.sort(function (a, b) { return b.timestamp.localeCompare(a.timestamp); });
  return { log: rows.slice(0, 500) };
}

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 19_bantuan_luar_kampus.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
/**
 * 19_bantuan_luar_kampus.gs — Bantuan biaya makan tunai untuk taruna PKL/
 * Magang/KPA/PTB di luar kampus (mekanisme berbeda dari Dalam Kampus — bukan
 * lewat kontrak penyedia, transfer tunai langsung, rate BISA beda per
 * individu per wilayah penempatan).
 *
 * ACTION: blk.list (PPK, ADMIN, KPA, WADIR3), blk.import (PPK, ADMIN)
 *
 * Ketua Jurusan & panitia PKL/KPA menyusun rekapnya di luar sistem; hasilnya
 * diajukan ke PPK untuk diinput di sini. Catatan MURNI (tanpa alur status
 * verifikasi/final seperti REKAP_BULANAN) — kunci gabungan (nit, kegiatan,
 * bulan, pembayaran_ke), upsert supaya aman diimpor ulang.
 * Setiap aksi tulis → withLock + auditLog.
 */

/** Daftar bantuan luar kampus, filter {bulan?, kegiatan?}. */
function blkList(payload, session) {
  var f = payload || {};
  var rows = sheetRead(SHEETS.BANTUAN_LUAR_KAMPUS, function (r) {
    if (f.bulan && String(r.bulan) !== f.bulan) return false;
    if (f.kegiatan && String(r.kegiatan) !== f.kegiatan) return false;
    return true;
  });
  var total = 0;
  rows.forEach(function (r) { total += _int_(r.nominal || 0, 'nominal'); });
  return { bantuan: rows, total: total };
}

/**
 * Impor batch (PPK, Admin). Payload {baris:[{nit, kegiatan, bulan, periode,
 * total_hari, nilai_per_hari, pembayaran_ke, keterangan?}]}.
 * nilai_per_hari BOLEH beda per baris (per individu/wilayah) — beda dari
 * rekap.input_historis yang satu rate untuk semua baris.
 */
function blkImport(payload, session) {
  var baris = (payload && payload.baris) || [];
  if (!baris.length) throw _fail_('baris tidak boleh kosong.');

  var tarunaValid = {};
  sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaValid[String(t.nit)] = true; });

  return withLock(function () {
    var sh = _sheet_(SHEETS.BANTUAN_LUAR_KAMPUS);
    var lastCol = sh.getLastColumn();
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var last = sh.getLastRow();
    var data = last >= 2 ? sh.getRange(2, 1, last - 1, lastCol).getValues() : [];
    var iNit = headers.indexOf('nit'), iKeg = headers.indexOf('kegiatan'),
        iBulan = headers.indexOf('bulan'), iBayarKe = headers.indexOf('pembayaran_ke'),
        iId = headers.indexOf('bantuan_id');

    function kunci(nit, kegiatan, bulan, bayarKe) {
      return nit + '|' + kegiatan + '|' + bulan + '|' + bayarKe;
    }

    var barisKunci = {}; // kunci -> {baris: nomor baris sheet, id: bantuan_id lama}
    for (var i = 0; i < data.length; i++) {
      var k0 = kunci(String(data[i][iNit]), String(data[i][iKeg]), String(data[i][iBulan]), String(data[i][iBayarKe]));
      barisKunci[k0] = { baris: i + 2, id: data[i][iId] };
    }

    var barisBaru = [];
    var n = 0;
    baris.forEach(function (b) {
      var nit = String((b && b.nit) || '').trim();
      if (!nit) throw _fail_('nit wajib diisi pada setiap baris.');
      if (!tarunaValid[nit]) throw _fail_('Taruna tidak ditemukan: ' + nit);
      var kegiatan = String((b && b.kegiatan) || '').trim();
      if (!kegiatan) throw _fail_('kegiatan wajib diisi pada setiap baris.');
      var bulan = _wajibBulan_(b && b.bulan, 'bulan');
      var bayarKe = _int_(b.pembayaran_ke || 1, 'pembayaran_ke');
      var totalHari = _int_(b.total_hari, 'total_hari');
      var nilaiPerHari = _int_(b.nilai_per_hari, 'nilai_per_hari');
      var nominal = Math.round(totalHari * nilaiPerHari);

      var k = kunci(nit, kegiatan, bulan, String(bayarKe));
      var ada = barisKunci[k];
      var nilai = {
        bantuan_id: ada ? ada.id : nextId('BLK'),
        nit: nit, kegiatan: kegiatan, bulan: bulan,
        periode: String((b && b.periode) || ''), total_hari: totalHari,
        nilai_per_hari: nilaiPerHari, nominal: nominal, pembayaran_ke: bayarKe,
        keterangan: String((b && b.keterangan) || '')
      };
      var row = headers.map(function (h) { return nilai[h] !== undefined ? nilai[h] : ''; });
      if (ada) {
        sh.getRange(ada.baris, 1, 1, lastCol).setValues([row]);
      } else {
        barisBaru.push(row);
      }
      n++;
    });
    if (barisBaru.length) {
      sh.getRange(sh.getLastRow() + 1, 1, barisBaru.length, lastCol).setValues(barisBaru);
    }

    auditLog(session, 'blk.import', 'BANTUAN_LUAR_KAMPUS', null, null, { baris: n });
    return { baris: n };
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 20_trigger.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
/**
 * 20_trigger.gs — Trigger terjadwal: eskalasi SP harian
 *
 * Kebijakan (tenggat, JAM_TRIGGER) via getKebijakanSP() — DILARANG baca CONFIG langsung.
 * - eskalasiTagihan() : dijalankan trigger harian; IDEMPOTEN (aman 2× sehari)
 * - pasangTrigger()   : sekali jalan dari editor — pasang trigger harian eskalasi
 * - backupMingguan()  : copy spreadsheet ke e-BAMA/BACKUP, retensi 8 terbaru
 * - pasangTriggerBackup() : sekali jalan dari editor — pasang trigger mingguan backup
 */

/**
 * Eskalasi tagihan TERTAGIH yang melewati tenggat SP aktif:
 *   level 1 → terbit SP-2 ; level 2 → terbit SP-3 ;
 *   level 3 → status ESKALASI_MANUAL (penanganan di luar sistem:
 *   sanksi akademik / pemanggilan — sistem hanya menandai).
 * IDEMPOTEN: bila SP level target sudah ada → lewati (tidak terbit ganda).
 */
function eskalasiTagihan() {
  var today = _todayStr_();
  var hasil = { diperiksa: 0, sp2: 0, sp3: 0, eskalasi_manual: 0, lewati: 0 };

  // Peta SP per tagihan: level maksimum + tenggatnya + set level yang sudah ada
  var spMap = {};
  sheetRead(SHEETS.SURAT_PERINGATAN).forEach(function (s) {
    var key = String(s.tagihan_id);
    if (!spMap[key]) spMap[key] = { max: 0, tenggat: '', ada: {} };
    var lv = Number(s.level) || 0;
    spMap[key].ada[lv] = true;
    if (lv > spMap[key].max) {
      spMap[key].max = lv;
      spMap[key].tenggat = _tglStr_(s.tenggat);
    }
  });

  sheetRead(SHEETS.TAGIHAN, function (r) { return r.status === 'TERTAGIH'; })
    .forEach(function (t) {
      hasil.diperiksa++;
      var info = spMap[String(t.tagihan_id)];
      if (!info || !info.max) { hasil.lewati++; return; }          // belum ada SP → bukan urusan eskalasi
      if (today <= info.tenggat) { hasil.lewati++; return; }       // belum lewat tenggat

      if (info.max === 1 && !info.ada[2]) {
        spTerbitkan(t.tagihan_id, 2, null); hasil.sp2++;
      } else if (info.max === 2 && !info.ada[3]) {
        spTerbitkan(t.tagihan_id, 3, null); hasil.sp3++;
      } else if (info.max >= 3) {
        // Sudah SP-3 dan tetap lewat tenggat → tandai eskalasi manual (sekali saja)
        sheetUpdate(SHEETS.TAGIHAN, 'tagihan_id', t.tagihan_id, { status: 'ESKALASI_MANUAL' });
        auditLog(null, 'ESKALASI', 'TAGIHAN', t.tagihan_id,
          { status: 'TERTAGIH' }, { status: 'ESKALASI_MANUAL', keterangan: 'Lewat tenggat SP-3 — penanganan di luar sistem' });
        hasil.eskalasi_manual++;
      } else {
        hasil.lewati++; // SP level target sudah ada (idempoten)
      }
    });

  if (hasil.sp2 || hasil.sp3 || hasil.eskalasi_manual) _tagihanCacheClear_();
  Logger.log('eskalasiTagihan: ' + JSON.stringify(hasil));
  return hasil;
}

/**
 * Pasang trigger time-driven harian eskalasiTagihan() pada jam
 * getKebijakanSP().JAM_TRIGGER (default 06.00 WIT — timeZone proyek Asia/Jayapura).
 * Menghapus trigger lama fungsi yang sama dulu (tidak dobel).
 */
function pasangTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === 'eskalasiTagihan') ScriptApp.deleteTrigger(tr);
  });
  var jam = Number(getKebijakanSP().JAM_TRIGGER);
  ScriptApp.newTrigger('eskalasiTagihan')
    .timeBased().everyDays(1).atHour(jam)
    .create();
  Logger.log('Trigger eskalasiTagihan terpasang: harian jam ' + jam + '.00 (Asia/Jayapura).');
}

/**
 * pesananOtomatis21() — Fitur D: dijalankan trigger harian jam 21.00 WIT.
 * Target tanggal D = BESOK (tgl_makan berikutnya). Bila BELUM ada PESANAN
 * (manual/Pembina/sistem, status ≠ DIKEMBALIKAN) untuk D → buat otomatis:
 * `jml_taruna` = SALIN PERSIS dari PESANAN valid TERAKHIR sebelum D
 * (dikonfirmasi Firdaus — BUKAN dihitung ulang dari TARUNA/STATUS_HARIAN,
 * demi kesederhanaan; REALISASI tetap jadi titik verifikasi sebenarnya di
 * hilir, lihat docs/uji-terima.md §H). `menu` dirakit dari MENU_KONTRAK
 * (Malam D + Pagi/Siang D+1, pola sama seperti pesanan.create/
 * pesanan.pembina_kirim). status LANGSUNG `TERKIRIM` (melewati verifikasi
 * Pembina) — `created_by`/`verif_by` = 'SISTEM'.
 *
 * SAKLAR LIBUR (`getLiburAutoPesanan`, 00_config.gs): bila D masuk rentang
 * libur aktif → SKIP total (tidak membuat apa pun), dicatat AUDIT_LOG.
 * Tanpa PESANAN prior sama sekali → SKIP + AUDIT_LOG (butuh pesanan manual
 * pertama) — "notifikasi" via Audit Log karena aplikasi ini belum punya
 * infrastruktur push/email; PPK/Admin diharapkan memeriksa Audit Log secara
 * berkala (lihat catatan sama di pesanan.pembina_kirim, 12_pesanan.gs).
 *
 * IDEMPOTEN: aman dijalankan berkali-kali sehari (cek `existing` dulu,
 * tidak pernah menimpa/duplikasi). Dibungkus withLock — cek dobel + tulis
 * harus atomik (bisa berbarengan dengan pesanan.create/pembina_kirim manual
 * yang kebetulan jalan di jam yang sama).
 */
function pesananOtomatis21() {
  return withLock(function () {
    var d = _tambahHari_(_todayStr_(), 1);
    var hasil = { tanggal: d, dibuat: false, alasan: '' };

    if (_tanggalLiburAutoPesanan_(d)) {
      hasil.alasan = 'Tanggal ' + d + ' termasuk rentang libur (saklar libur aktif) — dilewati.';
      auditLog(null, 'pesanan.otomatis_lewati', 'PESANAN', null, null, { tanggal: d, alasan: hasil.alasan });
      Logger.log('pesananOtomatis21: ' + hasil.alasan);
      return hasil;
    }

    var existing = sheetRead(SHEETS.PESANAN, function (r) {
      return _tglStr_(r.tgl_makan) === d && r.status !== 'DIKEMBALIKAN';
    })[0];
    if (existing) {
      hasil.alasan = 'Pesanan ' + d + ' sudah ada (' + existing.pesanan_id + ', status ' + existing.status + ') — tidak dibuat ulang.';
      Logger.log('pesananOtomatis21: ' + hasil.alasan);
      return hasil;
    }

    var prior = sheetRead(SHEETS.PESANAN, function (r) {
      return r.status !== 'DIKEMBALIKAN' && _tglStr_(r.tgl_makan) < d;
    }).sort(function (a, b) { return _tglStr_(b.tgl_makan).localeCompare(_tglStr_(a.tgl_makan)); })[0];

    if (!prior) {
      hasil.alasan = 'Tidak ada histori PESANAN sebelumnya — butuh pesanan manual pertama, dilewati.';
      auditLog(null, 'pesanan.otomatis_lewati', 'PESANAN', null, null, { tanggal: d, alasan: hasil.alasan });
      Logger.log('pesananOtomatis21: ' + hasil.alasan);
      return hasil;
    }

    var kontrak;
    try {
      kontrak = _kontrakAktifPada_(d);
    } catch (e) {
      hasil.alasan = 'Tidak ada kontrak aktif untuk ' + d + ' — dilewati.';
      auditLog(null, 'pesanan.otomatis_lewati', 'PESANAN', null, null, { tanggal: d, alasan: hasil.alasan });
      Logger.log('pesananOtomatis21: ' + hasil.alasan);
      return hasil;
    }

    var hariMalam = _hariDalamMinggu_(d);
    var hariPagiSiang = _hariDalamMinggu_(_tambahHari_(d, 1));
    var menuHari = sheetRead(SHEETS.MENU_KONTRAK, function (r) { return String(r.kontrak_id) === String(kontrak.kontrak_id); });
    var menuMalamRow = menuHari.filter(function (r) { return r.hari === hariMalam; })[0];
    var menuPagiSiangRow = menuHari.filter(function (r) { return r.hari === hariPagiSiang; })[0];
    var barisMenu = [];
    if (menuMalamRow && menuMalamRow.menu_malam) barisMenu.push(hariMalam + ' Malam: ' + menuMalamRow.menu_malam);
    if (menuPagiSiangRow && menuPagiSiangRow.menu_pagi) barisMenu.push(hariPagiSiang + ' Pagi: ' + menuPagiSiangRow.menu_pagi);
    if (menuPagiSiangRow && menuPagiSiangRow.menu_siang) barisMenu.push(hariPagiSiang + ' Siang: ' + menuPagiSiangRow.menu_siang);

    var obj = {
      pesanan_id: nextId('PSN'),
      tgl_makan: d,
      kontrak_id: kontrak.kontrak_id,
      jml_taruna: _int_(prior.jml_taruna, 'jml_taruna'), // SALIN PERSIS — bukan hitung ulang
      menu: barisMenu.join('\n'),
      catatan: 'Pesanan otomatis 21:00 — belum diverifikasi Pembina',
      status: 'TERKIRIM',
      created_by: 'SISTEM', verif_by: 'SISTEM', verif_at: new Date(), revisi_dari: ''
    };
    sheetAppend(SHEETS.PESANAN, obj);
    auditLog(null, 'pesanan.otomatis', 'PESANAN', obj.pesanan_id, null,
      { tanggal: d, jml_taruna: obj.jml_taruna, disalin_dari: prior.pesanan_id, kontrak_id: kontrak.kontrak_id });
    Logger.log('pesananOtomatis21: dibuat ' + obj.pesanan_id + ' untuk ' + d +
      ' (jml_taruna=' + obj.jml_taruna + ', disalin dari ' + prior.pesanan_id + ').');

    hasil.dibuat = true;
    hasil.pesanan_id = obj.pesanan_id;
    return hasil;
  });
}

/**
 * Pasang trigger time-driven harian pesananOtomatis21() jam 21.00
 * (Asia/Jayapura). Menghapus trigger lama fungsi yang sama dulu (tidak dobel).
 */
function pasangTriggerPesananOtomatis() {
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === 'pesananOtomatis21') ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger('pesananOtomatis21')
    .timeBased().everyDays(1).atHour(21)
    .create();
  Logger.log('Trigger pesananOtomatis21 terpasang: harian jam 21.00 (Asia/Jayapura).');
}

/**
 * backupMingguan() — copy spreadsheet ke folder e-BAMA/BACKUP.
 * Retensi 8 backup terbaru (± 2 bulan mingguan); yang lebih lama dibuang
 * ke sampah Drive (bukan dihapus permanen — masih bisa dipulihkan 30 hari).
 */
function backupMingguan() {
  var p = PropertiesService.getScriptProperties();
  var rootId = p.getProperty('FOLDER_ROOT');
  var root = rootId ? DriveApp.getFolderById(rootId) : _ensureFolder_(null, 'e-BAMA');
  var folderBackup = _ensureFolder_(root, 'BACKUP');
  p.setProperty('FOLDER_BACKUP', folderBackup.getId());

  var ss = _getSpreadsheet_();
  var sumber = DriveApp.getFileById(ss.getId());
  var nama = 'e-BAMA-DB-BACKUP-' + _todayStr_();
  sumber.makeCopy(nama, folderBackup);

  var MAKS_BACKUP = 8;
  var files = [];
  var iter = folderBackup.getFiles();
  while (iter.hasNext()) files.push(iter.next());
  files.sort(function (a, b) { return b.getDateCreated().getTime() - a.getDateCreated().getTime(); });
  for (var i = MAKS_BACKUP; i < files.length; i++) files[i].setTrashed(true);

  var totalTersimpan = Math.min(files.length, MAKS_BACKUP);
  Logger.log('backupMingguan: ' + nama + ' dibuat. Total backup tersimpan: ' + totalTersimpan);
  return { nama: nama, total_tersimpan: totalTersimpan };
}

/**
 * Pasang trigger time-driven mingguan backupMingguan() — Minggu jam 02.00
 * (Asia/Jayapura, di luar jam sibuk). Menghapus trigger lama dulu (tidak dobel).
 */
function pasangTriggerBackup() {
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === 'backupMingguan') ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger('backupMingguan')
    .timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(2)
    .create();
  Logger.log('Trigger backupMingguan terpasang: mingguan hari Minggu jam 02.00 (Asia/Jayapura).');
}

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 21_cetak.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
/**
 * 21_cetak.gs — Cetak Form Manual SOP (Form 01-08, docs/format-dokumen.md)
 *
 * ACTION: cetak.form01 (SENAT, PEMBINA, PPK, ADMIN),
 *         cetak.form02 (PEMBINA, PPK, ADMIN),
 *         cetak.form03 (PPK, ADMIN, PEMBINA),
 *         cetak.form04 (SENAT, PEMBINA, PPK, ADMIN),
 *         cetak.form05 (PEMBINA, PPK, ADMIN),
 *         cetak.form06 (PPK, KPA, ADMIN),
 *         cetak.form07 (ADMIN, PPK SAJA — baca TARUNA_REKENING, lihat 22_rekening.gs),
 *         cetak.form08 (ADMIN, PPK SAJA — baca TARUNA_REKENING, lihat 22_rekening.gs)
 *
 * Setiap cetak.formNN adalah action GET-style (tanpa efek samping) — hanya
 * membaca & merangkai data untuk dirender+dicetak di frontend. Tidak ada
 * withLock/AUDIT_LOG di sini KECUALI form yang membaca data sensitif
 * (rekening lengkap, lihat cetak.form07/form08 di tahap lanjutan).
 */

/**
 * Form 01: Rencana & Persetujuan Pemesanan Makan Harian (H-1). Payload {tgl_makan}.
 * Skema TIDAK memisahkan porsi per waktu makan (KONTRAK.porsi_per_hari cuma
 * angka agregat, bukan Sarapan/Siang/Malam terpisah) — sengaja TIDAK
 * mengarang rincian per waktu; frontend menampilkan total porsi harian saja
 * dan mencatat keterbatasan ini di halaman cetak.
 */
function cetakForm01(payload, session) {
  var tgl = _wajibTgl_(payload && payload.tgl_makan, 'tgl_makan');
  var pesanan = sheetRead(SHEETS.PESANAN, function (r) { return _tglStr_(r.tgl_makan) === tgl; })[0];
  if (!pesanan) throw _fail_('Belum ada pesanan untuk tanggal ' + tgl + '.');

  var kontrak = sheetRead(SHEETS.KONTRAK, function (r) { return String(r.kontrak_id) === String(pesanan.kontrak_id); })[0];
  var namaPengguna = {};
  sheetRead(SHEETS.PENGGUNA).forEach(function (p) { namaPengguna[String(p.user_id)] = p.nama; });
  var statusHarianHari = sheetRead(SHEETS.STATUS_HARIAN, function (r) { return _tglStr_(r.tanggal) === tgl; });

  return {
    pesanan: {
      pesanan_id: pesanan.pesanan_id,
      tgl_makan: _tglStr_(pesanan.tgl_makan),
      jml_taruna: _int_(pesanan.jml_taruna, 'jml_taruna'),
      menu: pesanan.menu,
      catatan: pesanan.catatan,
      status: pesanan.status
    },
    kontrak: kontrak ? {
      kontrak_id: kontrak.kontrak_id,
      harga_per_porsi: _int_(kontrak.harga_per_porsi, 'harga_per_porsi'),
      porsi_per_hari: _int_(kontrak.porsi_per_hari, 'porsi_per_hari'),
      harga_per_hari_efektif: _hargaPerHariKontrak_(kontrak)
    } : null,
    jml_status_harian: statusHarianHari.length,
    dibuat_oleh_nama: namaPengguna[String(pesanan.created_by)] || pesanan.created_by || '',
    diverifikasi_oleh_nama: namaPengguna[String(pesanan.verif_by)] || pesanan.verif_by || '',
    verif_at: (pesanan.verif_at instanceof Date)
      ? Utilities.formatDate(pesanan.verif_at, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
      : String(pesanan.verif_at || '')
  };
}

/**
 * Form 02: Daftar Hadir / Tanda Terima Makan. Payload {tanggal}.
 * Keputusan desain (dikonfirmasi Firdaus): TIDAK ada pencatatan kehadiran
 * individual di skema — tanda tangan digital Pembina+Senat di REALISASI
 * (ttd_pembina_at/ttd_senat_at) sudah jadi bukti sah tanda terima, jadi form
 * ini HANYA daftar taruna berhak makan (taruna AKTIF dikurangi STATUS_HARIAN
 * tanggal itu — subset sama seperti _hitungJmlTaruna_ PESANAN) tanpa kolom
 * paraf per waktu makan.
 */
function cetakForm02(payload, session) {
  var tgl = _wajibTgl_(payload && payload.tanggal, 'tanggal');

  var tidakBerhak = {};
  sheetRead(SHEETS.STATUS_HARIAN, function (r) { return _tglStr_(r.tanggal) === tgl; })
    .forEach(function (r) { tidakBerhak[String(r.nit)] = true; });

  var daftar = sheetRead(SHEETS.TARUNA, function (r) { return r.status === 'AKTIF' && !tidakBerhak[String(r.nit)]; })
    .map(function (t) { return { nit: String(t.nit), nama: t.nama, prodi: t.prodi, tingkat: t.tingkat, kelas: t.kelas }; })
    .sort(function (a, b) { return a.nama.localeCompare(b.nama); });

  var realisasi = sheetRead(SHEETS.REALISASI, function (r) { return _tglStr_(r.tanggal) === tgl; })[0];

  return {
    tanggal: tgl,
    taruna: daftar,
    jml_taruna: daftar.length,
    realisasi: realisasi ? {
      porsi_diterima: _int_(realisasi.porsi_diterima, 'porsi_diterima'),
      jml_taruna_makan: _int_(realisasi.jml_taruna_makan, 'jml_taruna_makan'),
      ttd_pembina_at: (realisasi.ttd_pembina_at instanceof Date)
        ? Utilities.formatDate(realisasi.ttd_pembina_at, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
        : String(realisasi.ttd_pembina_at || ''),
      ttd_senat_at: (realisasi.ttd_senat_at instanceof Date)
        ? Utilities.formatDate(realisasi.ttd_senat_at, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
        : String(realisasi.ttd_senat_at || '')
    } : null
  };
}

/**
 * Form 03: Rekap Taruna Tidak Menerima Makan (bulanan). Payload {bulan}.
 * Kelompokkan STATUS_HARIAN sebulan per jenis status, sertakan referensi
 * LAMPIRAN (surat bukti) per baris kalau ada.
 */
function cetakForm03(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');

  var tarunaByNit = {};
  sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });

  var rows = sheetRead(SHEETS.STATUS_HARIAN, function (r) { return _bulanStr_(r.tanggal) === bulan; });

  var perStatus = {};
  ENUM.STATUS_HARIAN.forEach(function (s) { perStatus[s] = []; });

  rows.forEach(function (r) {
    var t = tarunaByNit[String(r.nit)] || {};
    var lampiran = lampiranList('STATUS_HARIAN', r.status_id).map(function (l) {
      return { lamp_id: l.lamp_id, nama_file: l.nama_file, drive_file_id: l.drive_file_id };
    });
    var baris = {
      nit: String(r.nit), nama: t.nama || '', prodi: t.prodi || '',
      tanggal: _tglStr_(r.tanggal), status: r.status, lampiran: lampiran
    };
    if (!perStatus[r.status]) perStatus[r.status] = [];
    perStatus[r.status].push(baris);
  });

  // Urutkan tiap kelompok status berdasarkan tanggal
  Object.keys(perStatus).forEach(function (s) {
    perStatus[s].sort(function (a, b) { return a.tanggal.localeCompare(b.tanggal); });
  });

  return { bulan: bulan, per_status: perStatus, total: rows.length };
}

/**
 * Form 04: Rekapitulasi Bulanan Porsi Makan. Payload {bulan}.
 * Keputusan desain (dikonfirmasi Firdaus): TIDAK ada rincian porsi per waktu
 * makan (Sarapan/Siang/Malam) — skema hanya simpan REALISASI.porsi_diterima
 * agregat per tanggal, sama seperti Form 01. Baris per tanggal yang ADA
 * REALISASI (bukan 1..31 buta), diurutkan tanggal, + baris JUMLAH TOTAL.
 * Biaya harian = REALISASI.jml_taruna_makan × harga_per_hari_efektif kontrak
 * (headcount, BUKAN porsi_diterima — konsisten dengan alasan Form-05: satuan
 * biaya sudah per taruna/hari sejak migrasi harga per-porsi → per-hari, tak
 * lagi terpengaruh porsi_per_hari).
 */
function cetakForm04(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var realisasiBulan = sheetRead(SHEETS.REALISASI, function (r) { return _bulanStr_(r.tanggal) === bulan; });

  var penyediaById = {};
  sheetRead(SHEETS.PENYEDIA).forEach(function (p) { penyediaById[String(p.penyedia_id)] = p; });

  var kontrakCache = {};
  var kontrakRingkasById = {};
  function kontrakPada(tgl) {
    if (kontrakCache.hasOwnProperty(tgl)) return kontrakCache[tgl];
    var k = null;
    try { k = _kontrakAktifPada_(tgl); } catch (e) { k = null; }
    kontrakCache[tgl] = k;
    if (k && !kontrakRingkasById[k.kontrak_id]) {
      var p = penyediaById[String(k.penyedia_id)] || {};
      kontrakRingkasById[k.kontrak_id] = {
        kontrak_id: k.kontrak_id, penyedia_nama: p.nama || '',
        harga_per_porsi: _int_(k.harga_per_porsi, 'harga_per_porsi'),
        harga_per_hari_efektif: _hargaPerHariKontrak_(k)
      };
    }
    return k;
  }

  var totalTarunaAktif = 0, totalPorsi = 0, totalBiaya = 0;
  var baris = realisasiBulan
    .map(function (r) {
      var tgl = _tglStr_(r.tanggal);
      var tarunaAktif = _hitungJmlTaruna_(tgl);
      var porsi = _int_(r.porsi_diterima, 'porsi_diterima');
      var jmlMakan = _int_(r.jml_taruna_makan || 0, 'jml_taruna_makan');
      var kontrak = kontrakPada(tgl);
      var hargaPerHari = kontrak ? _hargaPerHariKontrak_(kontrak) : 0;
      var biaya = Math.round(jmlMakan * hargaPerHari);
      totalTarunaAktif += tarunaAktif; totalPorsi += porsi; totalBiaya += biaya;
      return {
        tanggal: tgl, taruna_aktif: tarunaAktif, total_porsi: porsi,
        jumlah_biaya: biaya, kontrak_ditemukan: !!kontrak
      };
    })
    .sort(function (a, b) { return a.tanggal.localeCompare(b.tanggal); });

  return {
    bulan: bulan, baris: baris,
    total_taruna_aktif: totalTarunaAktif, total_porsi: totalPorsi, total_biaya: totalBiaya,
    kontrak_ringkas: Object.keys(kontrakRingkasById).map(function (k) { return kontrakRingkasById[k]; })
  };
}

/**
 * Form 05: BA Rekonsiliasi 3 Titik. Payload {tanggal}.
 * Titik 1 = taruna AKTIF dikurangi STATUS_HARIAN pada tanggal itu (headcount
 *   berhak makan, sama seperti perhitungan jml_taruna PESANAN — pakai
 *   _hitungJmlTaruna_ yang sudah ada di 12_pesanan.gs, jangan hitung ulang).
 * Titik 2 = PESANAN.jml_taruna pada tgl_makan = tanggal itu (headcount dipesan).
 * Titik 3 = REALISASI.jml_taruna_makan pada tanggal itu — dipilih (BUKAN
 *   porsi_diterima) supaya satuannya konsisten dengan Titik 1/2, yaitu
 *   headcount taruna, bukan jumlah porsi/menu yang bisa berbeda kalau
 *   porsi_per_hari > 1.
 * Kolom "Penjelasan/Penyebab" SENGAJA tidak dihasilkan otomatis di sini —
 * itu wajib diisi manual oleh Pembina di halaman cetak (state lokal frontend,
 * tidak dikirim ke server).
 */
function cetakForm05(payload, session) {
  var tgl = _wajibTgl_(payload && payload.tanggal, 'tanggal');
  var titik1 = _hitungJmlTaruna_(tgl);
  var pesanan = sheetRead(SHEETS.PESANAN, function (r) { return _tglStr_(r.tgl_makan) === tgl; })[0];
  var titik2 = pesanan ? _int_(pesanan.jml_taruna, 'jml_taruna') : 0;
  var realisasi = sheetRead(SHEETS.REALISASI, function (r) { return _tglStr_(r.tanggal) === tgl; })[0];
  var titik3 = realisasi ? _int_(realisasi.jml_taruna_makan, 'jml_taruna_makan') : 0;
  var selisih1_2 = titik1 - titik2;
  var selisih2_3 = titik2 - titik3;
  var cekOtomatis = {
    label: 'Tidak ada taruna non-aktif/tidak berhak makan yang ikut menerima makan',
    cocok: titik3 <= titik1
  };

  return {
    tanggal: tgl,
    titik1_taruna_berhak: titik1,
    titik2_total_pesanan: titik2,
    titik3_total_realisasi: titik3,
    selisih_titik1_titik2: selisih1_2,
    selisih_titik2_titik3: selisih2_3,
    cocok: selisih1_2 === 0 && selisih2_3 === 0,
    ada_pesanan: !!pesanan,
    ada_realisasi: !!realisasi,
    ketidaksesuaian: realisasi ? (realisasi.ketidaksesuaian || '') : '',
    tindak_lanjut: realisasi ? (realisasi.tindak_lanjut || '') : '',
    cek_otomatis: cekOtomatis
  };
}

/**
 * Form 06: Verifikasi & Rencana Pembayaran PPK (bulanan). Payload {bulan}.
 * HANYA boleh dicetak dari REKAP_BULANAN berstatus FINAL — nominal FINAL
 * sudah beku (§5 CLAUDE.md), jadi angka yang tercetak tidak akan berubah lagi.
 * Kalau bulan itu belum ada rekap sama sekali, atau ada baris yang BUKAN
 * FINAL, tolak dengan pesan jelas (jangan cetak angka yang masih bisa berubah).
 * Checklist 8 dokumen kelengkapan SENGAJA disederhanakan jadi checkbox manual
 * di frontend pada tahap ini (belum ada sumber data terstruktur utk itu).
 */
function cetakForm06(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var rows = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  if (!rows.length) throw _fail_('Belum ada rekap untuk bulan ' + bulan + ' — Form 06 hanya bisa dicetak setelah rekap dibuat dan FINAL.');

  var belumFinal = rows.filter(function (r) { return String(r.status) !== 'FINAL'; });
  if (belumFinal.length) {
    throw _fail_('Rekap bulan ' + bulan + ' belum FINAL (masih berstatus ' + belumFinal[0].status + ') — ' +
      'Form 06 hanya boleh dicetak dari rekap yang sudah FINAL supaya angka yang tercetak tidak berubah lagi. ' +
      'Selesaikan rekap.verify dan rekap.final terlebih dahulu.');
  }

  var tarunaByNit = {};
  sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });

  var totalHariMakan = 0, totalNominal = 0;
  var baris = rows.map(function (r) {
    var t = tarunaByNit[String(r.nit)] || {};
    var nominal = _int_(r.nominal, 'nominal');
    var hariMakan = _int_(r.hari_makan, 'hari_makan');
    totalHariMakan += hariMakan;
    totalNominal += nominal;
    return { nit: String(r.nit), nama: t.nama || '', hari_makan: hariMakan, nominal: nominal };
  });

  return {
    bulan: bulan,
    baris: baris,
    total_taruna: baris.length,
    total_hari_makan: totalHariMakan,
    total_nominal: totalNominal,
    nominal_terbilang: _terbilangRupiah_(totalNominal),
    pejabat: PEJABAT
  };
}

/**
 * Form 07: Usulan Penahanan & Pendebetan Rekening ke Bank. Payload {bulan}.
 * Satu-satunya form yang menampilkan nomor rekening PENUH (join ke
 * TARUNA_REKENING) — role dibatasi ADMIN/PPK dua lapis (ACTION_MAP.roles DAN
 * _hanyaAdminPPK_ di sini), dan setiap panggilan WAJIB 1 baris AUDIT_LOG
 * (daftar NIT yang rekeningnya ikut terbaca, BUKAN nomor rekeningnya).
 * Mensyaratkan PEMBAYARAN bulan itu sudah ada (dibuat lewat bayar.create,
 * yang sendirinya mensyaratkan REKAP_BULANAN berstatus FINAL — setelah alur
 * Wadir 3 setujui → PPK verifikasi → PPK finalkan) — supaya nominal yang
 * tercetak sudah melalui seluruh gerbang persetujuan.
 */
function cetakForm07(payload, session) {
  _hanyaAdminPPK_(session);
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');

  return withLock(function () {
    var pembayaran = sheetRead(SHEETS.PEMBAYARAN, function (r) { return _bulanStr_(r.bulan) === bulan; })[0];
    if (!pembayaran) {
      throw _fail_('Belum ada PEMBAYARAN untuk bulan ' + bulan + ' — Form 07 hanya bisa dicetak setelah proses pembayaran dibuat (bayar.create).');
    }

    var rekapRows = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
    if (!rekapRows.length) throw _fail_('Belum ada rekap untuk bulan ' + bulan + '.');
    // Abaikan taruna bernilai Rp0 (tidak makan bulan ini) — tak perlu diblokir/didebet,
    // dan rekening lengkapnya tidak perlu ikut terbaca/diaudit.
    rekapRows = rekapRows.filter(function (r) { return _int_(r.nominal || 0, 'nominal') > 0; });

    var tarunaByNit = {};
    sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });

    var nitList = rekapRows.map(function (r) { return String(r.nit); });
    var rekeningByNit = {};
    sheetRead(SHEETS.TARUNA_REKENING, function (r) { return nitList.indexOf(String(r.nit)) >= 0; })
      .forEach(function (r) { rekeningByNit[String(r.nit)] = r; });

    var biayaAdminBank = getKebijakanPendebetan().biayaAdminBank;
    var totalNominal = 0;
    var baris = rekapRows.map(function (r) {
      var nit = String(r.nit);
      var t = tarunaByNit[nit] || {};
      var rek = rekeningByNit[nit];
      var nominal = _int_(r.nominal, 'nominal');
      totalNominal += nominal;
      return {
        nit: nit, nama: t.nama || '', prodi: t.prodi || '', tingkat: t.tingkat || '',
        bank: rek ? rek.bank : '', no_rekening_lengkap: rek ? rek.no_rekening_lengkap : '',
        nama_pemilik: rek ? rek.nama_pemilik : '', nominal: nominal,
        // Nilai yang diinstruksikan ke bank utk didebet dari rekening taruna —
        // nominal SPM dikurangi biaya admin bank (getKebijakanPendebetan,
        // 00_config.gs), floor di 0. HANYA dipakai tampilan Form-07 — nominal
        // di atas TETAP nilai penuh (snapshot SPM), tidak berubah.
        nilai_debet: Math.max(0, nominal - biayaAdminBank),
        hari_makan: _int_(r.hari_makan || 0, 'hari_makan'), rekening_lengkap_ada: !!rek
      };
    });

    // AUDIT: satu baris untuk seluruh daftar penerima bulan ini — catat SIAPA
    // (session.user_id) membaca rekening SIAPA (nitList) dan KAPAN, TANPA
    // pernah menulis nomor rekeningnya sendiri ke AUDIT_LOG.
    auditLog(session, 'cetak.form07', 'TARUNA_REKENING', nitList.join(','), null, { nit_list: nitList });

    var rekInst = getRekeningInstansi();
    // Rekening penyedia (tujuan akhir) diambil dari KONTRAK pembayaran ini bila diisi;
    // fallback ke Script Property. Rekening Senat + nama a.n. tetap Script Property.
    var kontrak = sheetRead(SHEETS.KONTRAK, function (r) { return String(r.kontrak_id) === String(pembayaran.kontrak_id); })[0];
    var rekPenyedia = {
      BNI: (kontrak && kontrak.rek_penyedia_bni) ? String(kontrak.rek_penyedia_bni) : (rekInst.penyedia.BNI || ''),
      BSI: (kontrak && kontrak.rek_penyedia_bsi) ? String(kontrak.rek_penyedia_bsi) : (rekInst.penyedia.BSI || '')
    };
    return {
      bulan: bulan,
      pembayaran: {
        bayar_id: pembayaran.bayar_id,
        nilai_total: _int_(pembayaran.nilai_total, 'nilai_total'),
        no_spm: pembayaran.no_spm, tgl_spm: _tglStr_(pembayaran.tgl_spm),
        no_sp2d: pembayaran.no_sp2d, tgl_sp2d: _tglStr_(pembayaran.tgl_sp2d),
        status: pembayaran.status
      },
      baris: baris,
      total_nominal: totalNominal,
      biaya_admin_bank: biayaAdminBank,
      pejabat: PEJABAT,
      // Rekening tujuan pendebetan per bank: taruna → Senat, lalu Senat → Penyedia
      // (+ nama pemilik rekening untuk "a.n." di surat ke bank).
      rekening_senat: rekInst.senat,
      rekening_penyedia: rekPenyedia,
      rekening_senat_nama: rekInst.senat_nama,
      rekening_penyedia_nama: rekInst.penyedia_nama,
      kontrak: {
        no_kontrak: kontrak ? String(kontrak.no_kontrak || '') : '',
        tgl_kontrak: kontrak ? _tglStr_(kontrak.tgl_kontrak) : '',
        adendum: kontrak ? String(kontrak.adendum || '') : ''
      }
    };
  });
}

/**
 * cetak.blokir_gagal_debet {bulan?} — Surat Permohonan Pemblokiran & Pendebetan
 * ke bank untuk taruna yang GAGAL DEBET dan BELUM MENYETOR ke Senat (jalur
 * TAGIHAN, terpisah dari Form-07 yang jalur SP2D/LS). Karena taruna tak
 * kunjung menyetor tunggakan, Senat/PPK meminta bank memblokir & mendebet
 * langsung rekening taruna ke rekening Senat. Menampilkan NOMOR REKENING PENUH
 * → ADMIN/PPK/STAF_PPK saja (`_hanyaAdminPPK_`), WAJIB 1 baris AUDIT_LOG per
 * panggilan (catat NIT yang terbaca, JANGAN nomornya). Dikelompokkan per bank
 * di frontend (surat terpisah per bank, sama seperti Form-07). `bulan` opsional:
 * kosong = semua tunggakan belum-setor; diisi = bulan itu saja.
 *
 * "Belum disetor" = TAGIHAN status TERTAGIH dgn `tgl_setor` kosong (identik
 * definisi bucket `belum_disetor` di tagihanSummary, 16_tagihan.gs). Nilai
 * debet = nominal tunggakan PENUH (bukan dikurangi biaya admin — ini penagihan
 * utang, bukan mekanika LS Form-07).
 */
function cetakBlokirGagalDebet(payload, session) {
  _hanyaAdminPPK_(session);
  var bulanFilter = payload && payload.bulan ? _bulanStr_(payload.bulan) : '';

  return withLock(function () {
    var rows = _tagihanJoin_().filter(function (t) {
      return t.status === 'TERTAGIH' && !t.tgl_setor && (!bulanFilter || t.bulan === bulanFilter);
    });
    if (!rows.length) {
      throw _fail_('Tidak ada taruna "belum disetor ke Senat"' +
        (bulanFilter ? (' untuk bulan ' + bulanFilter) : '') + '.');
    }

    var tarunaByNit = {};
    sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });

    var nitList = rows.map(function (t) { return String(t.nit); });
    var rekeningByNit = {};
    sheetRead(SHEETS.TARUNA_REKENING, function (r) { return nitList.indexOf(String(r.nit)) >= 0; })
      .forEach(function (r) { rekeningByNit[String(r.nit)] = r; });

    var totalNominal = 0;
    var baris = rows.map(function (t) {
      var nit = String(t.nit);
      var tr = tarunaByNit[nit] || {};
      var rek = rekeningByNit[nit];
      totalNominal += t.nominal;
      return {
        nit: nit, nama: tr.nama || '', prodi: tr.prodi || '', tingkat: tr.tingkat || '',
        bulan: t.bulan, sebab: t.sebab,
        bank: rek ? rek.bank : '', no_rekening_lengkap: rek ? rek.no_rekening_lengkap : '',
        nama_pemilik: rek ? rek.nama_pemilik : '',
        nominal: t.nominal, nilai_debet: t.nominal, rekening_lengkap_ada: !!rek
      };
    });

    // AUDIT: satu baris — siapa membaca rekening siapa & kapan (TANPA nomornya).
    auditLog(session, 'cetak.blokir_gagal_debet', 'TARUNA_REKENING', nitList.join(','), null, { nit_list: nitList });

    var rekInst = getRekeningInstansi();
    return {
      bulan_filter: bulanFilter,
      baris: baris,
      total_nominal: totalNominal,
      pejabat: PEJABAT,
      rekening_senat: rekInst.senat,
      rekening_senat_nama: rekInst.senat_nama
    };
  });
}

/**
 * Form 08: Usulan Pembayaran Luar Kampus (PKL/Magang/KPA/PTB). Payload
 * {bulan, kegiatan?}. Keputusan desain (dikonfirmasi Firdaus):
 * - Tarif harian TIDAK diinput manual per panggilan — dipakai
 *   BANTUAN_LUAR_KAMPUS.nilai_per_hari yang sudah diimpor (rate bisa beda
 *   per individu/wilayah, tidak ada sheet tarif-per-provinsi baru).
 * - "Jumlah hari kegiatan luar kampus" = dihitung ULANG dari STATUS_HARIAN
 *   (baris berstatus KEGIATAN_LUAR_KAMPUS per nit pada bulan itu), BUKAN
 *   dipercaya dari BANTUAN_LUAR_KAMPUS.total_hari yang diimpor manual dari
 *   dokumen kertas Ketua Jurusan/panitia — konsisten dengan cara Form 03/05
 *   menghitung dari STATUS_HARIAN sebagai sumber kebenaran. total_hari hasil
 *   impor tetap ditampilkan sebagai pembanding (hari_cocok), tapi nominal
 *   yang dicetak memakai hasil hitung ulang ini.
 * Sama seperti Form 07: menampilkan rekening lengkap → ADMIN/PPK saja,
 * wajib AUDIT_LOG per panggilan.
 */
function cetakForm08(payload, session) {
  _hanyaAdminPPK_(session);
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var kegiatan = (payload && payload.kegiatan) ? String(payload.kegiatan).trim() : '';

  return withLock(function () {
    var blkRows = sheetRead(SHEETS.BANTUAN_LUAR_KAMPUS, function (r) {
      return _bulanStr_(r.bulan) === bulan && (!kegiatan || String(r.kegiatan) === kegiatan);
    });
    if (!blkRows.length) {
      throw _fail_('Belum ada data Bantuan Luar Kampus untuk bulan ' + bulan + (kegiatan ? (' kegiatan ' + kegiatan) : '') + '.');
    }

    // Hitung ulang jml hari dari STATUS_HARIAN — sumber kebenaran (dikonfirmasi Firdaus),
    // bukan total_hari hasil impor CSV.
    var hariStatusHarianByNit = {};
    sheetRead(SHEETS.STATUS_HARIAN, function (r) {
      return _bulanStr_(r.tanggal) === bulan && STATUS_LUAR_KAMPUS.indexOf(r.status) >= 0;
    }).forEach(function (r) {
      var nit = String(r.nit);
      hariStatusHarianByNit[nit] = (hariStatusHarianByNit[nit] || 0) + 1;
    });

    var tarunaByNit = {};
    sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });

    var nitList = blkRows.map(function (r) { return String(r.nit); });
    var rekeningByNit = {};
    sheetRead(SHEETS.TARUNA_REKENING, function (r) { return nitList.indexOf(String(r.nit)) >= 0; })
      .forEach(function (r) { rekeningByNit[String(r.nit)] = r; });

    var totalNominal = 0;
    var baris = blkRows.map(function (r) {
      var nit = String(r.nit);
      var t = tarunaByNit[nit] || {};
      var rek = rekeningByNit[nit];
      var nilaiPerHari = _int_(r.nilai_per_hari, 'nilai_per_hari');
      var totalHariImpor = _int_(r.total_hari, 'total_hari');
      var jmlHari = hariStatusHarianByNit[nit] || 0;
      var nominal = Math.round(jmlHari * nilaiPerHari);
      totalNominal += nominal;
      return {
        nit: nit, nama: t.nama || '', kegiatan: r.kegiatan, periode: r.periode,
        bank: rek ? rek.bank : '', no_rekening_lengkap: rek ? rek.no_rekening_lengkap : '',
        nama_pemilik: rek ? rek.nama_pemilik : '', rekening_lengkap_ada: !!rek,
        jml_hari: jmlHari, total_hari_impor: totalHariImpor, hari_cocok: jmlHari === totalHariImpor,
        nilai_per_hari: nilaiPerHari, nominal: nominal,
        // Persetujuan Ketua Jurusan (soft-gate: ditampilkan, tidak menghentikan cetak).
        disetujui_kajur: String(r.status) === 'DISETUJUI_KAJUR'
      };
    });

    auditLog(session, 'cetak.form08', 'TARUNA_REKENING', nitList.join(','), null, { nit_list: nitList });

    // Semua baris sudah disetujui Ketua Jurusan? (untuk peringatan di halaman cetak)
    var semuaDisetujuiKajur = baris.length > 0 && baris.every(function (b) { return b.disetujui_kajur; });
    return {
      bulan: bulan, kegiatan: kegiatan, baris: baris, total_nominal: totalNominal,
      semua_disetujui_kajur: semuaDisetujuiKajur, pejabat: PEJABAT
    };
  });
}

/**
 * Form 09: Permohonan Pendebetan Rekening Senat → Penyedia (tahap-2 pembayaran).
 * Payload {bulan}. Setelah dana taruna didebet ke rekening Senat (Form 07),
 * Senat mengajukan pendebetan rekening Senat ke rekening Penyedia — PER BANK
 * (BNI & BSI), karena rekening Senat & Penyedia masing-masing 2 (alur paralel:
 * Senat BSI→Penyedia BSI, Senat BNI→Penyedia BNI).
 *
 * Nominal per bank HARUS sama persis dengan total per bank di Form 07 — sebab
 * yang diteruskan Senat→Penyedia adalah dana yang masuk dari pendebetan Form 07
 * (sudah dipotong biaya admin bank per taruna, getKebijakanPendebetan — sama
 * kebijakan dgn Form 07, dikonfirmasi Firdaus berlaku di kedua form).
 * Karena itu pengelompokan bank memakai bank REKENING RIIL taruna
 * (`TARUNA_REKENING.bank`), bukan `TARUNA.bank` master (yang bisa berbeda), dan
 * taruna bernilai Rp0 diabaikan — persis aturan Form 07. Yang dibaca dari
 * TARUNA_REKENING HANYA kolom `bank` (BSI/BNI), TIDAK pernah `no_rekening_lengkap`
 * → bukan data sensitif §4, jadi tidak wajib AUDIT_LOG. Rekening Senat/Penyedia
 * (nomor penuh yang dituju) tetap dari getRekeningInstansi() (Script Property).
 */
function cetakForm09(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');

  var pembayaran = sheetRead(SHEETS.PEMBAYARAN, function (r) { return _bulanStr_(r.bulan) === bulan; })[0];
  if (!pembayaran) {
    throw _fail_('Belum ada PEMBAYARAN untuk bulan ' + bulan + ' — Form 09 hanya bisa dicetak setelah proses pembayaran dibuat.');
  }
  var rekapRows = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  if (!rekapRows.length) throw _fail_('Belum ada rekap untuk bulan ' + bulan + '.');
  // Abaikan taruna Rp0 — sama seperti Form 07 (tak didebet, tak diteruskan).
  rekapRows = rekapRows.filter(function (r) { return _int_(r.nominal || 0, 'nominal') > 0; });

  // Bank per taruna dari TARUNA_REKENING (rekening riil) — HANYA kolom `bank`,
  // supaya total per bank identik dengan Form 07. Taruna tanpa baris rekening →
  // grup 'TANPA_REKENING' (belum bisa diteruskan; sama seperti Form 07).
  var nitList = rekapRows.map(function (r) { return String(r.nit); });
  var bankByNit = {};
  sheetRead(SHEETS.TARUNA_REKENING, function (r) { return nitList.indexOf(String(r.nit)) >= 0; })
    .forEach(function (r) { bankByNit[String(r.nit)] = String(r.bank || ''); });

  // Kontrak pembayaran ini: sumber rekening penyedia per bank (nomor PENUH) +
  // nama penyedia + data dokumen kontrak. Rekening penyedia diambil dari kontrak;
  // bila kosong, fallback ke Script Property (getRekeningInstansi) demi kompatibilitas.
  var kontrak = sheetRead(SHEETS.KONTRAK, function (r) { return String(r.kontrak_id) === String(pembayaran.kontrak_id); })[0];
  var kRekPenyedia = { BNI: '', BSI: '' };
  var penyediaNama = '';
  if (kontrak) {
    kRekPenyedia.BNI = String(kontrak.rek_penyedia_bni || '');
    kRekPenyedia.BSI = String(kontrak.rek_penyedia_bsi || '');
    var p = sheetRead(SHEETS.PENYEDIA, function (r) { return String(r.penyedia_id) === String(kontrak.penyedia_id); })[0];
    if (p) penyediaNama = p.nama || '';
  }

  // Biaya admin bank per taruna (sama kebijakan dgn Form 07, getKebijakanPendebetan)
  // — dikurangi di sini juga supaya total per bank TETAP identik dengan Form 07,
  // sebab dana yang diteruskan Senat→Penyedia = hasil pendebetan Form 07 (yang
  // sudah dipotong biaya admin bank per taruna), bukan nilai SPM penuh.
  var biayaAdminBank = getKebijakanPendebetan().biayaAdminBank;
  var rek = getRekeningInstansi();
  var agg = {}; // bank -> {total, jml}
  rekapRows.forEach(function (r) {
    var bank = bankByNit[String(r.nit)] || 'TANPA_REKENING';
    if (!agg[bank]) agg[bank] = { total: 0, jml: 0 };
    var nominal = _int_(r.nominal || 0, 'nominal');
    agg[bank].total += Math.max(0, nominal - biayaAdminBank);
    agg[bank].jml += 1;
  });

  var urut = { BSI: 0, BNI: 1, TANPA_REKENING: 9 };
  var perBank = Object.keys(agg)
    .sort(function (a, b) { return (urut[a] == null ? 5 : urut[a]) - (urut[b] == null ? 5 : urut[b]); })
    .map(function (bank) {
      return {
        bank: bank, jml_taruna: agg[bank].jml, total: agg[bank].total,
        rek_senat_sumber: rek.senat[bank] || '',
        rek_penyedia_tujuan: (kRekPenyedia[bank] || '') || rek.penyedia[bank] || '',
        rek_senat_nama: rek.senat_nama[bank] || '',
        rek_penyedia_nama: rek.penyedia_nama[bank] || ''
      };
    });

  var totalNominal = 0;
  perBank.forEach(function (b) { totalNominal += b.total; });

  return {
    bulan: bulan,
    penyedia_nama: penyediaNama,
    per_bank: perBank,
    total_nominal: totalNominal,
    nominal_terbilang: _terbilangRupiah_(totalNominal),
    biaya_admin_bank: biayaAdminBank,
    pembayaran: {
      no_spm: pembayaran.no_spm, tgl_spm: _tglStr_(pembayaran.tgl_spm),
      no_sp2d: pembayaran.no_sp2d, tgl_sp2d: _tglStr_(pembayaran.tgl_sp2d),
      status: pembayaran.status
    },
    kontrak: {
      no_kontrak: kontrak ? String(kontrak.no_kontrak || '') : '',
      tgl_kontrak: kontrak ? _tglStr_(kontrak.tgl_kontrak) : '',
      adendum: kontrak ? String(kontrak.adendum || '') : ''
    },
    pejabat: PEJABAT
  };
}

/**
 * Form 10: Rencana Pengajuan SPM ke KPPN, DIPECAH PER SUPLIER (dikonfirmasi
 * Firdaus). Payload {bulan}. Realitanya SPM ke KPPN diajukan terpisah per
 * suplier katering → tiap suplier = satu lembar SPM sendiri; di dalamnya
 * penerima dikelompokkan per **prodi + tingkat** (dikonfirmasi Firdaus:
 * dipecah sesuai ID suplier, prodi, tingkat — angkatan sudah terwakili oleh ID
 * suplier). Menampilkan nomor rekening PENUH taruna (join TARUNA_REKENING,
 * mekanisme LS bayar ke rekening taruna) → role ADMIN/PPK dua lapis
 * (_hanyaAdminPPK_ + ACTION_MAP) + WAJIB 1 baris AUDIT_LOG (daftar NIT terbaca,
 * BUKAN nomornya), persis Form-07. Suplier tiap taruna diambil dari
 * TARUNA_REKENING.penyedia_id; nama di-join dari PENYEDIA bila ada (kalau tidak,
 * frontend menampilkan ID-nya). Mensyaratkan PEMBAYARAN bulan itu sudah ada
 * (→ REKAP sudah melalui FINAL).
 */
function cetakForm10(payload, session) {
  _hanyaAdminPPK_(session);
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');

  return withLock(function () {
    var pembayaran = sheetRead(SHEETS.PEMBAYARAN, function (r) { return _bulanStr_(r.bulan) === bulan; })[0];
    if (!pembayaran) {
      throw _fail_('Belum ada PEMBAYARAN untuk bulan ' + bulan + ' — Form 10 hanya bisa dicetak setelah proses pembayaran dibuat (bayar.create).');
    }
    var rekapRows = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
    if (!rekapRows.length) throw _fail_('Belum ada rekap untuk bulan ' + bulan + '.');
    // Abaikan taruna bernilai Rp0 (tidak makan bulan ini) — tak masuk pengajuan SPM.
    rekapRows = rekapRows.filter(function (r) { return _int_(r.nominal || 0, 'nominal') > 0; });

    var tarunaByNit = {};
    sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });
    var penyediaById = {};
    sheetRead(SHEETS.PENYEDIA).forEach(function (p) { penyediaById[String(p.penyedia_id)] = p; });

    var nitList = rekapRows.map(function (r) { return String(r.nit); });
    var rekeningByNit = {};
    sheetRead(SHEETS.TARUNA_REKENING, function (r) { return nitList.indexOf(String(r.nit)) >= 0; })
      .forEach(function (r) { rekeningByNit[String(r.nit)] = r; });

    var URUT_TINGKAT = { I: 1, II: 2, III: 3 };
    var TANPA = '__TANPA__'; // penampung taruna yang belum punya suplier terpasang
    var perSuplier = {};
    var totalNominal = 0;

    rekapRows.forEach(function (r) {
      var nit = String(r.nit);
      var t = tarunaByNit[nit] || {};
      var rek = rekeningByNit[nit];
      var nominal = _int_(r.nominal || 0, 'nominal');
      totalNominal += nominal;

      var pid = (rek && rek.penyedia_id) ? String(rek.penyedia_id) : '';
      var kunciSup = pid || TANPA;
      if (!perSuplier[kunciSup]) {
        var p = penyediaById[pid];
        perSuplier[kunciSup] = {
          penyedia_id: pid, penyedia_nama: p ? (p.nama || '') : '',
          jml_taruna: 0, total_nominal: 0, kelompok: {}
        };
      }
      var s = perSuplier[kunciSup];
      s.jml_taruna += 1;
      s.total_nominal += nominal;

      var prodi = t.prodi || '', tingkat = t.tingkat || '';
      var kk = prodi + '|' + tingkat;
      if (!s.kelompok[kk]) {
        s.kelompok[kk] = { prodi: prodi, tingkat: tingkat, jml_taruna: 0, total_nominal: 0, baris: [] };
      }
      var k = s.kelompok[kk];
      k.jml_taruna += 1;
      k.total_nominal += nominal;
      k.baris.push({
        nit: nit, nama: t.nama || '',
        bank: rek ? rek.bank : '', no_rekening_lengkap: rek ? rek.no_rekening_lengkap : '',
        nama_pemilik: rek ? rek.nama_pemilik : '',
        hari_makan: _int_(r.hari_makan || 0, 'hari_makan'), nominal: nominal,
        rekening_lengkap_ada: !!rek
      });
    });

    function urutKelompok(a, b) {
      // Urut sesuai permintaan: prodi lalu tingkat.
      if (a.prodi !== b.prodi) return a.prodi < b.prodi ? -1 : 1;
      return (URUT_TINGKAT[a.tingkat] || 9) - (URUT_TINGKAT[b.tingkat] || 9);
    }
    // Kelompok (prodi+tingkat) dgn taruna TERBANYAK dalam satu lembar suplier —
    // dipakai sebagai wakil prodi/tingkat suplier itu utk urutan ANTAR-lembar
    // (dikonfirmasi Firdaus: satu suplier praktiknya melayani satu prodi+tingkat+
    // angkatan, jadi ini biasanya kelompok satu-satunya). kelompokArr sudah
    // terurut prodi lalu tingkat, jadi seri (jml_taruna sama) jatuh ke yg
    // alfabetis/tingkat lebih awal — deterministik.
    function kelompokUtama(kelompokArr) {
      if (!kelompokArr.length) return { prodi: '', tingkat: '' };
      var utama = kelompokArr[0];
      kelompokArr.forEach(function (k) { if (k.jml_taruna > utama.jml_taruna) utama = k; });
      return utama;
    }
    var perSuplierArr = Object.keys(perSuplier).map(function (kunciSup) {
      var s = perSuplier[kunciSup];
      var kelompokArr = Object.keys(s.kelompok).map(function (kk) { return s.kelompok[kk]; }).sort(urutKelompok);
      kelompokArr.forEach(function (k) {
        k.baris.sort(function (a, b) { return (a.nama || '').localeCompare(b.nama || ''); });
      });
      return {
        penyedia_id: s.penyedia_id, penyedia_nama: s.penyedia_nama,
        jml_taruna: s.jml_taruna, total_nominal: s.total_nominal,
        total_terbilang: _terbilangRupiah_(s.total_nominal),
        kelompok: kelompokArr
      };
    }).sort(function (a, b) {
      // suplier belum terisi (penyedia_id kosong) selalu di paling bawah
      if (!a.penyedia_id && b.penyedia_id) return 1;
      if (a.penyedia_id && !b.penyedia_id) return -1;
      // Urutan ANTAR lembar suplier: prodi dulu, lalu tingkat, baru nama suplier
      // (dikonfirmasi Firdaus) — tetap SATU lembar/CSV per suplier (SOP SPM per
      // kontrak), hanya urutan kemunculan lembarnya yang berubah.
      var ka = kelompokUtama(a.kelompok), kb = kelompokUtama(b.kelompok);
      if (ka.prodi !== kb.prodi) return ka.prodi < kb.prodi ? -1 : 1;
      var ta = URUT_TINGKAT[ka.tingkat] || 9, tb = URUT_TINGKAT[kb.tingkat] || 9;
      if (ta !== tb) return ta - tb;
      return (a.penyedia_nama || '').localeCompare(b.penyedia_nama || '');
    });

    // AUDIT wajib: SIAPA membaca rekening SIAPA (nitList), KAPAN — tanpa nomornya.
    auditLog(session, 'cetak.form10', 'TARUNA_REKENING', nitList.join(','), null, { nit_list: nitList });

    return {
      bulan: bulan,
      pembayaran: {
        bayar_id: pembayaran.bayar_id,
        nilai_total: _int_(pembayaran.nilai_total, 'nilai_total'),
        no_spm: pembayaran.no_spm, tgl_spm: _tglStr_(pembayaran.tgl_spm),
        no_sp2d: pembayaran.no_sp2d, tgl_sp2d: _tglStr_(pembayaran.tgl_sp2d),
        status: pembayaran.status
      },
      per_suplier: perSuplierArr,
      total_nominal: totalNominal,
      nominal_terbilang: _terbilangRupiah_(totalNominal),
      pejabat: PEJABAT
    };
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 22_rekening.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
/**
 * 22_rekening.gs — TARUNA_REKENING: nomor rekening LENGKAP taruna (docs/skema-sheet.md §16)
 *
 * ACTION: rekening.lihat_lengkap (ADMIN, PPK), rekening.simpan (ADMIN),
 *         rekening.simpan_batch (ADMIN)
 *
 * PENGECUALIAN KEAMANAN TERBATAS — satu-satunya tempat di e-BAMA yang boleh
 * menyimpan nomor rekening PENUH (di luar sheet ini, semua tempat lain HANYA
 * boleh menyimpan/menampilkan rek_mask 4 digit, lihat CLAUDE.md §4/§7). Setiap
 * pemanggilan rekening.lihat_lengkap yang berhasil WAJIB tercatat di AUDIT_LOG
 * (siapa melihat rekening siapa, kapan) — TANPA nomor rekeningnya sendiri.
 */

/** Peta penyedia_id → baris PENYEDIA (validasi + join nama). */
function _penyediaById_() {
  var m = {};
  sheetRead(SHEETS.PENYEDIA).forEach(function (p) { m[String(p.penyedia_id)] = p; });
  return m;
}

/** Normalisasi payload {nit} atau {nit_list} → array string NIT non-kosong. */
function _normalisasiNitList_(payload) {
  var list = [];
  if (payload && payload.nit_list) list = payload.nit_list;
  else if (payload && payload.nit) list = [payload.nit];
  return list.map(function (n) { return String(n).trim(); }).filter(function (n) { return !!n; });
}

/**
 * rekening.lihat_lengkap {nit} atau {nit_list} → daftar rekening lengkap.
 * Role ADMIN/PPK diperiksa DUA kali: di ACTION_MAP.roles (01_router.gs) DAN
 * di sini via _hanyaAdminPPK_ — supaya handler tidak pernah bergantung
 * satu-satunya pada konfigurasi router.
 */
function rekeningLihatLengkap(payload, session) {
  _hanyaAdminPPK_(session);
  var nitList = _normalisasiNitList_(payload);
  if (!nitList.length) throw _fail_('nit atau nit_list wajib diisi.');

  return withLock(function () {
    var rows = sheetRead(SHEETS.TARUNA_REKENING, function (r) { return nitList.indexOf(String(r.nit)) >= 0; });
    var byNit = {};
    rows.forEach(function (r) { byNit[String(r.nit)] = r; });

    var penyediaMap = _penyediaById_();
    var hasil = nitList.map(function (nit) {
      var r = byNit[nit];
      if (!r) return { nit: nit, no_rekening_lengkap: '', bank: '', nama_pemilik: '', penyedia_id: '', penyedia_nama: '', belum_ada: true };
      var pid = String(r.penyedia_id || '');
      var p = penyediaMap[pid];
      return {
        nit: nit, no_rekening_lengkap: r.no_rekening_lengkap, bank: r.bank, nama_pemilik: r.nama_pemilik,
        penyedia_id: pid, penyedia_nama: p ? p.nama : ''
      };
    });

    // AUDIT: catat SIAPA (session.user_id, via auditLog) melihat rekening SIAPA
    // (daftar NIT) dan KAPAN (timestamp) — JANGAN pernah simpan nomor rekening
    // itu sendiri di AUDIT_LOG, sekalipun di data_baru.
    auditLog(session, 'rekening.lihat_lengkap', 'TARUNA_REKENING', nitList.join(','), null, { nit_list: nitList });

    return { rekening: hasil };
  });
}

/**
 * rekening.cocokkan {no_rekening_list, bulan?, bank?} — arah SEBALIKNYA dari
 * rekening.lihat_lengkap (rekening→NIT, bukan NIT→rekening). Dipakai importer
 * gagal-debet (/tagihan/impor-debet): nomor rekening PENUH dari laporan bank
 * dicocokkan EXACT ke TARUNA_REKENING.no_rekening_lengkap → NIT pemiliknya,
 * bukan tebak nama (nama di laporan bank sering terpotong). Role ADMIN/PPK,
 * diperiksa dua kali (ACTION_MAP.roles + _hanyaAdminPPK_ di sini). WAJIB 1 baris
 * AUDIT_LOG per pemanggilan berhasil — TANPA nomor rekening di AUDIT_LOG.
 */
function rekeningCocokkan(payload, session) {
  _hanyaAdminPPK_(session);
  var daftar = ((payload && payload.no_rekening_list) || [])
    .map(function (n) { return String(n).trim(); })
    .filter(function (n) { return !!n; });
  if (!daftar.length) throw _fail_('no_rekening_list wajib diisi.');

  return withLock(function () {
    var byRekening = {};
    sheetRead(SHEETS.TARUNA_REKENING).forEach(function (r) { byRekening[String(r.no_rekening_lengkap)] = r; });

    var hasil = daftar.map(function (noRek) {
      var r = byRekening[noRek];
      if (!r) return { no_rekening: noRek, ditemukan: false };
      return { no_rekening: noRek, ditemukan: true, nit: r.nit, nama_pemilik: r.nama_pemilik, bank: r.bank };
    });

    // AUDIT: jumlah dicocokkan/ditemukan + konteks (bulan/bank) bila dikirim —
    // JANGAN pernah simpan nomor rekening itu sendiri di AUDIT_LOG.
    var konteks = (payload && payload.bulan ? payload.bulan : '?') + ':' + (payload && payload.bank ? payload.bank : '?');
    auditLog(session, 'rekening.cocokkan', 'TARUNA_REKENING', konteks, null,
      { jumlah_dicocokkan: daftar.length, jumlah_ditemukan: hasil.filter(function (h) { return h.ditemukan; }).length });

    return { hasil: hasil };
  });
}

/**
 * rekening.simpan {nit, no_rekening_lengkap, bank, nama_pemilik, penyedia_id?}
 * — isi/perbarui satu baris. Role ADMIN SAJA (bukan PPK juga) supaya input data
 * sensitif ini tetap satu pintu. `penyedia_id` (opsional) = suplier yang
 * dipasangkan ke rekening taruna ini (FK PENYEDIA) — dipakai memecah pengajuan
 * SPM per suplier (Form-10). Bila key `penyedia_id` tidak dikirim, nilai lama
 * dipertahankan; bila dikirim '' → dikosongkan.
 */
function rekeningSimpan(payload, session) {
  var nit = (payload && payload.nit != null) ? String(payload.nit).trim() : '';
  var noRek = (payload && payload.no_rekening_lengkap != null) ? String(payload.no_rekening_lengkap).trim() : '';
  var bank = payload && payload.bank;
  var namaPemilik = (payload && payload.nama_pemilik != null) ? String(payload.nama_pemilik).trim() : '';
  var kirimPenyedia = payload && payload.penyedia_id !== undefined;
  var penyediaId = kirimPenyedia ? String(payload.penyedia_id || '').trim() : '';

  if (!nit) throw _fail_('nit wajib diisi.');
  if (!sheetRead(SHEETS.TARUNA, function (r) { return String(r.nit) === nit; })[0]) {
    throw _fail_('Taruna tidak ditemukan: ' + nit);
  }
  if (!noRek) throw _fail_('no_rekening_lengkap wajib diisi.');
  if (ENUM.BANK.indexOf(bank) < 0) throw _fail_('bank tidak valid.');
  if (!namaPemilik) throw _fail_('nama_pemilik wajib diisi.');
  if (penyediaId && !_penyediaById_()[penyediaId]) throw _fail_('Penyedia tidak ditemukan: ' + penyediaId);

  return withLock(function () {
    var ada = sheetRead(SHEETS.TARUNA_REKENING, function (r) { return String(r.nit) === nit; })[0];
    var penyediaFinal = kirimPenyedia ? penyediaId : (ada ? String(ada.penyedia_id || '') : '');
    var nilai = {
      nit: nit, no_rekening_lengkap: noRek, bank: bank, nama_pemilik: namaPemilik,
      updated_by: session.user_id, updated_at: new Date(), penyedia_id: penyediaFinal
    };
    if (ada) {
      sheetUpdate(SHEETS.TARUNA_REKENING, 'nit', nit, nilai);
    } else {
      sheetAppend(SHEETS.TARUNA_REKENING, nilai);
    }

    // AUDIT: field yang berubah dicatat, nomor rekeningnya sendiri TIDAK.
    auditLog(session, 'rekening.simpan', 'TARUNA_REKENING', nit,
      ada ? { bank: ada.bank, nama_pemilik: ada.nama_pemilik, penyedia_id: ada.penyedia_id || '' } : null,
      { bank: bank, nama_pemilik: namaPemilik, penyedia_id: penyediaFinal, rekening_diubah: true });

    return { nit: nit, bank: bank, nama_pemilik: namaPemilik, penyedia_id: penyediaFinal };
  });
}

/**
 * rekening.simpan_batch {baris:[{nit, no_rekening_lengkap, bank, nama_pemilik}]}
 * — versi batch rekening.simpan, dipakai utk isi massal dari sumber terpercaya
 * (mis. laporan Autotran bank yang sudah dicocokkan manual ke NIT oleh Admin di
 * frontend — lihat halaman Impor Rekening). Role ADMIN SAJA, sama seperti
 * rekening.simpan. Tiap baris tetap diaudit SATU-SATU (granularitas sama
 * dengan rekening.simpan tunggal), bukan satu baris audit gabungan.
 */
function rekeningSimpanBatch(payload, session) {
  var baris = (payload && payload.baris) || [];
  if (!baris.length) throw _fail_('baris tidak boleh kosong.');

  var tarunaValid = {};
  sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaValid[String(t.nit)] = true; });

  // Validasi semua baris DULU sebelum menulis apa pun (all-or-nothing).
  baris.forEach(function (b) {
    var nit = (b && b.nit != null) ? String(b.nit).trim() : '';
    if (!nit) throw _fail_('nit wajib diisi pada setiap baris.');
    if (!tarunaValid[nit]) throw _fail_('Taruna tidak ditemukan: ' + nit);
    if (!(b.no_rekening_lengkap && String(b.no_rekening_lengkap).trim())) throw _fail_('no_rekening_lengkap wajib diisi untuk NIT ' + nit + '.');
    if (ENUM.BANK.indexOf(b.bank) < 0) throw _fail_('bank tidak valid untuk NIT ' + nit + '.');
    if (!(b.nama_pemilik && String(b.nama_pemilik).trim())) throw _fail_('nama_pemilik wajib diisi untuk NIT ' + nit + '.');
    // penyedia_id di impor batch BOLEH kode suplier eksternal (mis. 7 digit SPAN)
    // yang belum ada di master PENYEDIA — disimpan apa adanya; Form-10 tetap
    // mengelompokkan per ID (nama tampil setelah master diisi). Tidak divalidasi
    // ketat di sini (beda dari rekening.simpan modal yang pakai dropdown terkontrol).
  });

  return withLock(function () {
    var existingByNit = {};
    sheetRead(SHEETS.TARUNA_REKENING).forEach(function (r) { existingByNit[String(r.nit)] = r; });

    var n = 0;
    baris.forEach(function (b) {
      var nit = String(b.nit).trim();
      var noRek = String(b.no_rekening_lengkap).trim();
      var bank = b.bank;
      var namaPemilik = String(b.nama_pemilik).trim();
      var ada = existingByNit[nit];
      // penyedia_id: bila key dikirim (walau '') dipakai; kalau tidak, pertahankan lama.
      var kirimPenyedia = b.penyedia_id !== undefined;
      var penyediaFinal = kirimPenyedia ? String(b.penyedia_id || '').trim() : (ada ? String(ada.penyedia_id || '') : '');
      var nilai = {
        nit: nit, no_rekening_lengkap: noRek, bank: bank, nama_pemilik: namaPemilik,
        updated_by: session.user_id, updated_at: new Date(), penyedia_id: penyediaFinal
      };
      if (ada) {
        sheetUpdate(SHEETS.TARUNA_REKENING, 'nit', nit, nilai);
      } else {
        sheetAppend(SHEETS.TARUNA_REKENING, nilai);
      }
      auditLog(session, 'rekening.simpan', 'TARUNA_REKENING', nit,
        ada ? { bank: ada.bank, nama_pemilik: ada.nama_pemilik, penyedia_id: ada.penyedia_id || '' } : null,
        { bank: bank, nama_pemilik: namaPemilik, penyedia_id: penyediaFinal, rekening_diubah: true, sumber: 'rekening.simpan_batch' });
      n++;
    });

    return { disimpan: n };
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 23_sp2d.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
/**
 * 23_sp2d.gs — Rekonsiliasi SP2D vs data sistem (REKAP_BULANAN/BANTUAN_LUAR_KAMPUS)
 *
 * ACTION: sp2d.import (PPK, ADMIN), sp2d.rekonsiliasi (PPK, KPA, WADIR3, ADMIN)
 *
 * Latar belakang: file "Monitoring SP2D" (ekspor OM-SPAN/SAKTI) mencatat SATU
 * baris per kombinasi Prodi+Tingkat+Bulan (Dalam Kampus) atau per
 * Prodi+Tingkat+Bulan+Kegiatan (Luar Kampus) — BUKAN satu baris per bulan
 * untuk seluruh taruna seperti asumsi awal PEMBAYARAN. Karena granularitasnya
 * jauh lebih rinci (bahkan bisa per rentang tanggal utk Luar Kampus), rekonsiliasi
 * dilakukan lewat PERBANDINGAN JUMLAH per kelompok (Prodi+Tingkat+Bulan[+Kegiatan]),
 * BUKAN penautan baris-per-baris yang kaku (rawan salah cocok).
 *
 * Prodi/Tingkat/Bulan/Kegiatan tidak ada di kolom file sumber — diparse dari
 * teks bebas "Uraian SPP/SPM" (lihat _parseUraianSpm_). Kalau parsing gagal,
 * baris tetap masuk (data uang tidak boleh hilang) tapi ditandai
 * perlu_cek_manual='YA' dan DIKECUALIKAN dari rekonsiliasi otomatis.
 *
 * Format kedua ("SPANExt") — satu baris per TARUNA penerima (bukan per
 * kelompok). Dikirim dengan `nit` terisi (dicocokkan Admin/PPK dari nama
 * penerima di frontend). `prodi`/`tingkat` diparse dari Deskripsi sebagai
 * SNAPSHOT saat pembayaran (dikonfirmasi Firdaus) supaya tabel SP2D_MONITORING
 * langsung terbaca; kalau gagal parse, dikosongkan (tetap bisa diturunkan via
 * join TARUNA saat rekonsiliasi). `jumlah_orang` tetap kosong (per baris = 1).
 */

var _SP2D_BULAN_MAP_ = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12
};

/** Parse "Program Studi III TBP" atau "Prodi III TBP" → {prodi:'TBP', tingkat:'III'} atau null. */
function _parseProdiTingkat_(teks) {
  var m = /(?:Program Studi|Prodi)\s+(I{1,3})\s+(TPI|MP|TBP)/i.exec(teks);
  if (!m) return null;
  return { tingkat: m[1].toUpperCase(), prodi: m[2].toUpperCase() };
}

/**
 * Parse bulan MAKAN dari Uraian → 'YYYY-MM' atau null. Prioritas:
 *  1) "Bulan Mei 2026" (Dalam Kampus & SPANExt).
 *  2) "Periode [Bulan] [tgl] <bulan> <tahun>" (Luar Kampus) — mis.
 *     "Periode 1 Mei 2026 s.d 31 Mei 2026", "Periode April 2026",
 *     "Periode Bulan Februari 2026". DIANCHOR ke kata "Periode" supaya TIDAK
 *     salah ambil tanggal SK ("...Tanggal 27 Februari 2026") yang formatnya
 *     juga tgl-bulan-tahun. Kalau tak ada pola dikenal → null (perlu_cek_manual).
 */
function _parseBulanUraian_(teks) {
  var namaBulan = Object.keys(_SP2D_BULAN_MAP_).join('|');
  var m = new RegExp('Bulan\\s+(' + namaBulan + ')\\s+(\\d{4})', 'i').exec(teks);
  if (m) return m[2] + '-' + ('0' + _SP2D_BULAN_MAP_[m[1].toLowerCase()]).slice(-2);
  m = new RegExp('Periode\\s+(?:Bulan\\s+)?(?:\\d{1,2}\\s+)?(' + namaBulan + ')\\s+(\\d{4})', 'i').exec(teks);
  if (m) return m[2] + '-' + ('0' + _SP2D_BULAN_MAP_[m[1].toLowerCase()]).slice(-2);
  return null;
}

/** Parse jenis kegiatan Luar Kampus dari teks Uraian (KPA/PKL2/PKL3/PTB) atau null. */
function _parseKegiatanUraian_(teks) {
  if (/Praktik Pembelajaran Taruna Berprestasi/i.test(teks)) return 'PTB';
  if (/PKL\s*III/i.test(teks)) return 'PKL3';
  if (/PKL\s*II\b/i.test(teks)) return 'PKL2';
  if (/\bKPA\b/i.test(teks)) return 'KPA';
  return null;
}

/**
 * Deteksi apakah teks Uraian sebenarnya bertema LUAR KAMPUS (KPA/PKL/PTB) —
 * dipakai sebagai PENGAMAN saat impor kategori DALAM_KAMPUS supaya baris KPA/PKL
 * yang salah pilih kategori tidak mencemari rekonsiliasi Dalam Kampus
 * (dikonfirmasi Firdaus: Mei 2026 rincian KPA per-taruna sempat masuk sebagai
 * DALAM_KAMPUS → tampak "selisih"/dobel).
 *
 * PENTING: nomor SK memuat "KPA.PKPS" (Kuasa Pengguna Anggaran) di HAMPIR SEMUA
 * uraian, termasuk Dalam Kampus asli — jadi KPA sebagai KEGIATAN hanya dikenali
 * bila muncul sebagai "Taruna KPA" (kegiatan), BUKAN "KPA.PKPS" di nomor SK.
 */
function _uraianTerlihatLuarKampus_(teks) {
  var t = String(teks || '');
  return /Praktik Pembelajaran Taruna Berprestasi/i.test(t)
    || /PKL\s*III/i.test(t)
    || /PKL\s*II\b/i.test(t)
    || /Taruna\s+KPA\b/i.test(t);
}

/** Parse "...untuk 28 Orang" → 28 atau null. */
function _parseJmlOrangUraian_(teks) {
  var m = /untuk\s+(\d+)\s+Orang/i.exec(teks);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Parse satu baris Uraian SPP/SPM → {prodi, tingkat, bulan, kegiatan, jumlah_orang, gagal}.
 * kegiatan hanya wajib untuk kategori LUAR_KAMPUS.
 */
function _parseUraianSpm_(uraian, kategori) {
  var teks = String(uraian || '');
  var pt = _parseProdiTingkat_(teks);
  var bulan = _parseBulanUraian_(teks);
  var kegiatan = kategori === 'LUAR_KAMPUS' ? _parseKegiatanUraian_(teks) : null;
  var jmlOrang = _parseJmlOrangUraian_(teks);

  var gagal = !pt || !bulan || jmlOrang === null || (kategori === 'LUAR_KAMPUS' && !kegiatan);
  return {
    prodi: pt ? pt.prodi : '',
    tingkat: pt ? pt.tingkat : '',
    bulan: bulan || '',
    kegiatan: kegiatan || '',
    jumlah_orang: jmlOrang,
    gagal: gagal
  };
}

/**
 * Hasil parsing satu baris ber-nit (format SPANExt, per-taruna). bulan =
 * bulan MAKAN, diparse dari teks Deskripsi ("...Bulan Januari 2026...") —
 * BUKAN dari tgl_sp2d (tanggal pencairan; sering beda bulan dari bulan makan,
 * mis. makan Januari dibayar Februari). REKAP_BULANAN dikunci per bulan makan,
 * jadi kalau pakai tgl_sp2d rekonsiliasi akan salah kelompok / selalu selisih.
 * prodi/tingkat DIPARSE dari Deskripsi juga (dikonfirmasi Firdaus) sebagai
 * SNAPSHOT saat pembayaran, supaya tabel SP2D_MONITORING langsung terbaca —
 * best-effort: kalau gagal parse, dikosongkan TANPA menandai perlu_cek_manual
 * (nit tetap kunci; prodi/tingkat bisa diturunkan via join TARUNA saat
 * rekonsiliasi). jumlah_orang tetap kosong (per baris = 1 taruna; "N Orang" di
 * Deskripsi itu ukuran kelompok, bukan per-individu). gagal=true hanya kalau
 * bulan tidak terbaca, kegiatan wajib (Luar Kampus) tidak ketemu, atau nit
 * tidak dikenal.
 */
function _parseBarisPerTaruna_(nit, uraian, kategori, tarunaValid) {
  var teks = String(uraian || '');
  var bulan = _parseBulanUraian_(teks);
  var kegiatan = kategori === 'LUAR_KAMPUS' ? _parseKegiatanUraian_(teks) : null;
  var pt = _parseProdiTingkat_(teks); // best-effort — tidak mempengaruhi gagal
  var gagal = !bulan || (kategori === 'LUAR_KAMPUS' && !kegiatan) || !tarunaValid[nit];
  return {
    prodi: pt ? pt.prodi : '', tingkat: pt ? pt.tingkat : '', bulan: bulan || '',
    kegiatan: kegiatan || '', jumlah_orang: null, gagal: gagal
  };
}

/**
 * Kunci dedup untuk no_spm — buang prefix lama "Ref No : " (format kunci
 * per-taruna sempat menyertakan prefix ini sebelum diperbaiki). Dipakai HANYA
 * untuk pembandingan "sudah ada / belum", bukan untuk mengubah data yang
 * tersimpan — supaya baris lama (masih berprefix) & baris baru (tanpa
 * prefix) dari SP2D yang SAMA tetap dikenali sebagai duplikat, walau bentuk
 * kuncinya beda karena perbaikan bug sebelumnya.
 */
function _kunciNoSpm_(s) {
  return String(s || '').replace(/^ref\s*no\s*:\s*/i, '').trim();
}

/**
 * Kunci dedup tambahan per (nit, no_sp2d) — lebih tahan dobel daripada `no_spm`
 * saja. `no_spm` baris SPANExt sering disintesis dari nama penerima (lihat
 * `validasiBarisPerTaruna` frontend) yang bisa berbeda ejaan/spasi antar
 * ekspor OM-SPAN untuk TRANSAKSI YANG SAMA — lolos dari deteksi `no_spm` dan
 * masuk sebagai baris dobel (nominal taruna itu ikut terhitung dua kali di
 * rekonsiliasi). Kunci ini HANYA berlaku bila `nit` & `no_sp2d` sama-sama
 * terisi (baris agregat tanpa nit, atau SP2D belum terbit, tak diperiksa —
 * tak ada dasar deteksi dobel yang aman untuk itu).
 */
function _kunciNitSp2d_(nit, noSp2d) {
  var n = String(nit || '').trim(), s = String(noSp2d || '').trim();
  return (n && s) ? (n + '|' + s) : '';
}

/**
 * sp2d.import {kategori, baris:[{no_spm, nit?, tgl_spm?, no_sp2d?, tgl_sp2d?,
 * jumlah_pembayaran, status_sp2d?, uraian_asli}]} — HANYA MENAMBAH baris
 * dengan no_spm yang belum pernah ada (dikonfirmasi Firdaus: cek impor bulanan
 * hanya untuk penambahan, bukan mengulang proses semua riwayat). `nit` opsional
 * — terisi untuk format per-taruna (SPANExt), kosong untuk format agregat lama.
 * Dedup GANDA: `no_spm` (kunci utama) DAN `(nit, no_sp2d)` (kunci tambahan,
 * lihat `_kunciNitSp2d_`) — mencegah taruna yang sama & SP2D yang sama masuk
 * dua kali walau `no_spm` hasil sintesis kebetulan berbeda (impor ulang file
 * yang sama/mirip). Diperiksa juga ANTAR baris dalam satu batch impor.
 */
function sp2dImport(payload, session) {
  var kategori = payload && payload.kategori;
  if (ENUM.SP2D_KATEGORI.indexOf(kategori) < 0) throw _fail_('kategori tidak valid.');
  var baris = (payload && payload.baris) || [];
  if (!baris.length) throw _fail_('baris tidak boleh kosong.');

  return withLock(function () {
    var adaNoSpm = {};
    var adaNitSp2d = {};
    sheetRead(SHEETS.SP2D_MONITORING).forEach(function (r) {
      adaNoSpm[_kunciNoSpm_(r.no_spm)] = true;
      var kNit = _kunciNitSp2d_(r.nit, r.no_sp2d);
      if (kNit) adaNitSp2d[kNit] = true;
    });
    var tarunaValid = {};
    sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaValid[String(t.nit)] = true; });

    var ditambah = 0, dilewati = 0;
    var bulanDalamKampusTersentuh = {}; // dipakai sinkronisasi PEMBAYARAN legacy di bawah
    var bulanTersentuh = {}; // dipakai auto-isi SPM (kedua kategori) di bawah
    baris.forEach(function (b) {
      var noSpm = String((b && b.no_spm) || '').trim();
      if (!noSpm) throw _fail_('no_spm wajib diisi pada setiap baris.');
      var nit = (b && b.nit) ? String(b.nit).trim() : '';
      var noSp2dMentah = (b.no_sp2d && b.no_sp2d !== '-') ? String(b.no_sp2d) : '';
      var kunciNit = _kunciNitSp2d_(nit, noSp2dMentah);
      if (adaNoSpm[_kunciNoSpm_(noSpm)] || (kunciNit && adaNitSp2d[kunciNit])) {
        dilewati++; return; // sudah pernah masuk (no_spm ATAU nit+no_sp2d sama) — lewati
      }

      var uraian = String((b && b.uraian_asli) || '');
      var hasil = nit
        ? _parseBarisPerTaruna_(nit, uraian, kategori, tarunaValid)
        : _parseUraianSpm_(uraian, kategori);
      // PENGAMAN salah-kategori: baris DALAM_KAMPUS yang uraiannya justru KPA/PKL/
      // PTB (Luar Kampus) → tandai perlu_cek_manual supaya DIKELUARKAN dari
      // rekonsiliasi Dalam Kampus (tidak menumpuk jadi "selisih"/dobel).
      var salahKategori = kategori === 'DALAM_KAMPUS' && _uraianTerlihatLuarKampus_(uraian);
      sheetAppend(SHEETS.SP2D_MONITORING, {
        no_spm: noSpm, kategori: kategori, nit: nit,
        prodi: hasil.prodi, tingkat: hasil.tingkat, bulan: hasil.bulan, kegiatan: hasil.kegiatan,
        jumlah_orang: hasil.jumlah_orang !== null ? hasil.jumlah_orang : '',
        jumlah_pembayaran: _int_(b.jumlah_pembayaran, 'jumlah_pembayaran'),
        tgl_spm: (b.tgl_spm && b.tgl_spm !== '-') ? b.tgl_spm : '',
        no_sp2d: noSp2dMentah,
        tgl_sp2d: (b.tgl_sp2d && b.tgl_sp2d !== '-') ? b.tgl_sp2d : '',
        status_sp2d: (b.status_sp2d && b.status_sp2d !== '-') ? String(b.status_sp2d) : '',
        uraian_asli: uraian,
        perlu_cek_manual: (hasil.gagal || salahKategori) ? 'YA' : ''
      });
      adaNoSpm[_kunciNoSpm_(noSpm)] = true;
      if (kunciNit) adaNitSp2d[kunciNit] = true;
      ditambah++;
      if (kategori === 'DALAM_KAMPUS' && !hasil.gagal && !salahKategori && hasil.bulan) bulanDalamKampusTersentuh[hasil.bulan] = true;
      if (!hasil.gagal && !salahKategori && hasil.bulan) bulanTersentuh[hasil.bulan] = true;
    });

    auditLog(session, 'sp2d.import', 'SP2D_MONITORING', null, null,
      { kategori: kategori, ditambah: ditambah, dilewati: dilewati });

    // Sinkronkan PEMBAYARAN Dalam Kampus bulan yang tersentuh — begitu SEMUA
    // kelompok Prodi+Tingkat bulan itu cocok, otomatis SELESAI (dikonfirmasi
    // Firdaus: SP2D terbit lengkap = dana sudah cair ke taruna, tanpa PPK
    // perlu ketik ulang satu nomor SPM/SP2D "wakil" secara manual).
    Object.keys(bulanDalamKampusTersentuh).forEach(function (bln) {
      _sinkronkanPembayaranDariSp2d_(bln, session, 'AUTO_IMPOR');
    });

    // Auto-isi no_spm/tgl_spm/no_sp2d/tgl_sp2d SPM (§18) dari data yang baru
    // masuk — kedua kategori, hanya kelompok yang tak ambigu (lihat catatan
    // _autoIsiSpmDariSp2d_ di 15_pembayaran.gs). Silent, bukan bagian syarat
    // sukses impor.
    Object.keys(bulanTersentuh).forEach(function (bln) {
      _autoIsiSpmDariSp2d_(bln, session, 'AUTO_IMPOR');
    });

    return { ditambah: ditambah, dilewati: dilewati };
  });
}

/** Kelompokkan array objek by kunci(item) → jumlah SUM(nilai(item)). */
function _kelompokkanJumlah_(items, kunciFn, nilaiFn) {
  var map = {};
  items.forEach(function (it) {
    var k = kunciFn(it);
    map[k] = (map[k] || 0) + nilaiFn(it);
  });
  return map;
}

/**
 * SUM(nominal) REKAP_BULANAN `bulan` per kelompok (prodi|tingkat), di-join
 * TARUNA — sumber angka "Sistem" Dalam Kampus. Diekstrak supaya sp2dRekonsiliasi
 * (kolom `dalam_kampus`) dan _rincianSp2dDalamKampus_ (halaman Pembayaran)
 * menghitung dari rumus yang SAMA — angka tak akan pernah beda antar dua
 * tampilan. `bulan` difilter dengan _bulanStr_ (kolom bulan bisa auto-tertafsir
 * Date oleh Google Sheets; lihat catatan panjang di sp2dRekonsiliasi).
 */
function _sistemDalamKampusPerKelompok_(bulan, tarunaByNit) {
  var rekapRows = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  return _kelompokkanJumlah_(
    rekapRows.map(function (r) {
      var t = tarunaByNit[String(r.nit)] || {};
      return { kunci: (t.prodi || '?') + '|' + (t.tingkat || '?'), nominal: _int_(r.nominal || 0, 'nominal') };
    }),
    function (x) { return x.kunci; }, function (x) { return x.nominal; }
  );
}

/**
 * SUM(nominal) REKAP_BULANAN `bulan` per kelompok (prodi|tingkat) DAN per suplier
 * (TARUNA_REKENING.penyedia_id) — pecahan lebih rinci dari
 * _sistemDalamKampusPerKelompok_, dipakai HANYA utk kolom "Sistem" per suplier
 * di Rincian SP2D (`_rincianSp2dDalamKampus_`). Angka "Sistem" ini ASLI (dihitung
 * dari data internal e-BAMA) — beda dgn kolom "SP2D" per suplier di pemanggil,
 * yang cuma PERKIRAAN (dibagi proporsional) karena SP2D_MONITORING (impor KPPN)
 * tidak punya kolom suplier sama sekali (dikonfirmasi Firdaus). Taruna tanpa
 * penyedia_id masuk kunci suplier '' (BELUM DITENTUKAN).
 */
function _sistemDalamKampusPerKelompokSuplier_(bulan, tarunaByNit, rekeningByNit) {
  var rekapRows = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  var hasil = {};
  rekapRows.forEach(function (r) {
    var nit = String(r.nit);
    var t = tarunaByNit[nit] || {};
    var rek = rekeningByNit[nit];
    var kunciKelompok = (t.prodi || '?') + '|' + (t.tingkat || '?');
    var pid = (rek && rek.penyedia_id) ? String(rek.penyedia_id) : '';
    if (!hasil[kunciKelompok]) hasil[kunciKelompok] = {};
    hasil[kunciKelompok][pid] = (hasil[kunciKelompok][pid] || 0) + _int_(r.nominal || 0, 'nominal');
  });
  return hasil;
}

/**
 * sp2d.rekonsiliasi {bulan} — bandingkan SUM per kelompok (Prodi+Tingkat[+Kegiatan])
 * antara data sistem (REKAP_BULANAN/BANTUAN_LUAR_KAMPUS, di-join TARUNA utk
 * prodi+tingkat) vs SUM jumlah_pembayaran SP2D_MONITORING kelompok yang sama.
 * Baris SP2D yang perlu_cek_manual='YA' DIKECUALIKAN dari perbandingan, tapi
 * tetap dikembalikan terpisah sebagai daftar untuk dicek manual.
 *
 * Juga menghitung CROSS-CHECK per No. SP2D (cross_check_sp2d): menautkan baris
 * AGREGAT (Monitoring, acuan total) dengan baris RINCIAN (SPANExt, per taruna)
 * lewat `no_sp2d` — dikonfirmasi Firdaus 1 No. SP2D = 1 kelompok tingkat
 * penerima. Cek: SUM(rincian) harus = jumlah_pembayaran agregat, dan
 * COUNT(rincian) harus = "untuk N Orang" di agregat. Ini membuktikan agregat &
 * rincian saling konsisten (rincian tidak ada yang hilang/dobel/salah input).
 */
function sp2dRekonsiliasi(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');

  var tarunaByNit = {};
  sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });

  // _bulanStr_ (BUKAN String() polos) — cermin cara REKAP_BULANAN/BANTUAN_LUAR_KAMPUS
  // difilter di bawah. Kolom `bulan` bertipe teks ('2026-04'), tapi kalau Google
  // Sheets pernah menafsirkannya sebagai tanggal (Date), String(Date) TIDAK PERNAH
  // sama dengan '2026-04' — bikin sp2dBulan selalu kosong padahal datanya ada
  // (gejala: kolom "Sistem" di rekonsiliasi terisi normal, tapi "SP2D" selalu Rp0
  // utk SEMUA kelompok bulan itu). _bulanStr_ menangani String MAUPUN Date.
  var sp2dBulan = sheetRead(SHEETS.SP2D_MONITORING, function (r) { return _bulanStr_(r.bulan) === bulan; });
  var sp2dValid = sp2dBulan.filter(function (r) { return r.perlu_cek_manual !== 'YA'; });
  var perluCekManual = sp2dBulan
    .filter(function (r) { return r.perlu_cek_manual === 'YA'; })
    .map(function (r) {
      return { no_spm: r.no_spm, kategori: r.kategori, jumlah_pembayaran: _int_(r.jumlah_pembayaran || 0, 'jumlah_pembayaran'), uraian_asli: r.uraian_asli };
    });

  // Baris ber-nit (format per-taruna/SPANExt) DIKECUALIKAN dari kelompok
  // agregat di bawah — prodi/tingkat-nya sengaja kosong (lihat catatan modul),
  // jadi ikut di sini akan lumped jadi satu kelompok "prodi/tingkat kosong"
  // yang keliru. Baris ber-nit punya perbandingannya sendiri (per_taruna).
  var sp2dAgregat = sp2dValid.filter(function (r) { return !r.nit; });
  var sp2dPerTaruna = sp2dValid.filter(function (r) { return !!r.nit; });

  // ── Dalam Kampus (agregat): REKAP_BULANAN × TARUNA, kelompok (prodi, tingkat) ──
  var rekapRows = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  var sistemDalam = _sistemDalamKampusPerKelompok_(bulan, tarunaByNit);
  var sp2dDalam = _kelompokkanJumlah_(
    sp2dAgregat.filter(function (r) { return r.kategori === 'DALAM_KAMPUS'; }),
    function (r) { return r.prodi + '|' + r.tingkat; },
    function (r) { return _int_(r.jumlah_pembayaran || 0, 'jumlah_pembayaran'); }
  );
  var kunciDalam = {};
  Object.keys(sistemDalam).forEach(function (k) { kunciDalam[k] = true; });
  Object.keys(sp2dDalam).forEach(function (k) { kunciDalam[k] = true; });
  var dalamKampus = Object.keys(kunciDalam).sort().map(function (k) {
    var parts = k.split('|');
    var sistem = sistemDalam[k] || 0, sp2d = sp2dDalam[k] || 0;
    return { prodi: parts[0], tingkat: parts[1], sistem: sistem, sp2d: sp2d, selisih: sistem - sp2d, cocok: sistem === sp2d };
  });

  // ── Luar Kampus (agregat): BANTUAN_LUAR_KAMPUS × TARUNA, kelompok (kegiatan, prodi, tingkat) ──
  var blkRows = sheetRead(SHEETS.BANTUAN_LUAR_KAMPUS, function (r) { return _bulanStr_(r.bulan) === bulan; });
  var sistemLuar = _kelompokkanJumlah_(
    blkRows.map(function (r) {
      var t = tarunaByNit[String(r.nit)] || {};
      return { kunci: r.kegiatan + '|' + (t.prodi || '?') + '|' + (t.tingkat || '?'), nominal: _int_(r.nominal || 0, 'nominal') };
    }),
    function (x) { return x.kunci; }, function (x) { return x.nominal; }
  );
  var sp2dLuar = _kelompokkanJumlah_(
    sp2dAgregat.filter(function (r) { return r.kategori === 'LUAR_KAMPUS'; }),
    function (r) { return r.kegiatan + '|' + r.prodi + '|' + r.tingkat; },
    function (r) { return _int_(r.jumlah_pembayaran || 0, 'jumlah_pembayaran'); }
  );
  var kunciLuar = {};
  Object.keys(sistemLuar).forEach(function (k) { kunciLuar[k] = true; });
  Object.keys(sp2dLuar).forEach(function (k) { kunciLuar[k] = true; });
  var luarKampus = Object.keys(kunciLuar).sort().map(function (k) {
    var parts = k.split('|');
    var sistem = sistemLuar[k] || 0, sp2d = sp2dLuar[k] || 0;
    return { kegiatan: parts[0], prodi: parts[1], tingkat: parts[2], sistem: sistem, sp2d: sp2d, selisih: sistem - sp2d, cocok: sistem === sp2d };
  });

  // ── Dalam Kampus (per-taruna/SPANExt): REKAP_BULANAN vs SP2D, kelompok (nit) ──
  // prodi/tingkat DITURUNKAN via join TARUNA di sini, TIDAK dibaca dari SP2D_MONITORING.
  // Tabel ini HANYA dihitung kalau ada minimal satu baris SP2D per-taruna kategori
  // ybs bulan ini — kalau tidak, sistemDalamNit (dari SELURUH REKAP_BULANAN bulan
  // itu) akan lumped jadi "selisih" palsu untuk bulan yang memang masih format
  // agregat lama (belum ada impor SPANExt sama sekali).
  var sp2dPerTarunaDalam = sp2dPerTaruna.filter(function (r) { return r.kategori === 'DALAM_KAMPUS'; });
  var dalamKampusPerTaruna = [];
  if (sp2dPerTarunaDalam.length > 0) {
    var sistemDalamNit = _kelompokkanJumlah_(
      rekapRows, function (r) { return String(r.nit); }, function (r) { return _int_(r.nominal || 0, 'nominal'); }
    );
    var sp2dDalamNit = _kelompokkanJumlah_(
      sp2dPerTarunaDalam, function (r) { return String(r.nit); },
      function (r) { return _int_(r.jumlah_pembayaran || 0, 'jumlah_pembayaran'); }
    );
    // Kumpulkan No. SP2D per taruna (satu taruna bisa punya >1 baris SPANExt).
    var noSp2dDalamNit = {};
    sp2dPerTarunaDalam.forEach(function (r) {
      var nit = String(r.nit), no = String(r.no_sp2d || '').trim();
      if (!no) return;
      if (!noSp2dDalamNit[nit]) noSp2dDalamNit[nit] = [];
      if (noSp2dDalamNit[nit].indexOf(no) === -1) noSp2dDalamNit[nit].push(no);
    });
    // Kumpulkan No. SPM per taruna — dipakai tombol "Koreksi" per baris (UI) untuk
    // memindahkan baris SP2D_MONITORING taruna ini ke kategori lain via sp2d.koreksi
    // TANPA perlu mencarinya dulu di panel Koreksi Baris SP2D generik di bawah.
    var noSpmDalamNit = {};
    sp2dPerTarunaDalam.forEach(function (r) {
      var nit = String(r.nit), no = String(r.no_spm || '').trim();
      if (!no) return;
      if (!noSpmDalamNit[nit]) noSpmDalamNit[nit] = [];
      if (noSpmDalamNit[nit].indexOf(no) === -1) noSpmDalamNit[nit].push(no);
    });
    var kunciDalamNit = {};
    Object.keys(sistemDalamNit).forEach(function (k) { kunciDalamNit[k] = true; });
    Object.keys(sp2dDalamNit).forEach(function (k) { kunciDalamNit[k] = true; });
    dalamKampusPerTaruna = Object.keys(kunciDalamNit).sort().map(function (nit) {
      var t = tarunaByNit[nit] || {};
      var sistem = sistemDalamNit[nit] || 0, sp2d = sp2dDalamNit[nit] || 0;
      return {
        nit: nit, nama: t.nama || '', prodi: t.prodi || '', tingkat: t.tingkat || '',
        sistem: sistem, sp2d: sp2d, selisih: sistem - sp2d, cocok: sistem === sp2d,
        no_sp2d: (noSp2dDalamNit[nit] || []).sort(),
        no_spm: (noSpmDalamNit[nit] || []).sort()
      };
    });
  }

  // ── Luar Kampus (per-taruna/SPANExt): BANTUAN_LUAR_KAMPUS vs SP2D, kelompok (nit, kegiatan) ──
  // Sama seperti di atas: hanya dihitung kalau ada baris SPANExt Luar Kampus bulan ini.
  var sp2dPerTarunaLuar = sp2dPerTaruna.filter(function (r) { return r.kategori === 'LUAR_KAMPUS'; });
  var luarKampusPerTaruna = [];
  if (sp2dPerTarunaLuar.length > 0) {
    var sistemLuarNit = _kelompokkanJumlah_(
      blkRows, function (r) { return String(r.nit) + '|' + r.kegiatan; }, function (r) { return _int_(r.nominal || 0, 'nominal'); }
    );
    var sp2dLuarNit = _kelompokkanJumlah_(
      sp2dPerTarunaLuar, function (r) { return String(r.nit) + '|' + r.kegiatan; },
      function (r) { return _int_(r.jumlah_pembayaran || 0, 'jumlah_pembayaran'); }
    );
    // Kumpulkan No. SPM per (nit, kegiatan) — sama fungsinya seperti noSpmDalamNit di atas.
    var noSpmLuarNit = {};
    sp2dPerTarunaLuar.forEach(function (r) {
      var k = String(r.nit) + '|' + r.kegiatan, no = String(r.no_spm || '').trim();
      if (!no) return;
      if (!noSpmLuarNit[k]) noSpmLuarNit[k] = [];
      if (noSpmLuarNit[k].indexOf(no) === -1) noSpmLuarNit[k].push(no);
    });
    var kunciLuarNit = {};
    Object.keys(sistemLuarNit).forEach(function (k) { kunciLuarNit[k] = true; });
    Object.keys(sp2dLuarNit).forEach(function (k) { kunciLuarNit[k] = true; });
    luarKampusPerTaruna = Object.keys(kunciLuarNit).sort().map(function (k) {
      var parts = k.split('|'); var nit = parts[0], kegiatan = parts[1];
      var t = tarunaByNit[nit] || {};
      var sistem = sistemLuarNit[k] || 0, sp2d = sp2dLuarNit[k] || 0;
      return {
        nit: nit, nama: t.nama || '', kegiatan: kegiatan, prodi: t.prodi || '', tingkat: t.tingkat || '',
        sistem: sistem, sp2d: sp2d, selisih: sistem - sp2d, cocok: sistem === sp2d,
        no_spm: (noSpmLuarNit[k] || []).sort()
      };
    });
  }

  // ── Cross-check per No. SP2D: Agregat (acuan) vs Rincian (per taruna) ──
  // Dikonfirmasi Firdaus: 1 No. SP2D = 1 kelompok tingkat penerima. Tiap
  // no_sp2d menautkan SATU baris agregat (Monitoring) dengan N baris rincian
  // (SPANExt). Dipakai SEMUA baris bulan ini (termasuk perlu_cek_manual) selama
  // punya no_sp2d — cross-check ini soal kebenaran nominal, bukan hasil parse
  // prodi/kegiatan. Baris tanpa no_sp2d (SP2D belum terbit) dilewati.
  var perSp2d = {};
  sp2dBulan.forEach(function (r) {
    var noSp2d = String(r.no_sp2d || '').trim();
    if (!noSp2d) return;
    if (!perSp2d[noSp2d]) {
      perSp2d[noSp2d] = {
        no_sp2d: noSp2d, prodi: '', tingkat: '', kegiatan: '', kategori: r.kategori,
        agregat_total: 0, agregat_orang: 0, ada_agregat: false,
        rincian_total: 0, rincian_orang: 0
      };
    }
    var g = perSp2d[noSp2d];
    var jml = _int_(r.jumlah_pembayaran || 0, 'jumlah_pembayaran');
    if (r.nit) {
      // baris rincian (per taruna)
      g.rincian_total += jml;
      g.rincian_orang += 1;
      if (!g.prodi) { // prodi/tingkat via join TARUNA (kalau agregat belum ada)
        var t = tarunaByNit[String(r.nit)] || {};
        if (t.prodi) { g.prodi = t.prodi; g.tingkat = t.tingkat; }
      }
    } else {
      // baris agregat (acuan) — biasanya cuma 1 per no_sp2d, SUM utk jaga-jaga
      g.agregat_total += jml;
      g.agregat_orang += _int_(r.jumlah_orang || 0, 'jumlah_orang');
      g.ada_agregat = true;
      if (r.prodi) { g.prodi = r.prodi; g.tingkat = r.tingkat; }
      if (r.kegiatan) g.kegiatan = r.kegiatan;
    }
  });
  var crossCheckSp2d = Object.keys(perSp2d).sort().map(function (k) {
    var g = perSp2d[k];
    var adaRincian = g.rincian_orang > 0;
    return {
      no_sp2d: g.no_sp2d, kategori: g.kategori, prodi: g.prodi, tingkat: g.tingkat, kegiatan: g.kegiatan,
      ada_agregat: g.ada_agregat, ada_rincian: adaRincian,
      agregat_total: g.agregat_total, rincian_total: g.rincian_total,
      agregat_orang: g.agregat_orang, rincian_orang: g.rincian_orang,
      selisih_total: g.agregat_total - g.rincian_total,
      total_cocok: g.ada_agregat && adaRincian && g.agregat_total === g.rincian_total,
      orang_cocok: g.ada_agregat && adaRincian && g.agregat_orang === g.rincian_orang
    };
  });

  return {
    bulan: bulan, dalam_kampus: dalamKampus, luar_kampus: luarKampus,
    dalam_kampus_per_taruna: dalamKampusPerTaruna, luar_kampus_per_taruna: luarKampusPerTaruna,
    cross_check_sp2d: crossCheckSp2d,
    perlu_cek_manual: perluCekManual
  };
}

/**
 * sp2d.list {bulan} — daftar baris SP2D_MONITORING bulan itu (field ringkas)
 * untuk penelusuran & koreksi manual di UI. READ-ONLY. Role PPK/ADMIN.
 */
function sp2dList(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var rows = sheetRead(SHEETS.SP2D_MONITORING, function (r) { return _bulanStr_(r.bulan) === bulan; })
    .map(function (r) {
      return {
        no_spm: String(r.no_spm || ''), kategori: String(r.kategori || ''),
        nit: String(r.nit || ''), prodi: String(r.prodi || ''), tingkat: String(r.tingkat || ''),
        kegiatan: String(r.kegiatan || ''), jumlah_pembayaran: _int_(r.jumlah_pembayaran || 0, 'jumlah_pembayaran'),
        no_sp2d: String(r.no_sp2d || ''), uraian_asli: String(r.uraian_asli || ''),
        perlu_cek_manual: String(r.perlu_cek_manual || '')
      };
    });
  return { bulan: bulan, baris: rows };
}

/**
 * sp2d.koreksi {no_spm | no_spm_list:[], kategori, kegiatan?} — pindahkan baris
 * SP2D_MONITORING yang "salah tempat" ke kategori/kegiatan yang benar (massal
 * atau per satu transaksi). HANYA mengubah kolom kategori/kegiatan +
 * membersihkan perlu_cek_manual (koreksi manual = terverifikasi). TIDAK menyentuh
 * REKAP_BULANAN/PEMBAYARAN/BANTUAN_LUAR_KAMPUS dan TIDAK memicu sinkron pembayaran
 * — rekonsiliasi otomatis menyesuaikan saat dibaca ulang. withLock + 1 AUDIT_LOG
 * per baris. Role PPK/ADMIN. Baris dicocokkan lewat _kunciNoSpm_ (toleran prefix).
 */
function sp2dKoreksi(payload, session) {
  var kategori = payload && payload.kategori;
  if (ENUM.SP2D_KATEGORI.indexOf(kategori) < 0) throw _fail_('kategori tidak valid.');
  var kegiatan = (kategori === 'LUAR_KAMPUS') ? String((payload && payload.kegiatan) || '').trim() : '';

  var daftar = (payload && payload.no_spm_list) ? payload.no_spm_list
    : ((payload && payload.no_spm) ? [payload.no_spm] : []);
  daftar = daftar.map(function (s) { return String(s || '').trim(); }).filter(function (s) { return s; });
  if (!daftar.length) throw _fail_('no_spm (atau no_spm_list) wajib diisi.');

  return withLock(function () {
    // Peta kunci no_spm → baris asli, untuk pencocokan toleran prefix "Ref No :".
    var byKunci = {};
    sheetRead(SHEETS.SP2D_MONITORING).forEach(function (r) { byKunci[_kunciNoSpm_(r.no_spm)] = r; });

    var dikoreksi = 0, takKetemu = [];
    daftar.forEach(function (noSpm) {
      var r = byKunci[_kunciNoSpm_(noSpm)];
      if (!r) { takKetemu.push(noSpm); return; }
      var patch = { kategori: kategori, kegiatan: kegiatan, perlu_cek_manual: '' };
      sheetUpdate(SHEETS.SP2D_MONITORING, 'no_spm', r.no_spm, patch);
      auditLog(session, 'sp2d.koreksi', 'SP2D_MONITORING', String(r.no_spm),
        { kategori: r.kategori, kegiatan: r.kegiatan, perlu_cek_manual: r.perlu_cek_manual },
        patch);
      dikoreksi++;
    });
    if (!dikoreksi) throw _fail_('Tidak ada baris SP2D yang cocok: ' + daftar.join(', '));
    return { dikoreksi: dikoreksi, tak_ketemu: takKetemu };
  });
}

/**
 * Kelompokkan baris SP2D_MONITORING bulan tsb yang dobel: nit & no_sp2d SAMA
 * muncul >1 kali (baris `no_spm` disintesis beda ejaan nama saat impor ulang
 * — lihat catatan `sp2dImport` — lolos dari dedup lama & masuk dua kali,
 * menggandakan nominal taruna itu di rekonsiliasi). Baris agregat (tanpa nit)
 * atau SP2D belum terbit (tanpa no_sp2d) TIDAK diperiksa — tak ada dasar
 * deteksi dobel yang aman untuk itu. Baris PERTAMA (urutan sheet) jadi acuan
 * yang dipertahankan; sisanya masuk daftar untuk dihapus.
 */
function _kelompokDobelSp2d_(bulan) {
  var tarunaByNit = {};
  sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });
  var rows = sheetRead(SHEETS.SP2D_MONITORING, function (r) {
    return _bulanStr_(r.bulan) === bulan && r.nit && r.no_sp2d;
  });
  var kelompok = {};
  rows.forEach(function (r) {
    var k = String(r.nit) + '|' + String(r.no_sp2d).trim();
    if (!kelompok[k]) kelompok[k] = [];
    kelompok[k].push(r);
  });
  var hasil = [];
  Object.keys(kelompok).sort().forEach(function (k) {
    var list = kelompok[k];
    if (list.length < 2) return;
    var t = tarunaByNit[String(list[0].nit)] || {};
    hasil.push({
      nit: String(list[0].nit), nama: t.nama || '', no_sp2d: String(list[0].no_sp2d),
      baris: list.map(function (r) {
        return {
          no_spm: String(r.no_spm), jumlah_pembayaran: _int_(r.jumlah_pembayaran || 0, 'jumlah_pembayaran'),
          uraian_asli: String(r.uraian_asli || ''), perlu_cek_manual: String(r.perlu_cek_manual || '')
        };
      }),
      no_spm_dipertahankan: String(list[0].no_spm),
      no_spm_dihapus: list.slice(1).map(function (r) { return String(r.no_spm); })
    });
  });
  return hasil;
}

/**
 * sp2d.cek_dobel {bulan} — deteksi baris SP2D_MONITORING dobel bulan itu
 * (nit + no_sp2d sama, lihat `_kelompokDobelSp2d_`). READ-ONLY, tanpa
 * mengubah data — dipakai UI untuk pratinjau sebelum `sp2d.hapus_dobel`.
 * Role PPK/ADMIN.
 */
function sp2dCekDobel(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var kelompok = _kelompokDobelSp2d_(bulan);
  var jmlBarisDihapus = 0;
  kelompok.forEach(function (k) { jmlBarisDihapus += k.no_spm_dihapus.length; });
  return { bulan: bulan, kelompok: kelompok, jml_kelompok: kelompok.length, jml_baris_dihapus: jmlBarisDihapus };
}

/**
 * sp2d.hapus_dobel {bulan} — hapus baris SP2D_MONITORING dobel bulan itu
 * (kelompok sama seperti `sp2d.cek_dobel`, dihitung ULANG di sini — bukan
 * percaya daftar dari frontend — supaya konsisten & aman dari race condition).
 * Baris PERTAMA per kelompok (nit+no_sp2d) dipertahankan, sisanya DIHAPUS
 * (satu-satunya penghapusan baris data di codebase ini, lihat `sheetDeleteRows`
 * 03_helpers.gs). 1 AUDIT_LOG per baris dihapus (data_lama = seluruh isi baris,
 * data_baru = null). TIDAK menyentuh REKAP_BULANAN/PEMBAYARAN — rekonsiliasi
 * otomatis menyesuaikan (nominal taruna itu turun) saat dibaca ulang. Role
 * PPK/ADMIN.
 */
function sp2dHapusDobel(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var kelompok = _kelompokDobelSp2d_(bulan);
  var noSpmHapus = [];
  kelompok.forEach(function (k) { noSpmHapus = noSpmHapus.concat(k.no_spm_dihapus); });
  if (!noSpmHapus.length) return { dihapus: 0, kelompok_dobel: [] };

  var dihapus = sheetDeleteRows(SHEETS.SP2D_MONITORING, 'no_spm', noSpmHapus);
  dihapus.forEach(function (r) {
    auditLog(session, 'sp2d.hapus_dobel', 'SP2D_MONITORING', String(r.no_spm), r, null);
  });
  var ringkasan = kelompok.map(function (k) {
    return { nit: k.nit, nama: k.nama, no_sp2d: k.no_sp2d, jumlah_dihapus: k.no_spm_dihapus.length };
  });
  return { dihapus: dihapus.length, kelompok_dobel: ringkasan };
}

/**
 * Rincian SP2D Dalam Kampus per kelompok (Prodi+Tingkat) untuk `bulan` — versi
 * "per baris" dari `dalam_kampus` di sp2dRekonsiliasi, dipakai halaman
 * Pembayaran (relasi 1 bulan PEMBAYARAN : N SP2D). KPPN menerbitkan SATU SP2D
 * per kelompok Prodi+Tingkat, jadi satu bulan pembayaran Dalam Kampus terdiri
 * dari BANYAK SP2D. Tiap kelompok memuat daftar `rincian` (satu entri per baris
 * SP2D_MONITORING agregat: no_spm, no_sp2d, tgl, nominal, status).
 *
 * Sama seperti `dalam_kampus`: hanya baris `kategori==='DALAM_KAMPUS' && !nit`
 * (agregat, bukan SPANExt per-taruna) dan `perlu_cek_manual!=='YA'` yang masuk
 * agregat. Kelompok dobel (mis. MP/II dua SP2D) SUM-nya digabung, tapi tiap
 * SP2D tetap tampil sebagai baris `rincian` terpisah.
 *
 * `lengkap` = untuk SETIAP kelompok yang Sistem-nya > 0, SUM(SP2D) == Sistem,
 * DAN minimal ada satu kelompok bersistem > 0 (dikonfirmasi Firdaus). Kelompok
 * bersistem 0 tidak menghalangi kelengkapan (tapi tetap tampil sebagai anomali
 * kalau ada SP2D nyasar). `perlu_cek_manual` = jumlah baris Dalam Kampus bulan
 * ini yang gagal parse (SP2D ada tapi tak terhitung — perlu koreksi manual).
 *
 * Tiap kelompok juga memuat `per_suplier` (dikonfirmasi Firdaus) — pecahan
 * tambahan per `TARUNA_REKENING.penyedia_id`. Kolom `sistem` di situ ASLI
 * (dihitung langsung dari REKAP_BULANAN), tapi `sp2d_perkiraan`/`selisih_perkiraan`
 * SELALU perkiraan (dibagi PROPORSIONAL dari total SP2D kelompok berdasar porsi
 * `sistem` tiap suplier) — SP2D_MONITORING (impor KPPN) tidak punya kolom
 * suplier sama sekali, jadi tidak ada cara membaca angka SP2D per suplier yang
 * sungguh-sungguh asli. Frontend WAJIB menandai kolom ini sebagai perkiraan.
 */
function _rincianSp2dDalamKampus_(bulan) {
  var tarunaByNit = {};
  sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });
  var rekeningByNit = {};
  sheetRead(SHEETS.TARUNA_REKENING).forEach(function (r) { rekeningByNit[String(r.nit)] = r; });
  var penyediaById = {};
  sheetRead(SHEETS.PENYEDIA).forEach(function (p) { penyediaById[String(p.penyedia_id)] = p; });

  var sistemDalam = _sistemDalamKampusPerKelompok_(bulan, tarunaByNit);
  var sistemSuplierDalam = _sistemDalamKampusPerKelompokSuplier_(bulan, tarunaByNit, rekeningByNit);

  // _bulanStr_ (BUKAN String() polos) — lihat catatan di sp2dRekonsiliasi.
  var semua = sheetRead(SHEETS.SP2D_MONITORING, function (r) {
    return _bulanStr_(r.bulan) === bulan && r.kategori === 'DALAM_KAMPUS';
  });
  var agregat = semua.filter(function (r) { return !r.nit && r.perlu_cek_manual !== 'YA'; });
  var perluCekManual = semua.filter(function (r) { return r.perlu_cek_manual === 'YA'; }).length;

  var sp2dPerKunci = {};
  var rincianPerKunci = {};
  agregat.forEach(function (r) {
    var kunci = r.prodi + '|' + r.tingkat;
    var jml = _int_(r.jumlah_pembayaran || 0, 'jumlah_pembayaran');
    sp2dPerKunci[kunci] = (sp2dPerKunci[kunci] || 0) + jml;
    if (!rincianPerKunci[kunci]) rincianPerKunci[kunci] = [];
    rincianPerKunci[kunci].push({
      no_spm: String(r.no_spm || ''), no_sp2d: String(r.no_sp2d || ''),
      tgl_spm: _tglStr_(r.tgl_spm) || '', tgl_sp2d: _tglStr_(r.tgl_sp2d) || '',
      jumlah_pembayaran: jml, status_sp2d: String(r.status_sp2d || '')
    });
  });

  var kunciSemua = {};
  Object.keys(sistemDalam).forEach(function (k) { kunciSemua[k] = true; });
  Object.keys(sp2dPerKunci).forEach(function (k) { kunciSemua[k] = true; });

  var adaSistem = false, semuaCocok = true;
  var kelompok = Object.keys(kunciSemua).sort().map(function (k) {
    var parts = k.split('|');
    var sistem = sistemDalam[k] || 0, sp2d = sp2dPerKunci[k] || 0;
    if (sistem > 0) { adaSistem = true; if (sistem !== sp2d) semuaCocok = false; }
    return {
      prodi: parts[0], tingkat: parts[1], sistem: sistem, sp2d: sp2d,
      selisih: sistem - sp2d, cocok: sistem === sp2d,
      per_suplier: _pecahSp2dPerSuplierPerkiraan_(sistemSuplierDalam[k], sp2d, penyediaById),
      rincian: rincianPerKunci[k] || []
    };
  });

  return { bulan: bulan, kelompok: kelompok, lengkap: adaSistem && semuaCocok, perlu_cek_manual: perluCekManual };
}

/**
 * Pecah `sp2dTotal` (satu angka ASLI KPPN utk satu kelompok Prodi+Tingkat) jadi
 * PERKIRAAN per suplier — proporsional terhadap porsi `sistem` (ASLI, dari
 * REKAP_BULANAN) tiap suplier dalam kelompok itu. WAJIB dianggap taksiran,
 * BUKAN angka resmi KPPN per suplier (yang memang tidak ada/tidak pernah
 * dilaporkan terpisah). Sisa pembulatan ditumpuk ke baris terakhir (terurut by
 * penyedia_id) supaya SUM(sp2d_perkiraan) tetap == sp2dTotal.
 */
function _pecahSp2dPerSuplierPerkiraan_(sistemSuplierKelompok, sp2dTotal, penyediaById) {
  var pidList = Object.keys(sistemSuplierKelompok || {}).sort();
  if (!pidList.length) return [];
  var totalSistem = pidList.reduce(function (s, pid) { return s + sistemSuplierKelompok[pid]; }, 0);
  var hasil = pidList.map(function (pid) {
    var sistemSup = sistemSuplierKelompok[pid];
    var sp2dSup = totalSistem > 0 ? Math.round(sp2dTotal * sistemSup / totalSistem) : 0;
    var p = penyediaById[pid];
    return {
      penyedia_id: pid,
      penyedia_nama: pid ? (p ? (p.nama || '') : '') : '(BELUM DITENTUKAN)',
      sistem: sistemSup, sp2d_perkiraan: sp2dSup, selisih_perkiraan: sistemSup - sp2dSup
    };
  });
  if (totalSistem > 0 && hasil.length) {
    var sumSp2d = hasil.reduce(function (s, x) { return s + x.sp2d_perkiraan; }, 0);
    var selisihBulat = sp2dTotal - sumSp2d;
    if (selisihBulat !== 0) {
      var last = hasil[hasil.length - 1];
      last.sp2d_perkiraan += selisihBulat;
      last.selisih_perkiraan = last.sistem - last.sp2d_perkiraan;
    }
  }
  return hasil;
}

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 24_penyedia_portal.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
/**
 * 24_penyedia_portal.gs — Portal Penyedia (rekanan katering eksternal).
 *
 * SATU action baca (`penyedia.portal`) yang mengembalikan bundel data milik
 * SATU penyedia — di-scope ketat ke `session.penyedia_id`. Role PENYEDIA hanya
 * boleh memanggil action di allowlist `PENYEDIA_ACTIONS` (01_router.gs); di sini
 * `_hanyaPenyedia_(session)` menjadi pagar kedua (defense-in-depth).
 *
 * PRINSIP DATA SENSITIF (CLAUDE.md § 4): portal ini SENGAJA hanya memuat field
 * non-sensitif — TIDAK ADA data per-taruna (nama/NIT), TIDAK ADA rekening,
 * TIDAK ADA geotag realisasi, TIDAK ADA identitas staf internal (created_by/
 * verif_by/approved_by/uploaded_by). Yang keluar hanya: profil penyedia sendiri,
 * kontrak & menu miliknya, jumlah porsi (angka agregat) per pengantaran, ringkas
 * realisasi (porsi & ketidaksesuaian), dan status pembayaran miliknya.
 *
 * READ-ONLY → tanpa withLock/AUDIT_LOG (audit hanya untuk aksi tulis; portal ini
 * tidak menyentuh data sensitif seperti rekening.lihat_lengkap yang diaudit).
 *
 * BANTUAN MAKAN LUAR KAMPUS TIDAK DITAMPILKAN di portal (dipastikan Firdaus):
 * bantuan luar kampus (PKL/Magang/KPA/PTB) adalah transfer tunai LANGSUNG ke
 * rekening taruna, BUKAN lewat kontrak penyedia katering. Sheet-nya terpisah
 * (BANTUAN_LUAR_KAMPUS / SP2D_MONITORING) dan handler ini SENGAJA tidak
 * membacanya sama sekali — semua yang dikeluarkan hanya bertaut ke kontrak_id
 * milik penyedia (Dalam Kampus). Jangan menambah pembacaan sheet luar kampus.
 */

/** Batas bawah jadwal yang ditampilkan: hari ini − 7 hari (minggu lalu + mendatang). */
function _batasJadwalPenyedia_() {
  var d = new Date();
  d.setDate(d.getDate() - 7);
  return _tglStr_(d);
}

/**
 * penyedia.portal {} → bundel data milik session.penyedia_id:
 *   {penyedia, kontrak:[{...,menu:[],lampiran:[]}], pesanan:[], realisasi:[], pembayaran:[]}
 */
function penyediaPortal(payload, session) {
  var pid = _hanyaPenyedia_(session);

  var penyedia = sheetRead(SHEETS.PENYEDIA, function (r) { return String(r.penyedia_id) === pid; })[0];
  if (!penyedia) throw _fail_('Data penyedia tidak ditemukan.');

  // ── Kontrak milik penyedia ini + menu mingguan + lampiran (metadata saja) ──
  var kontrakRows = sheetRead(SHEETS.KONTRAK, function (r) { return String(r.penyedia_id) === pid; });
  var kontrakIds = {};
  kontrakRows.forEach(function (k) { kontrakIds[String(k.kontrak_id)] = true; });

  var kontrak = kontrakRows.map(function (k) {
    var menu = sheetRead(SHEETS.MENU_KONTRAK, function (r) { return String(r.kontrak_id) === String(k.kontrak_id); });
    menu.sort(function (a, b) { return ENUM.HARI.indexOf(a.hari) - ENUM.HARI.indexOf(b.hari); });
    return {
      kontrak_id: k.kontrak_id,
      harga_per_porsi: _int_(k.harga_per_porsi || 0, 'harga_per_porsi'),
      porsi_per_hari: _int_(k.porsi_per_hari || 0, 'porsi_per_hari'),
      harga_per_hari_efektif: _hargaPerHariKontrak_(k),
      tgl_mulai: _tglStr_(k.tgl_mulai),
      tgl_akhir: _tglStr_(k.tgl_akhir),
      status: k.status,
      menu: menu.map(function (m) {
        return { hari: m.hari, menu_pagi: m.menu_pagi, menu_siang: m.menu_siang, menu_malam: m.menu_malam };
      }),
      // lampiran: HANYA jenis & nama_file (tanpa drive_file_id/uploaded_by) — informasional.
      lampiran: lampiranList('KONTRAK', String(k.kontrak_id)).map(function (l) {
        return { jenis: l.jenis, nama_file: l.nama_file };
      })
    };
  });

  // ── Jadwal pengantaran: pesanan penyedia yang SUDAH final (DISETUJUI/TERKIRIM),
  //    tgl_makan ≥ (hari ini − 7). Pesanan DRAFT/DIAJUKAN/DIKEMBALIKAN belum boleh
  //    bocor ke penyedia (belum diverifikasi Pembina). Tanpa identitas staf. ──
  var batas = _batasJadwalPenyedia_();
  var pesanan = sheetRead(SHEETS.PESANAN, function (r) {
    return kontrakIds[String(r.kontrak_id)]
      && (r.status === 'DISETUJUI' || r.status === 'TERKIRIM')
      && _tglStr_(r.tgl_makan) >= batas;
  }).map(function (p) {
    return {
      tgl_makan: _tglStr_(p.tgl_makan),
      jml_taruna: _int_(p.jml_taruna || 0, 'jml_taruna'),
      menu: String(p.menu || ''),
      catatan: String(p.catatan || ''),
      status: p.status
    };
  });
  pesanan.sort(function (a, b) { return a.tgl_makan < b.tgl_makan ? -1 : 1; }); // terlama→terbaru (jadwal maju)

  // ── Ringkas realisasi: untuk pesanan milik penyedia. Tanpa geotag/ttd staf. ──
  var pesananPenyedia = {};
  sheetRead(SHEETS.PESANAN, function (r) { return kontrakIds[String(r.kontrak_id)]; })
    .forEach(function (p) { pesananPenyedia[String(p.pesanan_id)] = true; });
  var realisasi = sheetRead(SHEETS.REALISASI, function (r) { return pesananPenyedia[String(r.pesanan_id)]; })
    .map(function (r) {
      return {
        tanggal: _tglStr_(r.tanggal),
        porsi_diterima: _int_(r.porsi_diterima || 0, 'porsi_diterima'),
        jml_taruna_makan: _int_(r.jml_taruna_makan || 0, 'jml_taruna_makan'),
        ketidaksesuaian: String(r.ketidaksesuaian || ''),
        tindak_lanjut: String(r.tindak_lanjut || '')
      };
    });
  realisasi.sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : -1; }); // terbaru dulu

  // ── Status pembayaran miliknya (agregat per bulan/kontrak — bukan per taruna) ──
  var pembayaran = sheetRead(SHEETS.PEMBAYARAN, function (r) { return kontrakIds[String(r.kontrak_id)]; })
    .map(function (p) {
      return {
        bulan: _bulanStr_(p.bulan),
        nilai_total: _int_(p.nilai_total || 0, 'nilai_total'),
        no_spm: String(p.no_spm || ''),
        tgl_spm: p.tgl_spm ? _tglStr_(p.tgl_spm) : '',
        no_sp2d: String(p.no_sp2d || ''),
        tgl_sp2d: p.tgl_sp2d ? _tglStr_(p.tgl_sp2d) : '',
        status: p.status,
        // konfirmasi_senat_at tidak lagi diisi sejak mesin status PEMBAYARAN
        // disederhanakan (DIAJUKAN→SELESAI langsung, lihat 15_pembayaran.gs) —
        // field ini akan selalu false untuk pembayaran baru; dipertahankan
        // untuk baris historis lama saja.
        invoice_dikonfirmasi: p.konfirmasi_senat_at ? true : false
      };
    });
  pembayaran.sort(function (a, b) { return a.bulan < b.bulan ? 1 : -1; }); // terbaru dulu

  return {
    penyedia: { nama: penyedia.nama, kontak: penyedia.kontak, alamat: penyedia.alamat, status: penyedia.status },
    kontrak: kontrak,
    pesanan: pesanan,
    realisasi: realisasi,
    pembayaran: pembayaran
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 25_ketua_jurusan.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
/**
 * 25_ketua_jurusan.gs — Peran KETUA_JURUSAN (ketua jurusan/prodi).
 *
 * Tugas (di-scope ke session.prodi):
 *  1. Input absen luar kampus taruna prodinya → STATUS_HARIAN dengan status ∈
 *     STATUS_LUAR_KAMPUS. BOLEH tanggal lampau (taruna PKL berada di luar kampus,
 *     absen sering diinput mundur) — memang tidak ada date-guard.
 *  2. Menyetujui rekap bantuan luar kampus prodinya: BANTUAN_LUAR_KAMPUS
 *     DRAFT → DISETUJUI_KAJUR (persetujuan Ketua Jurusan sebelum PPK memproses).
 *  3. Melihat REKAP saja (TANPA nomor rekening).
 *
 * Setiap handler memanggil _hanyaKajur_(session) (pagar dalam-handler) DAN router
 * membatasi lewat KETUA_JURUSAN_ACTIONS (deny-by-default, seperti PENYEDIA).
 * ACTION: kajur.taruna_list, kajur.status_set, kajur.status_batch, kajur.rekap, kajur.approve.
 * Setiap aksi tulis → withLock + auditLog.
 */

/** Baris TARUNA satu prodi (nit, nama, tingkat, kelas — TANPA rekening). */
function _tarunaProdi_(prodi) {
  return sheetRead(SHEETS.TARUNA, function (r) { return String(r.prodi) === String(prodi); });
}

/** Pastikan taruna ada & berada di prodi Ketua Jurusan. */
function _pastikanTarunaProdi_(nit, prodi) {
  var t = sheetRead(SHEETS.TARUNA, function (r) { return String(r.nit) === String(nit); })[0];
  if (!t) throw _fail_('Taruna tidak ditemukan: ' + nit);
  if (String(t.prodi) !== String(prodi)) throw _fail_('Taruna di luar prodi Anda: ' + nit);
  return t;
}

/** Daftar taruna prodi Ketua Jurusan (untuk UI input absen). */
function kajurTarunaList(payload, session) {
  var prodi = _hanyaKajur_(session);
  var rows = _tarunaProdi_(prodi).map(function (t) {
    return {
      nit: String(t.nit), nama: t.nama || '', prodi: t.prodi || '',
      tingkat: t.tingkat || '', kelas: t.kelas || '', status: t.status || ''
    };
  });
  return { taruna: rows, prodi: prodi };
}

/**
 * Set absen luar kampus satu taruna. Payload {tanggal, nit, status, tgl_akhir?}.
 * Backdate diizinkan. `tgl_akhir` opsional → isi rentang tanggal (PKL/KPA biasanya
 * berlangsung berbulan-bulan, tidak perlu input per hari).
 */
function kajurStatusSet(payload, session) {
  var prodi = _hanyaKajur_(session);
  var tanggal = _wajibTgl_(payload && payload.tanggal, 'tanggal');
  var nit = String((payload && payload.nit) || '').trim();
  if (!nit) throw _fail_('nit wajib diisi.');
  var status = String((payload && payload.status) || '');
  if (STATUS_LUAR_KAMPUS.indexOf(status) < 0) {
    throw _fail_('Ketua Jurusan hanya boleh menginput status luar kampus: ' + STATUS_LUAR_KAMPUS.join(' / '));
  }
  _pastikanTarunaProdi_(nit, prodi);
  var daftarTgl = (payload && payload.tgl_akhir)
    ? _daftarTanggal_(tanggal, _wajibTgl_(payload.tgl_akhir, 'tgl_akhir'))
    : [tanggal];
  return withLock(function () {
    var hasil = daftarTgl.map(function (t) { return _statusUpsert_(session, t, nit, status); });
    return hasil.length === 1 ? hasil[0] : { jml: hasil.length };
  });
}

/** Set absen luar kampus massal. Payload {tanggal, status, nit:[], tgl_akhir?}. */
function kajurStatusBatch(payload, session) {
  var prodi = _hanyaKajur_(session);
  var tanggal = _wajibTgl_(payload && payload.tanggal, 'tanggal');
  var status = String((payload && payload.status) || '');
  if (STATUS_LUAR_KAMPUS.indexOf(status) < 0) {
    throw _fail_('Ketua Jurusan hanya boleh menginput status luar kampus: ' + STATUS_LUAR_KAMPUS.join(' / '));
  }
  var daftar = (payload && payload.nit) || [];
  if (!daftar.length) throw _fail_('nit harus berupa daftar minimal 1 taruna.');
  // Validasi semua nit dalam prodi DULU (all-or-nothing sebelum menulis).
  var prodiNit = {};
  _tarunaProdi_(prodi).forEach(function (t) { prodiNit[String(t.nit)] = true; });
  daftar.forEach(function (nit) {
    if (!prodiNit[String(nit).trim()]) throw _fail_('Taruna di luar prodi Anda: ' + nit);
  });
  var daftarTgl = (payload && payload.tgl_akhir)
    ? _daftarTanggal_(tanggal, _wajibTgl_(payload.tgl_akhir, 'tgl_akhir'))
    : [tanggal];
  return withLock(function () {
    var n = 0;
    daftar.forEach(function (nit) {
      daftarTgl.forEach(function (t) { _statusUpsert_(session, t, String(nit).trim(), status); n++; });
    });
    return { jml: n };
  });
}

/**
 * Rekap luar kampus prodi untuk bulan (TANPA rekening). Per taruna: jml hari luar
 * kampus dihitung dari STATUS_HARIAN (status ∈ STATUS_LUAR_KAMPUS) bulan itu —
 * sumber kebenaran yang sama dengan Form-08 — di-join BANTUAN_LUAR_KAMPUS
 * (kegiatan/nilai_per_hari/nominal/status) bila ada. Payload {bulan}.
 */
function kajurRekap(payload, session) {
  var prodi = _hanyaKajur_(session);
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var nitSet = {};
  _tarunaProdi_(prodi).forEach(function (t) { nitSet[String(t.nit)] = t; });

  // Hari luar kampus per nit dari STATUS_HARIAN bulan itu (prodi ini saja).
  var hariByNit = {};
  sheetRead(SHEETS.STATUS_HARIAN, function (r) {
    return _bulanStr_(r.tanggal) === bulan && STATUS_LUAR_KAMPUS.indexOf(r.status) >= 0 && nitSet[String(r.nit)];
  }).forEach(function (r) {
    var nit = String(r.nit);
    hariByNit[nit] = (hariByNit[nit] || 0) + 1;
  });

  // Join BANTUAN_LUAR_KAMPUS (bulan itu, prodi ini) untuk kegiatan/tarif/nominal/status.
  var blkByNit = {};
  sheetRead(SHEETS.BANTUAN_LUAR_KAMPUS, function (r) {
    return _bulanStr_(r.bulan) === bulan && nitSet[String(r.nit)];
  }).forEach(function (r) {
    var nit = String(r.nit);
    if (!blkByNit[nit]) blkByNit[nit] = [];
    blkByNit[nit].push(r);
  });

  var kunci = {};
  Object.keys(hariByNit).forEach(function (n) { kunci[n] = true; });
  Object.keys(blkByNit).forEach(function (n) { kunci[n] = true; });
  var baris = Object.keys(kunci).sort().map(function (nit) {
    var t = nitSet[nit] || {};
    var blkRows = blkByNit[nit] || [];
    var kegiatan = blkRows.map(function (r) { return r.kegiatan; }).join(', ');
    var nilaiPerHari = blkRows.length ? _int_(blkRows[0].nilai_per_hari || 0, 'nilai_per_hari') : 0;
    var hari = hariByNit[nit] || 0;
    // Nominal = hari (dari absen) × tarif (dari BLK) — konsisten dengan Form-08.
    var nominal = Math.round(hari * nilaiPerHari);
    // disetujui_kajur = SEMUA baris BLK taruna ini sudah DISETUJUI_KAJUR.
    var semuaSetuju = blkRows.length > 0 && blkRows.every(function (r) { return String(r.status) === 'DISETUJUI_KAJUR'; });
    return {
      nit: nit, nama: t.nama || '', tingkat: t.tingkat || '', kelas: t.kelas || '',
      kegiatan: kegiatan, hari_luar_kampus: hari, nilai_per_hari: nilaiPerHari,
      nominal: nominal, ada_blk: blkRows.length > 0, disetujui_kajur: semuaSetuju
    };
  });

  var totalNominal = 0;
  baris.forEach(function (b) { totalNominal += b.nominal; });
  return { bulan: bulan, prodi: prodi, baris: baris, total_nominal: totalNominal };
}

/**
 * Setujui rekap luar kampus prodi untuk bulan: set BANTUAN_LUAR_KAMPUS.status
 * (baris nit berprodi session.prodi & bulan itu) DRAFT → DISETUJUI_KAJUR.
 * Payload {bulan}.
 */
function kajurApprove(payload, session) {
  var prodi = _hanyaKajur_(session);
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  return withLock(function () {
    var nitProdi = {};
    _tarunaProdi_(prodi).forEach(function (t) { nitProdi[String(t.nit)] = true; });
    var rows = sheetRead(SHEETS.BANTUAN_LUAR_KAMPUS, function (r) {
      return _bulanStr_(r.bulan) === bulan && nitProdi[String(r.nit)];
    });
    if (!rows.length) throw _fail_('Belum ada data bantuan luar kampus prodi ' + prodi + ' untuk bulan ' + bulan + '.');
    var n = 0;
    rows.forEach(function (r) {
      if (String(r.status) === 'DISETUJUI_KAJUR') return;
      sheetUpdate(SHEETS.BANTUAN_LUAR_KAMPUS, 'bantuan_id', r.bantuan_id,
        { status: 'DISETUJUI_KAJUR', approved_by: session.user_id, approved_at: new Date() });
      auditLog(session, 'kajur.approve', 'BANTUAN_LUAR_KAMPUS', r.bantuan_id,
        { status: r.status || 'DRAFT' }, { status: 'DISETUJUI_KAJUR', prodi: prodi, bulan: bulan });
      n++;
    });
    return { disetujui: n, prodi: prodi, bulan: bulan };
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 26_kokpit.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
/**
 * 26_kokpit.gs — Kokpit PPK: orkestrasi tutup-bulan, READ-ONLY.
 *
 * ACTION: ppk.kokpit (PPK, KPA, WADIR3)
 *
 * Murni agregasi baca dari action/fungsi yang SUDAH ADA (REKAP_BULANAN,
 * bayarList, spmList, sp2dRekonsiliasi, tagihanStatusDebet/tagihanList,
 * PESANAN/REALISASI) — TIDAK menulis apa pun, TIDAK melewati guard action
 * mana pun. `link` di `tahapan`/`tindakan` hanya menautkan ke halaman aksi;
 * penegakan sebenarnya tetap di action masing-masing saat user mengeklik.
 *
 * Degradasi anggun (BUKAN error): SPM kosong untuk suatu bulan (mis. bulan
 * legacy Jan-Mar 2026, lihat docs/skema-sheet.md §9, atau bulan yang belum
 * dibuatkan PEMBAYARAN) → status 'n_a', bukan 'merah'. SURAT_PENDEBETAN
 * (§20) memang belum ada sheet/action-nya (masih PARKIR) → langsung 'n_a'.
 */
function ppkKokpit(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var today = _todayStr_();

  // ── Sumber data (satu kali baca/panggil per domain — reuse, bukan duplikasi) ──
  var rekapRows = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  var pembayaranRows = bayarList({ bulan: bulan }, session).pembayaran;
  var spmRows = spmList({ bulan: bulan }, session).spm;
  var sp2dRek = null;
  try { sp2dRek = sp2dRekonsiliasi({ bulan: bulan }, session); } catch (e) { sp2dRek = null; }
  var statusDebet = null;
  try { statusDebet = tagihanStatusDebet({ bulan: bulan }, session); } catch (e) { statusDebet = null; }
  var tagihanOutstanding = tagihanList({ bulan: bulan, status: 'TERTAGIH' }, session).tagihan;
  var pesananRows = sheetRead(SHEETS.PESANAN, function (r) { return _bulanStr_(r.tgl_makan) === bulan; });
  var realisasiRows = sheetRead(SHEETS.REALISASI, function (r) { return _bulanStr_(r.tanggal) === bulan; });

  // ── Turunan dasar ─────────────────────────────────────────────────────────
  var semuaRekapAda = rekapRows.length > 0;
  var semuaRekapFinal = semuaRekapAda && rekapRows.every(function (r) { return r.status === 'FINAL'; });
  var jmlRekapFinal = rekapRows.filter(function (r) { return r.status === 'FINAL'; }).length;
  var targetRekap = 0;
  rekapRows.forEach(function (r) { targetRekap += _int_(r.nominal || 0, 'nominal'); });

  var pembayaranAda = pembayaranRows.length > 0;
  var pembayaranSelesai = pembayaranAda && pembayaranRows.every(function (b) { return b.status === 'SELESAI'; });
  var terbayarSp2d = 0;
  pembayaranRows.forEach(function (b) { if (b.status === 'SELESAI') terbayarSp2d += _int_(b.nilai_total || 0, 'nilai_total'); });

  var spmAda = spmRows.length > 0; // kosong = bulan legacy (pra-SPM) ATAU belum ada PEMBAYARAN
  var spmAdaDraft = spmAda && spmRows.some(function (s) { return s.status === 'DRAFT'; });
  var spmSemuaDiajukan = spmAda && spmRows.every(function (s) { return s.status !== 'DRAFT'; });
  var spmSemuaSp2dTerbit = spmAda && spmRows.every(function (s) { return s.status === 'SP2D_TERBIT'; });
  var jmlSpmCair = spmRows.filter(function (s) { return s.status === 'SP2D_TERBIT'; }).length;

  var sp2dPerluCekManual = sp2dRek ? sp2dRek.perlu_cek_manual.length : 0;
  var sp2dBersih = sp2dRek ? (sp2dPerluCekManual === 0 &&
    sp2dRek.dalam_kampus.every(function (g) { return g.cocok; }) &&
    sp2dRek.luar_kampus.every(function (g) { return g.cocok; })) : false;

  // Proksi "debet sudah diproses bulan ini" — sistem tak melacak "kapan impor
  // terakhir" secara eksplisit; tagihanStatusDebet hanya berhasil (tak throw)
  // kalau REKAP bernominal>0 untuk bulan itu ADA (dasar permohonan debet siap).
  var jmlGagalDebet = statusDebet ? statusDebet.jml_gagal : 0;
  var jmlBerhasilDebet = statusDebet ? statusDebet.jml_berhasil : 0;
  var debetSiapDiproses = !!statusDebet;

  var outstandingTagihan = 0;
  tagihanOutstanding.forEach(function (t) { outstandingTagihan += _int_(t.nominal || 0, 'nominal'); });
  var tagihanLewatTenggat = tagihanOutstanding.filter(function (t) {
    return t.tenggat_aktif && today > t.tenggat_aktif;
  });

  var porsiDipesan = 0;
  pesananRows.forEach(function (p) { porsiDipesan += _int_(p.jml_taruna || 0, 'jml_taruna'); });
  var porsiDimakan = 0;
  realisasiRows.forEach(function (r) { porsiDimakan += _int_(r.jml_taruna_makan || 0, 'jml_taruna_makan'); });

  // ── Bagian 1: ringkasan (angka kunci) ─────────────────────────────────────
  var ringkasan = {
    bulan: bulan,
    target_rekap: targetRekap,
    terbayar_sp2d: terbayarSp2d,
    outstanding_tagihan: outstandingTagihan,
    porsi_dipesan: porsiDipesan,
    porsi_dimakan: porsiDimakan
  };

  // ── Bagian 2: tahapan tutup-bulan (status diturunkan + gerbang prasyarat) ──
  function langkah(no, label, statusWarna, angka, prasyaratOk, link) {
    return { no: no, label: label, status: statusWarna, angka: angka, prasyarat_ok: prasyaratOk, link: link };
  }

  var tahapan = [
    langkah(1, 'REKAP FINAL',
      semuaRekapFinal ? 'hijau' : (semuaRekapAda ? 'kuning' : 'merah'),
      semuaRekapAda ? (jmlRekapFinal + '/' + rekapRows.length + ' FINAL') : 'belum ada rekap',
      true, '/rekap'),
    langkah(2, 'PEMBAYARAN dibuat',
      pembayaranAda ? 'hijau' : 'merah',
      pembayaranAda ? (pembayaranRows.length + ' baris') : 'belum dibuat',
      semuaRekapFinal, '/pembayaran'),
    langkah(3, 'SPM diajukan',
      !spmAda ? 'n_a' : (spmSemuaDiajukan ? 'hijau' : 'kuning'),
      !spmAda ? 'N/A (bulan legacy / belum ada SPM)' : (spmAdaDraft ? 'ada DRAFT' : 'semua diajukan'),
      pembayaranAda, '/pembayaran'),
    langkah(4, 'SP2D diterima',
      !spmAda ? 'n_a' : (spmSemuaSp2dTerbit ? 'hijau' : 'kuning'),
      !spmAda ? 'N/A' : (jmlSpmCair + '/' + spmRows.length + ' cair'),
      spmSemuaDiajukan, '/pembayaran'),
    langkah(5, 'Rekonsiliasi SP2D bersih',
      !sp2dRek ? 'n_a' : (sp2dBersih ? 'hijau' : 'kuning'),
      !sp2dRek ? 'N/A' : (sp2dPerluCekManual + ' perlu cek manual'),
      pembayaranSelesai || spmSemuaSp2dTerbit, '/laporan'),
    langkah(6, 'Debet diimpor',
      !debetSiapDiproses ? 'n_a' : (jmlGagalDebet > 0 || jmlBerhasilDebet > 0 ? 'hijau' : 'kuning'),
      debetSiapDiproses ? (jmlGagalDebet + ' gagal debet') : 'N/A',
      pembayaranSelesai || spmSemuaSp2dTerbit, '/tagihan/impor-debet'),
    langkah(7, 'SP & penagihan',
      outstandingTagihan === 0 ? 'hijau' : (tagihanLewatTenggat.length > 0 ? 'merah' : 'kuning'),
      outstandingTagihan === 0 ? 'lunas semua' : (tagihanOutstanding.length + ' outstanding'),
      true, '/tagihan'),
    langkah(8, 'Surat pendebetan (remit)', 'n_a', 'N/A — §20 belum ada (masih parkir)', false, ''),
    langkah(9, 'Laporan/SPJ diarsipkan',
      pembayaranSelesai ? 'kuning' : 'merah', // sistem tak melacak "sudah diarsipkan" — kuning = siap, tetap perlu konfirmasi manual di luar sistem
      pembayaranSelesai ? 'siap cetak Laporan Resmi' : 'menunggu PEMBAYARAN SELESAI',
      pembayaranSelesai, '/laporan')
  ];

  // ── Bagian 3: butuh tindakan PPK (pengecualian, prioritas tenggat dulu) ───
  var tindakan = [];
  tagihanLewatTenggat.forEach(function (t) {
    tindakan.push({
      prioritas: 0,
      apa: 'Tindak lanjut tagihan ' + t.tagihan_id + ' (SP-' + t.level_aktif + ' lewat tenggat)',
      kenapa: 'Tenggat ' + t.tenggat_aktif + ' sudah lewat (' + today + ').',
      link: '/tagihan/' + t.tagihan_id
    });
  });
  if (semuaRekapAda && !semuaRekapFinal) {
    tindakan.push({ prioritas: 1, apa: 'Verifikasi & finalkan REKAP bulan ' + bulan, kenapa: 'REKAP belum FINAL — tak bisa lanjut ke PEMBAYARAN/SPM.', link: '/rekap' });
  }
  if (spmAda && spmAdaDraft) {
    var jmlDraft = spmRows.filter(function (s) { return s.status === 'DRAFT'; }).length;
    tindakan.push({ prioritas: 2, apa: 'Ajukan ' + jmlDraft + ' SPM ke KPPN', kenapa: 'Ada SPM berstatus DRAFT.', link: '/pembayaran' });
  }
  if (sp2dPerluCekManual > 0) {
    tindakan.push({ prioritas: 2, apa: 'Cocokkan ' + sp2dPerluCekManual + ' baris SP2D', kenapa: 'perlu_cek_manual pada rekonsiliasi SP2D.', link: '/laporan' });
  }
  var selisihPorsi = porsiDipesan - porsiDimakan;
  if (porsiDipesan > 0 && Math.abs(selisihPorsi) > Math.round(porsiDipesan * 0.1)) {
    tindakan.push({ prioritas: 3, apa: 'Cek realisasi — selisih dipesan-vs-dimakan besar', kenapa: 'Selisih ' + selisihPorsi + ' dari ' + porsiDipesan + ' porsi dipesan.', link: '/realisasi' });
  }
  tindakan.sort(function (a, b) { return a.prioritas - b.prioritas; });

  return { ringkasan: ringkasan, tahapan: tahapan, tindakan: tindakan };
}

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 99_setup.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
/**
 * 99_setup.gs — Inisialisasi database e-BAMA (sekali jalan, idempotent)
 *
 * Cara pakai (dari editor Apps Script, pilih fungsi lalu Run):
 *   0) setSpreadsheetId('<ID>')  → WAJIB sekali untuk proyek standalone (clasp).
 *      Lewati bila skrip terikat (bound) langsung ke spreadsheet.
 *   1) setupSemua()        → jalankan ketiga langkah sekaligus (disarankan)
 *    atau satu per satu:
 *   2) setupDatabase()     → buat 18 sheet + header + validasi + format + proteksi
 *   3) seedAwal()          → 5 akun contoh (kata sandi default 123456, di-hash SHA-256+SALT)
 *   4) setupFolderDrive()  → folder Drive e-BAMA/{LAMPIRAN,SURAT_PERINGATAN,TEMPLATE}
 *
 * Semua nama sheet dirujuk dari SHEETS (00_config.gs). Aman dijalankan ulang:
 * sheet/kolom/akun yang sudah ada tidak diduplikasi, DATA TIDAK DIHAPUS.
 */

/**
 * setSpreadsheetId(id) — tautkan skrip standalone ke spreadsheet target.
 * Contoh: setSpreadsheetId('12AF44PZlGxlm2762_VWgVp6C91Dv6Ylkw4mil9tYXvI')
 */
function setSpreadsheetId(id) {
  if (!id) throw new Error('ID spreadsheet wajib diisi.');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', id);
  Logger.log('SPREADSHEET_ID diset: ' + id);
  return id;
}

/**
 * _getSpreadsheet_() — resolver spreadsheet aktif:
 * pakai SPREADSHEET_ID dari Script Properties (standalone) bila ada,
 * jika tidak pakai spreadsheet terikat (bound).
 */
function _getSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error('SPREADSHEET_ID belum diset. Jalankan setSpreadsheetId("<id>") dulu, ' +
    'atau jalankan dari skrip yang terikat spreadsheet.');
}

// ── Definisi kolom per sheet (PERSIS docs/skema-sheet.md) ───────────────────
// Tipe kolom: 's' teks | 'i' integer | 'n' angka desimal | 'd' tanggal |
//             'dt' datetime | 'b' boolean (checkbox) | ['ENUM_KEY'] dropdown enum (nilai dari ENUM).
function _skema_() {
  var E = ENUM;
  return [
    [SHEETS.PENGGUNA, [
      ['user_id','s'], ['nama','s'], ['role', E.ROLE], ['pin_hash','s'],
      ['token','s'], ['token_exp','dt'], ['status', E.AKTIF_STATUS],
      // penyedia_id (FK PENYEDIA) & prodi (scope KETUA_JURUSAN) di-append di AKHIR
      // supaya setupDatabase idempotent tak menggeser data lama.
      ['penyedia_id','s'], ['prodi','s']
    ]],
    [SHEETS.TARUNA, [
      ['nit','s'], ['nama','s'], ['prodi','s'], ['tingkat','s'], ['kelas','s'],
      ['bank', E.BANK], ['rek_mask','s'], ['status', E.AKTIF_STATUS]
    ]],
    [SHEETS.PENYEDIA, [
      ['penyedia_id','s'], ['nama','s'], ['kontak','s'], ['alamat','s'],
      ['npwp_mask','s'], ['status', E.AKTIF_STATUS]
    ]],
    [SHEETS.KONTRAK, [
      ['kontrak_id','s'], ['penyedia_id','s'], ['harga_per_porsi','i'],
      ['porsi_per_hari','i'], ['tgl_mulai','d'], ['tgl_akhir','d'],
      ['status', E.KONTRAK_STATUS], ['approved_by','s'], ['approved_at','dt'],
      // Data dokumen kontrak riil (di-append di AKHIR utk migrasi setupDatabase idempotent):
      // no_kontrak = nomor surat kontrak (beda dari kontrak_id internal), tgl_kontrak
      // = tanggal kontrak, adendum = catatan adendum, rek_penyedia_bni/bsi = nomor
      // rekening PENUH penyedia per bank (dipakai Form-07/09).
      ['no_kontrak','s'], ['tgl_kontrak','d'], ['adendum','s'],
      ['rek_penyedia_bni','s'], ['rek_penyedia_bsi','s'],
      // harga_per_hari = tarif utama (rupiah/taruna/hari) sejak migrasi harga
      // per-porsi → per-hari (dikonfirmasi Firdaus); harga_per_porsi/porsi_per_hari
      // TETAP ada (fallback kontrak lama, lihat _hargaPerHariKontrak_ 05_master.gs).
      ['harga_per_hari','i']
    ]],
    [SHEETS.MENU_KONTRAK, [
      ['menu_id','s'], ['kontrak_id','s'], ['hari', E.HARI],
      ['menu_pagi','s'], ['menu_siang','s'], ['menu_malam','s']
    ]],
    [SHEETS.STATUS_HARIAN, [
      ['status_id','s'], ['tanggal','d'], ['nit','s'], ['status', E.STATUS_HARIAN],
      ['input_by','s'], ['timestamp','dt']
    ]],
    [SHEETS.PESANAN, [
      ['pesanan_id','s'], ['tgl_makan','d'], ['kontrak_id','s'], ['jml_taruna','i'],
      ['menu','s'], ['catatan','s'], ['status', E.PESANAN_STATUS],
      ['created_by','s'], ['verif_by','s'], ['verif_at','dt'], ['revisi_dari','s']
    ]],
    [SHEETS.REALISASI, [
      ['real_id','s'], ['pesanan_id','s'], ['tanggal','d'], ['porsi_diterima','i'],
      ['jml_taruna_makan','i'], ['ketidaksesuaian','s'], ['tindak_lanjut','s'],
      ['geotag_lat','n'], ['geotag_lng','n'], ['ttd_pembina_at','dt'], ['ttd_senat_at','dt'],
      // Ownership Taruna — Fitur 1 Piket Verifikasi Makan (append-only, idempotent).
      // Diisi kemudian oleh action verifikasi piket (tahap berikutnya) — kosong
      // di realisasi.create, TIDAK mengubah ttd Pembina/Senat/foto/geotag di atas.
      ['piket_nit','s'], ['piket_nama','s'], ['piket_menu_sesuai','b'],
      ['piket_porsi_cukup','b'], ['piket_kualitas', E.REALISASI_KUALITAS],
      ['piket_gizi','s'], ['piket_catatan','s'], ['piket_at','dt'],
      // Penerimaan Barang Senat (append-only, idempotent) — string JSON
      // {pagi:[{komponen,ada,jumlah}], siang:[...], malam:[...]}, diisi lewat
      // realisasi.penerimaan (tahap berikutnya). Kosong di realisasi.create,
      // TIDAK mengubah porsi_diterima/jml_taruna_makan/ttd/piket_* di atas.
      ['penerimaan','s']
    ]],
    [SHEETS.PEMBAYARAN, [
      ['bayar_id','s'], ['bulan','s'], ['kontrak_id','s'], ['nilai_total','i'],
      ['no_spm','s'], ['tgl_spm','d'], ['no_sp2d','s'], ['tgl_sp2d','d'],
      ['konfirmasi_senat_at','dt'], ['status', E.PEMBAYARAN_STATUS]
    ]],
    [SHEETS.TAGIHAN, [
      ['tagihan_id','s'], ['bulan','s'], ['nit','s'], ['nominal','i'],
      ['sebab', E.TAGIHAN_SEBAB], ['status', E.TAGIHAN_STATUS], ['tgl_setor','d'],
      ['diverifikasi_oleh','s'], ['catatan_hapus','s'], ['verif_pembina_oleh','s'],
      ['verif_2_oleh','s'], ['nilai_transfer','i'],
      // Penerusan dana LUNAS ke penyedia — TERPISAH dari SP2D/SPM, lihat
      // tagihan.teruskan_penyedia (16_tagihan.gs). Di-append di AKHIR
      // (migrasi idempotent). Kosong = belum diteruskan.
      ['tgl_diteruskan_penyedia','d']
    ]],
    [SHEETS.SURAT_PERINGATAN, [
      ['sp_id','s'], ['tagihan_id','s'], ['level','i'], ['no_surat','s'],
      ['tgl_terbit','d'], ['tenggat','d'], ['ditandatangani_oleh', E.SP_TTD],
      ['generated_by', E.SP_GENERATED]
    ]],
    [SHEETS.LAMPIRAN, [
      ['lamp_id','s'], ['ref_type', E.LAMPIRAN_REFTYPE], ['ref_id','s'],
      ['jenis', E.LAMPIRAN_JENIS], ['drive_file_id','s'], ['nama_file','s'],
      ['uploaded_by','s'], ['timestamp','dt']
    ]],
    [SHEETS.AUDIT_LOG, [
      ['timestamp','dt'], ['user_id','s'], ['aksi','s'], ['ref_type','s'],
      ['ref_id','s'], ['data_lama','s'], ['data_baru','s']
    ]],
    [SHEETS.REKAP_BULANAN, [
      ['bulan','s'], ['nit','s'], ['hari_makan','i'], ['hari_tidak_makan','i'],
      ['nominal','i'], ['status', E.REKAP_STATUS], ['verif_by','s'], ['verif_at','dt']
    ]],
    [SHEETS.BANTUAN_LUAR_KAMPUS, [
      ['bantuan_id','s'], ['nit','s'], ['kegiatan','s'], ['bulan','s'], ['periode','s'],
      ['total_hari','i'], ['nilai_per_hari','i'], ['nominal','i'], ['pembayaran_ke','i'],
      ['keterangan','s'],
      // Persetujuan Ketua Jurusan (di-append di AKHIR utk migrasi idempotent):
      // status DRAFT→DISETUJUI_KAJUR + siapa/kapan menyetujui.
      ['status', E.BLK_STATUS], ['approved_by','s'], ['approved_at','dt']
    ]],
    [SHEETS.TARUNA_REKENING, [
      ['nit','s'], ['no_rekening_lengkap','s'], ['bank', E.BANK], ['nama_pemilik','s'],
      ['updated_by','s'], ['updated_at','dt'], ['penyedia_id','s']
    ]],
    [SHEETS.SP2D_MONITORING, [
      ['no_spm','s'], ['kategori', E.SP2D_KATEGORI], ['nit','s'], ['prodi','s'], ['tingkat','s'],
      ['bulan','s'], ['kegiatan','s'], ['jumlah_orang','i'], ['jumlah_pembayaran','i'],
      ['tgl_spm','d'], ['no_sp2d','s'], ['tgl_sp2d','d'], ['status_sp2d','s'],
      ['uraian_asli','s'], ['perlu_cek_manual','s']
    ]],
    // SPM (§18 skema-sheet.md) — header kelompok AUTHORED (dibuat satker sebelum
    // SP2D terbit), beda provenance dari SP2D_MONITORING (imported). Satu sheet,
    // dua kategori simetris: DALAM_KAMPUS (kunci bulan+prodi+tingkat+penyedia_id,
    // anak PEMBAYARAN lewat bayar_id) & LUAR_KAMPUS (kunci bulan+prodi+tingkat+
    // kegiatan+pembayaran_ke, tanpa bayar_id — tidak ada sheet amplop). 1 SPM = 1 SP2D
    // (dikonfirmasi Firdaus), jadi field hasil SP2D menempel di baris yang sama.
    [SHEETS.SPM, [
      ['spm_id','s'], ['kategori', E.SPM_KATEGORI], ['bayar_id','s'], ['bulan','s'],
      ['prodi','s'], ['tingkat','s'], ['penyedia_id','s'], ['kegiatan','s'],
      ['pembayaran_ke','i'], ['periode','s'], ['nominal','i'],
      ['no_spm','s'], ['tgl_spm','d'], ['no_sp2d','s'], ['tgl_sp2d','d'],
      ['status', E.SPM_STATUS],
      // nit_anggota/induk_spm_id (spm.split/spm.gabung) — default kosong,
      // TIDAK memengaruhi grup yang belum pernah displit (lihat skema-sheet.md §18).
      ['nit_anggota','s'], ['induk_spm_id','s']
    ]]
  ];
}

// Sheet yang append-only → diproteksi warning-only (edit manual memunculkan peringatan)
// TARUNA_REKENING ikut diproteksi (bukan append-only, tapi datanya sensitif —
// pengisian/pembaruan seharusnya hanya lewat rekening.simpan, bukan edit manual).
var _SHEET_PROTECT_ = [SHEETS.AUDIT_LOG, SHEETS.SURAT_PERINGATAN, SHEETS.TARUNA_REKENING];

var _WARNA_HEADER_ = '#E0F2F1';

/**
 * setupSemua() — orkestrasi seluruh inisialisasi (disarankan dijalankan ini).
 */
function setupSemua() {
  setupDatabase();
  seedAwal();
  setupFolderDrive();
  Logger.log('setupSemua() selesai. Database, seed, dan folder Drive siap.');
}

/**
 * setupDatabase() — buat/segarkan 18 sheet sesuai skema. Idempotent.
 */
function setupDatabase() {
  var ss = _getSpreadsheet_();
  var skema = _skema_();

  skema.forEach(function (def) {
    var nama = def[0];
    var kolom = def[1];
    var sheet = ss.getSheetByName(nama) || ss.insertSheet(nama);

    // 1) Header baris 1 (snake_case persis skema)
    var header = kolom.map(function (c) { return c[0]; });
    sheet.getRange(1, 1, 1, header.length).setValues([header]);

    // 2) Gaya header: bold + background + freeze baris 1
    sheet.getRange(1, 1, 1, header.length)
      .setFontWeight('bold')
      .setBackground(_WARNA_HEADER_);
    sheet.setFrozenRows(1);

    // 3) Format & validasi per kolom (berlaku pada area data baris 2 ke bawah)
    var maxRows = sheet.getMaxRows();
    var dataRows = maxRows - 1;
    if (dataRows > 0) {
      kolom.forEach(function (c, idx) {
        var col = idx + 1;
        var tipe = c[1];
        var rng = sheet.getRange(2, col, dataRows, 1);

        if (Object.prototype.toString.call(tipe) === '[object Array]') {
          // Kolom enum → dropdown + teks polos
          var rule = SpreadsheetApp.newDataValidation()
            .requireValueInList(tipe, true)
            .setAllowInvalid(false)
            .build();
          rng.setDataValidation(rule).setNumberFormat('@');
        } else if (tipe === 'i') {
          rng.setNumberFormat('0');            // integer rupiah/jumlah
        } else if (tipe === 'n') {
          rng.setNumberFormat('0.000000');     // koordinat geotag
        } else if (tipe === 'd') {
          rng.setNumberFormat('yyyy-mm-dd');
        } else if (tipe === 'dt') {
          rng.setNumberFormat('yyyy-mm-dd hh:mm:ss');
        } else if (tipe === 'b') {
          rng.setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
        } else {
          rng.setNumberFormat('@');            // teks polos (hindari auto-konversi ID)
        }
      });
    }

    // 4) Rapikan lebar kolom sekali
    sheet.autoResizeColumns(1, header.length);
  });

  // 5) Proteksi warning-only untuk sheet append-only
  _SHEET_PROTECT_.forEach(function (nama) {
    var sheet = ss.getSheetByName(nama);
    if (sheet) _protectWarning_(sheet);
  });

  // 6) Hapus sheet default kosong ("Sheet1") bila ada dan bukan bagian skema
  _hapusSheetDefault_(ss);

  Logger.log('setupDatabase() selesai: ' + skema.length + ' sheet siap.');
}

/**
 * tambahKolomSpm() — migrasi ringan: tambah kolom SPM yang belum ada
 * (`nit_anggota`, `induk_spm_id` untuk fitur spm.split/spm.gabung) ke sheet
 * SPM yang SUDAH ADA, TANPA menyentuh sheet lain, data, maupun urutan kolom.
 *
 * Kenapa fungsi terpisah, bukan `setupDatabase()`? `setupDatabase()` menimpa
 * baris header SEMUA 18 sheet secara posisi + menerapkan ulang validasi —
 * palu besar yang berisiko bila urutan kolom live sheet lain sudah bergeser
 * dari skema. Fungsi ini hanya menambah kolom yang HILANG di ujung kanan
 * sheet SPM (append), jadi aman dijalankan berapa kali pun (idempotent).
 *
 * Jalankan sekali dari editor GAS: Run → tambahKolomSpm.
 */
function tambahKolomSpm() {
  var ss = _getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEETS.SPM);
  if (!sheet) throw new Error('Sheet SPM belum ada. Jalankan setupDatabase() dulu.');

  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var perluTambah = ['nit_anggota', 'induk_spm_id'];
  var ditambah = [];

  perluTambah.forEach(function (nama) {
    if (header.indexOf(nama) !== -1) return; // sudah ada → lewati (idempotent)
    var col = sheet.getLastColumn() + 1;
    sheet.getRange(1, col).setValue(nama)
      .setFontWeight('bold').setBackground(_WARNA_HEADER_);
    // Format teks polos di area data (hindari auto-konversi ID/NIT jadi angka)
    var dataRows = Math.max(sheet.getMaxRows() - 1, 1);
    sheet.getRange(2, col, dataRows, 1).setNumberFormat('@');
    header.push(nama);
    ditambah.push(nama);
  });

  Logger.log('tambahKolomSpm() selesai. Ditambah: ' +
    (ditambah.length ? ditambah.join(', ') : '(tidak ada — semua sudah ada)') +
    '. Header SPM sekarang: ' + header.join(', '));
  return ditambah;
}

/**
 * seedAwal() — 5 akun contoh. Kata sandi default 123456 di-hash SHA-256(sandi+SALT).
 * Idempotent: akun dengan user_id yang sudah ada dilewati.
 */
function seedAwal() {
  var ss = _getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEETS.PENGGUNA);
  if (!sheet) throw new Error('Sheet PENGGUNA belum ada. Jalankan setupDatabase() dulu.');

  var salt = _getSalt_();
  var pinHash = _sha256Hex_('123456' + salt); // kata sandi default seragam untuk seed

  var akun = [
    { user_id: 'kpa01',     nama: PEJABAT.KPA.nama, role: ROLES.KPA },
    { user_id: 'ppk01',     nama: PEJABAT.PPK.nama, role: ROLES.PPK },
    { user_id: 'senat01',   nama: 'Senat (Contoh)',    role: ROLES.SENAT },
    { user_id: 'pembina01', nama: 'Pembina (Contoh)',  role: ROLES.PEMBINA },
    { user_id: 'admin01',   nama: 'Administrator',     role: ROLES.ADMIN }
  ];

  // user_id yang sudah ada (kolom 1)
  var adaSekarang = {};
  var last = sheet.getLastRow();
  if (last >= 2) {
    sheet.getRange(2, 1, last - 1, 1).getValues().forEach(function (r) {
      if (r[0]) adaSekarang[String(r[0])] = true;
    });
  }

  var ditambah = 0;
  akun.forEach(function (a) {
    if (adaSekarang[a.user_id]) return;
    // Kolom PENGGUNA: user_id, nama, role, pin_hash, token, token_exp, status
    sheet.appendRow([a.user_id, a.nama, a.role, pinHash, '', '', 'AKTIF']);
    ditambah++;
  });

  Logger.log('seedAwal() selesai: ' + ditambah + ' akun ditambahkan, ' +
    (akun.length - ditambah) + ' sudah ada. Kata sandi default 123456 (WAJIB diganti sebelum go-live).');
}

/**
 * setupFolderDrive() — struktur folder Drive + simpan ID ke Script Properties.
 * Idempotent: folder dengan nama sama dipakai ulang, tidak membuat duplikat.
 */
function setupFolderDrive() {
  var p = PropertiesService.getScriptProperties();
  var root = _ensureFolder_(null, 'e-BAMA');
  var lampiran = _ensureFolder_(root, 'LAMPIRAN');
  var suratSp  = _ensureFolder_(root, 'SURAT_PERINGATAN');
  var template = _ensureFolder_(root, 'TEMPLATE');

  p.setProperty('FOLDER_ROOT',     root.getId());
  p.setProperty('FOLDER_LAMPIRAN', lampiran.getId());
  p.setProperty('FOLDER_SP',       suratSp.getId());
  p.setProperty('FOLDER_TEMPLATE', template.getId());

  Logger.log('setupFolderDrive() selesai. FOLDER_LAMPIRAN=' + lampiran.getId() +
    ', FOLDER_SP=' + suratSp.getId() + ', FOLDER_TEMPLATE=' + template.getId());
}

// ── Util internal ───────────────────────────────────────────────────────────

/** Proteksi sheet warning-only tanpa duplikasi (idempotent). */
function _protectWarning_(sheet) {
  var ps = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  var prot = (ps && ps.length) ? ps[0] : sheet.protect();
  prot.setWarningOnly(true);
}

/** Hapus sheet default kosong yang bukan bagian skema (mis. "Sheet1"). */
function _hapusSheetDefault_(ss) {
  var valid = {};
  Object.keys(SHEETS).forEach(function (k) { valid[SHEETS[k]] = true; });
  ss.getSheets().forEach(function (sh) {
    var nama = sh.getName();
    var kosong = sh.getLastRow() === 0 && sh.getLastColumn() === 0;
    if (!valid[nama] && kosong && ss.getSheets().length > 1) {
      ss.deleteSheet(sh);
    }
  });
}

/** Ambil SALT dari Script Properties; generate & simpan bila belum ada. */
function _getSalt_() {
  var p = PropertiesService.getScriptProperties();
  var salt = p.getProperty('SALT');
  if (!salt) {
    salt = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    p.setProperty('SALT', salt);
  }
  return salt;
}

/** SHA-256 → hex string. */
function _sha256Hex_(s) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return raw.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

/** Cari folder bernama `nama` di dalam `parent` (root My Drive bila null); buat bila tidak ada. */
function _ensureFolder_(parent, nama) {
  var cari = parent ? parent.getFoldersByName(nama) : DriveApp.getFoldersByName(nama);
  if (cari.hasNext()) return cari.next();
  return parent ? parent.createFolder(nama) : DriveApp.createFolder(nama);
}

