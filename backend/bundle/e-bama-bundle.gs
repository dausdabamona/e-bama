/**
 * e-bama-bundle.gs — SEMUA kode backend e-BAMA dalam SATU file.
 * DIBUAT OTOMATIS dari backend/src/*.gs — jangan edit manual; edit sumbernya.
 * Cara pakai: di GAS hapus semua file .gs lama (sisakan tes.gs),
 * buat satu file 'e_bama_bundle.gs', tempel seluruh isi file ini, Ctrl+S.
 */

// ═══════════════════════════════════════════════════════════════════
// ▼▼▼ 00_config.gs ▼▼▼
// ═══════════════════════════════════════════════════════════════════
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
  STATUS_HARIAN:    'STATUS_HARIAN',
  PESANAN:          'PESANAN',
  REALISASI:        'REALISASI',
  PEMBAYARAN:       'PEMBAYARAN',
  TAGIHAN:          'TAGIHAN',
  SURAT_PERINGATAN: 'SURAT_PERINGATAN',
  LAMPIRAN:         'LAMPIRAN',
  AUDIT_LOG:        'AUDIT_LOG',
  REKAP_BULANAN:    'REKAP_BULANAN'
};

// ── Role pengguna ───────────────────────────────────────────────────────────
var ROLES = {
  KPA:     'KPA',
  PPK:     'PPK',
  SENAT:   'SENAT',
  PEMBINA: 'PEMBINA',
  ADMIN:   'ADMIN'
};

// ── Nilai enum per kolom (rujukan validasi dropdown & pengecekan handler) ────
var ENUM = {
  AKTIF_STATUS:      ['AKTIF', 'NONAKTIF'],                 // PENGGUNA/TARUNA/PENYEDIA.status
  ROLE:              ['KPA', 'PPK', 'SENAT', 'PEMBINA', 'ADMIN'],
  BANK:              ['BNI', 'BSI'],                        // TARUNA.bank
  KONTRAK_STATUS:    ['DRAFT', 'DISETUJUI_PPK'],
  STATUS_HARIAN:     ['PESIAR', 'CUTI', 'SAKIT_RUMAH', 'PENUNDAAN_STUDI', 'KEGIATAN_LUAR_KAMPUS'],
  PESANAN_STATUS:    ['DRAFT', 'DIAJUKAN', 'DIKEMBALIKAN', 'DISETUJUI_PEMBINA', 'DISETUJUI_PPK', 'TERKIRIM'],
  PEMBAYARAN_STATUS: ['DIAJUKAN', 'SP2D_TERBIT', 'DITRANSFER', 'DIKONFIRMASI', 'SELESAI'],
  TAGIHAN_STATUS:    ['TERTAGIH', 'LUNAS', 'DIHAPUSKAN', 'ESKALASI_MANUAL'],
  TAGIHAN_SEBAB:     ['GAGAL_DEBET', 'SALDO_KURANG', 'REKENING_BERMASALAH'],
  REKAP_STATUS:      ['DRAFT', 'TERVERIFIKASI_PPK', 'FINAL'],
  SP_TTD:            ['PPK', 'KPA'],                        // SURAT_PERINGATAN.ditandatangani_oleh
  SP_GENERATED:      ['SISTEM', 'MANUAL'],
  LAMPIRAN_REFTYPE:  ['KONTRAK', 'STATUS_HARIAN', 'PESANAN', 'REALISASI',
                      'PEMBAYARAN', 'TAGIHAN', 'SP'],
  LAMPIRAN_JENIS:    ['FOTO', 'SURAT', 'BA', 'INVOICE', 'BUKTI_SETOR',
                      'BUKTI_DEBET', 'MENU_GIZI', 'NOTULEN', 'LAINNYA']
};

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

// ═══════════════════════════════════════════════════════════════════
// ▼▼▼ 01_router.gs ▼▼▼
// ═══════════════════════════════════════════════════════════════════
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
  'taruna.upsert':    { handler: tarunaUpsert,   roles: ['ADMIN'] },
  'penyedia.list':    { handler: penyediaList,   roles: [] },
  'penyedia.upsert':  { handler: penyediaUpsert, roles: ['ADMIN', 'PPK'] },
  'kontrak.list':     { handler: kontrakList,    roles: [] },
  'kontrak.upsert':   { handler: kontrakUpsert,  roles: ['PPK'] },
  'kontrak.approve':  { handler: kontrakApprove, roles: ['PPK'] },

  // Status harian (TAHAP 3)
  'status.set':       { handler: statusSet,      roles: ['ADMIN', 'PEMBINA'] },
  'status.batch':     { handler: statusBatch,    roles: ['ADMIN', 'PEMBINA'] },
  'status.list':      { handler: statusList,     roles: [] },

  // Pesanan (TAHAP 3)
  'pesanan.list':     { handler: pesananList,    roles: [] },
  'pesanan.get':      { handler: pesananGet,     roles: [] },
  'pesanan.create':   { handler: pesananCreate,  roles: ['SENAT'] },
  'pesanan.submit':   { handler: pesananSubmit,  roles: ['SENAT'] },
  'pesanan.verify':   { handler: pesananVerify,  roles: ['PEMBINA'] },
  'pesanan.approve':  { handler: pesananApprove, roles: ['PPK'] },
  'pesanan.return':   { handler: pesananReturn,  roles: ['PEMBINA', 'PPK'] },
  'pesanan.kirim':    { handler: pesananKirim,   roles: ['SENAT'] },
  'pesanan.revisi':   { handler: pesananRevisi,  roles: ['SENAT'] },

  // Realisasi (TAHAP 3)
  'realisasi.list':   { handler: realisasiList,  roles: [] },
  'realisasi.create': { handler: realisasiCreate, roles: ['PEMBINA', 'SENAT'] },
  'realisasi.ttd':    { handler: realisasiTtd,   roles: ['PEMBINA', 'SENAT'] },

  // Rekap bulanan (TAHAP 3)
  'rekap.get':        { handler: rekapGet,       roles: ['PPK', 'KPA'] },
  'rekap.verify':     { handler: rekapVerify,    roles: ['PPK'] },
  'rekap.final':      { handler: rekapFinal,     roles: ['PPK'] },

  // Pembayaran (TAHAP 4A)
  'bayar.list':       { handler: bayarList,      roles: ['PPK', 'KPA', 'SENAT'] },
  'bayar.get':        { handler: bayarGet,       roles: ['PPK', 'KPA', 'SENAT'] },
  'bayar.create':     { handler: bayarCreate,    roles: ['PPK'] },
  'bayar.update':     { handler: bayarUpdate,    roles: ['PPK'] },
  'bayar.confirm':    { handler: bayarConfirm,   roles: ['SENAT'] },
  'bayar.close':      { handler: bayarClose,     roles: ['PPK'] },

  // Tagihan gagal debet (TAHAP 4A)
  'tagihan.create':   { handler: tagihanCreate,  roles: ['SENAT', 'PPK'] },
  'tagihan.list':     { handler: tagihanList,    roles: [] },
  'tagihan.summary':  { handler: tagihanSummary, roles: ['PPK', 'KPA'] },
  'tagihan.setor':    { handler: tagihanSetor,   roles: ['SENAT'] },
  'tagihan.verify':   { handler: tagihanVerify,  roles: ['PPK'] },
  'tagihan.waive':    { handler: tagihanWaive,   roles: ['PPK'] },
  'tagihan.regenerate_sp': { handler: tagihanRegenerateSp, roles: ['PPK'] },

  // Surat peringatan (TAHAP 4B)
  'sp.list':          { handler: spList,         roles: [] }

  // Master pengguna (Admin) — didaftarkan pada TAHAP 7 (handler sudah ada di 02_auth.gs):
  // 'pengguna.list':      { handler: penggunaList,     roles: ['ADMIN'] },
  // 'pengguna.upsert':    { handler: penggunaUpsert,   roles: ['ADMIN'] },
  // 'pengguna.reset_pin': { handler: penggunaResetPin, roles: ['ADMIN'] }
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

// ═══════════════════════════════════════════════════════════════════
// ▼▼▼ 02_auth.gs ▼▼▼
// ═══════════════════════════════════════════════════════════════════
/**
 * 02_auth.gs — Autentikasi & sesi (token 24 jam) + master pengguna (Admin)
 *
 * SALT & hash memakai _getSalt_() / _sha256Hex_() (99_setup.gs).
 * ACTION: auth.login, auth.logout, auth.change_pin,
 *         pengguna.list, pengguna.upsert, pengguna.reset_pin
 */

var _PIN_DEFAULT_ = '123456';       // PIN reset (wajib diganti pengguna)
var _TOKEN_TTL_MS_ = 24 * 60 * 60 * 1000;
var _LOGIN_MAX_GAGAL_ = 5;
var _LOGIN_BLOKIR_DETIK_ = 15 * 60; // 15 menit

/** Login → {token, role, nama}. Rate limit 5x gagal → blokir 15 menit. */
function authLogin(payload) {
  var uid = (payload && payload.user_id != null) ? String(payload.user_id).trim() : '';
  var pin = (payload && payload.pin != null) ? String(payload.pin) : '';
  if (!uid || !pin) throw _fail_('user_id dan PIN wajib diisi.');

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
    throw _fail_('user_id atau PIN salah.');
  }

  cache.remove(fkey);
  var token = Utilities.getUuid();
  var exp = new Date(Date.now() + _TOKEN_TTL_MS_);
  sheetUpdate(SHEETS.PENGGUNA, 'user_id', uid, { token: token, token_exp: exp });
  auditLog({ user_id: uid }, 'auth.login', 'PENGGUNA', uid, null, { login: true });
  return { token: token, role: u.role, nama: u.nama };
}

/** Validasi token → session {user_id, nama, role} atau null. */
function validateToken(token) {
  if (!token) return null;
  var u = sheetRead(SHEETS.PENGGUNA, function (r) { return String(r.token) === String(token); })[0];
  if (!u || u.status === 'NONAKTIF') return null;
  var exp = u.token_exp;
  var expMs = (exp instanceof Date) ? exp.getTime() : (exp ? new Date(exp).getTime() : 0);
  if (!expMs || expMs < Date.now()) return null;
  return { user_id: u.user_id, nama: u.nama, role: u.role };
}

/** Logout → hapus token. */
function authLogout(payload, session) {
  sheetUpdate(SHEETS.PENGGUNA, 'user_id', session.user_id, { token: '', token_exp: '' });
  auditLog(session, 'auth.logout', 'PENGGUNA', session.user_id, null, null);
  return { ok: true };
}

/** Ganti PIN (pin_lama wajib benar; pin_baru 6 digit). */
function authChangePin(payload, session) {
  var lama = (payload && payload.pin_lama != null) ? String(payload.pin_lama) : '';
  var baru = (payload && payload.pin_baru != null) ? String(payload.pin_baru) : '';
  if (!/^\d{6}$/.test(baru)) throw _fail_('PIN baru harus 6 digit angka.');
  var salt = _getSalt_();
  var u = sheetRead(SHEETS.PENGGUNA, function (r) { return String(r.user_id) === String(session.user_id); })[0];
  if (!u) throw _fail_('Pengguna tidak ditemukan.');
  if (String(u.pin_hash) !== _sha256Hex_(lama + salt)) throw _fail_('PIN lama salah.');
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
      return { user_id: u.user_id, nama: u.nama, role: u.role, status: u.status };
    })
  };
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

  var ada = sheetRead(SHEETS.PENGGUNA, function (r) { return String(r.user_id) === uid; })[0];
  if (ada) {
    var baru = sheetUpdate(SHEETS.PENGGUNA, 'user_id', uid, { nama: nama, role: role, status: status });
    auditLog(session, 'pengguna.upsert', 'PENGGUNA', uid,
      { nama: ada.nama, role: ada.role, status: ada.status }, { nama: nama, role: role, status: status });
    return { pengguna: { user_id: uid, nama: baru.nama, role: baru.role, status: baru.status } };
  }
  sheetAppend(SHEETS.PENGGUNA, {
    user_id: uid, nama: nama, role: role,
    pin_hash: _sha256Hex_(_PIN_DEFAULT_ + _getSalt_()),
    token: '', token_exp: '', status: status
  });
  auditLog(session, 'pengguna.upsert', 'PENGGUNA', uid, null, { nama: nama, role: role, status: status });
  return { pengguna: { user_id: uid, nama: nama, role: role, status: status } };
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

// ═══════════════════════════════════════════════════════════════════
// ▼▼▼ 03_helpers.gs ▼▼▼
// ═══════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════
// ▼▼▼ 05_master.gs ▼▼▼
// ═══════════════════════════════════════════════════════════════════
/**
 * 05_master.gs — Master data penyedia & kontrak + util domain bersama
 *
 * ACTION: penyedia.list, penyedia.upsert (Admin, PPK),
 *         kontrak.list, kontrak.upsert (PPK), kontrak.approve (PPK)
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

/** Daftar kontrak. */
function kontrakList(payload, session) {
  return { kontrak: sheetRead(SHEETS.KONTRAK) };
}

/** Tambah/ubah kontrak (hanya selama DRAFT). Baru → KTR-000001, status DRAFT. */
function kontrakUpsert(payload, session) {
  var pid = String((payload && payload.penyedia_id) || '').trim();
  if (!pid) throw _fail_('penyedia_id wajib diisi.');
  var penyedia = sheetRead(SHEETS.PENYEDIA, function (r) { return String(r.penyedia_id) === pid; })[0];
  if (!penyedia) throw _fail_('Penyedia tidak ditemukan: ' + pid);

  var obj = {
    penyedia_id: pid,
    harga_per_porsi: _int_(payload.harga_per_porsi, 'harga_per_porsi'),
    porsi_per_hari: _int_(payload.porsi_per_hari, 'porsi_per_hari'),
    tgl_mulai: _wajibTgl_(payload.tgl_mulai, 'tgl_mulai'),
    tgl_akhir: _wajibTgl_(payload.tgl_akhir, 'tgl_akhir')
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

// ═══════════════════════════════════════════════════════════════════
// ▼▼▼ 10_taruna.gs ▼▼▼
// ═══════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════
// ▼▼▼ 11_status_harian.gs ▼▼▼
// ═══════════════════════════════════════════════════════════════════
/**
 * 11_status_harian.gs — Status harian taruna yang TIDAK berhak makan
 * (SOP: Peringatan no. 2). Enum: PESIAR / CUTI / SAKIT_RUMAH / PENUNDAAN_STUDI.
 *
 * ACTION: status.set (Admin, Pembina), status.batch (Admin, Pembina),
 *         status.list (semua login)
 *
 * Unik per (tanggal, nit) — upsert. Surat pendukung → LAMPIRAN ref_type=STATUS_HARIAN.
 * Setiap aksi tulis → withLock + auditLog.
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

/** Set status satu taruna satu tanggal. Payload {tanggal, nit, status, berkas?}. */
function statusSet(payload, session) {
  var tanggal = _wajibTgl_(payload && payload.tanggal, 'tanggal');
  var nit = String((payload && payload.nit) || '').trim();
  if (!nit) throw _fail_('nit wajib diisi.');
  var hasil = _statusUpsert_(session, tanggal, nit, String((payload && payload.status) || ''));

  // Surat pendukung opsional: berkas {base64, nama_file, jenis?}
  if (payload.berkas && payload.berkas.base64) {
    lampiranSave(session, 'STATUS_HARIAN', hasil.status_id,
      payload.berkas.jenis || 'SURAT', payload.berkas.base64, payload.berkas.nama_file);
  }
  return hasil;
}

/** Input massal: {tanggal, status, nit: [], berkas?}. Mis. satu kelas pesiar. */
function statusBatch(payload, session) {
  var tanggal = _wajibTgl_(payload && payload.tanggal, 'tanggal');
  var daftar = (payload && payload.nit) || [];
  if (!daftar.length) throw _fail_('nit harus berupa daftar minimal 1 taruna.');
  var status = String((payload && payload.status) || '');
  var hasil = [];
  daftar.forEach(function (nit) {
    hasil.push(_statusUpsert_(session, tanggal, String(nit).trim(), status));
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

// ═══════════════════════════════════════════════════════════════════
// ▼▼▼ 12_pesanan.gs ▼▼▼
// ═══════════════════════════════════════════════════════════════════
/**
 * 12_pesanan.gs — Pesanan makan Pre-Order H-1 (SOP no. 5–8, Form-01)
 * Mesin status: DRAFT → DIAJUKAN → (DIKEMBALIKAN | DISETUJUI_PEMBINA)
 *               → (DIKEMBALIKAN | DISETUJUI_PPK) → TERKIRIM
 * Rantai Form-01: Senat merencanakan → Pembina memverifikasi → PPK menyetujui
 *               → Senat menyampaikan ke penyedia paling lambat H-1.
 *
 * ACTION: pesanan.list, pesanan.get (semua login),
 *         pesanan.create/submit/kirim/revisi (Senat),
 *         pesanan.verify (Pembina), pesanan.approve (PPK),
 *         pesanan.return (Pembina, PPK)
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

/** Daftar pesanan, filter {bulan?}. */
function pesananList(payload, session) {
  var bulan = payload && payload.bulan;
  var rows = sheetRead(SHEETS.PESANAN, function (r) {
    return !bulan || _bulanStr_(r.tgl_makan) === bulan;
  });
  rows.forEach(function (r) { r.tgl_makan = _tglStr_(r.tgl_makan); });
  return { pesanan: rows };
}

/** Detail pesanan + lampiran. */
function pesananGet(payload, session) {
  var p = _pesanan_(payload && payload.pesanan_id);
  p.tgl_makan = _tglStr_(p.tgl_makan);
  return { pesanan: p, lampiran: lampiranList('PESANAN', p.pesanan_id) };
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
    verif_by: '', verif_at: '', revisi_dari: '',
    appr_by: '', appr_at: ''
  };
  sheetAppend(SHEETS.PESANAN, obj);
  auditLog(session, 'pesanan.create', 'PESANAN', obj.pesanan_id, null,
    { tgl_makan: tgl, jml_taruna: jml, jml_otomatis: jmlAuto, kontrak_id: kontrak.kontrak_id });
  return { pesanan: obj, jml_otomatis: jmlAuto };
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

/** DRAFT → DIAJUKAN (hanya pembuat). */
function pesananSubmit(payload, session) {
  var p = _pesanan_(payload && payload.pesanan_id);
  if (String(p.created_by) !== String(session.user_id)) {
    throw _fail_('Hanya pembuat pesanan yang boleh mengajukan.');
  }
  _pesananTransisi_(session, p.pesanan_id, 'DRAFT', 'DIAJUKAN', 'submit', null);
  return { pesanan_id: p.pesanan_id, status: 'DIAJUKAN' };
}

/** DIAJUKAN → DISETUJUI_PEMBINA (Pembina, SOP no. 6). */
function pesananVerify(payload, session) {
  var id = payload && payload.pesanan_id;
  _pesananTransisi_(session, id, 'DIAJUKAN', 'DISETUJUI_PEMBINA', 'verify',
    { verif_by: session.user_id, verif_at: new Date() });
  return { pesanan_id: id, status: 'DISETUJUI_PEMBINA' };
}

/** DISETUJUI_PEMBINA → DISETUJUI_PPK (PPK, SOP no. 7 / Form-01). */
function pesananApprove(payload, session) {
  var id = payload && payload.pesanan_id;
  _pesananTransisi_(session, id, 'DISETUJUI_PEMBINA', 'DISETUJUI_PPK', 'approve',
    { appr_by: session.user_id, appr_at: new Date() });
  return { pesanan_id: id, status: 'DISETUJUI_PPK' };
}

/**
 * Pengembalian (alasan wajib):
 * Pembina: DIAJUKAN → DIKEMBALIKAN; PPK: DISETUJUI_PEMBINA → DIKEMBALIKAN.
 */
function pesananReturn(payload, session) {
  var id = payload && payload.pesanan_id;
  var alasan = String((payload && payload.alasan) || '').trim();
  if (!alasan) throw _fail_('alasan pengembalian wajib diisi.');
  var dariStatus = (session.role === 'PPK') ? 'DISETUJUI_PEMBINA' : 'DIAJUKAN';
  var p = _pesanan_(id);
  // Skema tidak punya kolom alasan tersendiri → catat di catatan + AUDIT_LOG
  var catatan = (p.catatan ? p.catatan + ' | ' : '') + 'DIKEMBALIKAN (' + session.role + '): ' + alasan;
  _pesananTransisi_(session, id, dariStatus, 'DIKEMBALIKAN', 'return', { catatan: catatan });
  return { pesanan_id: id, status: 'DIKEMBALIKAN' };
}

/** DISETUJUI_PPK → TERKIRIM (Senat), hanya ≤ H-1 dari tgl_makan. */
function pesananKirim(payload, session) {
  var id = payload && payload.pesanan_id;
  var p = _pesanan_(id);
  if (_todayStr_() >= _tglStr_(p.tgl_makan)) {
    throw _fail_('Pengiriman hanya boleh H-1 atau lebih awal dari tgl_makan. ' +
      'Untuk perubahan setelah terkirim gunakan pesanan.revisi dengan BA perubahan.');
  }
  _pesananTransisi_(session, id, 'DISETUJUI_PPK', 'TERKIRIM', 'kirim', null);
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

// ═══════════════════════════════════════════════════════════════════
// ▼▼▼ 13_realisasi.gs ▼▼▼
// ═══════════════════════════════════════════════════════════════════
/**
 * 13_realisasi.gs — Realisasi penyediaan makan harian (SOP no. 8–9)
 *
 * ACTION: realisasi.list (semua login),
 *         realisasi.create (Pembina, Senat),
 *         realisasi.ttd (Pembina, Senat — konfirmasi PIN)
 *
 * Pesanan wajib TERKIRIM. Foto → LAMPIRAN ref_type=REALISASI jenis=FOTO.
 * Kedua ttd terisi → otomatis rekapUpdate(tanggal).
 * Setiap aksi tulis → withLock + auditLog.
 */

/** Ambil realisasi by id atau error. */
function _realisasi_(id) {
  var r = sheetRead(SHEETS.REALISASI, function (x) { return String(x.real_id) === String(id); })[0];
  if (!r) throw _fail_('Realisasi tidak ditemukan: ' + id);
  return r;
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
 * Catat realisasi harian. Payload:
 * {pesanan_id, porsi_diterima, jml_taruna_makan, ketidaksesuaian?, tindak_lanjut?,
 *  geotag_lat, geotag_lng, berkas?}  — berkas = foto dokumentasi (jenis FOTO).
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
  sheetAppend(SHEETS.REALISASI, obj);

  if (payload.berkas && payload.berkas.base64) {
    lampiranSave(session, 'REALISASI', obj.real_id, 'FOTO',
      payload.berkas.base64, payload.berkas.nama_file || (obj.real_id + '.jpg'));
  }
  auditLog(session, 'realisasi.create', 'REALISASI', obj.real_id, null, {
    pesanan_id: p.pesanan_id, tanggal: obj.tanggal,
    porsi_diterima: obj.porsi_diterima, jml_taruna_makan: obj.jml_taruna_makan
  });
  return { realisasi: obj };
}

/**
 * Tanda tangan digital (konfirmasi PIN ulang). Payload {real_id, pin}.
 * PEMBINA mengisi ttd_pembina_at, SENAT mengisi ttd_senat_at.
 * Kedua ttd terisi → rekapUpdate(tanggal) otomatis.
 */
function realisasiTtd(payload, session) {
  var r = _realisasi_(payload && payload.real_id);

  // Konfirmasi PIN pemilik sesi
  var pin = (payload && payload.pin != null) ? String(payload.pin) : '';
  var u = sheetRead(SHEETS.PENGGUNA, function (x) { return String(x.user_id) === String(session.user_id); })[0];
  if (!u || String(u.pin_hash) !== _sha256Hex_(pin + _getSalt_())) {
    throw _fail_('PIN salah — tanda tangan dibatalkan.');
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

// ═══════════════════════════════════════════════════════════════════
// ▼▼▼ 14_rekap.gs ▼▼▼
// ═══════════════════════════════════════════════════════════════════
/**
 * 14_rekap.gs — REKAP_BULANAN: materialized view incremental (SOP no. 10)
 * Status: DRAFT → TERVERIFIKASI_PPK → FINAL (beku, dasar SPM)
 *
 * ACTION: rekap.get (PPK, KPA), rekap.verify (PPK), rekap.final (PPK)
 * INTERNAL: rekapUpdate(tanggal) — dipanggil realisasi.ttd, BUKAN action publik.
 *
 * Uang selalu integer rupiah: nominal = hari_makan × harga_per_porsi × porsi_per_hari.
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
  var harga = _int_(kontrak.harga_per_porsi, 'harga_per_porsi');
  var porsi = _int_(kontrak.porsi_per_hari, 'porsi_per_hari');

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
      var nominal = Math.round(makan * harga * porsi); // integer rupiah

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
      { hari_sah: jmlHariSah, taruna: tarunaAktif.length, harga: harga, porsi: porsi });
    return { bulan: bulan, hari_sah: jmlHariSah, taruna: tarunaAktif.length };
  });
}

/** Baris rekap satu bulan. */
function _rekapBulan_(bulan) {
  var rows = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  if (!rows.length) throw _fail_('Belum ada rekap untuk bulan ' + bulan + '.');
  return rows;
}

/** rekap.get {bulan} → baris + total (PPK, KPA). */
function rekapGet(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var rows = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  var total = 0;
  rows.forEach(function (r) { total += _int_(r.nominal || 0, 'nominal'); });
  return { rekap: rows, total: total, bulan: bulan };
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

/** DRAFT → TERVERIFIKASI_PPK. */
function rekapVerify(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  return _rekapSetStatus_(session, bulan, 'DRAFT', 'TERVERIFIKASI_PPK', 'verify');
}

/** TERVERIFIKASI_PPK → FINAL (beku, dasar SPM). */
function rekapFinal(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  return _rekapSetStatus_(session, bulan, 'TERVERIFIKASI_PPK', 'FINAL', 'final');
}

// ═══════════════════════════════════════════════════════════════════
// ▼▼▼ 15_pembayaran.gs ▼▼▼
// ═══════════════════════════════════════════════════════════════════
/**
 * 15_pembayaran.gs — Pembayaran LS via KPPN (SOP no. 11–17)
 * Mesin status: DIAJUKAN → SP2D_TERBIT → DITRANSFER → DIKONFIRMASI → SELESAI
 *
 * ACTION: bayar.list, bayar.get (PPK, KPA, Senat),
 *         bayar.create, bayar.update, bayar.close (PPK),
 *         bayar.confirm (Senat)
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

/** Daftar pembayaran, filter {bulan?}. */
function bayarList(payload, session) {
  var bulan = payload && payload.bulan;
  var rows = sheetRead(SHEETS.PEMBAYARAN, function (r) {
    return !bulan || String(r.bulan) === bulan;
  });
  return { pembayaran: rows };
}

/** Detail pembayaran + lampiran. */
function bayarGet(payload, session) {
  var b = _bayar_(payload && payload.bayar_id);
  return { pembayaran: b, lampiran: lampiranList('PEMBAYARAN', b.bayar_id) };
}

/** Buat pembayaran: syarat rekap bulan FINAL; nilai_total = SUM(nominal) snapshot. */
function bayarCreate(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');

  var rekap = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  if (!rekap.length) throw _fail_('Belum ada rekap untuk bulan ' + bulan + '.');
  rekap.forEach(function (r) {
    if (String(r.status) !== 'FINAL') {
      throw _fail_('Rekap bulan ' + bulan + ' belum FINAL (ada baris ' + r.status + ') — finalkan dulu sebagai dasar SPM.');
    }
  });

  var dobel = sheetRead(SHEETS.PEMBAYARAN, function (r) { return String(r.bulan) === bulan; })[0];
  if (dobel) throw _fail_('Pembayaran bulan ' + bulan + ' sudah ada: ' + dobel.bayar_id);

  var total = 0;
  rekap.forEach(function (r) { total += _int_(r.nominal || 0, 'nominal'); });
  var kontrak = _kontrakBulan_(bulan);

  var obj = {
    bayar_id: nextId('BYR'),
    bulan: bulan,
    kontrak_id: kontrak.kontrak_id,
    nilai_total: total,          // SNAPSHOT — beku, momen penulisan di AUDIT_LOG
    no_spm: '', tgl_spm: '', no_sp2d: '', tgl_sp2d: '',
    konfirmasi_senat_at: '',
    status: 'DIAJUKAN'
  };
  sheetAppend(SHEETS.PEMBAYARAN, obj);
  auditLog(session, 'bayar.create', 'PEMBAYARAN', obj.bayar_id, null,
    { bulan: bulan, nilai_total: total, kontrak_id: kontrak.kontrak_id });
  return { pembayaran: obj };
}

/**
 * Isi SPM/SP2D bertahap — status naik sesuai urutan:
 * DIAJUKAN + no_sp2d terisi → SP2D_TERBIT; SP2D_TERBIT + ditransfer:true → DITRANSFER.
 * Payload {bayar_id, no_spm?, tgl_spm?, no_sp2d?, tgl_sp2d?, ditransfer?, berkas?}.
 */
function bayarUpdate(payload, session) {
  var b = _bayar_(payload && payload.bayar_id);
  if (b.status === 'DIKONFIRMASI' || b.status === 'SELESAI') {
    throw _fail_('Pembayaran berstatus ' + b.status + ' — tidak bisa diubah lagi.');
  }

  var patch = {};
  if (payload.no_spm !== undefined) patch.no_spm = String(payload.no_spm);
  if (payload.tgl_spm) patch.tgl_spm = _wajibTgl_(payload.tgl_spm, 'tgl_spm');
  if (payload.no_sp2d !== undefined) patch.no_sp2d = String(payload.no_sp2d);
  if (payload.tgl_sp2d) patch.tgl_sp2d = _wajibTgl_(payload.tgl_sp2d, 'tgl_sp2d');

  // Kenaikan status berurutan
  var statusBaru = b.status;
  if (b.status === 'DIAJUKAN' && (patch.no_sp2d || b.no_sp2d)) statusBaru = 'SP2D_TERBIT';
  if ((statusBaru === 'SP2D_TERBIT') && payload.ditransfer === true) statusBaru = 'DITRANSFER';
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

/** Senat: DITRANSFER → DIKONFIRMASI (invoice diterima penyedia, SOP 15–16). */
function bayarConfirm(payload, session) {
  var b = _bayar_(payload && payload.bayar_id);
  if (b.status !== 'DITRANSFER') {
    throw _fail_('Pembayaran berstatus ' + b.status + ', tidak bisa dikonfirmasi (butuh DITRANSFER).');
  }
  sheetUpdate(SHEETS.PEMBAYARAN, 'bayar_id', b.bayar_id,
    { status: 'DIKONFIRMASI', konfirmasi_senat_at: new Date() });
  auditLog(session, 'bayar.confirm', 'PEMBAYARAN', b.bayar_id,
    { status: b.status }, { status: 'DIKONFIRMASI' });
  return { bayar_id: b.bayar_id, status: 'DIKONFIRMASI' };
}

/** PPK: DIKONFIRMASI → SELESAI (SOP 17). */
function bayarClose(payload, session) {
  var b = _bayar_(payload && payload.bayar_id);
  if (b.status !== 'DIKONFIRMASI') {
    throw _fail_('Pembayaran berstatus ' + b.status + ', tidak bisa ditutup (butuh DIKONFIRMASI).');
  }
  sheetUpdate(SHEETS.PEMBAYARAN, 'bayar_id', b.bayar_id, { status: 'SELESAI' });
  auditLog(session, 'bayar.close', 'PEMBAYARAN', b.bayar_id, { status: b.status }, { status: 'SELESAI' });
  return { bayar_id: b.bayar_id, status: 'SELESAI' };
}

// ═══════════════════════════════════════════════════════════════════
// ▼▼▼ 16_tagihan.gs ▼▼▼
// ═══════════════════════════════════════════════════════════════════
/**
 * 16_tagihan.gs — Piutang gagal debet rekening taruna
 * Status: TERTAGIH → LUNAS | DIHAPUSKAN | ESKALASI_MANUAL
 *
 * ACTION: tagihan.create (Senat, PPK), tagihan.list (semua login),
 *         tagihan.summary (PPK, KPA), tagihan.setor (Senat),
 *         tagihan.verify (PPK), tagihan.waive (PPK)
 *
 * nominal = SNAPSHOT dari REKAP_BULANAN FINAL. tagihan_id = TGH-{yyyymm}-{nit}.
 * Level SP aktif TIDAK disimpan — dibaca MAX(level) dari SURAT_PERINGATAN.
 * tagihan.create LANGSUNG menerbitkan SP-1.
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
    return {
      tagihan_id: t.tagihan_id, bulan: String(t.bulan), nit: t.nit,
      nominal: Number(t.nominal) || 0, sebab: t.sebab, status: t.status,
      tgl_setor: _tglStr_(t.tgl_setor), diverifikasi_oleh: t.diverifikasi_oleh,
      catatan_hapus: t.catatan_hapus,
      level_aktif: sp ? sp.level : 0,
      tenggat_aktif: sp ? sp.tenggat : ''
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
    if (String(r.status) !== 'FINAL') throw _fail_('Rekap bulan ' + bulan + ' belum FINAL — tagihan butuh dasar nominal beku.');
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

/** Daftar tagihan + level_aktif + tenggat_aktif. Filter {bulan?, status?}. */
function tagihanList(payload, session) {
  var f = payload || {};
  var rows = _tagihanJoin_().filter(function (t) {
    if (f.bulan && t.bulan !== f.bulan) return false;
    if (f.status && t.status !== f.status) return false;
    return true;
  });
  return { tagihan: rows };
}

/** Dashboard piutang: {per_level: {0..3:{jumlah,nominal}}, total_outstanding}. */
function tagihanSummary(payload, session) {
  var per = { 0: { jumlah: 0, nominal: 0 }, 1: { jumlah: 0, nominal: 0 },
              2: { jumlah: 0, nominal: 0 }, 3: { jumlah: 0, nominal: 0 } };
  var total = 0;
  _tagihanJoin_().forEach(function (t) {
    if (t.status !== 'TERTAGIH') return; // outstanding saja
    var lv = Math.min(Math.max(t.level_aktif, 0), 3);
    per[lv].jumlah++; per[lv].nominal += t.nominal;
    total += t.nominal;
  });
  return { per_level: per, total_outstanding: total };
}

/** Senat lapor setoran: {tagihan_id, tgl_setor, berkas} — bukti WAJIB, status tetap TERTAGIH. */
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

/** PPK verifikasi setoran: syarat bukti setor ada → LUNAS. */
function tagihanVerify(payload, session) {
  var t = _tagihan_(payload && payload.tagihan_id);
  if (t.status !== 'TERTAGIH') throw _fail_('Tagihan berstatus ' + t.status + ', tidak bisa diverifikasi.');
  var bukti = lampiranList('TAGIHAN', t.tagihan_id).filter(function (l) { return l.jenis === 'BUKTI_SETOR'; });
  if (!bukti.length) throw _fail_('Belum ada bukti setor — verifikasi ditolak.');

  sheetUpdate(SHEETS.TAGIHAN, 'tagihan_id', t.tagihan_id,
    { status: 'LUNAS', diverifikasi_oleh: session.user_id });
  auditLog(session, 'tagihan.verify', 'TAGIHAN', t.tagihan_id,
    { status: t.status }, { status: 'LUNAS' });
  _tagihanCacheClear_();
  return { tagihan_id: t.tagihan_id, status: 'LUNAS' };
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

// ═══════════════════════════════════════════════════════════════════
// ▼▼▼ 17_surat_peringatan.gs ▼▼▼
// ═══════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════
// ▼▼▼ 20_trigger.gs ▼▼▼
// ═══════════════════════════════════════════════════════════════════
/**
 * 20_trigger.gs — Trigger terjadwal: eskalasi SP harian
 *
 * Kebijakan (tenggat, JAM_TRIGGER) via getKebijakanSP() — DILARANG baca CONFIG langsung.
 * - eskalasiTagihan() : dijalankan trigger harian; IDEMPOTEN (aman 2× sehari)
 * - pasangTrigger()   : sekali jalan dari editor — pasang trigger harian
 * - backupMingguan()  : diisi pada TAHAP 8 (copy spreadsheet ke e-BAMA/BACKUP)
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
 * backupMingguan() — DIISI PADA TAHAP 8:
 * copy spreadsheet ke folder e-BAMA/BACKUP tiap minggu + trigger-nya.
 */

// ═══════════════════════════════════════════════════════════════════
// ▼▼▼ 99_setup.gs ▼▼▼
// ═══════════════════════════════════════════════════════════════════
/**
 * 99_setup.gs — Inisialisasi database e-BAMA (sekali jalan, idempotent)
 *
 * Cara pakai (dari editor Apps Script, pilih fungsi lalu Run):
 *   0) setSpreadsheetId('<ID>')  → WAJIB sekali untuk proyek standalone (clasp).
 *      Lewati bila skrip terikat (bound) langsung ke spreadsheet.
 *   1) setupSemua()        → jalankan ketiga langkah sekaligus (disarankan)
 *    atau satu per satu:
 *   2) setupDatabase()     → buat 13 sheet + header + validasi + format + proteksi
 *   3) seedAwal()          → 5 akun contoh (PIN default 123456, di-hash SHA-256+SALT)
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
      ['token','s'], ['token_exp','dt'], ['status', E.AKTIF_STATUS]
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
      ['status', E.KONTRAK_STATUS], ['approved_by','s'], ['approved_at','dt']
    ]],
    [SHEETS.STATUS_HARIAN, [
      ['status_id','s'], ['tanggal','d'], ['nit','s'], ['status', E.STATUS_HARIAN],
      ['input_by','s'], ['timestamp','dt']
    ]],
    [SHEETS.PESANAN, [
      // appr_by/appr_at (persetujuan PPK, Form-01) di UJUNG agar sheet lama tidak bergeser
      ['pesanan_id','s'], ['tgl_makan','d'], ['kontrak_id','s'], ['jml_taruna','i'],
      ['menu','s'], ['catatan','s'], ['status', E.PESANAN_STATUS],
      ['created_by','s'], ['verif_by','s'], ['verif_at','dt'], ['revisi_dari','s'],
      ['appr_by','s'], ['appr_at','dt']
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
    ]]
  ];
}

// Sheet yang append-only → diproteksi warning-only (edit manual memunculkan peringatan)
var _SHEET_PROTECT_ = [SHEETS.AUDIT_LOG, SHEETS.SURAT_PERINGATAN];

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
 * setupDatabase() — buat/segarkan 13 sheet sesuai skema. Idempotent.
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
 * seedAwal() — 5 akun contoh. PIN default 123456 di-hash SHA-256(pin+SALT).
 * Idempotent: akun dengan user_id yang sudah ada dilewati.
 */
function seedAwal() {
  var ss = _getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEETS.PENGGUNA);
  if (!sheet) throw new Error('Sheet PENGGUNA belum ada. Jalankan setupDatabase() dulu.');

  var salt = _getSalt_();
  var pinHash = _sha256Hex_('123456' + salt); // PIN default seragam untuk seed

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
    (akun.length - ditambah) + ' sudah ada. PIN default 123456 (WAJIB diganti sebelum go-live).');
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

