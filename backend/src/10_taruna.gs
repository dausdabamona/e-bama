/**
 * 10_taruna.gs — Master data taruna
 *
 * ACTION: taruna.list (semua login), taruna.upsert (Admin)
 *
 * rek_mask HANYA 4 digit terakhir (••••1234) — nomor rekening lengkap
 * DILARANG masuk sistem (validasi _mask4_ menolak >4 digit angka).
 * Setiap aksi tulis → withLock + auditLog.
 */

/** Normalisasi TARUNA.tgl_keluar → 'YYYY-MM-DD' atau '' (kosong = tak keluar permanen). */
function _tglKeluarStr_(t) {
  var v = t && t.tgl_keluar;
  if (!v) return '';
  try { return _tglStr_(v); } catch (e) { return String(v); }
}
/**
 * Taruna berhak makan kampus pada TANGGAL tsb? AKTIF DAN belum lewat tgl_keluar
 * (keluar PERMANEN: pada/atan sebelum tgl_keluar masih dihitung, sesudahnya tidak).
 * Dipakai konsumen harian (pesanan, rekap harian).
 */
function _tarunaAktifTanggal_(t, tgl) {
  if (String(t.status) !== 'AKTIF') return false;
  var kel = _tglKeluarStr_(t);
  return !kel || tgl <= kel;
}
/**
 * Taruna termasuk dalam rekap BULAN (YYYY-MM) tsb? AKTIF DAN tgl_keluar tidak
 * SEBELUM bulan itu — jadi bulan keluar (& sebelumnya) tetap terhitung, bulan
 * BERIKUTNYA otomatis tereksklusi. Dipakai rekapUpdate bulanan.
 */
function _tarunaAktifBulan_(t, bulan) {
  if (String(t.status) !== 'AKTIF') return false;
  var kel = _tglKeluarStr_(t);
  return !kel || _bulanStr_(kel) >= bulan;
}

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

  // tgl_keluar/alasan_keluar hanya di-set bila DIKIRIM eksplisit (partial update)
  // supaya edit taruna biasa tak menghapus tanda keluar yang sudah ada.
  if (payload && payload.tgl_keluar !== undefined) {
    obj.tgl_keluar = (payload.tgl_keluar === '' || payload.tgl_keluar === null)
      ? '' : _wajibTgl_(payload.tgl_keluar, 'tgl_keluar');
  }
  if (payload && payload.alasan_keluar !== undefined) {
    obj.alasan_keluar = String(payload.alasan_keluar || '');
  }

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

var _ALASAN_KELUAR_ = ['LULUS', 'PINDAH', 'DO'];

/**
 * Tandai taruna KELUAR kampus secara MASSAL (satu kelas/tingkat atau individu).
 * Payload {jenis, nit_list, ...}:
 *  - jenis='PERMANEN' (lulus/pindah/DO): set TARUNA.tgl_keluar + alasan_keluar
 *    tiap NIT. Bulan tgl_keluar (& sebelumnya) tetap terhitung; bulan BERIKUTNYA
 *    otomatis tereksklusi rekap/pesanan (via _tarunaAktifBulan_/_tarunaAktifTanggal_).
 *    STATUS taruna TIDAK diubah. Butuh {tgl_keluar, alasan(LULUS/PINDAH/DO)}.
 *  - jenis='SEMENTARA' (magang/PKL/dll): buat PERIODE_LUAR (auto-kembali setelah
 *    tgl_kembali) via _periodeAppend_ — TIDAK menyentuh tgl_keluar. Butuh
 *    {status_kegiatan(∈STATUS_LUAR_KAMPUS, default MAGANG), tgl_keluar, tgl_kembali}.
 * Roles ADMIN, PPK.
 */
function tarunaTandaiKeluar(payload, session) {
  var jenis = String((payload && payload.jenis) || '').trim().toUpperCase();
  var nitList = (payload && payload.nit_list) || [];
  if (!nitList.length) throw _fail_('nit_list tidak boleh kosong.');

  var byNit = {};
  sheetRead(SHEETS.TARUNA).forEach(function (t) { byNit[String(t.nit)] = t; });
  nitList.forEach(function (n) { if (!byNit[String(n)]) throw _fail_('Taruna tidak ditemukan: ' + n); });

  if (jenis === 'PERMANEN') {
    var tglKeluar = _wajibTgl_(payload && payload.tgl_keluar, 'tgl_keluar');
    var alasan = String((payload && payload.alasan) || '').trim().toUpperCase();
    if (_ALASAN_KELUAR_.indexOf(alasan) < 0) throw _fail_('alasan harus salah satu: ' + _ALASAN_KELUAR_.join('/'));
    return withLock(function () {
      nitList.forEach(function (n) {
        var nit = String(n), lama = byNit[nit];
        sheetUpdate(SHEETS.TARUNA, 'nit', nit, { tgl_keluar: tglKeluar, alasan_keluar: alasan });
        auditLog(session, 'taruna.tandai_keluar', 'TARUNA', nit,
          { tgl_keluar: _tglKeluarStr_(lama), alasan_keluar: lama.alasan_keluar || '' },
          { jenis: 'PERMANEN', tgl_keluar: tglKeluar, alasan_keluar: alasan });
      });
      return { jenis: 'PERMANEN', jumlah: nitList.length, tgl_keluar: tglKeluar };
    });
  }

  if (jenis === 'SEMENTARA') {
    var statusKeg = String((payload && payload.status_kegiatan) || 'MAGANG').trim();
    if (STATUS_LUAR_KAMPUS.indexOf(statusKeg) < 0) throw _fail_('status_kegiatan harus salah satu: ' + STATUS_LUAR_KAMPUS.join('/'));
    var tm = _wajibTgl_(payload && payload.tgl_keluar, 'tgl_keluar');
    var ta = _wajibTgl_(payload && payload.tgl_kembali, 'tgl_kembali');
    if (ta < tm) throw _fail_('tgl_kembali tidak boleh sebelum tgl_keluar.');
    return withLock(function () {
      var baris = nitList.map(function (n) {
        return { nit: String(n), status: statusKeg, tgl_mulai: tm, tgl_akhir: ta };
      });
      var r = _periodeAppend_(baris, session);
      auditLog(session, 'taruna.tandai_keluar', 'PERIODE_LUAR', nitList.join(','), null,
        { jenis: 'SEMENTARA', status: statusKeg, tgl_mulai: tm, tgl_akhir: ta, dibuat: r.dibuat, dobel: r.dobel });
      return { jenis: 'SEMENTARA', jumlah: nitList.length, dibuat: r.dibuat, dobel: r.dobel, dilewati_nit: r.dilewati_nit };
    });
  }

  throw _fail_('jenis harus PERMANEN atau SEMENTARA.');
}

/**
 * Batalkan tanda keluar PERMANEN (koreksi salah input) — kosongkan tgl_keluar &
 * alasan_keluar. Tidak menyentuh PERIODE_LUAR (keluar sementara dicabut lewat
 * kajur.periode_hapus). Roles ADMIN, PPK.
 */
function tarunaBatalKeluar(payload, session) {
  var nitList = (payload && payload.nit_list) || [];
  if (!nitList.length) throw _fail_('nit_list tidak boleh kosong.');
  return withLock(function () {
    var byNit = {};
    sheetRead(SHEETS.TARUNA).forEach(function (t) { byNit[String(t.nit)] = t; });
    var n = 0;
    nitList.forEach(function (x) {
      var nit = String(x), lama = byNit[nit];
      if (!lama) return;
      sheetUpdate(SHEETS.TARUNA, 'nit', nit, { tgl_keluar: '', alasan_keluar: '' });
      auditLog(session, 'taruna.batal_keluar', 'TARUNA', nit,
        { tgl_keluar: _tglKeluarStr_(lama), alasan_keluar: lama.alasan_keluar || '' },
        { tgl_keluar: '', alasan_keluar: '' });
      n++;
    });
    return { dibatalkan: n };
  });
}


// ── Label tingkat per bulan (TINGKAT_BULANAN, skema §19) ───────────────────

/** Baca sheet TINGKAT_BULANAN dengan aman (sheet belum dibuat → []). */
function _barisTingkatBulanan_() {
  try { return sheetRead(SHEETS.TINGKAT_BULANAN); } catch (e) { return []; }
}

/**
 * tarunaBulan(bulan) — daftar TARUNA dengan prodi/tingkat DIGANTI label yang
 * berlaku pada `bulan` (carry-forward: baris TINGKAT_BULANAN dengan bulan
 * terbesar yang <= bulan). Tanpa bulan / tanpa label → data TARUNA apa adanya.
 * Mengembalikan salinan objek (TIDAK mengubah sheet).
 */
function tarunaBulan(bulan) {
  var rows = sheetRead(SHEETS.TARUNA);
  var bln = bulan ? _bulanStr_(bulan) : '';
  if (!bln) return rows;
  var label = {};
  _barisTingkatBulanan_().forEach(function (r) {
    var b = _bulanStr_(r.bulan);
    if (!b || b > bln) return;
    var nit = String(r.nit);
    if (!label[nit] || b > label[nit].b) label[nit] = { b: b, prodi: r.prodi, tingkat: r.tingkat };
  });
  return rows.map(function (t) {
    var l = label[String(t.nit)];
    if (!l) return t;
    var c = {};
    Object.keys(t).forEach(function (k) { c[k] = t[k]; });
    if (l.prodi) c.prodi = String(l.prodi);
    if (l.tingkat) c.tingkat = String(l.tingkat);
    return c;
  });
}

/** Tambah banyak baris sekaligus (satu setValues) — dipanggil di dalam withLock. */
function _appendBanyak_(name, objs) {
  if (!objs.length) return 0;
  var sh = _sheet_(name);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var rows = objs.map(function (o) { return headers.map(function (h) { return o[h] !== undefined ? o[h] : ''; }); });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  return rows.length;
}

/** Buat sheet TINGKAT_BULANAN (header sesuai skema §19) bila belum ada — migrasi ringan idempotent. */
function _pastikanSheetTingkat_() {
  var ss = _getSpreadsheet_();
  if (ss.getSheetByName(SHEETS.TINGKAT_BULANAN)) return;
  var sh = ss.insertSheet(SHEETS.TINGKAT_BULANAN);
  sh.getRange(1, 1, 1, 7).setValues([['bulan', 'nit', 'prodi', 'tingkat', 'ta', 'sumber', 'timestamp']]).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.getRange('A:A').setNumberFormat('@'); // bulan 'YYYY-MM' tetap teks, bukan tanggal
}

/** Snapshot label TARUNA terkini untuk `bulan` (tanpa lock — dipanggil di dalam withLock). */
function _snapshotTingkat_(bulan, ta, sumber) {
  _pastikanSheetTingkat_();
  var ada = {};
  _barisTingkatBulanan_().forEach(function (r) {
    if (_bulanStr_(r.bulan) === bulan) ada[String(r.nit)] = true;
  });
  var now = new Date(), baru = [], dilewati = 0;
  sheetRead(SHEETS.TARUNA).forEach(function (t) {
    var nit = String(t.nit);
    if (ada[nit]) { dilewati++; return; }
    baru.push({ bulan: bulan, nit: nit, prodi: String(t.prodi || ''), tingkat: String(t.tingkat || ''),
      ta: ta, sumber: sumber, timestamp: now });
  });
  return { ditambah: _appendBanyak_(SHEETS.TINGKAT_BULANAN, baru), dilewati: dilewati };
}

/** tingkat.snapshot {bulan, ta} — bekukan label terkini sebagai label mulai `bulan`. */
function tingkatSnapshot(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var ta = String((payload && payload.ta) || '').trim();
  return withLock(function () {
    var r = _snapshotTingkat_(bulan, ta, 'SNAPSHOT');
    auditLog(session, 'tingkat.snapshot', 'TINGKAT_BULANAN', bulan, null, { ta: ta, ditambah: r.ditambah, dilewati: r.dilewati });
    return { bulan: bulan, ditambah: r.ditambah, dilewati: r.dilewati };
  });
}

/**
 * tingkat.set {bulan, nit, tingkat, prodi?, ta?, alasan?} — koreksi label SATU
 * taruna yang berlaku mulai `bulan` (sumber MANUAL). Baris bulan+nit yang sudah
 * ada ditimpa; bila belum ada, ditambahkan. TARUNA.tingkat TIDAK disentuh
 * (label terkini diubah lewat taruna.upsert). Jejak lama → AUDIT_LOG.
 */
function tingkatSet(payload, session) {
  var p = payload || {};
  var bulan = _wajibBulan_(p.bulan, 'bulan');
  var nit = String(p.nit || '').trim();
  if (!nit) throw _fail_('nit wajib diisi.');
  var tingkat = String(p.tingkat || '').trim().toUpperCase();
  if (['I', 'II', 'III'].indexOf(tingkat) < 0) throw _fail_('tingkat harus I / II / III.');
  var t = sheetRead(SHEETS.TARUNA, function (r) { return String(r.nit) === nit; })[0];
  if (!t) throw _fail_('Taruna tidak ditemukan: ' + nit);
  var prodi = String(p.prodi || t.prodi || '').trim();
  return withLock(function () {
    _pastikanSheetTingkat_();
    var sh = _sheet_(SHEETS.TINGKAT_BULANAN);
    var lastCol = sh.getLastColumn();
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var last = sh.getLastRow();
    var data = last >= 2 ? sh.getRange(2, 1, last - 1, lastCol).getValues() : [];
    var iB = headers.indexOf('bulan'), iN = headers.indexOf('nit');
    var nilai = { bulan: bulan, nit: nit, prodi: prodi, tingkat: tingkat,
      ta: String(p.ta || ''), sumber: 'MANUAL', timestamp: new Date() };
    var row = headers.map(function (h) { return nilai[h] !== undefined ? nilai[h] : ''; });
    var lama = null;
    for (var i = 0; i < data.length; i++) {
      if (_bulanStr_(data[i][iB]) === bulan && String(data[i][iN]) === nit) {
        lama = {}; headers.forEach(function (h, k) { lama[h] = data[i][k]; });
        if (!nilai.ta) row[headers.indexOf('ta')] = data[i][headers.indexOf('ta')];
        sh.getRange(i + 2, 1, 1, lastCol).setValues([row]);
        break;
      }
    }
    if (!lama) sh.getRange(last + 1, 1, 1, lastCol).setValues([row]);
    auditLog(session, 'tingkat.set', 'TINGKAT_BULANAN', bulan + '|' + nit, lama,
      { prodi: prodi, tingkat: tingkat, alasan: String(p.alasan || '') });
    return { bulan: bulan, nit: nit, prodi: prodi, tingkat: tingkat, ditimpa: !!lama };
  });
}

/**
 * tingkat.naik — naik tingkat massal awal tahun akademik (lihat kontrak-api).
 * Label lama dibekukan dulu di bulan_lama supaya laporan bulan-bulan lalu tetap
 * memakai tingkat lama; lalu TARUNA.tingkat diubah & label baru dicatat di
 * bulan_baru. Tingkat yang dipetakan ke 'LULUS' ditandai keluar permanen.
 */
function tingkatNaik(payload, session) {
  var p = payload || {};
  var bulanLama = _wajibBulan_(p.bulan_lama, 'bulan_lama');
  var bulanBaru = _wajibBulan_(p.bulan_baru, 'bulan_baru');
  if (bulanBaru <= bulanLama) throw _fail_('bulan_baru harus setelah bulan_lama.');
  var peta = p.peta || {};
  if (!Object.keys(peta).length) throw _fail_('peta tingkat wajib diisi, mis. {"III":"LULUS","II":"III","I":"II"}.');
  var adaLulus = Object.keys(peta).some(function (k) { return String(peta[k]).toUpperCase() === 'LULUS'; });
  var tglLulus = adaLulus ? _wajibTgl_(p.tgl_lulus, 'tgl_lulus') : '';
  var kecuali = {};
  (p.kecuali || []).forEach(function (n) { kecuali[String(n)] = true; });
  var taLama = String(p.ta_lama || ''), taBaru = String(p.ta_baru || '');
  var dry = !!p.dry_run;

  var taruna = sheetRead(SHEETS.TARUNA);
  var rencana = [], lulus = [], dilewati = 0, naik = {};
  taruna.forEach(function (t) {
    var nit = String(t.nit);
    if (kecuali[nit] || String(t.status) !== 'AKTIF' || _tglKeluarStr_(t)) { dilewati++; return; }
    var tujuan = peta[String(t.tingkat)];
    if (!tujuan) { dilewati++; return; }
    tujuan = String(tujuan).toUpperCase();
    if (tujuan === 'LULUS') { lulus.push(nit); return; }
    rencana.push({ nit: nit, prodi: String(t.prodi || ''), lama: String(t.tingkat), baru: tujuan });
    var k = String(t.tingkat) + '→' + tujuan; naik[k] = (naik[k] || 0) + 1;
  });
  if (dry) return { naik: naik, lulus: lulus.length, dilewati: dilewati, dry_run: true };

  return withLock(function () {
    var snap = _snapshotTingkat_(bulanLama, taLama, 'SNAPSHOT');
    var now = new Date();
    var adaBaru = {};
    _barisTingkatBulanan_().forEach(function (r) { if (_bulanStr_(r.bulan) === bulanBaru) adaBaru[String(r.nit)] = true; });
    // Ubah TARUNA dalam SATU baca + SATU tulis per kolom (hindari ratusan sheetUpdate).
    var sh = _sheet_(SHEETS.TARUNA);
    var last = sh.getLastRow(), lastCol = sh.getLastColumn();
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var data = sh.getRange(2, 1, last - 1, lastCol).getValues();
    var iNit = headers.indexOf('nit'), iTk = headers.indexOf('tingkat'),
        iKel = headers.indexOf('tgl_keluar'), iAls = headers.indexOf('alasan_keluar');
    var petaBaru = {}; rencana.forEach(function (x) { petaBaru[x.nit] = x.baru; });
    var setLulus = {}; lulus.forEach(function (n) { setLulus[n] = true; });
    data.forEach(function (r) {
      var nit = String(r[iNit]);
      if (petaBaru[nit]) r[iTk] = petaBaru[nit];
      if (setLulus[nit]) { r[iKel] = tglLulus; r[iAls] = 'LULUS'; }
    });
    [iTk, iKel, iAls].forEach(function (ci) {
      sh.getRange(2, ci + 1, data.length, 1).setValues(data.map(function (r) { return [r[ci]]; }));
    });
    _appendBanyak_(SHEETS.TINGKAT_BULANAN, rencana.filter(function (x) { return !adaBaru[x.nit]; }).map(function (x) {
      return { bulan: bulanBaru, nit: x.nit, prodi: x.prodi, tingkat: x.baru, ta: taBaru, sumber: 'NAIK_TINGKAT', timestamp: now };
    }));
    auditLog(session, 'tingkat.naik', 'TARUNA', bulanBaru, { bulan_lama: bulanLama, snapshot: snap },
      { naik: naik, lulus: lulus.length, tgl_lulus: tglLulus, dilewati: dilewati, ta_baru: taBaru });
    return { naik: naik, lulus: lulus.length, dilewati: dilewati, snapshot_lama: snap, dry_run: false };
  });
}
