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
  // Ownership Taruna Fitur 2a — papan "Menu Hari Ini", read-only, nol data sensitif
  'menu.hari_ini':    { handler: menuHariIni,    roles: ['SENAT', 'PEMBINA'] },

  // Status harian (TAHAP 3)
  'status.set':       { handler: statusSet,      roles: ['ADMIN', 'PEMBINA', 'BAAK'] },
  'status.batch':     { handler: statusBatch,    roles: ['ADMIN', 'PEMBINA', 'BAAK'] },
  'status.list':      { handler: statusList,     roles: [] },

  // Ketua Jurusan (luar kampus) — role KETUA_JURUSAN, scope prodi (25_ketua_jurusan.gs)
  'kajur.taruna_list':  { handler: kajurTarunaList,  roles: ['KETUA_JURUSAN'] },
  'kajur.status_set':   { handler: kajurStatusSet,   roles: ['KETUA_JURUSAN'] },
  'kajur.status_batch': { handler: kajurStatusBatch, roles: ['KETUA_JURUSAN'] },
  'kajur.rekap':        { handler: kajurRekap,       roles: ['KETUA_JURUSAN'] },
  'kajur.approve':      { handler: kajurApprove,     roles: ['KETUA_JURUSAN'] },

  // Pesanan (TAHAP 3)
  'pesanan.list':     { handler: pesananList,    roles: [] },
  'pesanan.get':      { handler: pesananGet,     roles: [] },
  // Surat Pesanan Makan ke Penyedia (cetak) — internal login mana pun; TANPA
  // rupiah (lihat 12_pesanan.gs), TIDAK di PENYEDIA_ACTIONS (portal penyedia
  // tidak boleh menarik data pesanan bebas lewat action ini).
  'pesanan.surat_penyedia': { handler: pesananSuratPenyedia, roles: [] },
  'pesanan.create':   { handler: pesananCreate,  roles: ['SENAT'] },
  'pesanan.submit':   { handler: pesananSubmit,  roles: ['SENAT'] },
  'pesanan.verify':   { handler: pesananVerify,  roles: ['PEMBINA'] },
  'pesanan.return':   { handler: pesananReturn,  roles: ['PEMBINA'] },
  'pesanan.kirim':    { handler: pesananKirim,   roles: ['SENAT'] },
  'pesanan.revisi':   { handler: pesananRevisi,  roles: ['SENAT'] },
  // Fitur F: Pembina buat & ajukan sendiri tanpa Senat (satu langkah,
  // langsung TERKIRIM) — lihat catatan lengkap di 12_pesanan.gs.
  'pesanan.pembina_kirim': { handler: pesananPembinaKirim, roles: ['PEMBINA'] },
  // Verifikasi by-Exception (1c/1d): bulk-approve pesanan rutin sekaligus,
  // dipakai saat kebijakan autoLolosRutin=false — lihat 12_pesanan.gs.
  'pesanan.bulk_approve_rutin': { handler: pesananBulkApproveRutin, roles: ['PEMBINA'] },
  'pesanan.antrian_verifikasi': { handler: pesananAntrianVerifikasi, roles: ['PEMBINA'] },

  // Realisasi (TAHAP 3)
  'realisasi.list':   { handler: realisasiList,  roles: [] },
  'realisasi.create': { handler: realisasiCreate, roles: ['PEMBINA', 'SENAT'] },
  'realisasi.ttd':    { handler: realisasiTtd,   roles: ['PEMBINA', 'SENAT'] },
  // Ownership Taruna Fitur 1b/2b — baca kebijakan piket + standar gizi
  'realisasi.kebijakan_piket': { handler: realisasiKebijakanPiket, roles: [] },
  // Penerimaan Barang Senat — checklist per waktu makan × komponen, BUKAN Penyedia
  'realisasi.penerimaan': { handler: realisasiPenerimaan, roles: ['SENAT', 'PEMBINA', 'ADMIN'] },
  'realisasi.kebijakan_penerimaan': { handler: realisasiKebijakanPenerimaan, roles: [] },
  // Rekap kelengkapan Penerimaan Barang (Tahap 5, opsional) — baca murni, bahan evaluasi penyedia
  'realisasi.rekap_penerimaan': { handler: realisasiRekapPenerimaan, roles: ['PPK', 'KPA', 'WADIR3', 'SENAT'] },

  // Rekap bulanan (TAHAP 3 + gerbang Wadir 3)
  // SENAT/PEMBINA baca saja (halaman /rekap-ringkas, tanpa nominal di frontend)
  'rekap.get':        { handler: rekapGet,       roles: ['PPK', 'KPA', 'WADIR3', 'SENAT', 'PEMBINA'] },
  'rekap.verify':     { handler: rekapVerify,    roles: ['PPK'] },
  'rekap.final':      { handler: rekapFinal,     roles: ['PPK'] },
  'rekap.approve_wadir3': { handler: rekapApproveWadir3, roles: ['WADIR3'] },
  'rekap.batal_wadir3': { handler: rekapBatalWadir3, roles: ['WADIR3'] },
  'rekap.input_historis': { handler: rekapInputHistoris, roles: ['PPK', 'ADMIN'] },
  // rekap.harian: rekonsiliasi 3 titik HARIAN per Prodi+Tingkat, read-only —
  // internal login mana pun (pola sama seperti taruna.list), TIDAK di
  // PENYEDIA_ACTIONS/KETUA_JURUSAN_ACTIONS jadi otomatis dikecualikan.
  'rekap.harian':     { handler: rekapHarian,    roles: [] },

  // Pembayaran (TAHAP 4A)
  'bayar.list':       { handler: bayarList,      roles: ['PPK', 'KPA', 'SENAT', 'WADIR3'] },
  'bayar.get':        { handler: bayarGet,       roles: ['PPK', 'KPA', 'SENAT', 'WADIR3'] },
  'bayar.create':     { handler: bayarCreate,    roles: ['PPK'] },
  'bayar.update':     { handler: bayarUpdate,    roles: ['PPK'] },
  // bayar.sync: tandai SELESAI dari kelengkapan SP2D_MONITORING (relasi 1:N) —
  // pelengkap auto-sync di sp2d.import; lihat 15_pembayaran.gs
  'bayar.sync':       { handler: bayarSync,      roles: ['PPK'] },
  // bayar.close: fallback manual (baris historis status lama) — bukan alur normal, lihat 15_pembayaran.gs
  'bayar.close':      { handler: bayarClose,     roles: ['PPK'] },

  // SPM (§18 skema-sheet.md) — header kelompok Prodi+Tingkat+Suplier, authored,
  // beda provenance dari sp2d.* (imported). Baca lebih longgar (pola bayar.*/
  // sp2d.rekonsiliasi), tulis PPK/ADMIN saja. TIDAK masuk PENYEDIA_ACTIONS.
  'spm.list':         { handler: spmList,        roles: ['PPK', 'KPA', 'SENAT', 'WADIR3', 'ADMIN'] },
  'spm.update':       { handler: spmUpdate,      roles: ['PPK', 'ADMIN'] },
  'spm.set_sp2d':     { handler: spmSetSp2d,     roles: ['PPK', 'ADMIN'] },
  'spm.regenerate':   { handler: spmRegenerate,  roles: ['PPK', 'ADMIN'] },

  // Tagihan gagal debet (TAHAP 4A)
  'tagihan.create':   { handler: tagihanCreate,  roles: ['SENAT', 'PPK'] },
  'tagihan.list':     { handler: tagihanList,    roles: [] },
  'tagihan.summary':  { handler: tagihanSummary, roles: ['PPK', 'KPA', 'WADIR3'] },
  // Laporan status debet taruna→Senat per taruna (berhasil/gagal) — baca saja,
  // tanpa rekening lengkap, akses sama seperti tagihan.summary + SENAT.
  'tagihan.status_debet': { handler: tagihanStatusDebet, roles: ['PPK', 'SENAT', 'KPA', 'WADIR3'] },
  'tagihan.setor':    { handler: tagihanSetor,   roles: ['SENAT', 'PEMBINA', 'ADMIN', 'PPK'] },
  // Verifikasi ganda TANPA urutan peran tetap — siapa pun di antara 4 role
  // boleh jadi verifikator 1 ATAU 2, ASAL dua orang (user_id) berbeda.
  'tagihan.verifikasi': { handler: tagihanVerifikasi, roles: ['SENAT', 'PEMBINA', 'ADMIN', 'PPK'] },
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
  'cetak.form10':     { handler: cetakForm10, roles: ['ADMIN', 'PPK'] },

  // Rekening lengkap (TARUNA_REKENING) — TAHAP SENSITIF, lihat CLAUDE.md § 4/§ 7
  'rekening.lihat_lengkap': { handler: rekeningLihatLengkap, roles: ['ADMIN', 'PPK'] },
  'rekening.cocokkan':      { handler: rekeningCocokkan,     roles: ['ADMIN', 'PPK'] },
  'rekening.simpan':        { handler: rekeningSimpan,       roles: ['ADMIN'] },
  'rekening.simpan_batch':  { handler: rekeningSimpanBatch,  roles: ['ADMIN'] },

  // Rekonsiliasi SP2D (Monitoring SP2D OM-SPAN vs data sistem)
  'sp2d.import':        { handler: sp2dImport,        roles: ['PPK', 'ADMIN'] },
  'sp2d.rekonsiliasi':  { handler: sp2dRekonsiliasi,  roles: ['PPK', 'KPA', 'WADIR3', 'ADMIN'] },
  'sp2d.list':          { handler: sp2dList,          roles: ['PPK', 'ADMIN'] },
  'sp2d.koreksi':       { handler: sp2dKoreksi,       roles: ['PPK', 'ADMIN'] },
  'sp2d.cek_dobel':     { handler: sp2dCekDobel,      roles: ['PPK', 'ADMIN'] },
  'sp2d.hapus_dobel':   { handler: sp2dHapusDobel,    roles: ['PPK', 'ADMIN'] },

  // Kokpit PPK — agregasi baca murni, tidak menulis apa pun
  'ppk.kokpit':         { handler: ppkKokpit,         roles: ['PPK', 'KPA', 'WADIR3'] },

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

/**
 * Allowlist role KETUA_JURUSAN — sama semangatnya dengan PENYEDIA_ACTIONS:
 * banyak action ber-`roles:[]` mengekspos data seluruh sistem, jadi Ketua Jurusan
 * HANYA boleh memanggil action di sini (apa pun isi `roles`-nya). Semua data
 * yang dilihatnya di-scope ke session.prodi di handler (25_ketua_jurusan.gs).
 */
var KETUA_JURUSAN_ACTIONS = {
  'kajur.taruna_list':  true,
  'kajur.status_set':   true,
  'kajur.status_batch': true,
  'kajur.rekap':        true,
  'kajur.approve':      true,
  'auth.logout':        true,
  'auth.change_pin':    true
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
      // Pagar khusus KETUA_JURUSAN: HANYA action di allowlist (scope prodi di handler).
      if (session.role === ROLES.KETUA_JURUSAN && !KETUA_JURUSAN_ACTIONS[action]) {
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
