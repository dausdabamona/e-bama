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
