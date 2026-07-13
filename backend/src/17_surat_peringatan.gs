/**
 * 17_surat_peringatan.gs — Surat Peringatan SP-1/2/3 + generate PDF
 *
 * Kebijakan (tenggat, penandatangan) via getKebijakanSP() — DILARANG baca CONFIG langsung.
 * No surat: B-{urut}/PKPS/SP{level}/{bulan-romawi}/{tahun} — counter per level, tak pernah mundur.
 * PDF: copy template Doc (TPL_SP1/2/3 di Script Properties) → replace placeholder →
 *      export PDF ke FOLDER_SP → hapus copy → append SURAT_PERINGATAN + LAMPIRAN + AUDIT_LOG.
 *
 * ACTION: sp.list (semua login), tagihan.regenerate_sp (PPK)
 * INTERNAL: spTerbitkan(tagihanId, level, session|null)
 * SEKALI JALAN: buatTemplateSP() — buat 3 Doc template + simpan ID ke properties.
 */

var _BULAN_ID_ = ['Januari','Februari','Maret','April','Mei','Juni',
                  'Juli','Agustus','September','Oktober','November','Desember'];
var _ROMAWI_ = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];

/** Format 'Rp1.234.567'. */
function _rupiah_(n) {
  return 'Rp' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** '2026-07' → 'Juli 2026'; '2026-07-04' → '4 Juli 2026'. */
function _tglIndo_(s) {
  var t = _tglStr_(s);
  var p = t.split('-');
  if (p.length === 2) return _BULAN_ID_[Number(p[1]) - 1] + ' ' + p[0];
  return Number(p[2]) + ' ' + _BULAN_ID_[Number(p[1]) - 1] + ' ' + p[0];
}

/** Terbilang bilangan bulat Bahasa Indonesia (tanpa 'rupiah'). */
function terbilang(n) {
  n = Math.floor(Number(n) || 0);
  if (n === 0) return 'nol';
  var satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  function t(x) {
    if (x < 12) return satuan[x];
    if (x < 20) return t(x - 10) + ' belas';
    if (x < 100) return t(Math.floor(x / 10)) + ' puluh' + (x % 10 ? ' ' + t(x % 10) : '');
    if (x < 200) return 'seratus' + (x % 100 ? ' ' + t(x % 100) : '');
    if (x < 1000) return t(Math.floor(x / 100)) + ' ratus' + (x % 100 ? ' ' + t(x % 100) : '');
    if (x < 2000) return 'seribu' + (x % 1000 ? ' ' + t(x % 1000) : '');
    if (x < 1000000) return t(Math.floor(x / 1000)) + ' ribu' + (x % 1000 ? ' ' + t(x % 1000) : '');
    if (x < 1000000000) return t(Math.floor(x / 1000000)) + ' juta' + (x % 1000000 ? ' ' + t(x % 1000000) : '');
    return t(Math.floor(x / 1000000000)) + ' miliar' + (x % 1000000000 ? ' ' + t(x % 1000000000) : '');
  }
  return t(n);
}

/** Terbilang rupiah: 1234567 → 'satu juta dua ratus ... enam puluh tujuh rupiah'. */
function terbilangRupiah(n) { return terbilang(n) + ' rupiah'; }

/** Nomor surat: B-{urut}/PKPS/SP{level}/{romawi}/{tahun}. Counter per level. */
function _noSuratSP_(level) {
  var raw = nextId('NOSP' + level);                 // NOSP1-000007
  var urut = parseInt(raw.split('-')[1], 10);
  var now = new Date();
  var romawi = _ROMAWI_[now.getMonth()];
  return 'B-' + urut + '/PKPS/SP' + level + '/' + romawi + '/' + now.getFullYear();
}

/** Ganti satu placeholder {{KEY}} di body Doc. */
function _ganti_(body, key, val) {
  body.replaceText('\\{\\{' + key + '\\}\\}', String(val));
}

/**
 * Terbitkan SP level 1/2/3 untuk sebuah tagihan.
 * session null → generated_by SISTEM (trigger); selain itu MANUAL dicatat user.
 * Mengembalikan {sp_id, no_surat, tenggat, drive_file_id}.
 */
function spTerbitkan(tagihanId, level, session) {
  level = Number(level);
  if ([1, 2, 3].indexOf(level) < 0) throw _fail_('Level SP harus 1, 2, atau 3.');
  var t = _tagihan_(tagihanId);
  var taruna = sheetRead(SHEETS.TARUNA, function (r) { return String(r.nit) === String(t.nit); })[0];
  if (!taruna) throw _fail_('Taruna tidak ditemukan: ' + t.nit);

  var sp = getKebijakanSP();
  var p = PropertiesService.getScriptProperties();
  var tplId = p.getProperty('TPL_SP' + level);
  if (!tplId) throw _fail_('Template SP' + level + ' belum ada. Jalankan buatTemplateSP() sekali dari editor.');
  var folderSpId = p.getProperty('FOLDER_SP');
  if (!folderSpId) throw _fail_('FOLDER_SP belum ada. Jalankan setupFolderDrive().');

  var rolePenandatangan = sp.PENANDATANGAN[String(level)];     // 'PPK' | 'KPA'
  var pejabat = PEJABAT[rolePenandatangan];
  var noSurat = _noSuratSP_(level);
  var today = _todayStr_();
  var tenggat = _tglStr_(new Date(Date.now() + Number(sp.TENGGAT_HARI[String(level)]) * 86400000));
  var rekSenat = p.getProperty('REK_SENAT') || '(nomor rekening Senat — set Script Property REK_SENAT)';

  // ── Generate PDF dari template ────────────────────────────────────────────
  var namaFile = 'SP' + level + '_' + t.tagihan_id + '_' + today;
  var copy = DriveApp.getFileById(tplId).makeCopy(namaFile);
  var doc = DocumentApp.openById(copy.getId());
  var body = doc.getBody();
  _ganti_(body, 'NO_SURAT', noSurat);
  _ganti_(body, 'TGL_SURAT', _tglIndo_(today));
  _ganti_(body, 'NAMA', taruna.nama);
  _ganti_(body, 'NIT', taruna.nit);
  _ganti_(body, 'PRODI_TINGKAT', taruna.prodi + ' Tingkat ' + taruna.tingkat);
  _ganti_(body, 'BULAN', _tglIndo_(String(t.bulan)));
  _ganti_(body, 'NOMINAL', _rupiah_(t.nominal));
  _ganti_(body, 'NOMINAL_TERBILANG', terbilangRupiah(t.nominal));
  _ganti_(body, 'REK_SENAT', rekSenat);
  _ganti_(body, 'TENGGAT', _tglIndo_(tenggat));
  _ganti_(body, 'PENANDATANGAN_NAMA', pejabat.nama);
  _ganti_(body, 'PENANDATANGAN_NIP', pejabat.nip);
  doc.saveAndClose();

  var pdf = DriveApp.getFolderById(folderSpId)
    .createFile(copy.getAs('application/pdf')).setName(namaFile + '.pdf');
  copy.setTrashed(true); // hapus copy Doc, simpan PDF saja

  // ── Catat SURAT_PERINGATAN (append-only) + LAMPIRAN + AUDIT ───────────────
  var spId = nextId('SP');
  var generatedBy = session ? 'MANUAL' : 'SISTEM';
  sheetAppend(SHEETS.SURAT_PERINGATAN, {
    sp_id: spId, tagihan_id: t.tagihan_id, level: level, no_surat: noSurat,
    tgl_terbit: today, tenggat: tenggat,
    ditandatangani_oleh: rolePenandatangan, generated_by: generatedBy
  });
  sheetAppend(SHEETS.LAMPIRAN, {
    lamp_id: nextId('LMP'), ref_type: 'SP', ref_id: spId, jenis: 'SURAT',
    drive_file_id: pdf.getId(), nama_file: namaFile + '.pdf',
    uploaded_by: session ? session.user_id : 'SISTEM', timestamp: new Date()
  });
  auditLog(session, 'sp.terbit', 'SP', spId, null, {
    tagihan_id: t.tagihan_id, level: level, no_surat: noSurat,
    tenggat: tenggat, generated_by: generatedBy
  });
  _tagihanCacheClear_();
  return { sp_id: spId, no_surat: noSurat, tenggat: tenggat, drive_file_id: pdf.getId() };
}

/** Riwayat SP per tagihan (+ link PDF). */
function spList(payload, session) {
  var id = String((payload && payload.tagihan_id) || '').trim();
  if (!id) throw _fail_('tagihan_id wajib diisi.');
  var rows = sheetRead(SHEETS.SURAT_PERINGATAN, function (s) { return String(s.tagihan_id) === id; });
  rows.forEach(function (s) {
    s.tgl_terbit = _tglStr_(s.tgl_terbit);
    s.tenggat = _tglStr_(s.tenggat);
    var pdf = lampiranList('SP', s.sp_id)[0];
    s.drive_file_id = pdf ? pdf.drive_file_id : '';
  });
  return { sp: rows };
}

/** PPK: terbitkan ulang PDF level aktif — no_surat BARU, baris baru, MANUAL. */
function tagihanRegenerateSp(payload, session) {
  var t = _tagihan_(payload && payload.tagihan_id);
  var maxLevel = 0;
  sheetRead(SHEETS.SURAT_PERINGATAN, function (s) { return String(s.tagihan_id) === String(t.tagihan_id); })
    .forEach(function (s) { if (Number(s.level) > maxLevel) maxLevel = Number(s.level); });
  if (!maxLevel) throw _fail_('Tagihan ini belum punya SP — tidak ada yang bisa diterbitkan ulang.');
  var hasil = spTerbitkan(t.tagihan_id, maxLevel, session);
  return { sp: hasil, level: maxLevel };
}

/**
 * sp.cetak_massal {bulan?} — data untuk CETAK MASSAL surat SP-1 di aplikasi
 * (halaman React /cetak/sp1), READ-ONLY. Mengumpulkan tagihan TERTAGIH yang
 * level aktifnya masih SP-1, memakai NOMOR SURAT SP-1 yang SUDAH terbit di
 * SURAT_PERINGATAN (TIDAK membuat nomor baru — beda dari tagihan.regenerate_sp).
 * Frontend memfilter di layar (belum setor / semua) & mencetak sekaligus.
 * Surat SP hanya memuat nominal + rekening Senat (BUKAN rekening taruna), jadi
 * tanpa audit khusus & boleh di-cache (beda dari Form-07/08/10). Bila `bulan`
 * diisi, hanya bulan itu; kosong = semua bulan. Roles: PPK/STAF_PPK/ADMIN.
 */
function spCetakMassal(payload, session) {
  var bulanFilter = payload && payload.bulan ? _bulanStr_(payload.bulan) : '';

  // SP-1 per tagihan — kalau pernah diterbitkan ulang, ambil yang tgl_terbit
  // paling baru (no_surat terbaru yang sah).
  var sp1ByTagihan = {};
  sheetRead(SHEETS.SURAT_PERINGATAN, function (s) { return Number(s.level) === 1; })
    .forEach(function (s) {
      var id = String(s.tagihan_id);
      var tgl = _tglStr_(s.tgl_terbit);
      var ada = sp1ByTagihan[id];
      if (!ada || tgl >= ada.tgl_terbit) {
        sp1ByTagihan[id] = { no_surat: s.no_surat, tgl_terbit: tgl, tenggat: _tglStr_(s.tenggat) };
      }
    });

  var tarunaByNit = {};
  sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });

  var daftar = [];
  _tagihanJoin_().forEach(function (t) {
    if (t.status !== 'TERTAGIH' || t.level_aktif !== 1) return;   // hanya yg masih SP-1
    if (bulanFilter && t.bulan !== bulanFilter) return;
    var sp = sp1ByTagihan[String(t.tagihan_id)];
    if (!sp) return;                                              // belum ada SP-1 tercatat
    var tr = tarunaByNit[String(t.nit)] || {};
    daftar.push({
      nit: String(t.nit), nama: tr.nama || '', prodi: tr.prodi || '', tingkat: tr.tingkat || '',
      bulan: t.bulan, nominal: t.nominal,
      no_surat: sp.no_surat, tgl_terbit: sp.tgl_terbit, tenggat: sp.tenggat,
      sudah_setor: !!t.tgl_setor
    });
  });

  daftar.sort(function (a, b) {
    return (a.prodi || '').localeCompare(b.prodi || '') ||
           (a.tingkat || '').localeCompare(b.tingkat || '') ||
           (a.nama || '').localeCompare(b.nama || '');
  });

  var kb = getKebijakanSP();
  var pej = PEJABAT[kb.PENANDATANGAN['1']] || PEJABAT.PPK;
  // Rekening tujuan setor taruna = rekening Senat, SUMBER SAMA dgn Form-07/09
  // (getRekeningInstansi — bukan Script Property REK_SENAT lama yg tak pernah
  // diisi, itu sebabnya nomor rekening tak muncul di SP-1). Kedua bank
  // ditampilkan supaya taruna bisa setor ke bank mana pun.
  var rek = getRekeningInstansi();

  return {
    bulan_filter: bulanFilter,
    rekening_senat: rek.senat,             // {BNI, BSI}
    rekening_senat_nama: rek.senat_nama,   // {BNI, BSI}
    penandatangan: { nama: pej.nama, nip: pej.nip },
    daftar: daftar
  };
}

/**
 * SEKALI JALAN dari editor: buat 3 Google Doc template SP di FOLDER_TEMPLATE
 * berisi struktur surat + seluruh placeholder. Kop & redaksi dirapikan manual
 * oleh Firdaus di Doc — kop mengikuti tata naskah satker.
 * Idempotent: template yang sudah ada tidak dibuat ulang.
 */
function buatTemplateSP() {
  var p = PropertiesService.getScriptProperties();
  var folderId = p.getProperty('FOLDER_TEMPLATE');
  if (!folderId) throw new Error('FOLDER_TEMPLATE belum ada. Jalankan setupFolderDrive() dulu.');
  var folder = DriveApp.getFolderById(folderId);

  var judulLevel = {
    1: 'SURAT PERINGATAN PERTAMA (SP-1)',
    2: 'SURAT PERINGATAN KEDUA (SP-2)',
    3: 'SURAT PERINGATAN KETIGA (SP-3)'
  };

  [1, 2, 3].forEach(function (lv) {
    var key = 'TPL_SP' + lv;
    var adaId = p.getProperty(key);
    if (adaId) {
      try { DriveApp.getFileById(adaId); Logger.log(key + ' sudah ada, dilewati.'); return; }
      catch (e) { /* file terhapus → buat ulang */ }
    }
    var doc = DocumentApp.create('TEMPLATE_SP' + lv + '_e-BAMA');
    var body = doc.getBody();
    body.appendParagraph('[KOP SURAT SATKER — rapikan sesuai tata naskah]')
      .setHeading(DocumentApp.ParagraphHeading.NORMAL);
    body.appendParagraph('');
    body.appendParagraph(judulLevel[lv]).setHeading(DocumentApp.ParagraphHeading.HEADING2)
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    body.appendParagraph('Nomor: {{NO_SURAT}}').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    body.appendParagraph('');
    body.appendParagraph('Sorong, {{TGL_SURAT}}');
    body.appendParagraph('');
    body.appendParagraph('Kepada Yth.');
    body.appendParagraph('{{NAMA}} (NIT {{NIT}})');
    body.appendParagraph('{{PRODI_TINGKAT}}');
    body.appendParagraph('di tempat');
    body.appendParagraph('');
    body.appendParagraph('Berdasarkan hasil pemantauan pembayaran Bantuan Uang Makan (BAMA) ' +
      'bulan {{BULAN}}, tercatat kewajiban Saudara yang belum terselesaikan (gagal auto-debet) ' +
      'sebesar {{NOMINAL}} ({{NOMINAL_TERBILANG}}).');
    body.appendParagraph('');
    body.appendParagraph('Sehubungan dengan itu, Saudara diminta menyetorkan kewajiban tersebut ke ' +
      'rekening Senat {{REK_SENAT}} selambat-lambatnya tanggal {{TENGGAT}}.' +
      (lv === 3 ? ' Apabila hingga tenggat tersebut tidak diselesaikan, penanganan dilanjutkan ' +
      'di luar sistem sesuai ketentuan (sanksi akademik / pemanggilan).' : ''));
    body.appendParagraph('');
    body.appendParagraph('Demikian surat peringatan ini disampaikan untuk dilaksanakan.');
    body.appendParagraph('');
    body.appendParagraph('{{PENANDATANGAN_NAMA}}').setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
    body.appendParagraph('NIP {{PENANDATANGAN_NIP}}').setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
    doc.saveAndClose();

    // Pindahkan ke FOLDER_TEMPLATE
    var file = DriveApp.getFileById(doc.getId());
    file.moveTo(folder);
    p.setProperty(key, doc.getId());
    Logger.log(key + ' dibuat: ' + doc.getId());
  });
  Logger.log('buatTemplateSP() selesai — rapikan kop & redaksi langsung di Doc.');
}
