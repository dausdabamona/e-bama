/**
 * 12_pesanan.gs — Pesanan makan Pre-Order H-1 (SOP no. 5–7)
 * Mesin status: DRAFT → DIAJUKAN → (DIKEMBALIKAN | DISETUJUI) → TERKIRIM
 *
 * Catatan koreksi: PPK TIDAK menyetujui pesanan harian — PPK menyetujui
 * REKAP_BULANAN (lihat 14_rekap.gs). Pembina adalah satu-satunya verifikator
 * pesanan sebelum dikirim ke penyedia.
 *
 * ACTION: pesanan.list, pesanan.get (semua login),
 *         pesanan.create/submit/kirim/revisi (Senat),
 *         pesanan.verify/return (Pembina)
 *
 * jml_taruna = SNAPSHOT (taruna AKTIF − STATUS_HARIAN tgl tsb); koreksi manual
 * wajib catatan. Transisi ilegal → error eksplisit.
 * Setiap aksi tulis → withLock + auditLog.
 */

/** Ambil pesanan by id atau error. */
function _pesanan_(id) {
  var p = sheetRead(SHEETS.PESANAN, function (r) { return String(r.pesanan_id) === String(id); })[0];
  if (!p) throw _fail_('Pesanan tidak ditemukan: ' + id);
  return p;
}

/** Hitung otomatis jml_taruna utk tanggal: taruna AKTIF − yang berstatus harian. */
function _hitungJmlTaruna_(tanggal) {
  var aktif = {};
  sheetRead(SHEETS.TARUNA, function (r) { return r.status === 'AKTIF'; })
    .forEach(function (r) { aktif[String(r.nit)] = true; });
  var tidakMakan = {};
  sheetRead(SHEETS.STATUS_HARIAN, function (r) { return _tglStr_(r.tanggal) === tanggal; })
    .forEach(function (r) { if (aktif[String(r.nit)]) tidakMakan[String(r.nit)] = true; });
  return Object.keys(aktif).length - Object.keys(tidakMakan).length;
}

/**
 * _pesananAnomali_(p) — Fitur "Verifikasi by-Exception" (1a): bandingkan
 * pesanan `p` dgn most-recent prior PESANAN non-DIKEMBALIKAN (tgl_makan lebih
 * awal) utk menentukan RUTIN vs ANOMALI. Anomali bila SALAH SATU:
 *  - |jml_taruna - jml_kemarin| > ambangSelisih (kebijakan; default 0);
 *  - catatan terisi (jml_taruna di-override manual dari angka otomatis);
 *  - STATUS_HARIAN tgl itu berubah sejak snapshot (recompute _hitungJmlTaruna_
 *    sekarang ≠ p.jml_taruna, TANPA catatan yg menjelaskan bedanya).
 * Tanpa pesanan pembanding sama sekali (pertama kali) → dianggap ANOMALI
 * (butuh mata Pembina, bukan diloloskan diam-diam krn tak ada dasar bandingan).
 * Murni baca — tidak mengubah data, aman dipanggil berkali-kali.
 */
function _pesananAnomali_(p) {
  var tgl = _tglStr_(p.tgl_makan);
  var jml = _int_(p.jml_taruna, 'jml_taruna');
  var catatan = String(p.catatan || '').trim();
  var kebijakan = getKebijakanVerifikasi();

  var prior = sheetRead(SHEETS.PESANAN, function (r) {
    return String(r.pesanan_id) !== String(p.pesanan_id) && r.status !== 'DIKEMBALIKAN' && _tglStr_(r.tgl_makan) < tgl;
  }).sort(function (a, b) { return _tglStr_(b.tgl_makan).localeCompare(_tglStr_(a.tgl_makan)); })[0];
  var jmlKemarin = prior ? _int_(prior.jml_taruna, 'jml_taruna') : null;
  var selisih = (jmlKemarin === null) ? null : (jml - jmlKemarin);

  var jmlAutoSaatIni = _hitungJmlTaruna_(tgl);
  var statusBerubah = !catatan && jmlAutoSaatIni !== jml;

  var alasan = [];
  var label;
  if (jmlKemarin === null) {
    alasan.push('Tidak ada pesanan sebelumnya untuk dibandingkan');
    label = 'TIDAK ADA PEMBANDING';
  } else if (selisih === 0) {
    label = 'SAMA';
  } else {
    label = (selisih > 0 ? 'NAIK +' : 'TURUN -') + Math.abs(selisih);
    if (Math.abs(selisih) > kebijakan.ambangSelisih) {
      alasan.push(label + ' dari kemarin (' + jmlKemarin + ')');
    }
  }
  if (catatan) {
    alasan.push('Override manual: ' + catatan);
    label = 'OVERRIDE MANUAL';
  }
  if (statusBerubah) {
    alasan.push('STATUS_HARIAN berubah sejak snapshot (hitung ulang=' + jmlAutoSaatIni + ', tercatat=' + jml + ')');
    label = 'STATUS BERUBAH';
  }

  return {
    anomali: jmlKemarin === null || alasan.length > 0,
    label: label,
    jml_kemarin: jmlKemarin,
    selisih: selisih,
    jml_auto_saat_ini: jmlAutoSaatIni,
    alasan: alasan.join('; ')
  };
}

/** Daftar pesanan, filter {bulan?}. */
function pesananList(payload, session) {
  var bulan = payload && payload.bulan;
  var rows = sheetRead(SHEETS.PESANAN, function (r) {
    return !bulan || _bulanStr_(r.tgl_makan) === bulan;
  });
  rows.forEach(function (r) { r.tgl_makan = _tglStr_(r.tgl_makan); });
  return { pesanan: rows };
}

/**
 * Antrian verifikasi Pembina + info anomali per pesanan (1d). Hanya baris
 * DIAJUKAN. Bila `autoLolosRutin` aktif, antrian ini SECARA ALAMI hanya
 * berisi pesanan ANOMALI (yang rutin sudah auto-lolos di pesanan.submit) —
 * bila nonaktif, berisi SEMUA (rutin+anomali) dengan label masing-masing,
 * dipakai UI utk menampilkan delta vs kemarin & tombol "Setujui semua yang
 * rutin" (pesanan.bulk_approve_rutin).
 */
function pesananAntrianVerifikasi(payload, session) {
  var kebijakan = getKebijakanVerifikasi();
  var diajukan = sheetRead(SHEETS.PESANAN, function (r) { return r.status === 'DIAJUKAN'; });
  var antrian = diajukan.map(function (p) {
    var a = _pesananAnomali_(p);
    var salin = {};
    Object.keys(p).forEach(function (k) { salin[k] = p[k]; });
    salin.tgl_makan = _tglStr_(p.tgl_makan);
    salin.anomali = a.anomali;
    salin.label = a.label;
    salin.alasan = a.alasan;
    salin.jml_kemarin = a.jml_kemarin;
    salin.selisih = a.selisih;
    return salin;
  }).sort(function (x, y) { return String(x.tgl_makan).localeCompare(String(y.tgl_makan)); });
  return { kebijakan: { autoLolosRutin: !!kebijakan.autoLolosRutin }, antrian: antrian };
}

/** Detail pesanan + lampiran. */
function pesananGet(payload, session) {
  var p = _pesanan_(payload && payload.pesanan_id);
  p.tgl_makan = _tglStr_(p.tgl_makan);
  return { pesanan: p, lampiran: lampiranList('PESANAN', p.pesanan_id) };
}

/**
 * pesanan.surat_penyedia {pesanan_id | tgl_makan} — bahan cetak "Surat Pesanan
 * Makan" untuk PENYEDIA/katering, READ-ONLY, TANPA rupiah apa pun (beda dari
 * Form-01 yang untuk internal & memuat harga — lihat catatan modul cetak).
 *
 * Komposisi pengantaran & rakitan menu SAMA PERSIS dengan logika frontend saat
 * pesanan.create (komposisiPesanan, pesanan-buat.tsx): Malam hari-D + Pagi &
 * Siang hari D+1, dari MENU_KONTRAK kontrak_id pesanan itu.
 *
 * Jumlah porsi per kelompok DITURUNKAN ulang dari TARUNA(AKTIF) − STATUS_HARIAN
 * tanggal itu (subset sama seperti _hitungJmlTaruna_) — TAPI angka yang
 * MENGIKAT tetap `PESANAN.jml_taruna` (snapshot 📸, bisa dikoreksi manual PPK/
 * Senat dgn catatan). Bila derivasi ≠ snapshot, `selisih_derivasi` diisi
 * (BUKAN didiamkan) supaya penyedia & pencetak sama-sama tahu ada koreksi
 * manual, tapi baris TOTAL yang dicetak tetap angka mengikat.
 */
function pesananSuratPenyedia(payload, session) {
  var p = (payload && payload.pesanan_id)
    ? _pesanan_(payload.pesanan_id)
    : sheetRead(SHEETS.PESANAN, function (r) {
        return _tglStr_(r.tgl_makan) === _wajibTgl_(payload && payload.tgl_makan, 'tgl_makan');
      })[0];
  if (!p) throw _fail_('Pesanan tidak ditemukan.');
  var tgl = _tglStr_(p.tgl_makan);

  var hariMalam = _hariDalamMinggu_(tgl);
  var hariPagiSiang = _hariDalamMinggu_(_tambahHari_(tgl, 1));
  var menuHari = sheetRead(SHEETS.MENU_KONTRAK, function (r) { return String(r.kontrak_id) === String(p.kontrak_id); });
  var menuMalamRow = menuHari.filter(function (r) { return r.hari === hariMalam; })[0];
  var menuPagiSiangRow = menuHari.filter(function (r) { return r.hari === hariPagiSiang; })[0];

  var tidakMakan = {};
  sheetRead(SHEETS.STATUS_HARIAN, function (r) { return _tglStr_(r.tanggal) === tgl; })
    .forEach(function (r) { tidakMakan[String(r.nit)] = true; });

  var kelompok = {};
  sheetRead(SHEETS.TARUNA, function (r) { return r.status === 'AKTIF' && !tidakMakan[String(r.nit)]; })
    .forEach(function (t) {
      var kunci = (t.prodi || '') + '|' + (t.tingkat || '');
      if (!kelompok[kunci]) kelompok[kunci] = { prodi: t.prodi || '', tingkat: t.tingkat || '', jml: 0 };
      kelompok[kunci].jml++;
    });
  var porsiPerKelompok = Object.keys(kelompok).map(function (k) { return kelompok[k]; })
    .sort(function (a, b) { return a.prodi.localeCompare(b.prodi) || a.tingkat.localeCompare(b.tingkat); });
  var totalDerivasi = porsiPerKelompok.reduce(function (s, k) { return s + k.jml; }, 0);
  var totalMengikat = _int_(p.jml_taruna, 'jml_taruna');

  return {
    pesanan_id: p.pesanan_id, tgl_makan: tgl,
    komposisi: {
      malam: { hari: hariMalam }, pagi: { hari: hariPagiSiang }, siang: { hari: hariPagiSiang }
    },
    menu: {
      malam: menuMalamRow ? String(menuMalamRow.menu_malam || '') : '',
      pagi: menuPagiSiangRow ? String(menuPagiSiangRow.menu_pagi || '') : '',
      siang: menuPagiSiangRow ? String(menuPagiSiangRow.menu_siang || '') : ''
    },
    porsi_per_kelompok: porsiPerKelompok,
    total: totalMengikat,
    total_derivasi: totalDerivasi,
    selisih_derivasi: totalMengikat - totalDerivasi,
    catatan: String(p.catatan || '')
  };
}

/** Buat pesanan DRAFT. Payload {tgl_makan, menu, jml_taruna?, catatan?}. */
function pesananCreate(payload, session) {
  var tgl = _wajibTgl_(payload && payload.tgl_makan, 'tgl_makan');
  var menu = String((payload && payload.menu) || '').trim();
  if (!menu) throw _fail_('menu wajib diisi.');

  // Satu pesanan per hari (DIKEMBALIKAN tidak menghalangi buat ulang)
  var dobel = sheetRead(SHEETS.PESANAN, function (r) {
    return _tglStr_(r.tgl_makan) === tgl && r.status !== 'DIKEMBALIKAN';
  })[0];
  if (dobel) throw _fail_('Sudah ada pesanan untuk ' + tgl + ' (' + dobel.pesanan_id + ', status ' + dobel.status + ').');

  var kontrak = _kontrakAktifPada_(tgl);
  var jmlAuto = _hitungJmlTaruna_(tgl);
  var jml = jmlAuto;
  var catatan = String((payload && payload.catatan) || '').trim();
  if (payload.jml_taruna !== undefined && payload.jml_taruna !== null && payload.jml_taruna !== '') {
    jml = _int_(payload.jml_taruna, 'jml_taruna');
    if (jml !== jmlAuto && !catatan) {
      throw _fail_('jml_taruna (' + jml + ') berbeda dari hitungan otomatis (' + jmlAuto + ') — catatan wajib diisi.');
    }
  }

  var obj = {
    pesanan_id: nextId('PSN'),
    tgl_makan: tgl,
    kontrak_id: kontrak.kontrak_id,
    jml_taruna: jml,             // SNAPSHOT — momen penulisan tercatat di AUDIT_LOG
    menu: menu,
    catatan: catatan,
    status: 'DRAFT',
    created_by: session.user_id,
    verif_by: '', verif_at: '', revisi_dari: ''
  };
  sheetAppend(SHEETS.PESANAN, obj);
  auditLog(session, 'pesanan.create', 'PESANAN', obj.pesanan_id, null,
    { tgl_makan: tgl, jml_taruna: jml, jml_otomatis: jmlAuto, kontrak_id: kontrak.kontrak_id });
  return { pesanan: obj, jml_otomatis: jmlAuto };
}

/**
 * pesanan.pembina_kirim {tgl_makan, menu, jml_taruna?} — Pembina membuat &
 * langsung mengajukan pesanan TANPA usulan Senat (dikonfirmasi Firdaus:
 * dipakai kalau Senat belum/tidak membuat pesanan). BEDA dari alur normal
 * (create→submit→verify→kirim, 4 langkah lintas 2 peran) — di sini SATU
 * langkah: created_by = verif_by = Pembina yang sama (maker-checker melebur,
 * terekam jelas di AUDIT_LOG untuk ditelusuri Itjen), status LANGSUNG
 * TERKIRIM. `catatan` WAJIB memuat frasa tetap di bawah — dipakai frontend
 * (pesanan-list.tsx) untuk menandai/"menotifikasi" Senat baris mana yang
 * dibuat tanpa sepengetahuan mereka (tanpa infrastruktur notifikasi
 * terpisah — aplikasi ini belum punya push/email).
 *
 * Kontrol pengganti (karena verifikasi Pembina-lain dilewati): REALISASI
 * tetap WAJIB ttd Pembina DAN Senat (dua pihak di hilir tidak berubah).
 *
 * Idempoten/precedence: PESANAN unik per tgl_makan. Bila SUDAH ada baris
 * (dari Senat/Pembina/Sistem) berstatus DRAFT/DIAJUKAN → EDIT baris itu
 * (bukan duplikat). Bila sudah DISETUJUI/TERKIRIM (alur normal sudah
 * berjalan) → TOLAK, Pembina tidak perlu/boleh menimpanya.
 */
var _CATATAN_PEMBINA_KIRIM_ = 'Dibuat & diajukan Pembina tanpa usulan Senat';

function pesananPembinaKirim(payload, session) {
  var tgl = _wajibTgl_(payload && payload.tgl_makan, 'tgl_makan');
  var menu = String((payload && payload.menu) || '').trim();
  if (!menu) throw _fail_('menu wajib diisi.');

  var existing = sheetRead(SHEETS.PESANAN, function (r) {
    return _tglStr_(r.tgl_makan) === tgl && r.status !== 'DIKEMBALIKAN';
  })[0];
  if (existing && (existing.status === 'DISETUJUI' || existing.status === 'TERKIRIM')) {
    throw _fail_('Pesanan ' + tgl + ' sudah berstatus ' + existing.status +
      ' (alur normal sudah berjalan) — tidak perlu/boleh dibuat ulang oleh Pembina.');
  }

  var jmlAuto = _hitungJmlTaruna_(tgl);
  var jml = jmlAuto;
  if (payload.jml_taruna !== undefined && payload.jml_taruna !== null && payload.jml_taruna !== '') {
    jml = _int_(payload.jml_taruna, 'jml_taruna');
  }

  if (existing) {
    var patch = {
      menu: menu, jml_taruna: jml, catatan: _CATATAN_PEMBINA_KIRIM_,
      status: 'TERKIRIM', created_by: session.user_id,
      verif_by: session.user_id, verif_at: new Date()
    };
    sheetUpdate(SHEETS.PESANAN, 'pesanan_id', existing.pesanan_id, patch);
    auditLog(session, 'pesanan.pembina_kirim', 'PESANAN', existing.pesanan_id,
      { status: existing.status, created_by: existing.created_by }, patch);
    return { pesanan_id: existing.pesanan_id, status: 'TERKIRIM', jml_otomatis: jmlAuto };
  }

  var kontrak = _kontrakAktifPada_(tgl);
  var obj = {
    pesanan_id: nextId('PSN'),
    tgl_makan: tgl,
    kontrak_id: kontrak.kontrak_id,
    jml_taruna: jml,
    menu: menu,
    catatan: _CATATAN_PEMBINA_KIRIM_,
    status: 'TERKIRIM',
    created_by: session.user_id,
    verif_by: session.user_id, verif_at: new Date(), revisi_dari: ''
  };
  sheetAppend(SHEETS.PESANAN, obj);
  auditLog(session, 'pesanan.pembina_kirim', 'PESANAN', obj.pesanan_id, null,
    { tgl_makan: tgl, jml_taruna: jml, jml_otomatis: jmlAuto, kontrak_id: kontrak.kontrak_id });
  return { pesanan: obj, jml_otomatis: jmlAuto };
}

/** Transisi status generik dengan validasi. */
function _pesananTransisi_(session, id, dariStatus, keStatus, aksi, patchTambahan) {
  var p = _pesanan_(id);
  if (p.status !== dariStatus) {
    throw _fail_('Pesanan berstatus ' + p.status + ', tidak bisa ' + aksi + ' (butuh ' + dariStatus + ').');
  }
  var patch = { status: keStatus };
  if (patchTambahan) for (var k in patchTambahan) patch[k] = patchTambahan[k];
  sheetUpdate(SHEETS.PESANAN, 'pesanan_id', id, patch);
  auditLog(session, 'pesanan.' + aksi, 'PESANAN', id, { status: p.status }, patch);
  return p;
}

/**
 * Catatan tetap (sentinel, pola sama _CATATAN_PEMBINA_KIRIM_) yang menandai
 * pesanan RUTIN diloloskan otomatis — dipakai frontend (pesanan-list.tsx)
 * untuk label kartu, sama seperti Fitur F. TIDAK menimpa catatan override
 * manual manapun (kalau catatan sudah terisi, _pesananAnomali_ SELALU
 * menganggapnya ANOMALI, jadi jalur auto-lolos tak pernah tercapai —
 * catatan di sini dijamin kosong sebelum ditimpa).
 */
var _CATATAN_AUTO_LOLOS_ = 'Auto-lolos: rutin (sama dengan kemarin)';

/**
 * DRAFT → DIAJUKAN (hanya pembuat). Fitur "Verifikasi by-Exception" (1c):
 * bila kebijakan `autoLolosRutin` aktif (default) DAN pesanan ini RUTIN
 * (lihat _pesananAnomali_), langsung lanjutkan DIAJUKAN → TERKIRIM otomatis
 * (verif_by='SISTEM') — TIDAK menunggu antrian Pembina. Hanya pesanan
 * ANOMALI yang tetap di DIAJUKAN (masuk antrian verifikasi manual Pembina,
 * tak berubah). Bila `autoLolosRutin` mati, semua pesanan tetap di DIAJUKAN
 * seperti sebelumnya (Pembina bisa memakai pesanan.bulk_approve_rutin utk
 * meloloskan yang rutin secara massal).
 */
function pesananSubmit(payload, session) {
  var p = _pesanan_(payload && payload.pesanan_id);
  if (String(p.created_by) !== String(session.user_id)) {
    throw _fail_('Hanya pembuat pesanan yang boleh mengajukan.');
  }
  _pesananTransisi_(session, p.pesanan_id, 'DRAFT', 'DIAJUKAN', 'submit', null);

  var kebijakan = getKebijakanVerifikasi();
  if (kebijakan.autoLolosRutin) {
    var diajukan = _pesanan_(p.pesanan_id);
    var anomali = _pesananAnomali_(diajukan);
    if (!anomali.anomali) {
      sheetUpdate(SHEETS.PESANAN, 'pesanan_id', p.pesanan_id, {
        status: 'TERKIRIM', verif_by: 'SISTEM', verif_at: new Date(), catatan: _CATATAN_AUTO_LOLOS_
      });
      auditLog(null, 'pesanan.auto_lolos', 'PESANAN', p.pesanan_id,
        { status: 'DIAJUKAN' }, { status: 'TERKIRIM', verif_by: 'SISTEM', label: anomali.label });
      return { pesanan_id: p.pesanan_id, status: 'TERKIRIM', auto_lolos: true, label: anomali.label };
    }
  }
  return { pesanan_id: p.pesanan_id, status: 'DIAJUKAN', auto_lolos: false };
}

/**
 * Bulk-approve (Pembina): setujui SEMUA pesanan DIAJUKAN yang RUTIN
 * sekaligus — satu ketuk. Dipakai saat kebijakan `autoLolosRutin`=false
 * (semua pesanan tetap masuk antrian dulu, Pembina meloloskan yang rutin
 * secara massal alih-alih satu-satu). RUTIN/ANOMALI dihitung ULANG di
 * backend (tak percaya daftar dari klien) — anomali dilewati, tetap di
 * antrian manual. `verif_by` = Pembina yang mengeklik (BUKAN 'SISTEM' —
 * ini aksi manual, walau meloloskan banyak sekaligus).
 */
function pesananBulkApproveRutin(payload, session) {
  var daftarDiajukan = sheetRead(SHEETS.PESANAN, function (r) { return r.status === 'DIAJUKAN'; });
  var hasil = [];
  daftarDiajukan.forEach(function (p) {
    var anomali = _pesananAnomali_(p);
    if (anomali.anomali) return; // anomali → lewati, tetap di antrian manual
    sheetUpdate(SHEETS.PESANAN, 'pesanan_id', p.pesanan_id, {
      status: 'TERKIRIM', verif_by: session.user_id, verif_at: new Date()
    });
    auditLog(session, 'pesanan.bulk_approve_rutin', 'PESANAN', p.pesanan_id,
      { status: 'DIAJUKAN' }, { status: 'TERKIRIM', label: anomali.label });
    hasil.push({ pesanan_id: p.pesanan_id, label: anomali.label });
  });
  return { disetujui: hasil.length, detail: hasil };
}

/** DIAJUKAN → DISETUJUI (Pembina, SOP no. 6). */
function pesananVerify(payload, session) {
  var id = payload && payload.pesanan_id;
  _pesananTransisi_(session, id, 'DIAJUKAN', 'DISETUJUI', 'verify',
    { verif_by: session.user_id, verif_at: new Date() });
  return { pesanan_id: id, status: 'DISETUJUI' };
}

/** DIAJUKAN → DIKEMBALIKAN (Pembina, alasan wajib). */
function pesananReturn(payload, session) {
  var id = payload && payload.pesanan_id;
  var alasan = String((payload && payload.alasan) || '').trim();
  if (!alasan) throw _fail_('alasan pengembalian wajib diisi.');
  var p = _pesanan_(id);
  // Skema tidak punya kolom alasan tersendiri → catat di catatan + AUDIT_LOG
  var catatan = (p.catatan ? p.catatan + ' | ' : '') + 'DIKEMBALIKAN: ' + alasan;
  _pesananTransisi_(session, id, 'DIAJUKAN', 'DIKEMBALIKAN', 'return', { catatan: catatan });
  return { pesanan_id: id, status: 'DIKEMBALIKAN' };
}

/** DISETUJUI → TERKIRIM (Senat), hanya ≤ H-1 dari tgl_makan. */
function pesananKirim(payload, session) {
  var id = payload && payload.pesanan_id;
  var p = _pesanan_(id);
  if (_todayStr_() >= _tglStr_(p.tgl_makan)) {
    throw _fail_('Pengiriman hanya boleh H-1 atau lebih awal dari tgl_makan. ' +
      'Untuk perubahan setelah terkirim gunakan pesanan.revisi dengan BA perubahan.');
  }
  _pesananTransisi_(session, id, 'DISETUJUI', 'TERKIRIM', 'kirim', null);
  return { pesanan_id: id, status: 'TERKIRIM' };
}

/**
 * Revisi setelah TERKIRIM (SOP 7b): buat pesanan BARU ber-revisi_dari.
 * Payload {pesanan_id, menu?, jml_taruna?, catatan, berkas} — berkas BA WAJIB.
 */
function pesananRevisi(payload, session) {
  var asal = _pesanan_(payload && payload.pesanan_id);
  if (asal.status !== 'TERKIRIM') {
    throw _fail_('Revisi hanya untuk pesanan TERKIRIM (status sekarang: ' + asal.status + ').');
  }
  var catatan = String((payload && payload.catatan) || '').trim();
  if (!catatan) throw _fail_('catatan alasan revisi wajib diisi.');
  if (!payload.berkas || !payload.berkas.base64) {
    throw _fail_('Lampiran BA perubahan wajib disertakan (berkas.base64).');
  }

  var jml = (payload.jml_taruna !== undefined && payload.jml_taruna !== null && payload.jml_taruna !== '')
    ? _int_(payload.jml_taruna, 'jml_taruna') : asal.jml_taruna;

  var obj = {
    pesanan_id: nextId('PSN'),
    tgl_makan: _tglStr_(asal.tgl_makan),
    kontrak_id: asal.kontrak_id,
    jml_taruna: jml,
    menu: String((payload && payload.menu) || asal.menu),
    catatan: catatan,
    status: 'TERKIRIM', // revisi menggantikan pesanan terkirim, disahkan BA perubahan
    created_by: session.user_id,
    verif_by: '', verif_at: '',
    revisi_dari: asal.pesanan_id
  };
  sheetAppend(SHEETS.PESANAN, obj);
  lampiranSave(session, 'PESANAN', obj.pesanan_id, 'BA', payload.berkas.base64,
    payload.berkas.nama_file || ('BA-perubahan-' + obj.pesanan_id + '.pdf'));
  auditLog(session, 'pesanan.revisi', 'PESANAN', obj.pesanan_id,
    { revisi_dari: asal.pesanan_id, jml_lama: asal.jml_taruna },
    { jml_taruna: jml, menu: obj.menu });
  return { pesanan: obj };
}
