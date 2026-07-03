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
  'kontrak.get':      { handler: kontrakGet,     roles: [] },
  'kontrak.upsert':   { handler: kontrakUpsert,  roles: ['PPK'] },
  'kontrak.approve':  { handler: kontrakApprove, roles: ['PPK'] },
  'kontrak.lampiran_upload': { handler: kontrakLampiranUpload, roles: ['PPK'] },
  'menu.list':        { handler: menuList,       roles: [] },
  'menu.upsert':      { handler: menuUpsert,     roles: ['PPK'] },

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
  'pesanan.return':   { handler: pesananReturn,  roles: ['PEMBINA'] },
  'pesanan.kirim':    { handler: pesananKirim,   roles: ['SENAT'] },
  'pesanan.revisi':   { handler: pesananRevisi,  roles: ['SENAT'] },

  // Realisasi (TAHAP 3)
  'realisasi.list':   { handler: realisasiList,  roles: [] },
  'realisasi.create': { handler: realisasiCreate, roles: ['PEMBINA', 'SENAT'] },
  'realisasi.ttd':    { handler: realisasiTtd,   roles: ['PEMBINA', 'SENAT'] },

  // Rekap bulanan (TAHAP 3 + gerbang Wadir 3)
  'rekap.get':        { handler: rekapGet,       roles: ['PPK', 'KPA', 'WADIR3'] },
  'rekap.verify':     { handler: rekapVerify,    roles: ['PPK'] },
  'rekap.final':      { handler: rekapFinal,     roles: ['PPK'] },
  'rekap.approve_wadir3': { handler: rekapApproveWadir3, roles: ['WADIR3'] },
  'rekap.input_historis': { handler: rekapInputHistoris, roles: ['PPK', 'ADMIN'] },

  // Pembayaran (TAHAP 4A)
  'bayar.list':       { handler: bayarList,      roles: ['PPK', 'KPA', 'SENAT', 'WADIR3'] },
  'bayar.get':        { handler: bayarGet,       roles: ['PPK', 'KPA', 'SENAT', 'WADIR3'] },
  'bayar.create':     { handler: bayarCreate,    roles: ['PPK'] },
  'bayar.update':     { handler: bayarUpdate,    roles: ['PPK'] },
  'bayar.confirm':    { handler: bayarConfirm,   roles: ['SENAT'] },
  'bayar.close':      { handler: bayarClose,     roles: ['PPK'] },

  // Tagihan gagal debet (TAHAP 4A)
  'tagihan.create':   { handler: tagihanCreate,  roles: ['SENAT', 'PPK'] },
  'tagihan.list':     { handler: tagihanList,    roles: [] },
  'tagihan.summary':  { handler: tagihanSummary, roles: ['PPK', 'KPA', 'WADIR3'] },
  'tagihan.setor':    { handler: tagihanSetor,   roles: ['SENAT'] },
  'tagihan.verify':   { handler: tagihanVerify,  roles: ['PPK'] },
  'tagihan.waive':    { handler: tagihanWaive,   roles: ['PPK'] },
  'tagihan.regenerate_sp': { handler: tagihanRegenerateSp, roles: ['PPK'] },

  // Surat peringatan (TAHAP 4B)
  'sp.list':          { handler: spList,         roles: [] },

  // Master pengguna (TAHAP 7 — Admin)
  'pengguna.list':      { handler: penggunaList,     roles: ['ADMIN'] },
  'pengguna.upsert':    { handler: penggunaUpsert,   roles: ['ADMIN'] },
  'pengguna.reset_pin': { handler: penggunaResetPin, roles: ['ADMIN'] },

  // Laporan & Audit (TAHAP 7)
  'laporan.bulanan':  { handler: laporanBulanan, roles: ['PPK', 'KPA', 'WADIR3'] },
  'laporan.resmi':    { handler: laporanResmi,   roles: ['PPK', 'KPA', 'WADIR3'] },
  'audit.list':       { handler: auditList,      roles: ['ADMIN', 'PPK', 'KPA', 'WADIR3'] }
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
