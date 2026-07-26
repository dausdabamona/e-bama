/**
 * 14_rekap.gs — REKAP_BULANAN: materialized view incremental (SOP no. 10)
 * Status: DRAFT → DISETUJUI_WADIR3 (Wadir 3) → TERVERIFIKASI_PPK (PPK verifikasi)
 *          → FINAL (PPK finalkan; beku, dasar SPM, siap dibayar)
 *
 * ACTION: rekap.get (PPK, KPA), rekap.verify (PPK), rekap.final (PPK),
 *         rekap.approve_wadir3 / rekap.batal_wadir3 (WADIR3),
 *         rekap.input_historis (PPK, Admin) — migrasi bulan pra-aplikasi,
 *         rekap.recompute (PPK, Staf PPK) — hitung ulang bulan berjalan on-demand
 * INTERNAL: rekapUpdate(tanggal, session) — dipanggil realisasi.ttd (session
 *         kosong) DAN rekap.recompute (session pemanggil), BUKAN action publik.
 *
 * Uang selalu integer rupiah: nominal = hari_makan × harga_per_hari (tarif
 * kontrak, lihat _hargaPerHariKontrak_ di 05_master.gs — fallback ke
 * harga_per_porsi × porsi_per_hari untuk kontrak lama yang belum diisi ulang).
 * Setelah FINAL semua update bulan tsb DITOLAK.
 */

/**
 * rekapUpdate(tanggal, session) — hitung ulang bulan berjalan secara incremental.
 * hari_makan  = jumlah hari realisasi SAH (kedua ttd) bulan itu MINUS hari
 *               taruna berstatus harian; hari_tidak_makan = hari berstatus.
 * Ditulis batch per baris (bukan 247 update terpisah) demi kuota GAS 6 menit.
 * `session` OPSIONAL — diisi saat dipicu manual (rekap.recompute) supaya
 * AUDIT_LOG mencatat siapa yang menghitung ulang; kosong bila dipicu otomatis
 * dari realisasi.ttd (perilaku lama tetap sama).
 */
function rekapUpdate(tanggal, session) {
  var bulan = _bulanStr_(tanggal);
  var kontrak = _kontrakAktifPada_(tanggal);
  var hargaPerHari = _hargaPerHariKontrak_(kontrak);

  // Hari-hari realisasi sah pada bulan tsb
  var hariSah = {};
  sheetRead(SHEETS.REALISASI, function (r) {
    return _bulanStr_(r.tanggal) === bulan && r.ttd_pembina_at && r.ttd_senat_at;
  }).forEach(function (r) { hariSah[_tglStr_(r.tanggal)] = true; });
  var jmlHariSah = Object.keys(hariSah).length;

  // Status harian per taruna pada bulan tsb — hari apa pun taruna berstatus
  // (tidak makan di kampus) menurunkan hari_makan-nya.
  var statusPerNit = {};
  sheetRead(SHEETS.STATUS_HARIAN, function (r) { return _bulanStr_(r.tanggal) === bulan; })
    .forEach(function (r) {
      var nit = String(r.nit);
      if (!statusPerNit[nit]) statusPerNit[nit] = {};
      statusPerNit[nit][_tglStr_(r.tanggal)] = true;
    });
  // Sertakan hari PERIODE_LUAR (model periode) yang jatuh di bulan ini — taruna
  // PKL/KPA tidak makan di kampus, jadi hari itu bukan hari_makan dalam kampus.
  (function () {
    var pinfo = bulan.split('-');
    var awal = bulan + '-01';
    var akhir = _tglStr_(new Date(Number(pinfo[0]), Number(pinfo[1]), 0));
    _periodeLuarRows_().forEach(function (pr) {
      if (!pr.tgl_mulai || !pr.tgl_akhir) return;
      var d0 = pr.tgl_mulai > awal ? pr.tgl_mulai : awal;
      var d1 = pr.tgl_akhir < akhir ? pr.tgl_akhir : akhir;
      if (d1 < d0) return;
      if (!statusPerNit[pr.nit]) statusPerNit[pr.nit] = {};
      _daftarTanggal_(d0, d1).forEach(function (t) { statusPerNit[pr.nit][t] = true; });
    });
  })();

  // Taruna yang termasuk bulan ini: AKTIF & belum keluar permanen sebelum bulan
  // ini (bulan keluar tetap terhitung; bulan berikutnya otomatis tereksklusi).
  var tarunaAktif = sheetRead(SHEETS.TARUNA, function (r) { return _tarunaAktifBulan_(r, bulan); });

  // Taruna keluar PERMANEN di TENGAH bulan ini: hari SETELAH tgl_keluar bukan
  // hari makan kampus (cegah overcount di bulan keluar).
  (function () {
    var pk = bulan.split('-');
    var awalBln = bulan + '-01';
    var akhirBln = _tglStr_(new Date(Number(pk[0]), Number(pk[1]), 0));
    tarunaAktif.forEach(function (t) {
      var kel = _tglKeluarStr_(t);
      if (!kel || kel < awalBln || kel >= akhirBln) return;
      var kd = new Date(kel); kd.setDate(kd.getDate() + 1);
      var nit = String(t.nit);
      if (!statusPerNit[nit]) statusPerNit[nit] = {};
      _daftarTanggal_(_tglStr_(kd), akhirBln).forEach(function (tg) { statusPerNit[nit][tg] = true; });
    });
  })();

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
      var nominal = Math.round(makan * hargaPerHari); // integer rupiah

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

    auditLog(session || null, 'rekap.update', 'REKAP_BULANAN', bulan, null,
      { hari_sah: jmlHariSah, taruna: tarunaAktif.length, harga_per_hari: hargaPerHari });
    return { bulan: bulan, hari_sah: jmlHariSah, taruna: tarunaAktif.length };
  });
}

/**
 * rekap.recompute {bulan} → {bulan, hari_sah, taruna} (PPK, Staf PPK).
 *
 * Pemicu MANUAL untuk rekapUpdate — supaya PPK/Staf PPK bisa MEMANTAU dan
 * membentuk rekap BULAN BERJALAN kapan saja, tanpa menunggu bulan tutup.
 * Sebelumnya rekap hanya terbentuk otomatis saat realisasi.ttd melengkapi kedua
 * tanda tangan, sehingga bulan yang belum ada ttd tampak kosong tanpa jalan
 * keluar (mis. penyiapan kuasa debet taruna wisuda di tengah bulan).
 *
 * Rumusnya TIDAK diubah: yang dihitung tetap HANYA hari realisasi SAH (kedua
 * ttd). Bila belum ada realisasi ter-ttd, hasilnya memang 0 — action ini
 * memantau progres, bukan pengganti tanda tangan Pembina/Senat.
 *
 * Bulan berjalan dihitung s.d. HARI INI; bulan lampau s.d. akhir bulan. Guard
 * FINAL & withLock ikut dari rekapUpdate (bulan FINAL ditolak di sana).
 */
function rekapRecompute(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');

  var kini = new Date();
  if (bulan > _bulanStr_(kini)) throw _fail_('Bulan ' + bulan + ' belum berjalan.');

  // Tanggal acuan = min(hari ini, akhir bulan tsb) — bulan berjalan dihitung
  // sampai hari ini, bulan lampau dihitung penuh.
  var bg = bulan.split('-');
  var akhirBulan = new Date(Number(bg[0]), Number(bg[1]), 0);
  var acuan = akhirBulan < kini ? akhirBulan : kini;

  return rekapUpdate(_tglStr_(acuan), session);
}

/** Baris rekap satu bulan. */
function _rekapBulan_(bulan) {
  var rows = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  if (!rows.length) throw _fail_('Belum ada rekap untuk bulan ' + bulan + '.');
  return rows;
}

/**
 * _basisPesananBulan_(bulan) — agregat pembanding BASIS PESANAN untuk rekap
 * bulan berjalan (permintaan Firdaus: rekap sementara dibandingkan dua dasar,
 * pesanan vs realisasi). HANYA dihitung on-the-fly & TIDAK pernah ditulis ke
 * REKAP_BULANAN — snapshot §5 tetap basis realisasi sah sebagai dasar bayar.
 * Pesanan yang dihitung: status final (DISETUJUI/TERKIRIM), aturan sama dgn
 * portal penyedia. `oh_dipesan` = Σ jml_taruna (orang-hari) — sebanding dgn
 * Σ hari_makan di rekap. Nominal proyeksi memakai tarif kontrak per baris
 * pesanan (fallback harga_per_porsi × porsi lewat _hargaPerHariKontrak_).
 */
function _basisPesananBulan_(bulan) {
  var rows = sheetRead(SHEETS.PESANAN, function (r) {
    return _bulanStr_(r.tgl_makan) === bulan &&
      (r.status === 'DISETUJUI' || r.status === 'TERKIRIM');
  });
  var tarifPerKontrak = {};
  var tglTerhitung = {};
  var hari = 0, oh = 0, nominal = 0;
  rows.forEach(function (p) {
    var tgl = _tglStr_(p.tgl_makan);
    if (!tglTerhitung[tgl]) { tglTerhitung[tgl] = true; hari++; }
    var jml = _int_(p.jml_taruna || 0, 'jml_taruna');
    oh += jml;
    var kid = String(p.kontrak_id || '');
    if (!(kid in tarifPerKontrak)) {
      var k = sheetRead(SHEETS.KONTRAK, function (r) { return String(r.kontrak_id) === kid; })[0];
      tarifPerKontrak[kid] = k ? _hargaPerHariKontrak_(k) : 0;
    }
    nominal += jml * tarifPerKontrak[kid];
  });
  return { bulan: bulan, hari_dipesan: hari, oh_dipesan: oh, nominal_proyeksi: Math.round(nominal) };
}

/**
 * _rekapProyeksiPesanan_(bulan, sampaiTanggal?) — proyeksi PER TARUNA basis
 * PESANAN final: utk tiap tanggal yang punya PESANAN DISETUJUI/TERKIRIM
 * bulan itu, taruna dihitung bila aktif pada tanggal tsb (_tarunaAktifTanggal_
 * — menghormati tgl_keluar wisuda) DAN tidak berstatus tidak-makan. Tarif per
 * tanggal = tarif kontrak baris pesanannya. Return array {nit, hari_makan,
 * nominal} (nominal integer rupiah) — BUKAN pengganti REKAP_BULANAN dan TIDAK
 * pernah ditulis ke sheet; dipakai kuasa debet taruna keluar saat rekap
 * realisasi bulan berjalan belum terbentuk (dikonfirmasi Firdaus: kuasa debet
 * boleh basis pesanan, dgn label jelas).
 *
 * `sampaiTanggal` (opsional, 'YYYY-MM-DD') — batasi proyeksi HANYA tanggal 1
 * s.d. tanggal itu (dikonfirmasi Firdaus: taruna wisuda keluar di tengah
 * bulan, proyeksi tidak boleh ikut menghitung hari SETELAH tanggal keluarnya
 * yang belum tentu makan). Kosong = seluruh bulan (perilaku lama, dipakai
 * pemanggil lain yang tidak mengirim parameter ini — TIDAK ada perubahan
 * perilaku bagi mereka).
 *
 * PERFORMA: STATUS_HARIAN & PERIODE_LUAR dibaca SEKALI di awal (bukan lewat
 * _tidakMakanKampusPada_ per tanggal) — versi awal memanggilnya di dalam
 * loop tanggal, artinya 1 bulan dgn N hari terisi = 2×N pembacaan sheet
 * penuh berturut-turut ke Google Sheets. Untuk Juli (26 hari terisi setelah
 * pemulihan PESANAN) ini menyebabkan permintaan >30 detik → klien menyerah
 * dgn pesan "Jaringan bermasalah" (frontend/src/lib/api.ts, TIMEOUT_MS)
 * padahal jaringan baik-baik saja. Sekarang O(1) pembacaan sheet apa pun
 * jumlah harinya.
 */
function _rekapProyeksiPesanan_(bulan, sampaiTanggal) {
  var pesanan = sheetRead(SHEETS.PESANAN, function (r) {
    if (_bulanStr_(r.tgl_makan) !== bulan) return false;
    if (r.status !== 'DISETUJUI' && r.status !== 'TERKIRIM') return false;
    if (sampaiTanggal && _tglStr_(r.tgl_makan) > sampaiTanggal) return false;
    return true;
  });
  var tarifPerKontrak = {};
  var taruna = sheetRead(SHEETS.TARUNA);

  var tidakMakanPerTgl = {}; // tgl -> {nit: true}
  sheetRead(SHEETS.STATUS_HARIAN).forEach(function (r) {
    var t = _tglStr_(r.tanggal);
    if (!tidakMakanPerTgl[t]) tidakMakanPerTgl[t] = {};
    tidakMakanPerTgl[t][String(r.nit)] = true;
  });
  var periodeLuar = _periodeLuarRows_();
  function tidakMakanPada(tgl) {
    var set = tidakMakanPerTgl[tgl] ? Object.assign({}, tidakMakanPerTgl[tgl]) : {};
    periodeLuar.forEach(function (p) {
      if (p.tgl_mulai && p.tgl_akhir && p.tgl_mulai <= tgl && tgl <= p.tgl_akhir) set[p.nit] = true;
    });
    return set;
  }

  var per = {}; // nit -> {hari, nominal}
  var tglSudah = {};
  pesanan.forEach(function (p) {
    var tgl = _tglStr_(p.tgl_makan);
    if (tglSudah[tgl]) return; // satu tanggal dihitung sekali
    tglSudah[tgl] = true;
    var kid = String(p.kontrak_id || '');
    if (!(kid in tarifPerKontrak)) {
      var k = sheetRead(SHEETS.KONTRAK, function (r) { return String(r.kontrak_id) === kid; })[0];
      tarifPerKontrak[kid] = k ? _hargaPerHariKontrak_(k) : 0;
    }
    var tarif = tarifPerKontrak[kid];
    var tidakMakan = tidakMakanPada(tgl);
    taruna.forEach(function (t) {
      if (!_tarunaAktifTanggal_(t, tgl)) return;
      var nit = String(t.nit);
      if (tidakMakan[nit]) return;
      if (!per[nit]) per[nit] = { hari: 0, nominal: 0 };
      per[nit].hari++;
      per[nit].nominal += tarif;
    });
  });
  return Object.keys(per).map(function (nit) {
    return { nit: nit, hari_makan: per[nit].hari, nominal: Math.round(per[nit].nominal) };
  });
}

/**
 * rekap.get {bulan} → baris + total (PPK, KPA).
 * D = hari realisasi sah bulan itu (hari_makan + hari_tidak_makan per baris —
 * konstan untuk semua taruna AKTIF sejak recompute rekapUpdate terakhir).
 * ambang_outlier dari getKebijakanRekap() — dipakai frontend untuk penanda
 * anomali (Redesign Rekap Bulanan), TIDAK memengaruhi hitungan nominal.
 */
function rekapGet(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var rows = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  var total = 0;
  rows.forEach(function (r) { total += _int_(r.nominal || 0, 'nominal'); });
  var d = rows.length ? (_int_(rows[0].hari_makan || 0, 'hari_makan') + _int_(rows[0].hari_tidak_makan || 0, 'hari_tidak_makan')) : 0;
  var totalHariMakan = 0;
  rows.forEach(function (r) { totalHariMakan += _int_(r.hari_makan || 0, 'hari_makan'); });
  // basis_pesanan: pembanding proyeksi (lihat _basisPesananBulan_). Ikut pola
  // lama rekap.get utk SENAT/PEMBINA: nominal dikirim, frontend yang
  // menyembunyikan (halaman /rekap-ringkas tanpa nominal).
  return {
    rekap: rows, total: total, bulan: bulan, D: d,
    total_hari_makan: totalHariMakan,
    basis_pesanan: _basisPesananBulan_(bulan),
    ambang_outlier: getKebijakanRekap().ambangOutlier
  };
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

/**
 * DISETUJUI_WADIR3 → TERVERIFIKASI_PPK (PPK verifikasi). PPK memeriksa hasil
 * yang sudah disetujui Wadir 3 — langkah kedua dari akhir sebelum finalisasi.
 */
function rekapVerify(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  return _rekapSetStatus_(session, bulan, 'DISETUJUI_WADIR3', 'TERVERIFIKASI_PPK', 'verify');
}

/**
 * TERVERIFIKASI_PPK → FINAL (PPK finalkan — angka BEKU, dasar SPM, siap dibayar).
 * Langkah TERAKHIR: PPK menyatakan hasil siap dibayar (gerbang bayar.create).
 */
function rekapFinal(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  return _rekapSetStatus_(session, bulan, 'TERVERIFIKASI_PPK', 'FINAL', 'final');
}

/**
 * DRAFT → DISETUJUI_WADIR3 (Wadir 3): persetujuan PALING AWAL atas rekap yang
 * baru tersusun, SEBELUM PPK memverifikasi & memfinalkan. Angka BELUM beku di
 * sini (baru beku saat PPK finalkan) — Wadir 3 menyetujui substansi hasil, lalu
 * diteruskan ke PPK. Prinsip: PPK di posisi terakhir (menerima hasil siap bayar).
 */
function rekapApproveWadir3(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  return _rekapSetStatus_(session, bulan, 'DRAFT', 'DISETUJUI_WADIR3', 'approve_wadir3');
}

/**
 * DISETUJUI_WADIR3 → DRAFT (Wadir 3 batalkan persetujuan — mis. salah klik,
 * atau ternyata ada koreksi hari makan yang perlu diperbaiki dulu sebelum
 * disetujui ulang). HANYA bisa dibatalkan selama PPK BELUM memverifikasi
 * (_rekapSetStatus_ menolak kalau status sudah bukan DISETUJUI_WADIR3, jadi
 * TERVERIFIKASI_PPK/FINAL otomatis tertutup dari pembatalan ini).
 */
function rekapBatalWadir3(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  return _rekapSetStatus_(session, bulan, 'DISETUJUI_WADIR3', 'DRAFT', 'batal_wadir3');
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

/**
 * rekap.harian {tanggal} — rekonsiliasi 3 titik HARIAN per Prodi+Tingkat,
 * READ-ONLY (tanpa withLock, tanpa efek samping). Beda dari REKAP_BULANAN
 * (materialized view bulanan): dihitung LIVE dari TARUNA+STATUS_HARIAN untuk
 * SATU tanggal, dikelompokkan Prodi+Tingkat supaya langsung terbaca per kelas
 * — pelengkap tampilan modul Taruna + dasar cetak "Rekapitulasi Harian Taruna".
 *
 * "Tidak makan" = STATUS_HARIAN ∈ {PESIAR, CUTI, SAKIT_RUMAH, PENUNDAAN_STUDI, TANPA_KETERANGAN}.
 * "Luar kampus" = STATUS_HARIAN ∈ STATUS_LUAR_KAMPUS (00_config.gs, berhak
 * BANTUAN_LUAR_KAMPUS, bukan makan di kampus). "Makan" = aktif − keduanya —
 * subset yang sama seperti _hitungJmlTaruna_ (12_pesanan.gs)/cetakForm02.
 *
 * `realisasi` (opsional) = rekonsiliasi ke PESANAN.jml_taruna vs
 * REALISASI.jml_taruna_makan tanggal itu — null bila belum ada salah satunya.
 */
function rekapHarian(payload, session) {
  var tgl = _wajibTgl_(payload && payload.tanggal, 'tanggal');

  var tarunaAktif = sheetRead(SHEETS.TARUNA, function (r) { return _tarunaAktifTanggal_(r, tgl); });
  var statusHari = {};
  sheetRead(SHEETS.STATUS_HARIAN, function (r) { return _tglStr_(r.tanggal) === tgl; })
    .forEach(function (r) { statusHari[String(r.nit)] = String(r.status); });
  // Sertakan taruna berperiode luar kampus (model periode) yang mencakup tgl ini
  // — kalau belum punya baris STATUS_HARIAN hari itu, pakai status periodenya.
  var luarPeriode = _nitLuarPadaTanggal_(tgl);
  Object.keys(luarPeriode).forEach(function (nit) { if (!statusHari[nit]) statusHari[nit] = luarPeriode[nit]; });

  var kelompok = {};
  function _grupHarian_(prodi, tingkat) {
    var kunci = (prodi || '') + '|' + (tingkat || '');
    if (!kelompok[kunci]) {
      kelompok[kunci] = { prodi: prodi || '', tingkat: tingkat || '', aktif: 0, tidak_makan: 0, luar_kampus: 0, makan: 0 };
    }
    return kelompok[kunci];
  }

  tarunaAktif.forEach(function (t) {
    var g = _grupHarian_(t.prodi, t.tingkat);
    g.aktif++;
    var st = statusHari[String(t.nit)];
    if (!st) { g.makan++; }
    else if (STATUS_LUAR_KAMPUS.indexOf(st) >= 0) { g.luar_kampus++; }
    else { g.tidak_makan++; }
  });

  var perKelompok = Object.keys(kelompok).map(function (k) { return kelompok[k]; })
    .sort(function (a, b) { return a.prodi.localeCompare(b.prodi) || a.tingkat.localeCompare(b.tingkat); });

  var total = { aktif: 0, tidak_makan: 0, luar_kampus: 0, makan: 0 };
  perKelompok.forEach(function (g) {
    total.aktif += g.aktif; total.tidak_makan += g.tidak_makan;
    total.luar_kampus += g.luar_kampus; total.makan += g.makan;
  });

  var pesanan = sheetRead(SHEETS.PESANAN, function (r) { return _tglStr_(r.tgl_makan) === tgl; })[0];
  var realisasi = sheetRead(SHEETS.REALISASI, function (r) { return _tglStr_(r.tanggal) === tgl; })[0];
  var rekonsiliasiHarian = null;
  if (pesanan && realisasi) {
    var dipesan = _int_(pesanan.jml_taruna, 'jml_taruna');
    var dimakan = _int_(realisasi.jml_taruna_makan, 'jml_taruna_makan');
    rekonsiliasiHarian = { dipesan: dipesan, dimakan: dimakan, selisih: dipesan - dimakan };
  }

  return { tanggal: tgl, per_kelompok: perKelompok, total: total, realisasi: rekonsiliasiHarian };
}
