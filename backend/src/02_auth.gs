/**
 * 02_auth.gs — Autentikasi & sesi (token 24 jam)
 *
 * Diisi pada TAHAP 2. Akan memuat:
 * - authLogin({user_id, pin})  : cek NONAKTIF → hash SHA-256(pin+SALT) → cocokkan
 *                → token Utilities.getUuid(), token_exp now+24 jam → simpan ke PENGGUNA
 *                → {token, role, nama}
 * - Rate limit  : CacheService "fail_"+user_id, 5x gagal → blokir 15 menit
 * - validateToken(token)       : cari di PENGGUNA, cek exp → session {user_id, nama, role} | null
 * - authLogout(token)
 * - authChangePin({pin_lama, pin_baru}) : pin lama wajib benar
 *
 * ACTION: auth.login, auth.logout, auth.change_pin
 */
