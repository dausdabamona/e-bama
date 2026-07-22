/**
 * 13_realisasi.gs — Realisasi penyediaan makan harian (SOP no. 8–9)
 *
 * ACTION: realisasi.list (semua login),
 *         realisasi.create (Pembina, Senat),
 *         realisasi.ttd (Pembina, Senat — konfirmasi PIN),
 *         realisasi.kebijakan_piket (semua login — baca kebijakan piket & standar gizi),
 *         realisasi.penerimaan (Senat, Pembina, Admin — checklist Penerimaan Barang Senat),
 *         realisasi.kebijakan_penerimaan (semua login — baca daftar komponen menu),
 *         realisasi.rekap_penerimaan (PPK, KPA, WADIR3, Senat — baca, rekap kelengkapan)
 *
 * Pesanan wajib TERKIRIM. Foto → LAMPIRAN ref_type=REALISASI jenis=FOTO.
 * Kedua ttd terisi → otomatis rekapUpdate(tanggal).
 * Setiap aksi tulis → withLock + auditLog.
 *
 * Ownership Taruna Fitur 1b (Piket Verifikasi Makan): realisasi.create
 * menerima field piket_* OPSIONAL (lihat _piketKolom_) — MENAMBAH bukti dari
 * sisi taruna piket, TIDAK mengubah ttd Pembina/Senat/foto/geotag di atas.
 * Piket diisi lewat perangkat bersama Pembina/Senat, TANPA akun/login taruna
 * sendiri — NIT divalidasi ke roster TARUNA (dikonfirmasi Firdaus).
 *
 * Penerimaan Barang Senat: realisasi.penerimaan menyimpan checklist
 * kelengkapan+jumlah komponen menu NYATA per waktu makan (kolom `penerimaan`,
 * JSON) — TERPISAH dari checklist piket (beda momen: serah-terima vs makan;
 * beda konsep: item menu vs kategori gizi). Decouple dari realisasi.ttd —
 * bisa diisi kapan saja setelah baris REALISASI ada, tidak menunggu ttd.
 */

/** Ambil realisasi by id atau error. */
function _realisasi_(id) {
  var r = sheetRead(SHEETS.REALISASI, function (x) { return String(x.real_id) === String(id); })[0];
  if (!r) throw _fail_('Realisasi tidak ditemukan: ' + id);
  return r;
}

/**
 * Kebijakan piket + standar gizi efektif — dipakai blok "Verifikasi Piket
 * Taruna" di form realisasi (checklist gizi & status wajib/opsional) dan
 * halaman papan "Menu Hari Ini" (Ownership Taruna Fitur 2, tahap lanjutan).
 */
function realisasiKebijakanPiket(payload, session) {
  return { wajib: getKebijakanPiket().wajib, komponen_gizi: getKebijakanGizi().komponen };
}

/**
 * Standar komponen menu efektif — dipakai blok "Penerimaan Barang" di form
 * realisasi (checklist per waktu makan × komponen, Tahap 4).
 */
function realisasiKebijakanPenerimaan(payload, session) {
  return { komponen: getKebijakanKomponenMenu().komponen };
}

var _WAKTU_MAKAN_ = ['pagi', 'siang', 'malam'];

var _KETERANGAN_PENERIMAAN_MAKS_ = 60;
var _KOMPONEN_PENERIMAAN_MAKS_ = 40;

/**
 * Validasi & normalisasi struktur `penerimaan` → {pagi,siang,malam:
 * [{komponen,ada,jumlah,keterangan}]}. `komponen` = nama menu bebas (TIDAK lagi
 * dikunci ke getKebijakanKomponenMenu) supaya menu non-standar per hari — mis.
 * "Bubur kacang ijo", lauk kedua, "Milo" — bisa direkam apa adanya (dikonfirmasi
 * Firdaus, masukan taruna). Hanya disaring: non-kosong & dipotong 40 karakter.
 * Daftar kebijakan tetap dipakai frontend sebagai checklist standar & di rekap
 * kelengkapan (komponen di luar daftar dilewati di rekap, tetap tersimpan utuh).
 * `jumlah` bilangan bulat ≥ 0; kunci waktu di luar pagi/siang/malam ditolak
 * (cegah typo diam-diam kehilangan data). `keterangan` OPSIONAL, bebas isi (mis.
 * jenis lauk/minuman nyata) — dipotong 60 karakter.
 */
function _validasiPenerimaan_(input) {
  if (!input || typeof input !== 'object') throw _fail_('penerimaan wajib berupa objek {pagi, siang, malam}.');
  Object.keys(input).forEach(function (k) {
    if (_WAKTU_MAKAN_.indexOf(k) < 0) throw _fail_('Waktu makan tidak dikenal: ' + k + ' (harus pagi/siang/malam).');
  });

  var hasil = {};
  _WAKTU_MAKAN_.forEach(function (waktu) {
    var baris = Array.isArray(input[waktu]) ? input[waktu] : [];
    hasil[waktu] = baris.map(function (b) {
      var komponen = String((b && b.komponen) || '').trim().slice(0, _KOMPONEN_PENERIMAAN_MAKS_);
      if (!komponen) throw _fail_('Nama komponen menu kosong (' + waktu + ').');
      var jumlah = _int_((b && b.jumlah) || 0, 'jumlah (' + waktu + ' ' + komponen + ')');
      var keterangan = String((b && b.keterangan) || '').trim().slice(0, _KETERANGAN_PENERIMAAN_MAKS_);
      return { komponen: komponen, ada: Boolean(b && b.ada), jumlah: jumlah, keterangan: keterangan };
    });
  });
  return hasil;
}

/**
 * Simpan checklist Penerimaan Barang Senat. Payload {real_id? , pesanan_id?,
 * penerimaan}. Realisasi TERKAIT harus SUDAH ADA (dibuat via realisasi.create)
 * — dicari via real_id bila diberikan, kalau tidak via pesanan_id. TERPISAH
 * dari realisasi.ttd (decouple — boleh diisi Senat kapan saja setelah baris
 * REALISASI ada, sebelum ATAU sesudah ttd, tanpa menunggu jml_taruna_makan
 * "final"). Role SENAT (utama)/PEMBINA/ADMIN.
 */
function realisasiPenerimaan(payload, session) {
  var r;
  if (payload && payload.real_id) {
    r = _realisasi_(payload.real_id);
  } else if (payload && payload.pesanan_id) {
    r = sheetRead(SHEETS.REALISASI, function (x) { return String(x.pesanan_id) === String(payload.pesanan_id); })[0];
    if (!r) throw _fail_('Realisasi untuk pesanan ini belum dibuat — buat realisasi.create dulu.');
  } else {
    throw _fail_('real_id atau pesanan_id wajib diisi.');
  }

  var penerimaan = _validasiPenerimaan_(payload && payload.penerimaan);
  sheetUpdate(SHEETS.REALISASI, 'real_id', r.real_id, { penerimaan: JSON.stringify(penerimaan) });
  auditLog(session, 'realisasi.penerimaan', 'REALISASI', r.real_id, null, { penerimaan: penerimaan });
  return { real_id: r.real_id, penerimaan: penerimaan };
}

/**
 * Rekap kelengkapan Penerimaan Barang (Tahap 5, opsional) — turunan MURNI
 * baca (parse `REALISASI.penerimaan`), TIDAK menulis apa pun. Payload
 * {bulan, penyedia_id?} — penyedia_id menyaring lewat PESANAN.kontrak_id →
 * KONTRAK.penyedia_id. Per komponen: `persen_lengkap` (berapa % realisasi
 * yang mencentang ADA), `kali_tidak_ada`, `total_selisih` (SUM porsi_diterima
 * − jumlah tercatat, hanya saat ADA — indikasi kurang KUANTITAS meski
 * komponennya ada). Bahan evaluasi penyedia (dikonfirmasi Firdaus).
 */
function realisasiRekapPenerimaan(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var penyediaId = payload && payload.penyedia_id ? String(payload.penyedia_id) : '';

  var pesananPenyedia = {};
  if (penyediaId) {
    var kontrakPenyedia = {};
    sheetRead(SHEETS.KONTRAK, function (k) { return String(k.penyedia_id) === penyediaId; })
      .forEach(function (k) { kontrakPenyedia[String(k.kontrak_id)] = true; });
    sheetRead(SHEETS.PESANAN, function (p) { return Boolean(kontrakPenyedia[String(p.kontrak_id)]); })
      .forEach(function (p) { pesananPenyedia[String(p.pesanan_id)] = true; });
  }

  var baris = sheetRead(SHEETS.REALISASI, function (r) {
    if (_bulanStr_(r.tanggal) !== bulan) return false;
    if (penyediaId && !pesananPenyedia[String(r.pesanan_id)]) return false;
    return true;
  });

  var komponenValid = getKebijakanKomponenMenu().komponen;
  var stat = {};
  komponenValid.forEach(function (k) { stat[k] = { kaliAda: 0, kaliCatat: 0, totalJumlah: 0, totalSelisih: 0 }; });

  var totalRealisasi = 0;
  baris.forEach(function (r) {
    if (!r.penerimaan) return;
    var p;
    try { p = JSON.parse(r.penerimaan); } catch (e) { return; }
    var punyaData = _WAKTU_MAKAN_.some(function (w) { return Array.isArray(p[w]) && p[w].length > 0; });
    if (!punyaData) return;
    totalRealisasi++;
    var porsi = Number(r.porsi_diterima) || 0;
    _WAKTU_MAKAN_.forEach(function (w) {
      (Array.isArray(p[w]) ? p[w] : []).forEach(function (b) {
        var s = stat[b.komponen];
        if (!s) return; // komponen lama di luar kebijakan saat ini → lewati
        s.kaliCatat++;
        if (b.ada) {
          s.kaliAda++;
          s.totalJumlah += Number(b.jumlah) || 0;
          s.totalSelisih += Math.max(0, porsi - (Number(b.jumlah) || 0));
        }
      });
    });
  });

  var perKomponen = komponenValid.map(function (k) {
    var s = stat[k];
    return {
      komponen: k, kali_ada: s.kaliAda, kali_tidak_ada: s.kaliCatat - s.kaliAda,
      persen_lengkap: s.kaliCatat > 0 ? Math.round((s.kaliAda / s.kaliCatat) * 100) : 0,
      total_jumlah: s.totalJumlah, total_selisih: s.totalSelisih
    };
  });

  var totalCatat = perKomponen.reduce(function (s, k) { return s + k.kali_ada + k.kali_tidak_ada; }, 0);
  var totalAda = perKomponen.reduce(function (s, k) { return s + k.kali_ada; }, 0);
  var palingKurang = perKomponen.slice().sort(function (a, b) { return b.kali_tidak_ada - a.kali_tidak_ada; })[0];

  return {
    bulan: bulan, total_realisasi: totalRealisasi, per_komponen: perKomponen,
    persen_lengkap_keseluruhan: totalCatat > 0 ? Math.round((totalAda / totalCatat) * 100) : 0,
    komponen_paling_sering_kurang: (palingKurang && palingKurang.kali_tidak_ada > 0) ? palingKurang.komponen : ''
  };
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
 * Siapkan & validasi kolom piket_* dari payload {piket_nit?, piket_menu_sesuai?,
 * piket_porsi_cukup?, piket_kualitas?, piket_gizi?[], piket_catatan?}.
 * OPSIONAL secara default (getKebijakanPiket().wajib) — kosong semua bila
 * piket_nit tidak diisi & tidak wajib. NIT WAJIB ada di roster TARUNA; nama
 * didenormalisasi dari situ (untuk cetak, tanpa join ulang). piket_kualitas
 * WAJIB salah satu ENUM.REALISASI_KUALITAS begitu piket_nit diisi — checkbox
 * menu_sesuai/porsi_cukup boleh dibiarkan tak dicentang (FALSE tetap sah).
 */
function _piketKolom_(payload) {
  var kosong = {
    piket_nit: '', piket_nama: '', piket_menu_sesuai: false, piket_porsi_cukup: false,
    piket_kualitas: '', piket_gizi: '', piket_catatan: '', piket_at: ''
  };
  var nit = String((payload && payload.piket_nit) || '').trim();
  if (!nit) {
    if (getKebijakanPiket().wajib) throw _fail_('Verifikasi piket wajib diisi (kebijakan aktif).');
    return kosong;
  }

  var taruna = sheetRead(SHEETS.TARUNA, function (t) { return String(t.nit) === nit; })[0];
  if (!taruna) throw _fail_('NIT piket tidak ditemukan di roster taruna: ' + nit);

  var kualitas = String((payload && payload.piket_kualitas) || '');
  if (ENUM.REALISASI_KUALITAS.indexOf(kualitas) < 0) {
    throw _fail_('piket_kualitas harus salah satu: ' + ENUM.REALISASI_KUALITAS.join(' / '));
  }

  var standarGizi = getKebijakanGizi().komponen;
  var gizi = Array.isArray(payload.piket_gizi) ? payload.piket_gizi.map(String) : [];
  gizi.forEach(function (g) {
    if (standarGizi.indexOf(g) < 0) throw _fail_('Komponen gizi tidak dikenal: ' + g);
  });

  return {
    piket_nit: nit, piket_nama: taruna.nama,
    piket_menu_sesuai: Boolean(payload.piket_menu_sesuai),
    piket_porsi_cukup: Boolean(payload.piket_porsi_cukup),
    piket_kualitas: kualitas,
    piket_gizi: gizi.join(','),
    piket_catatan: String((payload && payload.piket_catatan) || ''),
    piket_at: new Date()
  };
}

/**
 * Catat realisasi harian. Payload:
 * {pesanan_id, porsi_diterima, jml_taruna_makan, ketidaksesuaian?, tindak_lanjut?,
 *  geotag_lat, geotag_lng, berkas?, piket_nit?, piket_menu_sesuai?, piket_porsi_cukup?,
 *  piket_kualitas?, piket_gizi?, piket_catatan?}  — berkas = foto dokumentasi (jenis FOTO);
 *  piket_* opsional (lihat _piketKolom_), TIDAK memengaruhi bukti ttd/foto/geotag.
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
  Object.assign(obj, _piketKolom_(payload));
  sheetAppend(SHEETS.REALISASI, obj);

  // Foto close-up (kualitas) — dipertahankan sebagai `berkas` demi kompatibel
  // dengan payload lama. Foto wide-shot (kuantitas porsi, Fitur E) opsional
  // di `berkas_wide` — baris LAMPIRAN kedua, TIDAK perlu kolom/skema baru
  // (LAMPIRAN memang sudah mendukung banyak baris per ref_id).
  if (payload.berkas && payload.berkas.base64) {
    lampiranSave(session, 'REALISASI', obj.real_id, 'FOTO',
      payload.berkas.base64, payload.berkas.nama_file || (obj.real_id + '-closeup.jpg'));
  }
  if (payload.berkas_wide && payload.berkas_wide.base64) {
    lampiranSave(session, 'REALISASI', obj.real_id, 'FOTO',
      payload.berkas_wide.base64, payload.berkas_wide.nama_file || (obj.real_id + '-wide.jpg'));
  }
  auditLog(session, 'realisasi.create', 'REALISASI', obj.real_id, null, {
    pesanan_id: p.pesanan_id, tanggal: obj.tanggal,
    porsi_diterima: obj.porsi_diterima, jml_taruna_makan: obj.jml_taruna_makan,
    piket_nit: obj.piket_nit
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
