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
