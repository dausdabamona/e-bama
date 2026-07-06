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
 * pesananOtomatis21() — Fitur D: dijalankan trigger harian jam 21.00 WIT.
 * Target tanggal D = BESOK (tgl_makan berikutnya). Bila BELUM ada PESANAN
 * (manual/Pembina/sistem, status ≠ DIKEMBALIKAN) untuk D → buat otomatis:
 * `jml_taruna` = SALIN PERSIS dari PESANAN valid TERAKHIR sebelum D
 * (dikonfirmasi Firdaus — BUKAN dihitung ulang dari TARUNA/STATUS_HARIAN,
 * demi kesederhanaan; REALISASI tetap jadi titik verifikasi sebenarnya di
 * hilir, lihat docs/uji-terima.md §H). `menu` dirakit dari MENU_KONTRAK
 * (Malam D + Pagi/Siang D+1, pola sama seperti pesanan.create/
 * pesanan.pembina_kirim). status LANGSUNG `TERKIRIM` (melewati verifikasi
 * Pembina) — `created_by`/`verif_by` = 'SISTEM'.
 *
 * SAKLAR LIBUR (`getLiburAutoPesanan`, 00_config.gs): bila D masuk rentang
 * libur aktif → SKIP total (tidak membuat apa pun), dicatat AUDIT_LOG.
 * Tanpa PESANAN prior sama sekali → SKIP + AUDIT_LOG (butuh pesanan manual
 * pertama) — "notifikasi" via Audit Log karena aplikasi ini belum punya
 * infrastruktur push/email; PPK/Admin diharapkan memeriksa Audit Log secara
 * berkala (lihat catatan sama di pesanan.pembina_kirim, 12_pesanan.gs).
 *
 * IDEMPOTEN: aman dijalankan berkali-kali sehari (cek `existing` dulu,
 * tidak pernah menimpa/duplikasi). Dibungkus withLock — cek dobel + tulis
 * harus atomik (bisa berbarengan dengan pesanan.create/pembina_kirim manual
 * yang kebetulan jalan di jam yang sama).
 */
function pesananOtomatis21() {
  return withLock(function () {
    var d = _tambahHari_(_todayStr_(), 1);
    var hasil = { tanggal: d, dibuat: false, alasan: '' };

    if (_tanggalLiburAutoPesanan_(d)) {
      hasil.alasan = 'Tanggal ' + d + ' termasuk rentang libur (saklar libur aktif) — dilewati.';
      auditLog(null, 'pesanan.otomatis_lewati', 'PESANAN', null, null, { tanggal: d, alasan: hasil.alasan });
      Logger.log('pesananOtomatis21: ' + hasil.alasan);
      return hasil;
    }

    var existing = sheetRead(SHEETS.PESANAN, function (r) {
      return _tglStr_(r.tgl_makan) === d && r.status !== 'DIKEMBALIKAN';
    })[0];
    if (existing) {
      hasil.alasan = 'Pesanan ' + d + ' sudah ada (' + existing.pesanan_id + ', status ' + existing.status + ') — tidak dibuat ulang.';
      Logger.log('pesananOtomatis21: ' + hasil.alasan);
      return hasil;
    }

    var prior = sheetRead(SHEETS.PESANAN, function (r) {
      return r.status !== 'DIKEMBALIKAN' && _tglStr_(r.tgl_makan) < d;
    }).sort(function (a, b) { return _tglStr_(b.tgl_makan).localeCompare(_tglStr_(a.tgl_makan)); })[0];

    if (!prior) {
      hasil.alasan = 'Tidak ada histori PESANAN sebelumnya — butuh pesanan manual pertama, dilewati.';
      auditLog(null, 'pesanan.otomatis_lewati', 'PESANAN', null, null, { tanggal: d, alasan: hasil.alasan });
      Logger.log('pesananOtomatis21: ' + hasil.alasan);
      return hasil;
    }

    var kontrak;
    try {
      kontrak = _kontrakAktifPada_(d);
    } catch (e) {
      hasil.alasan = 'Tidak ada kontrak aktif untuk ' + d + ' — dilewati.';
      auditLog(null, 'pesanan.otomatis_lewati', 'PESANAN', null, null, { tanggal: d, alasan: hasil.alasan });
      Logger.log('pesananOtomatis21: ' + hasil.alasan);
      return hasil;
    }

    var hariMalam = _hariDalamMinggu_(d);
    var hariPagiSiang = _hariDalamMinggu_(_tambahHari_(d, 1));
    var menuHari = sheetRead(SHEETS.MENU_KONTRAK, function (r) { return String(r.kontrak_id) === String(kontrak.kontrak_id); });
    var menuMalamRow = menuHari.filter(function (r) { return r.hari === hariMalam; })[0];
    var menuPagiSiangRow = menuHari.filter(function (r) { return r.hari === hariPagiSiang; })[0];
    var barisMenu = [];
    if (menuMalamRow && menuMalamRow.menu_malam) barisMenu.push(hariMalam + ' Malam: ' + menuMalamRow.menu_malam);
    if (menuPagiSiangRow && menuPagiSiangRow.menu_pagi) barisMenu.push(hariPagiSiang + ' Pagi: ' + menuPagiSiangRow.menu_pagi);
    if (menuPagiSiangRow && menuPagiSiangRow.menu_siang) barisMenu.push(hariPagiSiang + ' Siang: ' + menuPagiSiangRow.menu_siang);

    var obj = {
      pesanan_id: nextId('PSN'),
      tgl_makan: d,
      kontrak_id: kontrak.kontrak_id,
      jml_taruna: _int_(prior.jml_taruna, 'jml_taruna'), // SALIN PERSIS — bukan hitung ulang
      menu: barisMenu.join('\n'),
      catatan: 'Pesanan otomatis 21:00 — belum diverifikasi Pembina',
      status: 'TERKIRIM',
      created_by: 'SISTEM', verif_by: 'SISTEM', verif_at: new Date(), revisi_dari: ''
    };
    sheetAppend(SHEETS.PESANAN, obj);
    auditLog(null, 'pesanan.otomatis', 'PESANAN', obj.pesanan_id, null,
      { tanggal: d, jml_taruna: obj.jml_taruna, disalin_dari: prior.pesanan_id, kontrak_id: kontrak.kontrak_id });
    Logger.log('pesananOtomatis21: dibuat ' + obj.pesanan_id + ' untuk ' + d +
      ' (jml_taruna=' + obj.jml_taruna + ', disalin dari ' + prior.pesanan_id + ').');

    hasil.dibuat = true;
    hasil.pesanan_id = obj.pesanan_id;
    return hasil;
  });
}

/**
 * Pasang trigger time-driven harian pesananOtomatis21() jam 21.00
 * (Asia/Jayapura). Menghapus trigger lama fungsi yang sama dulu (tidak dobel).
 */
function pasangTriggerPesananOtomatis() {
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === 'pesananOtomatis21') ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger('pesananOtomatis21')
    .timeBased().everyDays(1).atHour(21)
    .create();
  Logger.log('Trigger pesananOtomatis21 terpasang: harian jam 21.00 (Asia/Jayapura).');
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
