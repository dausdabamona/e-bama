/**
 * 11_status_harian.gs — Status harian taruna yang TIDAK berhak makan di kampus
 * (SOP: Peringatan no. 2). Enum: PESIAR / CUTI / SAKIT_RUMAH / PENUNDAAN_STUDI /
 * TANPA_KETERANGAN / KEGIATAN_LUAR_KAMPUS / PKL_1 / PKL_2 / PKL_3 / KPA /
 * MAGANG / PTB. Yang tergolong kegiatan luar kampus (dapat bantuan makan luar
 * kampus) ada di STATUS_LUAR_KAMPUS (00_config.gs) — dipakai Form-08.
 * TANPA_KETERANGAN (absen tanpa alasan resmi) TIDAK termasuk STATUS_LUAR_KAMPUS
 * — tidak berhak bantuan apa pun, sama seperti Pesiar/Cuti/Sakit/Penundaan
 * Studi. Tanpa mekanisme peringatan/eskalasi otomatis (dikonfirmasi Firdaus,
 * berbeda dari SURAT_PERINGATAN §7 yang murni soal tagihan) — begitu taruna
 * masuk kembali, cukup berhenti input status ini, tanpa aksi tambahan.
 *
 * ACTION: status.set (Admin, Pembina), status.batch (Admin, Pembina),
 *         status.list (semua login)
 *
 * Unik per (tanggal, nit) — upsert. Surat pendukung → LAMPIRAN ref_type=STATUS_HARIAN.
 * Setiap aksi tulis → withLock + auditLog.
 *
 * `tgl_akhir` (opsional, status.set/status.batch) → isi rentang tanggal
 * sekaligus (satu baris STATUS_HARIAN per hari, lihat _daftarTanggal_ di
 * 05_master.gs) — mis. cuti 2 minggu tidak perlu diinput per hari.
 *
 * TANPA_KETERANGAN (absen tanpa alasan) khusus: kapan taruna kembali tidak
 * diketahui, jadi bila `tgl_akhir` DIKOSONGKAN status ini di-isi maju sampai
 * AKHIR KONTRAK KATERING AKTIF (fallback akhir bulan berjalan) — "berlaku
 * sampai dicabut". Cabut lebih awal saat taruna kembali via status.tandai_kembali
 * (menghapus baris ke depan). Status lain tanpa `tgl_akhir` tetap satu hari saja.
 * (dikonfirmasi Firdaus). Lihat _horizonTanpaKeterangan_.
 */

/**
 * Horizon "berlaku sampai dicabut" untuk TANPA_KETERANGAN tanpa tgl_akhir:
 * isi baris STATUS_HARIAN maju sampai akhir kontrak katering aktif (batas
 * alami program makan). Fallback akhir bulan berjalan bila tidak ada kontrak
 * aktif pada `tanggal`. Di-clamp maks 185 hari agar tidak menembus batas
 * _daftarTanggal_ (186 hari) — kasus ekstrem taruna tak kembali >6 bulan
 * cukup di-input ulang.
 */
function _horizonTanpaKeterangan_(tanggal) {
  var horizon;
  try {
    horizon = _tglStr_(_kontrakAktifPada_(tanggal).tgl_akhir);
  } catch (e) {
    var p = String(tanggal).split('-');                       // akhir bulan berjalan
    horizon = _tglStr_(new Date(Number(p[0]), Number(p[1]), 0));
  }
  var maks = _tambahHari_(tanggal, 185);
  if (horizon > maks) horizon = maks;
  if (horizon < tanggal) horizon = tanggal;                   // jaga-jaga
  return horizon;
}

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

/**
 * Tulis status MASSAL (banyak nit × banyak tanggal) dalam SATU operasi — hindari
 * O(n²) yang membuat input sekelas/serentang bulan TIMEOUT. Baca STATUS_HARIAN
 * sekali, kumpulkan baris baru + update di memori, tulis sekali (setValues),
 * dan catat SATU baris AUDIT_LOG ringkas (bukan per baris). Dipakai statusBatch
 * & kajurStatusBatch. Panggil DI DALAM withLock (baca-ubah-tulis rawan balapan).
 */
function _statusTulisBatch_(session, daftarTgl, nitList, status, aksiLabel) {
  if (ENUM.STATUS_HARIAN.indexOf(status) < 0) {
    throw _fail_('status harus salah satu: ' + ENUM.STATUS_HARIAN.join(' / '));
  }
  var tarunaSet = {};
  sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaSet[String(t.nit)] = true; });
  var nits = nitList.map(function (n) { return String(n).trim(); });
  nits.forEach(function (nit) { if (!tarunaSet[nit]) throw _fail_('Taruna tidak ditemukan: ' + nit); });

  var sh = _sheet_(SHEETS.STATUS_HARIAN);
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var last = sh.getLastRow();
  var data = last >= 2 ? sh.getRange(2, 1, last - 1, lastCol).getValues() : [];
  var iTgl = headers.indexOf('tanggal'), iNit = headers.indexOf('nit'),
      iStatus = headers.indexOf('status'), iInputBy = headers.indexOf('input_by'),
      iTs = headers.indexOf('timestamp');

  var idx = {}; // 'tgl|nit' -> index di data (>=0), atau -1 bila baris baru sudah diantrikan
  for (var i = 0; i < data.length; i++) {
    idx[_tglStr_(data[i][iTgl]) + '|' + String(data[i][iNit])] = i;
  }

  var now = new Date();
  var barisBaru = [];
  var adaUpdate = false, jmlBaru = 0, jmlUbah = 0;
  nits.forEach(function (nit) {
    daftarTgl.forEach(function (t) {
      var key = t + '|' + nit;
      var pos = idx[key];
      if (pos === undefined) {
        var nilai = {
          status_id: nextId('STH'), tanggal: t, nit: nit, status: status,
          input_by: session.user_id, timestamp: now
        };
        barisBaru.push(headers.map(function (h) { return nilai[h] !== undefined ? nilai[h] : ''; }));
        idx[key] = -1;
        jmlBaru++;
      } else if (pos >= 0) {
        var r = data[pos];
        r[iStatus] = status;
        if (iInputBy >= 0) r[iInputBy] = session.user_id;
        if (iTs >= 0) r[iTs] = now;
        adaUpdate = true;
        jmlUbah++;
      } // pos === -1: sudah diantrikan di batch ini → lewati
    });
  });

  if (adaUpdate && data.length) sh.getRange(2, 1, data.length, lastCol).setValues(data);
  if (barisBaru.length) sh.getRange(sh.getLastRow() + 1, 1, barisBaru.length, lastCol).setValues(barisBaru);

  // Satu baris AUDIT_LOG ringkas untuk seluruh batch (bukan per baris → cepat).
  auditLog(session, aksiLabel || 'status.batch', 'STATUS_HARIAN', null, null, {
    status: status, jml_baru: jmlBaru, jml_ubah: jmlUbah,
    tgl_dari: daftarTgl[0], tgl_sampai: daftarTgl[daftarTgl.length - 1], nit: nits
  });
  return { jml: jmlBaru + jmlUbah, jml_baru: jmlBaru, jml_ubah: jmlUbah };
}

// ════════════════════════════════════════════════════════════════════════════
// MODEL PERIODE LUAR KAMPUS (Tahap 2) — helper BACA terpadu.
// Menggabungkan PERIODE_LUAR (1 baris/taruna/periode) + STATUS_HARIAN luar
// kampus LEGACY (per hari) sehingga data lama tetap benar selama transisi.
// BELUM dipakai konsumen (itu Tahap 4) — aman ditambah.
// ════════════════════════════════════════════════════════════════════════════

/** Baca PERIODE_LUAR → [{periode_id, nit, status, tgl_mulai, tgl_akhir}].
 * Toleran: bila sheet belum dibuat (setupDatabase belum dijalankan pasca-deploy)
 * anggap KOSONG — agar konsumen (rekap/Form-08) tetap jalan pakai data legacy. */
function _periodeLuarRows_() {
  if (!_getSpreadsheet_().getSheetByName(SHEETS.PERIODE_LUAR)) return [];
  return sheetRead(SHEETS.PERIODE_LUAR).map(function (r) {
    return {
      periode_id: r.periode_id, nit: String(r.nit), status: r.status,
      tgl_mulai: _tglStr_(r.tgl_mulai), tgl_akhir: _tglStr_(r.tgl_akhir)
    };
  });
}

/**
 * NIT yang sedang luar kampus pada satu tanggal — GABUNGAN periode (rentang
 * mencakup tanggal) + STATUS_HARIAN legacy. Kembalikan map { nit: status }.
 * Dipakai konsumen HARIAN (pengecualian pesanan, rekap harian).
 */
function _nitLuarPadaTanggal_(tanggal) {
  var t = _tglStr_(tanggal);
  var set = {};
  _periodeLuarRows_().forEach(function (p) {
    if (p.tgl_mulai && p.tgl_akhir && p.tgl_mulai <= t && t <= p.tgl_akhir) set[p.nit] = p.status;
  });
  sheetRead(SHEETS.STATUS_HARIAN, function (r) {
    return _tglStr_(r.tanggal) === t && STATUS_LUAR_KAMPUS.indexOf(r.status) >= 0;
  }).forEach(function (r) { set[String(r.nit)] = r.status; });
  return set;
}

/**
 * Jumlah HARI luar kampus per NIT pada satu bulan — GABUNGAN periode (irisan
 * rentang × bulan) + STATUS_HARIAN legacy, dihitung HARI UNIK (tak dobel bila
 * keduanya kebetulan ada). Kembalikan map { nit: {hari, status} }.
 * Dipakai konsumen BULANAN (kajur.rekap, Form-08).
 */
function _hariLuarPerNitBulan_(bulan) {
  var awal = bulan + '-01';
  var p = bulan.split('-');
  var akhir = _tglStr_(new Date(Number(p[0]), Number(p[1]), 0)); // hari terakhir bulan
  var byNit = {}; // nit -> { dates:{tgl:true}, status:'' }
  function tambah(nit, tgl, status) {
    if (!byNit[nit]) byNit[nit] = { dates: {}, status: status || '' };
    byNit[nit].dates[tgl] = true;
    if (status) byNit[nit].status = status;
  }
  _periodeLuarRows_().forEach(function (pr) {
    if (!pr.tgl_mulai || !pr.tgl_akhir) return;
    var d0 = pr.tgl_mulai > awal ? pr.tgl_mulai : awal;
    var d1 = pr.tgl_akhir < akhir ? pr.tgl_akhir : akhir;
    if (d1 < d0) return;
    _daftarTanggal_(d0, d1).forEach(function (t) { tambah(pr.nit, t, pr.status); });
  });
  sheetRead(SHEETS.STATUS_HARIAN, function (r) {
    return _bulanStr_(r.tanggal) === bulan && STATUS_LUAR_KAMPUS.indexOf(r.status) >= 0;
  }).forEach(function (r) { tambah(String(r.nit), _tglStr_(r.tanggal), r.status); });
  var out = {};
  Object.keys(byNit).forEach(function (nit) {
    out[nit] = { hari: Object.keys(byNit[nit].dates).length, status: byNit[nit].status };
  });
  return out;
}

/**
 * Set NIT yang TIDAK makan di kampus pada satu tanggal = STATUS_HARIAN (SEMUA
 * status: pesiar/cuti/sakit/luar/dst) ∪ PERIODE_LUAR yang mencakup tanggal.
 * Dipakai konsumen HARIAN pesanan (hitung jml_taruna, derivasi porsi) agar
 * taruna berperiode luar kampus tetap DIKECUALIKAN dari pesan makan kampus.
 * Kembalikan map { nit: true }.
 */
function _tidakMakanKampusPada_(tanggal) {
  var t = _tglStr_(tanggal);
  var set = {};
  sheetRead(SHEETS.STATUS_HARIAN, function (r) { return _tglStr_(r.tanggal) === t; })
    .forEach(function (r) { set[String(r.nit)] = true; });
  _periodeLuarRows_().forEach(function (p) {
    if (p.tgl_mulai && p.tgl_akhir && p.tgl_mulai <= t && t <= p.tgl_akhir) set[p.nit] = true;
  });
  return set;
}

/**
 * Set status satu taruna. Payload {tanggal, nit, status, berkas?, tgl_akhir?}.
 * `tgl_akhir` opsional → isi rentang tanggal, satu baris STATUS_HARIAN per hari
 * (mis. cuti 2 minggu sekali input, bukan per hari).
 */
function statusSet(payload, session) {
  var tanggal = _wajibTgl_(payload && payload.tanggal, 'tanggal');
  var nit = String((payload && payload.nit) || '').trim();
  if (!nit) throw _fail_('nit wajib diisi.');
  var status = String((payload && payload.status) || '');
  var daftarTgl = (payload && payload.tgl_akhir)
    ? _daftarTanggal_(tanggal, _wajibTgl_(payload.tgl_akhir, 'tgl_akhir'))
    : (status === 'TANPA_KETERANGAN'                          // open-ended → sampai dicabut
        ? _daftarTanggal_(tanggal, _horizonTanpaKeterangan_(tanggal))
        : [tanggal]);

  var hasil = daftarTgl.map(function (t) { return _statusUpsert_(session, t, nit, status); });

  // Surat pendukung opsional: berkas {base64, nama_file, jenis?} → tautkan ke entri pertama
  if (payload.berkas && payload.berkas.base64) {
    lampiranSave(session, 'STATUS_HARIAN', hasil[0].status_id,
      payload.berkas.jenis || 'SURAT', payload.berkas.base64, payload.berkas.nama_file);
  }
  return hasil.length === 1 ? hasil[0] : { jml: hasil.length };
}

/** Input massal: {tanggal, status, nit: [], berkas?, tgl_akhir?}. Mis. satu kelas pesiar (atau rentang tanggal). */
function statusBatch(payload, session) {
  var tanggal = _wajibTgl_(payload && payload.tanggal, 'tanggal');
  var daftar = (payload && payload.nit) || [];
  if (!daftar.length) throw _fail_('nit harus berupa daftar minimal 1 taruna.');
  var status = String((payload && payload.status) || '');
  var daftarTgl = (payload && payload.tgl_akhir)
    ? _daftarTanggal_(tanggal, _wajibTgl_(payload.tgl_akhir, 'tgl_akhir'))
    : (status === 'TANPA_KETERANGAN'                          // open-ended → sampai dicabut
        ? _daftarTanggal_(tanggal, _horizonTanpaKeterangan_(tanggal))
        : [tanggal]);

  return withLock(function () {
    var r = _statusTulisBatch_(session, daftarTgl, daftar, status, 'status.batch');
    if (payload.berkas && payload.berkas.base64) {
      // Satu surat pendukung untuk batch → tautkan ke entri pertama (tgl & nit awal).
      var pertama = sheetRead(SHEETS.STATUS_HARIAN, function (row) {
        return _tglStr_(row.tanggal) === daftarTgl[0] && String(row.nit) === String(daftar[0]).trim();
      })[0];
      if (pertama) {
        lampiranSave(session, 'STATUS_HARIAN', pertama.status_id,
          payload.berkas.jenis || 'SURAT', payload.berkas.base64, payload.berkas.nama_file);
      }
    }
    return { jml: r.jml };
  });
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

/**
 * Batalkan sisa hari status taruna sejak tanggal tertentu (default hari ini)
 * — dipakai saat taruna KEMBALI LEBIH CEPAT dari `tgl_akhir` yang sudah
 * diinput. `status.set`/`status.batch` menulis satu baris STATUS_HARIAN per
 * hari di muka; tanpa aksi ini, sisa hari ke depan tetap tercatat "di luar"
 * di rekap/dashboard walau taruna sudah kembali. Hanya menghapus baris ke
 * DEPAN (>= tanggal_kembali) — riwayat yang sudah lewat TIDAK diubah.
 * Payload {nit, tanggal_kembali?}.
 */
function statusTandaiKembali(payload, session) {
  var nit = String((payload && payload.nit) || '').trim();
  if (!nit) throw _fail_('nit wajib diisi.');
  var tanggalKembali = (payload && payload.tanggal_kembali)
    ? _wajibTgl_(payload.tanggal_kembali, 'tanggal_kembali') : _todayStr_();
  if (tanggalKembali < _todayStr_()) {
    throw _fail_('tanggal_kembali tidak boleh sebelum hari ini (riwayat tidak diubah).');
  }

  var target = sheetRead(SHEETS.STATUS_HARIAN, function (r) {
    return String(r.nit) === nit && _tglStr_(r.tanggal) >= tanggalKembali;
  });
  if (!target.length) return { jml_dibatalkan: 0 };

  var dihapus = sheetDeleteRows(SHEETS.STATUS_HARIAN, 'status_id', target.map(function (r) { return r.status_id; }));
  auditLog(session, 'status.tandai_kembali', 'STATUS_HARIAN', nit,
    { baris: dihapus.map(function (r) { return { tanggal: _tglStr_(r.tanggal), status: r.status }; }) },
    { tanggal_kembali: tanggalKembali });
  return { jml_dibatalkan: dihapus.length };
}
