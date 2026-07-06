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
