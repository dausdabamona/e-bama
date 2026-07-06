/**
 * 10_taruna.gs — Master data taruna
 *
 * ACTION: taruna.list (semua login), taruna.upsert (Admin)
 *
 * rek_mask HANYA 4 digit terakhir (••••1234) — nomor rekening lengkap
 * DILARANG masuk sistem (validasi _mask4_ menolak >4 digit angka).
 * Setiap aksi tulis → withLock + auditLog.
 */

/** Daftar taruna, filter opsional {status?, prodi?, tingkat?, kelas?}. */
function tarunaList(payload, session) {
  var f = payload || {};
  var rows = sheetRead(SHEETS.TARUNA, function (r) {
    if (f.status && String(r.status) !== String(f.status)) return false;
    if (f.prodi && String(r.prodi) !== String(f.prodi)) return false;
    if (f.tingkat && String(r.tingkat) !== String(f.tingkat)) return false;
    if (f.kelas && String(r.kelas) !== String(f.kelas)) return false;
    return true;
  });
  return { taruna: rows };
}

/** Tambah/ubah taruna (kunci: nit). */
function tarunaUpsert(payload, session) {
  var nit = String((payload && payload.nit) || '').trim();
  if (!nit) throw _fail_('nit wajib diisi.');
  var nama = String((payload && payload.nama) || '').trim();
  if (!nama) throw _fail_('nama wajib diisi.');
  var bank = String((payload && payload.bank) || '').trim();
  if (ENUM.BANK.indexOf(bank) < 0) throw _fail_('bank harus salah satu: ' + ENUM.BANK.join(' / '));
  var status = (payload && payload.status) ? String(payload.status) : 'AKTIF';
  if (ENUM.AKTIF_STATUS.indexOf(status) < 0) throw _fail_('status tidak valid.');

  var obj = {
    nama: nama,
    prodi: String((payload && payload.prodi) || ''),
    tingkat: String((payload && payload.tingkat) || ''),
    kelas: String((payload && payload.kelas) || ''),
    bank: bank,
    rek_mask: _mask4_(payload.rek_mask, 'rek_mask'),
    status: status
  };

  var lama = sheetRead(SHEETS.TARUNA, function (r) { return String(r.nit) === nit; })[0];
  if (lama) {
    sheetUpdate(SHEETS.TARUNA, 'nit', nit, obj);
    auditLog(session, 'taruna.upsert', 'TARUNA', nit, lama, obj);
  } else {
    obj.nit = nit;
    sheetAppend(SHEETS.TARUNA, obj);
    auditLog(session, 'taruna.upsert', 'TARUNA', nit, null, obj);
  }
  obj.nit = nit;
  return { taruna: obj };
}
