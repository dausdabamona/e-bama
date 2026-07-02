/**
 * 20_trigger.gs — Trigger terjadwal (eskalasi SP harian + backup mingguan)
 *
 * Diisi pada TAHAP 4B (eskalasi) & TAHAP 8 (backup). Akan memuat:
 * - eskalasiTagihan()  : untuk tiap TAGIHAN TERTAGIH, level_aktif=MAX(level) SP;
 *                  bila today > tenggat SP aktif:
 *                    level 1 → spTerbitkan(2); level 2 → spTerbitkan(3);
 *                    level 3 → status ESKALASI_MANUAL + auditLog (penanganan luar sistem)
 *                  IDEMPOTEN: sudah ada SP level target → lewati (tidak dobel)
 * - pasangTrigger()    : hapus trigger lama, pasang time-driven harian jam CONFIG.SP.JAM_TRIGGER (WIT)
 * - buatTemplateSP()   : sekali jalan — buat 3 Google Doc template SP + simpan ID ke Script Properties
 * - backupMingguan()   : (TAHAP 8) copy spreadsheet ke folder e-BAMA/BACKUP mingguan
 */
