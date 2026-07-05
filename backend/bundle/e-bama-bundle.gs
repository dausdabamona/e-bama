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
var _REKENING_INSTANSI_DEFAULT = {
  senat:    { BNI: '', BSI: '' },
  penyedia: { BNI: '', BSI: '' }
};

/** getRekeningInstansi() — rekening instansi efektif (default ← override Script Properties). */
function getRekeningInstansi() {
  var d = _REKENING_INSTANSI_DEFAULT;
  var out = {
    senat:    { BNI: d.senat.BNI,    BSI: d.senat.BSI },
    penyedia: { BNI: d.penyedia.BNI, BSI: d.penyedia.BSI }
  };
  var raw = PropertiesService.getScriptProperties().getProperty('REKENING_INSTANSI');
  if (raw) {
    var o = JSON.parse(raw);
    if (o.senat)    { if (o.senat.BNI    !== undefined) out.senat.BNI    = o.senat.BNI;
                      if (o.senat.BSI    !== undefined) out.senat.BSI    = o.senat.BSI; }
    if (o.penyedia) { if (o.penyedia.BNI !== undefined) out.penyedia.BNI = o.penyedia.BNI;
                      if (o.penyedia.BSI !== undefined) out.penyedia.BSI = o.penyedia.BSI; }
  }
  return out;
}

/**
 * setRekeningInstansi(obj) — isi/ubah rekening instansi dari editor GAS. Contoh:
 * setRekeningInstansi({ senat:{BNI:'123', BSI:'456'}, penyedia:{BNI:'789', BSI:'012'} })
 * Disimpan utuh (bukan merge per-kunci) — sertakan seluruh nilai yang diinginkan.
 */
function setRekeningInstansi(obj) {
  var cur = getRekeningInstansi();
  if (obj && obj.senat)    { if (obj.senat.BNI    !== undefined) cur.senat.BNI    = obj.senat.BNI;
                             if (obj.senat.BSI    !== undefined) cur.senat.BSI    = obj.senat.BSI; }
  if (obj && obj.penyedia) { if (obj.penyedia.BNI !== undefined) cur.penyedia.BNI = obj.penyedia.BNI;
                             if (obj.penyedia.BSI !== undefined) cur.penyedia.BSI = obj.penyedia.BSI; }
  PropertiesService.getScriptProperties().setProperty('REKENING_INSTANSI', JSON.stringify(cur));
  return cur;
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
  'penyedia.upsert':  { handler: penyediaUpsert, roles: ['ADMIN', 'PPK'] },
  'kontrak.list':     { handler: kontrakList,    roles: [] },
  'kontrak.get':      { handler: kontrakGet,     roles: [] },
  'kontrak.upsert':   { handler: kontrakUpsert,  roles: ['PPK'] },
  'kontrak.approve':  { handler: kontrakApprove, roles: ['PPK'] },
  'kontrak.lampiran_upload': { handler: kontrakLampiranUpload, roles: ['PPK'] },
  'menu.list':        { handler: menuList,       roles: [] },
  'menu.upsert':      { handler: menuUpsert,     roles: ['PPK'] },

  // Status harian (TAHAP 3)
  'status.set':       { handler: statusSet,      roles: ['ADMIN', 'PEMBINA', 'BAAK'] },
  'status.batch':     { handler: statusBatch,    roles: ['ADMIN', 'PEMBINA', 'BAAK'] },
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
  'laporan.bulanan':  { handler: laporanBulanan, roles: ['PPK', 'KPA', 'WADIR3', 'ADMIN'] },
  'laporan.resmi':    { handler: laporanResmi,   roles: ['PPK', 'KPA', 'WADIR3', 'ADMIN'] },

  // Bantuan Luar Kampus (PKL/Magang/KPA/PTB) — TAHAP migrasi
  'blk.list':         { handler: blkList,   roles: ['PPK', 'ADMIN', 'KPA', 'WADIR3'] },
  'blk.import':       { handler: blkImport, roles: ['PPK', 'ADMIN'] },
  'audit.list':       { handler: auditList,      roles: ['ADMIN', 'PPK', 'KPA', 'WADIR3'] },

  // Cetak Form Manual SOP (TAHAP cetak)
  'cetak.form01':     { handler: cetakForm01, roles: ['SENAT', 'PEMBINA', 'PPK', 'ADMIN'] },
  'cetak.form02':     { handler: cetakForm02, roles: ['PEMBINA', 'PPK', 'ADMIN'] },
  'cetak.form03':     { handler: cetakForm03, roles: ['PPK', 'ADMIN', 'PEMBINA'] },
  'cetak.form04':     { handler: cetakForm04, roles: ['SENAT', 'PEMBINA', 'PPK', 'ADMIN'] },
  'cetak.form05':     { handler: cetakForm05, roles: ['PEMBINA', 'PPK', 'ADMIN'] },
  'cetak.form06':     { handler: cetakForm06, roles: ['PPK', 'KPA', 'ADMIN'] },
  'cetak.form07':     { handler: cetakForm07, roles: ['ADMIN', 'PPK'] },
  'cetak.form08':     { handler: cetakForm08, roles: ['ADMIN', 'PPK'] },
  'cetak.form09':     { handler: cetakForm09, roles: ['SENAT', 'PPK', 'ADMIN'] },

  // Rekening lengkap (TARUNA_REKENING) — TAHAP SENSITIF, lihat CLAUDE.md § 4/§ 7
  'rekening.lihat_lengkap': { handler: rekeningLihatLengkap, roles: ['ADMIN', 'PPK'] },
  'rekening.simpan':        { handler: rekeningSimpan,       roles: ['ADMIN'] },
  'rekening.simpan_batch':  { handler: rekeningSimpanBatch,  roles: ['ADMIN'] },

  // Rekonsiliasi SP2D (Monitoring SP2D OM-SPAN vs data sistem)
  'sp2d.import':        { handler: sp2dImport,        roles: ['PPK', 'ADMIN'] },
  'sp2d.rekonsiliasi':  { handler: sp2dRekonsiliasi,  roles: ['PPK', 'KPA', 'WADIR3', 'ADMIN'] },

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
  return { user_id: u.user_id, nama: u.nama, role: u.role, penyedia_id: String(u.penyedia_id || '') };
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
      return { user_id: u.user_id, nama: u.nama, role: u.role, status: u.status, penyedia_id: String(u.penyedia_id || '') };
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

  var ada = sheetRead(SHEETS.PENGGUNA, function (r) { return String(r.user_id) === uid; })[0];
  if (ada) {
    var patch = { nama: nama, role: role, status: status, penyedia_id: penyediaId };
    var baru = sheetUpdate(SHEETS.PENGGUNA, 'user_id', uid, patch);
    auditLog(session, 'pengguna.upsert', 'PENGGUNA', uid,
      { nama: ada.nama, role: ada.role, status: ada.status, penyedia_id: String(ada.penyedia_id || '') }, patch);
    return { pengguna: { user_id: uid, nama: baru.nama, role: baru.role, status: baru.status, penyedia_id: penyediaId } };
  }
  sheetAppend(SHEETS.PENGGUNA, {
    user_id: uid, nama: nama, role: role,
    pin_hash: _sha256Hex_(_PIN_DEFAULT_ + _getSalt_()),
    token: '', token_exp: '', penyedia_id: penyediaId, status: status
  });
  auditLog(session, 'pengguna.upsert', 'PENGGUNA', uid, null, { nama: nama, role: role, status: status, penyedia_id: penyediaId });
  return { pengguna: { user_id: uid, nama: nama, role: role, status: status, penyedia_id: penyediaId } };
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

/** Detail kontrak + lampiran (menu & nilai gizi, BA penunjukan, notulen). */
function kontrakGet(payload, session) {
  var id = String((payload && payload.kontrak_id) || '').trim();
  var k = sheetRead(SHEETS.KONTRAK, function (r) { return String(r.kontrak_id) === id; })[0];
  if (!k) throw _fail_('Kontrak tidak ditemukan: ' + id);
  return { kontrak: k, lampiran: lampiranList('KONTRAK', id) };
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
 * KEGIATAN_LUAR_KAMPUS / PKL_1 / PKL_2 / PKL_3 / KPA / MAGANG / PTB. Yang
 * tergolong kegiatan luar kampus (dapat bantuan makan luar kampus) ada di
 * STATUS_LUAR_KAMPUS (00_config.gs) — dipakai Form-08.
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
    verif_by: '', verif_at: '', revisi_dari: ''
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
 * Status: DRAFT → TERVERIFIKASI_PPK → FINAL (beku, dasar SPM)
 *
 * ACTION: rekap.get (PPK, KPA), rekap.verify (PPK), rekap.final (PPK),
 *         rekap.input_historis (PPK, Admin) — migrasi bulan pra-aplikasi
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

/**
 * FINAL → DISETUJUI_WADIR3 (Wadir 3): otorisasi pencairan pembayaran
 * (ke rekening taruna via SP2D, lalu auto-debet ke penyedia) — bukan koreksi
 * angka, nominal sudah beku sejak FINAL. Syarat wajib sebelum bayar.create.
 */
function rekapApproveWadir3(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  return _rekapSetStatus_(session, bulan, 'FINAL', 'DISETUJUI_WADIR3', 'approve_wadir3');
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

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 15_pembayaran.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
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

/** Buat pembayaran: syarat rekap bulan DISETUJUI_WADIR3; nilai_total = SUM(nominal) snapshot. */
function bayarCreate(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');

  var rekap = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  if (!rekap.length) throw _fail_('Belum ada rekap untuk bulan ' + bulan + '.');
  rekap.forEach(function (r) {
    if (String(r.status) !== 'DISETUJUI_WADIR3') {
      throw _fail_('Rekap bulan ' + bulan + ' belum disetujui Wadir 3 (status sekarang ' + r.status +
        ') — finalkan (PPK) lalu minta persetujuan Wadir 3 dulu sebelum membuat pembayaran.');
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

// ═════════════════════════════════════════════════════════════════════════════
// ▼▼▼ 16_tagihan.gs ▼▼▼
// ═════════════════════════════════════════════════════════════════════════════
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
    // FINAL atau DISETUJUI_WADIR3 sama-sama berarti nominal sudah beku — status
    // hanya maju (tidak pernah balik ke FINAL setelah disetujui Wadir 3).
    if (r.status !== 'FINAL' && r.status !== 'DISETUJUI_WADIR3') {
      throw _fail_('Rekap bulan ' + bulan + ' belum FINAL — tagihan butuh dasar nominal beku.');
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

  var bayar = sheetRead(SHEETS.PEMBAYARAN, function (r) { return String(r.bulan) === bulan; })[0] || null;

  var tagihan = sheetRead(SHEETS.TAGIHAN, function (r) { return String(r.bulan) === bulan; });
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

  var bayar = sheetRead(SHEETS.PEMBAYARAN, function (r) { return String(r.bulan) === bulan; })[0] || null;
  var tagihan = sheetRead(SHEETS.TAGIHAN, function (r) { return String(r.bulan) === bulan; });

  return {
    bulan: bulan,
    jml_taruna_aktif: jmlAktif,
    kontrak: kontrakBulan ? {
      kontrak_id: kontrakBulan.kontrak_id,
      harga_per_porsi: _int_(kontrakBulan.harga_per_porsi, 'harga_per_porsi'),
      porsi_per_hari: _int_(kontrakBulan.porsi_per_hari, 'porsi_per_hari')
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
      porsi_per_hari: _int_(kontrak.porsi_per_hari, 'porsi_per_hari')
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
        harga_per_porsi: _int_(k.harga_per_porsi, 'harga_per_porsi')
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
      var kontrak = kontrakPada(tgl);
      var harga = kontrak ? _int_(kontrak.harga_per_porsi, 'harga_per_porsi') : 0;
      var biaya = Math.round(porsi * harga);
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
 * yang sendirinya mensyaratkan REKAP_BULANAN berstatus DISETUJUI_WADIR3) —
 * supaya nominal yang tercetak sudah melalui gerbang otorisasi pencairan.
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

    var tarunaByNit = {};
    sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });

    var nitList = rekapRows.map(function (r) { return String(r.nit); });
    var rekeningByNit = {};
    sheetRead(SHEETS.TARUNA_REKENING, function (r) { return nitList.indexOf(String(r.nit)) >= 0; })
      .forEach(function (r) { rekeningByNit[String(r.nit)] = r; });

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
        hari_makan: _int_(r.hari_makan || 0, 'hari_makan'), rekening_lengkap_ada: !!rek
      };
    });

    // AUDIT: satu baris untuk seluruh daftar penerima bulan ini — catat SIAPA
    // (session.user_id) membaca rekening SIAPA (nitList) dan KAPAN, TANPA
    // pernah menulis nomor rekeningnya sendiri ke AUDIT_LOG.
    auditLog(session, 'cetak.form07', 'TARUNA_REKENING', nitList.join(','), null, { nit_list: nitList });

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
      pejabat: PEJABAT,
      rekening_senat: getRekeningInstansi().senat  // rekening Senat tujuan debet per bank
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
        nilai_per_hari: nilaiPerHari, nominal: nominal
      };
    });

    auditLog(session, 'cetak.form08', 'TARUNA_REKENING', nitList.join(','), null, { nit_list: nitList });

    return { bulan: bulan, kegiatan: kegiatan, baris: baris, total_nominal: totalNominal, pejabat: PEJABAT };
  });
}

/**
 * Form 09: Permohonan Pendebetan Rekening Senat → Penyedia (tahap-2 pembayaran).
 * Payload {bulan}. Setelah dana taruna didebet ke rekening Senat (Form 07),
 * Senat mengajukan pendebetan rekening Senat ke rekening Penyedia — PER BANK
 * (BNI & BSI), karena rekening Senat & Penyedia masing-masing 2 (alur paralel:
 * Senat BSI→Penyedia BSI, Senat BNI→Penyedia BNI).
 *
 * TIDAK membaca TARUNA_REKENING (bukan rekening taruna) → tidak wajib AUDIT_LOG
 * rekening. Nominal per bank = SUM(REKAP_BULANAN.nominal) dikelompokkan lewat
 * join TARUNA.bank (pola sama seperti rekonsiliasi SP2D & Form 07). Rekening
 * Senat/Penyedia dari getRekeningInstansi() (Script Property, diisi Admin).
 */
function cetakForm09(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');

  var pembayaran = sheetRead(SHEETS.PEMBAYARAN, function (r) { return _bulanStr_(r.bulan) === bulan; })[0];
  if (!pembayaran) {
    throw _fail_('Belum ada PEMBAYARAN untuk bulan ' + bulan + ' — Form 09 hanya bisa dicetak setelah proses pembayaran dibuat.');
  }
  var rekapRows = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  if (!rekapRows.length) throw _fail_('Belum ada rekap untuk bulan ' + bulan + '.');

  var tarunaByNit = {};
  sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });

  var rek = getRekeningInstansi();
  var agg = {}; // bank -> {total, jml}
  rekapRows.forEach(function (r) {
    var t = tarunaByNit[String(r.nit)] || {};
    var bank = t.bank || 'LAINNYA';
    if (!agg[bank]) agg[bank] = { total: 0, jml: 0 };
    agg[bank].total += _int_(r.nominal || 0, 'nominal');
    agg[bank].jml += 1;
  });

  var urut = { BSI: 0, BNI: 1 };
  var perBank = Object.keys(agg)
    .sort(function (a, b) { return (urut[a] == null ? 9 : urut[a]) - (urut[b] == null ? 9 : urut[b]); })
    .map(function (bank) {
      return {
        bank: bank, jml_taruna: agg[bank].jml, total: agg[bank].total,
        rek_senat_sumber: rek.senat[bank] || '',
        rek_penyedia_tujuan: rek.penyedia[bank] || ''
      };
    });

  // Nama penyedia dari kontrak pembayaran.
  var penyediaNama = '';
  var kontrak = sheetRead(SHEETS.KONTRAK, function (r) { return String(r.kontrak_id) === String(pembayaran.kontrak_id); })[0];
  if (kontrak) {
    var p = sheetRead(SHEETS.PENYEDIA, function (r) { return String(r.penyedia_id) === String(kontrak.penyedia_id); })[0];
    if (p) penyediaNama = p.nama || '';
  }

  var totalNominal = 0;
  perBank.forEach(function (b) { totalNominal += b.total; });

  return {
    bulan: bulan,
    penyedia_nama: penyediaNama,
    per_bank: perBank,
    total_nominal: totalNominal,
    nominal_terbilang: _terbilangRupiah_(totalNominal),
    pembayaran: {
      no_spm: pembayaran.no_spm, tgl_spm: _tglStr_(pembayaran.tgl_spm),
      no_sp2d: pembayaran.no_sp2d, tgl_sp2d: _tglStr_(pembayaran.tgl_sp2d),
      status: pembayaran.status
    },
    pejabat: PEJABAT
  };
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

    var hasil = nitList.map(function (nit) {
      var r = byNit[nit];
      return r
        ? { nit: nit, no_rekening_lengkap: r.no_rekening_lengkap, bank: r.bank, nama_pemilik: r.nama_pemilik }
        : { nit: nit, no_rekening_lengkap: '', bank: '', nama_pemilik: '', belum_ada: true };
    });

    // AUDIT: catat SIAPA (session.user_id, via auditLog) melihat rekening SIAPA
    // (daftar NIT) dan KAPAN (timestamp) — JANGAN pernah simpan nomor rekening
    // itu sendiri di AUDIT_LOG, sekalipun di data_baru.
    auditLog(session, 'rekening.lihat_lengkap', 'TARUNA_REKENING', nitList.join(','), null, { nit_list: nitList });

    return { rekening: hasil };
  });
}

/**
 * rekening.simpan {nit, no_rekening_lengkap, bank, nama_pemilik} — isi/perbarui
 * satu baris. Role ADMIN SAJA (bukan PPK juga) supaya input data sensitif ini
 * tetap satu pintu.
 */
function rekeningSimpan(payload, session) {
  var nit = (payload && payload.nit != null) ? String(payload.nit).trim() : '';
  var noRek = (payload && payload.no_rekening_lengkap != null) ? String(payload.no_rekening_lengkap).trim() : '';
  var bank = payload && payload.bank;
  var namaPemilik = (payload && payload.nama_pemilik != null) ? String(payload.nama_pemilik).trim() : '';

  if (!nit) throw _fail_('nit wajib diisi.');
  if (!sheetRead(SHEETS.TARUNA, function (r) { return String(r.nit) === nit; })[0]) {
    throw _fail_('Taruna tidak ditemukan: ' + nit);
  }
  if (!noRek) throw _fail_('no_rekening_lengkap wajib diisi.');
  if (ENUM.BANK.indexOf(bank) < 0) throw _fail_('bank tidak valid.');
  if (!namaPemilik) throw _fail_('nama_pemilik wajib diisi.');

  return withLock(function () {
    var ada = sheetRead(SHEETS.TARUNA_REKENING, function (r) { return String(r.nit) === nit; })[0];
    var nilai = {
      nit: nit, no_rekening_lengkap: noRek, bank: bank, nama_pemilik: namaPemilik,
      updated_by: session.user_id, updated_at: new Date()
    };
    if (ada) {
      sheetUpdate(SHEETS.TARUNA_REKENING, 'nit', nit, nilai);
    } else {
      sheetAppend(SHEETS.TARUNA_REKENING, nilai);
    }

    // AUDIT: field yang berubah dicatat, nomor rekeningnya sendiri TIDAK.
    auditLog(session, 'rekening.simpan', 'TARUNA_REKENING', nit,
      ada ? { bank: ada.bank, nama_pemilik: ada.nama_pemilik } : null,
      { bank: bank, nama_pemilik: namaPemilik, rekening_diubah: true });

    return { nit: nit, bank: bank, nama_pemilik: namaPemilik };
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
      var nilai = {
        nit: nit, no_rekening_lengkap: noRek, bank: bank, nama_pemilik: namaPemilik,
        updated_by: session.user_id, updated_at: new Date()
      };
      if (ada) {
        sheetUpdate(SHEETS.TARUNA_REKENING, 'nit', nit, nilai);
      } else {
        sheetAppend(SHEETS.TARUNA_REKENING, nilai);
      }
      auditLog(session, 'rekening.simpan', 'TARUNA_REKENING', nit,
        ada ? { bank: ada.bank, nama_pemilik: ada.nama_pemilik } : null,
        { bank: bank, nama_pemilik: namaPemilik, rekening_diubah: true, sumber: 'rekening.simpan_batch' });
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
 * sp2d.import {kategori, baris:[{no_spm, nit?, tgl_spm?, no_sp2d?, tgl_sp2d?,
 * jumlah_pembayaran, status_sp2d?, uraian_asli}]} — HANYA MENAMBAH baris
 * dengan no_spm yang belum pernah ada (dikonfirmasi Firdaus: cek impor bulanan
 * hanya untuk penambahan, bukan mengulang proses semua riwayat). `nit` opsional
 * — terisi untuk format per-taruna (SPANExt), kosong untuk format agregat lama.
 */
function sp2dImport(payload, session) {
  var kategori = payload && payload.kategori;
  if (ENUM.SP2D_KATEGORI.indexOf(kategori) < 0) throw _fail_('kategori tidak valid.');
  var baris = (payload && payload.baris) || [];
  if (!baris.length) throw _fail_('baris tidak boleh kosong.');

  return withLock(function () {
    var adaNoSpm = {};
    sheetRead(SHEETS.SP2D_MONITORING).forEach(function (r) { adaNoSpm[_kunciNoSpm_(r.no_spm)] = true; });
    var tarunaValid = {};
    sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaValid[String(t.nit)] = true; });

    var ditambah = 0, dilewati = 0;
    baris.forEach(function (b) {
      var noSpm = String((b && b.no_spm) || '').trim();
      if (!noSpm) throw _fail_('no_spm wajib diisi pada setiap baris.');
      if (adaNoSpm[_kunciNoSpm_(noSpm)]) { dilewati++; return; } // sudah pernah masuk — lewati (hanya penambahan)

      var nit = (b && b.nit) ? String(b.nit).trim() : '';
      var uraian = String((b && b.uraian_asli) || '');
      var hasil = nit
        ? _parseBarisPerTaruna_(nit, uraian, kategori, tarunaValid)
        : _parseUraianSpm_(uraian, kategori);
      sheetAppend(SHEETS.SP2D_MONITORING, {
        no_spm: noSpm, kategori: kategori, nit: nit,
        prodi: hasil.prodi, tingkat: hasil.tingkat, bulan: hasil.bulan, kegiatan: hasil.kegiatan,
        jumlah_orang: hasil.jumlah_orang !== null ? hasil.jumlah_orang : '',
        jumlah_pembayaran: _int_(b.jumlah_pembayaran, 'jumlah_pembayaran'),
        tgl_spm: (b.tgl_spm && b.tgl_spm !== '-') ? b.tgl_spm : '',
        no_sp2d: (b.no_sp2d && b.no_sp2d !== '-') ? String(b.no_sp2d) : '',
        tgl_sp2d: (b.tgl_sp2d && b.tgl_sp2d !== '-') ? b.tgl_sp2d : '',
        status_sp2d: (b.status_sp2d && b.status_sp2d !== '-') ? String(b.status_sp2d) : '',
        uraian_asli: uraian,
        perlu_cek_manual: hasil.gagal ? 'YA' : ''
      });
      adaNoSpm[_kunciNoSpm_(noSpm)] = true;
      ditambah++;
    });

    auditLog(session, 'sp2d.import', 'SP2D_MONITORING', null, null,
      { kategori: kategori, ditambah: ditambah, dilewati: dilewati });
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
  var sistemDalam = _kelompokkanJumlah_(
    rekapRows.map(function (r) {
      var t = tarunaByNit[String(r.nit)] || {};
      return { kunci: (t.prodi || '?') + '|' + (t.tingkat || '?'), nominal: _int_(r.nominal || 0, 'nominal') };
    }),
    function (x) { return x.kunci; }, function (x) { return x.nominal; }
  );
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
    var kunciDalamNit = {};
    Object.keys(sistemDalamNit).forEach(function (k) { kunciDalamNit[k] = true; });
    Object.keys(sp2dDalamNit).forEach(function (k) { kunciDalamNit[k] = true; });
    dalamKampusPerTaruna = Object.keys(kunciDalamNit).sort().map(function (nit) {
      var t = tarunaByNit[nit] || {};
      var sistem = sistemDalamNit[nit] || 0, sp2d = sp2dDalamNit[nit] || 0;
      return {
        nit: nit, nama: t.nama || '', prodi: t.prodi || '', tingkat: t.tingkat || '',
        sistem: sistem, sp2d: sp2d, selisih: sistem - sp2d, cocok: sistem === sp2d
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
    var kunciLuarNit = {};
    Object.keys(sistemLuarNit).forEach(function (k) { kunciLuarNit[k] = true; });
    Object.keys(sp2dLuarNit).forEach(function (k) { kunciLuarNit[k] = true; });
    luarKampusPerTaruna = Object.keys(kunciLuarNit).sort().map(function (k) {
      var parts = k.split('|'); var nit = parts[0], kegiatan = parts[1];
      var t = tarunaByNit[nit] || {};
      var sistem = sistemLuarNit[k] || 0, sp2d = sp2dLuarNit[k] || 0;
      return {
        nit: nit, nama: t.nama || '', kegiatan: kegiatan, prodi: t.prodi || '', tingkat: t.tingkat || '',
        sistem: sistem, sp2d: sp2d, selisih: sistem - sp2d, cocok: sistem === sp2d
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
      ['keterangan','s']
    ]],
    [SHEETS.TARUNA_REKENING, [
      ['nit','s'], ['no_rekening_lengkap','s'], ['bank', E.BANK], ['nama_pemilik','s'],
      ['updated_by','s'], ['updated_at','dt']
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

