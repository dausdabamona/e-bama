/**
 * 24_penyedia_portal.gs — Portal Penyedia (rekanan katering eksternal).
 *
 * SATU action baca (`penyedia.portal`) yang mengembalikan bundel data milik
 * SATU penyedia — di-scope ketat ke `session.penyedia_id`. Role PENYEDIA hanya
 * boleh memanggil action di allowlist `PENYEDIA_ACTIONS` (01_router.gs); di sini
 * `_hanyaPenyedia_(session)` menjadi pagar kedua (defense-in-depth).
 *
 * PRINSIP DATA SENSITIF (CLAUDE.md § 4): portal ini SENGAJA hanya memuat field
 * non-sensitif — TIDAK ADA data per-taruna (nama/NIT), TIDAK ADA rekening,
 * TIDAK ADA geotag realisasi, TIDAK ADA identitas staf internal (created_by/
 * verif_by/approved_by/uploaded_by). Yang keluar hanya: profil penyedia sendiri,
 * kontrak & menu miliknya, jumlah porsi (angka agregat) per pengantaran, ringkas
 * realisasi (porsi & ketidaksesuaian), dan status pembayaran miliknya.
 *
 * READ-ONLY → tanpa withLock/AUDIT_LOG (audit hanya untuk aksi tulis; portal ini
 * tidak menyentuh data sensitif seperti rekening.lihat_lengkap yang diaudit).
 *
 * BANTUAN MAKAN LUAR KAMPUS TIDAK DITAMPILKAN di portal (dipastikan Firdaus):
 * bantuan luar kampus (PKL/Magang/KPA/PTB) adalah transfer tunai LANGSUNG ke
 * rekening taruna, BUKAN lewat kontrak penyedia katering. Sheet-nya terpisah
 * (BANTUAN_LUAR_KAMPUS / SP2D_MONITORING) dan handler ini SENGAJA tidak
 * membacanya sama sekali — semua yang dikeluarkan hanya bertaut ke kontrak_id
 * milik penyedia (Dalam Kampus). Jangan menambah pembacaan sheet luar kampus.
 */

/** Batas bawah jadwal yang ditampilkan: hari ini − 7 hari (minggu lalu + mendatang). */
function _batasJadwalPenyedia_() {
  var d = new Date();
  d.setDate(d.getDate() - 7);
  return _tglStr_(d);
}

/**
 * penyedia.portal {} → bundel data milik session.penyedia_id:
 *   {penyedia, kontrak:[{...,menu:[],lampiran:[]}], pesanan:[], realisasi:[], pembayaran:[]}
 */
function penyediaPortal(payload, session) {
  var pid = _hanyaPenyedia_(session);

  var penyedia = sheetRead(SHEETS.PENYEDIA, function (r) { return String(r.penyedia_id) === pid; })[0];
  if (!penyedia) throw _fail_('Data penyedia tidak ditemukan.');

  // ── Kontrak milik penyedia ini + menu mingguan + lampiran (metadata saja) ──
  var kontrakRows = sheetRead(SHEETS.KONTRAK, function (r) { return String(r.penyedia_id) === pid; });
  var kontrakIds = {};
  kontrakRows.forEach(function (k) { kontrakIds[String(k.kontrak_id)] = true; });

  var kontrak = kontrakRows.map(function (k) {
    var menu = sheetRead(SHEETS.MENU_KONTRAK, function (r) { return String(r.kontrak_id) === String(k.kontrak_id); });
    menu.sort(function (a, b) { return ENUM.HARI.indexOf(a.hari) - ENUM.HARI.indexOf(b.hari); });
    return {
      kontrak_id: k.kontrak_id,
      harga_per_porsi: _int_(k.harga_per_porsi || 0, 'harga_per_porsi'),
      porsi_per_hari: _int_(k.porsi_per_hari || 0, 'porsi_per_hari'),
      tgl_mulai: _tglStr_(k.tgl_mulai),
      tgl_akhir: _tglStr_(k.tgl_akhir),
      status: k.status,
      menu: menu.map(function (m) {
        return { hari: m.hari, menu_pagi: m.menu_pagi, menu_siang: m.menu_siang, menu_malam: m.menu_malam };
      }),
      // lampiran: HANYA jenis & nama_file (tanpa drive_file_id/uploaded_by) — informasional.
      lampiran: lampiranList('KONTRAK', String(k.kontrak_id)).map(function (l) {
        return { jenis: l.jenis, nama_file: l.nama_file };
      })
    };
  });

  // ── Jadwal pengantaran: pesanan penyedia yang SUDAH final (DISETUJUI/TERKIRIM),
  //    tgl_makan ≥ (hari ini − 7). Pesanan DRAFT/DIAJUKAN/DIKEMBALIKAN belum boleh
  //    bocor ke penyedia (belum diverifikasi Pembina). Tanpa identitas staf. ──
  var batas = _batasJadwalPenyedia_();
  var pesanan = sheetRead(SHEETS.PESANAN, function (r) {
    return kontrakIds[String(r.kontrak_id)]
      && (r.status === 'DISETUJUI' || r.status === 'TERKIRIM')
      && _tglStr_(r.tgl_makan) >= batas;
  }).map(function (p) {
    return {
      tgl_makan: _tglStr_(p.tgl_makan),
      jml_taruna: _int_(p.jml_taruna || 0, 'jml_taruna'),
      menu: String(p.menu || ''),
      catatan: String(p.catatan || ''),
      status: p.status
    };
  });
  pesanan.sort(function (a, b) { return a.tgl_makan < b.tgl_makan ? -1 : 1; }); // terlama→terbaru (jadwal maju)

  // ── Ringkas realisasi: untuk pesanan milik penyedia. Tanpa geotag/ttd staf. ──
  var pesananPenyedia = {};
  sheetRead(SHEETS.PESANAN, function (r) { return kontrakIds[String(r.kontrak_id)]; })
    .forEach(function (p) { pesananPenyedia[String(p.pesanan_id)] = true; });
  var realisasi = sheetRead(SHEETS.REALISASI, function (r) { return pesananPenyedia[String(r.pesanan_id)]; })
    .map(function (r) {
      return {
        tanggal: _tglStr_(r.tanggal),
        porsi_diterima: _int_(r.porsi_diterima || 0, 'porsi_diterima'),
        jml_taruna_makan: _int_(r.jml_taruna_makan || 0, 'jml_taruna_makan'),
        ketidaksesuaian: String(r.ketidaksesuaian || ''),
        tindak_lanjut: String(r.tindak_lanjut || '')
      };
    });
  realisasi.sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : -1; }); // terbaru dulu

  // ── Status pembayaran miliknya (agregat per bulan/kontrak — bukan per taruna) ──
  var pembayaran = sheetRead(SHEETS.PEMBAYARAN, function (r) { return kontrakIds[String(r.kontrak_id)]; })
    .map(function (p) {
      return {
        bulan: _bulanStr_(p.bulan),
        nilai_total: _int_(p.nilai_total || 0, 'nilai_total'),
        no_spm: String(p.no_spm || ''),
        tgl_spm: p.tgl_spm ? _tglStr_(p.tgl_spm) : '',
        no_sp2d: String(p.no_sp2d || ''),
        tgl_sp2d: p.tgl_sp2d ? _tglStr_(p.tgl_sp2d) : '',
        status: p.status,
        invoice_dikonfirmasi: p.konfirmasi_senat_at ? true : false
      };
    });
  pembayaran.sort(function (a, b) { return a.bulan < b.bulan ? 1 : -1; }); // terbaru dulu

  return {
    penyedia: { nama: penyedia.nama, kontak: penyedia.kontak, alamat: penyedia.alamat, status: penyedia.status },
    kontrak: kontrak,
    pesanan: pesanan,
    realisasi: realisasi,
    pembayaran: pembayaran
  };
}
