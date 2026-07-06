/**
 * 99_setup.gs — Inisialisasi database e-BAMA (sekali jalan, idempotent)
 *
 * Cara pakai (dari editor Apps Script, pilih fungsi lalu Run):
 *   0) setSpreadsheetId('<ID>')  → WAJIB sekali untuk proyek standalone (clasp).
 *      Lewati bila skrip terikat (bound) langsung ke spreadsheet.
 *   1) setupSemua()        → jalankan ketiga langkah sekaligus (disarankan)
 *    atau satu per satu:
 *   2) setupDatabase()     → buat 17 sheet + header + validasi + format + proteksi
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
//             'dt' datetime | ['ENUM_KEY'] dropdown enum (nilai dari ENUM).
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
      ['geotag_lat','n'], ['geotag_lng','n'], ['ttd_pembina_at','dt'], ['ttd_senat_at','dt']
    ]],
    [SHEETS.PEMBAYARAN, [
      ['bayar_id','s'], ['bulan','s'], ['kontrak_id','s'], ['nilai_total','i'],
      ['no_spm','s'], ['tgl_spm','d'], ['no_sp2d','s'], ['tgl_sp2d','d'],
      ['konfirmasi_senat_at','dt'], ['status', E.PEMBAYARAN_STATUS]
    ]],
    [SHEETS.TAGIHAN, [
      ['tagihan_id','s'], ['bulan','s'], ['nit','s'], ['nominal','i'],
      ['sebab', E.TAGIHAN_SEBAB], ['status', E.TAGIHAN_STATUS], ['tgl_setor','d'],
      ['diverifikasi_oleh','s'], ['catatan_hapus','s']
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
 * setupDatabase() — buat/segarkan 17 sheet sesuai skema. Idempotent.
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
