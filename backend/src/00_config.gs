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
  SP2D_MONITORING:  'SP2D_MONITORING'
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
  PENYEDIA: 'PENYEDIA'   // rekanan katering eksternal — akses portal terbatas (lihat 01_router.gs PENYEDIA_ACTIONS)
};

// ── Nilai enum per kolom (rujukan validasi dropdown & pengecekan handler) ────
var ENUM = {
  AKTIF_STATUS:      ['AKTIF', 'NONAKTIF'],                 // PENGGUNA/TARUNA/PENYEDIA.status
  ROLE:              ['KPA', 'PPK', 'SENAT', 'PEMBINA', 'ADMIN', 'WADIR3', 'BAAK', 'PENYEDIA'],
  BANK:              ['BNI', 'BSI'],                        // TARUNA.bank
  KONTRAK_STATUS:    ['DRAFT', 'DISETUJUI_PPK'],
  HARI:              ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'], // MENU_KONTRAK.hari
  STATUS_HARIAN:     ['PESIAR', 'CUTI', 'SAKIT_RUMAH', 'PENUNDAAN_STUDI', 'KEGIATAN_LUAR_KAMPUS',
                      'PKL_1', 'PKL_2', 'PKL_3', 'KPA', 'MAGANG', 'PTB'],
  PESANAN_STATUS:    ['DRAFT', 'DIAJUKAN', 'DIKEMBALIKAN', 'DISETUJUI', 'TERKIRIM'],
  PEMBAYARAN_STATUS: ['DIAJUKAN', 'SP2D_TERBIT', 'DITRANSFER', 'DIKONFIRMASI', 'SELESAI'],
  TAGIHAN_STATUS:    ['TERTAGIH', 'LUNAS', 'DIHAPUSKAN', 'ESKALASI_MANUAL'],
  TAGIHAN_SEBAB:     ['GAGAL_DEBET', 'SALDO_KURANG', 'REKENING_BERMASALAH'],
  // DISETUJUI_WADIR3: gerbang otorisasi pencairan sebelum bayar.create (bukan koreksi angka)
  REKAP_STATUS:      ['DRAFT', 'TERVERIFIKASI_PPK', 'FINAL', 'DISETUJUI_WADIR3'],
  SP_TTD:            ['PPK', 'KPA'],                        // SURAT_PERINGATAN.ditandatangani_oleh
  SP_GENERATED:      ['SISTEM', 'MANUAL'],
  LAMPIRAN_REFTYPE:  ['KONTRAK', 'STATUS_HARIAN', 'PESANAN', 'REALISASI',
                      'PEMBAYARAN', 'TAGIHAN', 'SP'],
  LAMPIRAN_JENIS:    ['FOTO', 'SURAT', 'BA', 'INVOICE', 'BUKTI_SETOR',
                      'BUKTI_DEBET', 'MENU_GIZI', 'NOTULEN', 'LAINNYA'],
  SP2D_KATEGORI:     ['DALAM_KAMPUS', 'LUAR_KAMPUS']         // SP2D_MONITORING.kategori
};

// Status harian yang tergolong "kegiatan luar kampus" — taruna berhak BANTUAN
// makan luar kampus (dihitung di Form-08). Subset dari ENUM.STATUS_HARIAN;
// PESIAR/CUTI/SAKIT_RUMAH/PENUNDAAN_STUDI TIDAK termasuk (tidak dapat bantuan).
var STATUS_LUAR_KAMPUS = ['KEGIATAN_LUAR_KAMPUS', 'PKL_1', 'PKL_2', 'PKL_3', 'KPA', 'MAGANG', 'PTB'];

// ── Data pejabat penandatangan surat ────────────────────────────────────────
var PEJABAT = {
  PPK: { nama: 'Firdaus Dabamona, S.T.',                nip: '198201032007011002' },
  KPA: { nama: 'Daniel Heintje Ndahawali, S.Pi., M.Si.', nip: '197207172002121003' }
};

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
