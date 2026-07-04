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
    sheetRead(SHEETS.SP2D_MONITORING).forEach(function (r) { adaNoSpm[String(r.no_spm)] = true; });
    var tarunaValid = {};
    sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaValid[String(t.nit)] = true; });

    var ditambah = 0, dilewati = 0;
    baris.forEach(function (b) {
      var noSpm = String((b && b.no_spm) || '').trim();
      if (!noSpm) throw _fail_('no_spm wajib diisi pada setiap baris.');
      if (adaNoSpm[noSpm]) { dilewati++; return; } // sudah pernah masuk — lewati (hanya penambahan)

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
      adaNoSpm[noSpm] = true;
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

  var sp2dBulan = sheetRead(SHEETS.SP2D_MONITORING, function (r) { return String(r.bulan) === bulan; });
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
