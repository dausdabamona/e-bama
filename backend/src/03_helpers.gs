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
