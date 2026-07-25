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
