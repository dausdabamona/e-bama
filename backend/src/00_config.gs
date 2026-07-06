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
  SENAT:    'SENAT',
  PEMBINA:  'PEMBINA',
  ADMIN:    'ADMIN',
  WADIR3:   'WADIR3',
  BAAK:     'BAAK',
  PENYEDIA: 'PENYEDIA',       // rekanan katering eksternal — akses portal terbatas (lihat 01_router.gs PENYEDIA_ACTIONS)
  KETUA_JURUSAN: 'KETUA_JURUSAN' // ketua jurusan/prodi — input absen luar kampus + approve rekap prodinya (scope prodi; lihat 01_router.gs KETUA_JURUSAN_ACTIONS)
};

// ── Nilai enum per kolom (rujukan validasi dropdown & pengecekan handler) ────
var ENUM = {
  AKTIF_STATUS:      ['AKTIF', 'NONAKTIF'],                 // PENGGUNA/TARUNA/PENYEDIA.status
  ROLE:              ['KPA', 'PPK', 'SENAT', 'PEMBINA', 'ADMIN', 'WADIR3', 'BAAK', 'PENYEDIA', 'KETUA_JURUSAN'],
  BANK:              ['BNI', 'BSI'],                        // TARUNA.bank
  KONTRAK_STATUS:    ['DRAFT', 'DISETUJUI_PPK'],
  BLK_STATUS:        ['DRAFT', 'DISETUJUI_KAJUR'],          // BANTUAN_LUAR_KAMPUS.status (persetujuan Ketua Jurusan)
  HARI:              ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'], // MENU_KONTRAK.hari
  STATUS_HARIAN:     ['PESIAR', 'CUTI', 'SAKIT_RUMAH', 'PENUNDAAN_STUDI', 'KEGIATAN_LUAR_KAMPUS',
                      'PKL_1', 'PKL_2', 'PKL_3', 'KPA', 'MAGANG', 'PTB'],
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
                      'BUKTI_DEBET', 'MENU_GIZI', 'NOTULEN', 'LAINNYA'],
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
  senat:         { BNI: '', BSI: '' },
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
