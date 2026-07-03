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

/** Parse bulan dari "Bulan Mei 2026" atau "... 9 Maret 2026 s.d ..." → 'YYYY-MM' atau null. */
function _parseBulanUraian_(teks) {
  var namaBulan = Object.keys(_SP2D_BULAN_MAP_).join('|');
  var m = new RegExp('Bulan\\s+(' + namaBulan + ')\\s+(\\d{4})', 'i').exec(teks);
  if (m) return m[2] + '-' + ('0' + _SP2D_BULAN_MAP_[m[1].toLowerCase()]).slice(-2);
  m = new RegExp('(\\d{1,2})\\s+(' + namaBulan + ')\\s+(\\d{4})', 'i').exec(teks);
  if (m) return m[3] + '-' + ('0' + _SP2D_BULAN_MAP_[m[2].toLowerCase()]).slice(-2);
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
 * sp2d.import {kategori, baris:[{no_spm, tgl_spm?, no_sp2d?, tgl_sp2d?,
 * jumlah_pembayaran, status_sp2d?, uraian_asli}]} — HANYA MENAMBAH baris
 * dengan no_spm yang belum pernah ada (dikonfirmasi Firdaus: cek impor bulanan
 * hanya untuk penambahan, bukan mengulang proses semua riwayat).
 */
function sp2dImport(payload, session) {
  var kategori = payload && payload.kategori;
  if (ENUM.SP2D_KATEGORI.indexOf(kategori) < 0) throw _fail_('kategori tidak valid.');
  var baris = (payload && payload.baris) || [];
  if (!baris.length) throw _fail_('baris tidak boleh kosong.');

  return withLock(function () {
    var adaNoSpm = {};
    sheetRead(SHEETS.SP2D_MONITORING).forEach(function (r) { adaNoSpm[String(r.no_spm)] = true; });

    var ditambah = 0, dilewati = 0;
    baris.forEach(function (b) {
      var noSpm = String((b && b.no_spm) || '').trim();
      if (!noSpm) throw _fail_('no_spm wajib diisi pada setiap baris.');
      if (adaNoSpm[noSpm]) { dilewati++; return; } // sudah pernah masuk — lewati (hanya penambahan)

      var uraian = String((b && b.uraian_asli) || '');
      var hasil = _parseUraianSpm_(uraian, kategori);
      sheetAppend(SHEETS.SP2D_MONITORING, {
        no_spm: noSpm, kategori: kategori,
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

  // ── Dalam Kampus: REKAP_BULANAN × TARUNA, kelompok (prodi, tingkat) ──
  var rekapRows = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  var sistemDalam = _kelompokkanJumlah_(
    rekapRows.map(function (r) {
      var t = tarunaByNit[String(r.nit)] || {};
      return { kunci: (t.prodi || '?') + '|' + (t.tingkat || '?'), nominal: _int_(r.nominal || 0, 'nominal') };
    }),
    function (x) { return x.kunci; }, function (x) { return x.nominal; }
  );
  var sp2dDalam = _kelompokkanJumlah_(
    sp2dValid.filter(function (r) { return r.kategori === 'DALAM_KAMPUS'; }),
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

  // ── Luar Kampus: BANTUAN_LUAR_KAMPUS × TARUNA, kelompok (kegiatan, prodi, tingkat) ──
  var blkRows = sheetRead(SHEETS.BANTUAN_LUAR_KAMPUS, function (r) { return _bulanStr_(r.bulan) === bulan; });
  var sistemLuar = _kelompokkanJumlah_(
    blkRows.map(function (r) {
      var t = tarunaByNit[String(r.nit)] || {};
      return { kunci: r.kegiatan + '|' + (t.prodi || '?') + '|' + (t.tingkat || '?'), nominal: _int_(r.nominal || 0, 'nominal') };
    }),
    function (x) { return x.kunci; }, function (x) { return x.nominal; }
  );
  var sp2dLuar = _kelompokkanJumlah_(
    sp2dValid.filter(function (r) { return r.kategori === 'LUAR_KAMPUS'; }),
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

  return { bulan: bulan, dalam_kampus: dalamKampus, luar_kampus: luarKampus, perlu_cek_manual: perluCekManual };
}
