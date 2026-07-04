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

/**
 * _hanyaAdminPPK_(session) — pagar tambahan di DALAM handler (bukan pengganti
 * ACTION_MAP.roles di router). Dipakai handler yang menyentuh data sangat
 * sensitif (rekening lengkap) supaya proteksi tidak bergantung SATU-SATUNYA
 * pada konfigurasi router — kalau suatu saat roles di ACTION_MAP salah/kosong,
 * handler tetap menolak sendiri.
 */
function _hanyaAdminPPK_(session) {
  if (!session || (session.role !== ROLES.ADMIN && session.role !== ROLES.PPK)) {
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
