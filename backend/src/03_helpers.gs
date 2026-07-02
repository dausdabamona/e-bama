/**
 * 03_helpers.gs — Utilitas I/O sheet, lock, audit, lampiran (dipakai semua modul)
 *
 * Diisi pada TAHAP 2. Akan memuat:
 * - sheetRead(name, filterFn?)              : array objek (header snake_case → key)
 * - sheetAppend(name, obj)                  : WAJIB withLock()
 * - sheetUpdate(name, keyCol, keyVal, patch): WAJIB withLock()
 * - withLock(fn)                            : LockService script lock, wait 10 dtk, finally release
 * - auditLog(session, aksi, refType, refId, dataLama, dataBaru) : append-only, JSON.stringify
 * - lampiranSave(session, refType, refId, jenis, base64, namaFile)
 *                : decode → simpan ke FOLDER_LAMPIRAN → append LAMPIRAN → {lamp_id, drive_file_id}
 *                  (tolak file > 5 MB)
 * - lampiranList(refType, refId)
 * - nextId(prefix)                          : counter Script Properties, format PREFIX-000001
 */
