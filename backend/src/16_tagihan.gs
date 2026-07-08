/**
 * 16_tagihan.gs — Piutang gagal debet rekening taruna
 * Status: TERTAGIH → LUNAS | DIHAPUSKAN | ESKALASI_MANUAL
 *
 * ACTION: tagihan.create (Senat, PPK), tagihan.list (semua login),
 *         tagihan.summary (PPK, KPA), tagihan.setor (Senat/Pembina/Admin/PPK),
 *         tagihan.verifikasi (Senat/Pembina/Admin/PPK — verifikasi 1 & 2),
 *         tagihan.waive (PPK), tagihan.teruskan_penyedia (Senat/Pembina/Admin/PPK
 *         — tandai batch LUNAS yang dananya sudah diteruskan ke penyedia,
 *         TERPISAH dari jalur SP2D/SPM)
 *
 * nominal = SNAPSHOT dari REKAP_BULANAN FINAL. tagihan_id = TGH-{yyyymm}-{nit}.
 * Level SP aktif TIDAK disimpan — dibaca MAX(level) dari SURAT_PERINGATAN.
 * tagihan.create LANGSUNG menerbitkan SP-1.
 *
 * Pelunasan verifikasi GANDA (dikonfirmasi Firdaus, direvisi): siapa pun di
 * antara 4 role (Senat/Pembina/Admin/PPK) boleh mengunggah bukti (`tagihan.setor`)
 * MAUPUN memverifikasi (`tagihan.verifikasi`) — bukan alur berurutan per-peran
 * lagi. Syaratnya cuma satu: dua verifikasi harus berasal dari DUA ORANG
 * BERBEDA (user_id), peran boleh sama (mis. dua staf Pembina berbeda orang
 * tetap sah). Verifikator kedua memicu LUNAS + menghapus SP yang tgl_terbit-nya
 * lebih baru dari tgl_setor (taruna sudah bayar sebelum SP itu terbit — SP tak
 * berdasar). Kolom sheet `verif_pembina_oleh` (nama lama) kini menyimpan
 * verifikator PERTAMA generik — lihat docs/skema-sheet.md §10.
 * Setiap aksi tulis → withLock + auditLog + invalidasi cache.
 */

var _CACHE_TAGIHAN_ = 'tagihan_join_v1';

/** Hapus cache daftar tagihan (dipanggil setiap aksi tulis tagihan/SP). */
function _tagihanCacheClear_() {
  CacheService.getScriptCache().remove(_CACHE_TAGIHAN_);
}

/** Ambil tagihan by id atau error. */
function _tagihan_(id) {
  var t = sheetRead(SHEETS.TAGIHAN, function (r) { return String(r.tagihan_id) === String(id); })[0];
  if (!t) throw _fail_('Tagihan tidak ditemukan: ' + id);
  return t;
}

/** Join tagihan + level_aktif/tenggat_aktif dari SURAT_PERINGATAN (cache 60 detik). */
function _tagihanJoin_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(_CACHE_TAGIHAN_);
  if (hit) return JSON.parse(hit);

  var spPerTagihan = {};
  sheetRead(SHEETS.SURAT_PERINGATAN).forEach(function (s) {
    var key = String(s.tagihan_id);
    var lv = Number(s.level) || 0;
    if (!spPerTagihan[key] || lv > spPerTagihan[key].level) {
      spPerTagihan[key] = { level: lv, tenggat: _tglStr_(s.tenggat) };
    }
  });

  var rows = sheetRead(SHEETS.TAGIHAN).map(function (t) {
    var sp = spPerTagihan[String(t.tagihan_id)];
    var bukti = lampiranList('TAGIHAN', t.tagihan_id).filter(function (l) { return l.jenis === 'BUKTI_SETOR'; })[0];
    var nominal = Number(t.nominal) || 0;
    var nilaiTransfer = Number(t.nilai_transfer) || 0;
    return {
      tagihan_id: t.tagihan_id, bulan: _bulanStr_(t.bulan), nit: t.nit,
      nominal: nominal, sebab: t.sebab, status: t.status,
      tgl_setor: _tglStr_(t.tgl_setor), diverifikasi_oleh: t.diverifikasi_oleh,
      catatan_hapus: t.catatan_hapus,
      // Nama kolom sheet `verif_pembina_oleh` legacy — di JSON diekspos generik
      // sebagai verif_1_oleh (verifikator PERTAMA, bisa peran apa saja).
      verif_1_oleh: String(t.verif_pembina_oleh || ''),
      verif_2_oleh: String(t.verif_2_oleh || ''),
      nilai_transfer: nilaiTransfer,
      // Selisih (nominal - nilai_transfer) — DIHITUNG, bukan disimpan. >0 =
      // kurang bayar, dipakai frontend bandingkan dgn kebijakan.toleransiSelisihTransfer
      // dari tagihanList() (lihat getKebijakanTagihan, 00_config.gs).
      selisih_transfer: nominal - nilaiTransfer,
      bukti_setor_drive_file_id: bukti ? bukti.drive_file_id : '',
      level_aktif: sp ? sp.level : 0,
      tenggat_aktif: sp ? sp.tenggat : '',
      // Penerusan dana LUNAS ke penyedia — TERPISAH dari SP2D/SPM (jalur
      // pembayaran utama). Uang tagih-ulang gagal debet ini dikumpulkan di
      // rekening Senat lalu diteruskan manual (biasanya per-batch); kosong =
      // belum diteruskan (lihat tagihan.teruskan_penyedia).
      tgl_diteruskan_penyedia: _tglStr_(t.tgl_diteruskan_penyedia)
    };
  });
  try { cache.put(_CACHE_TAGIHAN_, JSON.stringify(rows), 60); } catch (e) { /* cache >100KB → lewati */ }
  return rows;
}

/**
 * Catat gagal debet batch: {bulan, nit: [], sebab}.
 * Syarat rekap FINAL; nominal snapshot; tolak duplikat; SP-1 langsung terbit.
 */
function tagihanCreate(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');
  var daftar = (payload && payload.nit) || [];
  if (!daftar.length) throw _fail_('nit harus berupa daftar minimal 1 taruna.');
  var sebab = String((payload && payload.sebab) || '');
  if (ENUM.TAGIHAN_SEBAB.indexOf(sebab) < 0) {
    throw _fail_('sebab harus salah satu: ' + ENUM.TAGIHAN_SEBAB.join(' / '));
  }

  var rekap = sheetRead(SHEETS.REKAP_BULANAN, function (r) { return _bulanStr_(r.bulan) === bulan; });
  if (!rekap.length) throw _fail_('Belum ada rekap untuk bulan ' + bulan + '.');
  var rekapNit = {};
  rekap.forEach(function (r) {
    // Angka beku HANYA saat FINAL (PPK finalkan, langkah terakhir). DISETUJUI_WADIR3
    // kini langkah AWAL (angka belum beku) → tidak lagi dianggap dasar nominal beku.
    if (r.status !== 'FINAL') {
      throw _fail_('Rekap bulan ' + bulan + ' belum FINAL — tagihan butuh dasar nominal beku (PPK finalkan dulu).');
    }
    rekapNit[String(r.nit)] = r;
  });

  var yyyymm = bulan.replace('-', '');
  var hasil = [];
  daftar.forEach(function (nitRaw) {
    var nit = String(nitRaw).trim();
    var r = rekapNit[nit];
    if (!r) throw _fail_('Taruna ' + nit + ' tidak ada di rekap bulan ' + bulan + '.');
    var id = 'TGH-' + yyyymm + '-' + nit;
    var dobel = sheetRead(SHEETS.TAGIHAN, function (x) { return String(x.tagihan_id) === id; })[0];
    if (dobel) throw _fail_('Tagihan sudah ada: ' + id + ' (duplikat bulan+nit ditolak).');

    var obj = {
      tagihan_id: id, bulan: bulan, nit: nit,
      nominal: _int_(r.nominal, 'nominal'),  // SNAPSHOT dari rekap FINAL
      sebab: sebab, status: 'TERTAGIH',
      tgl_setor: '', diverifikasi_oleh: '', catatan_hapus: ''
    };
    sheetAppend(SHEETS.TAGIHAN, obj);
    auditLog(session, 'tagihan.create', 'TAGIHAN', id, null,
      { bulan: bulan, nit: nit, nominal: obj.nominal, sebab: sebab });

    // SP-1 terbit saat tagihan dicatat (lewati bila sudah ada — aman diulang)
    var adaSp1 = sheetRead(SHEETS.SURAT_PERINGATAN, function (s) {
      return String(s.tagihan_id) === id && Number(s.level) === 1;
    })[0];
    var sp = adaSp1 ? { sp_id: adaSp1.sp_id, no_surat: adaSp1.no_surat }
                    : spTerbitkan(id, 1, session);
    hasil.push({ tagihan_id: id, nominal: obj.nominal, sp1: sp });
  });

  _tagihanCacheClear_();
  return { tagihan: hasil };
}

/**
 * Daftar tagihan + level_aktif + tenggat_aktif + selisih_transfer. Filter
 * {bulan?, status?}. `kebijakan` disertakan supaya frontend bisa menandai
 * tagihan LUNAS dgn selisih_transfer di atas toleransi sebagai piutang
 * kurang bayar (dikonfirmasi Firdaus — lihat getKebijakanTagihan).
 */
function tagihanList(payload, session) {
  var f = payload || {};
  var rows = _tagihanJoin_().filter(function (t) {
    if (f.bulan && t.bulan !== f.bulan) return false;
    if (f.status && t.status !== f.status) return false;
    return true;
  });
  return { tagihan: rows, kebijakan: getKebijakanTagihan() };
}

/**
 * Dashboard piutang: {per_level: {0..3:{jumlah,nominal}}, total_outstanding,
 * belum_disetor, sudah_disetor_menunggu_verifikasi_1, verifikasi_1x,
 * lunas_belum_diteruskan, lunas_sudah_diteruskan, eskalasi_manual}.
 *
 * `per_level` HANYA tagihan TERTAGIH (SP-1/2/3 murni, masih dalam proses SP
 * normal) — TIDAK termasuk ESKALASI_MANUAL (dipisah, lihat di bawah), supaya
 * semantiknya jelas: per_level = masih diproses lewat SP, eskalasi_manual =
 * sudah keluar dari proses SP (penanganan di luar sistem).
 *
 * Tiap tagihan TERTAGIH jatuh ke TEPAT SATU dari tiga bucket berikut
 * (dikonfirmasi Firdaus, urutan tahap):
 * - `belum_disetor` = TERTAGIH, dana BELUM masuk rekening Senat sama sekali
 *   (`tgl_setor` kosong) — tahap PALING AWAL.
 * - `sudah_disetor_menunggu_verifikasi_1` = dana SUDAH MASUK ke rekening
 *   Senat (`tgl_setor` terisi) tapi BELUM disentuh verifikator sama sekali.
 * - `verifikasi_1x` = sudah lolos verifikator PERTAMA, tinggal menunggu
 *   verifikator KEDUA (yang memicu LUNAS).
 * `lunas_belum_diteruskan` = dana taruna yang SUDAH lunas ditagih tapi BELUM
 * diteruskan ke penyedia — inilah angka "utang Poltek ke penyedia" dari
 * jalur tagih-ulang ini (terpisah dari SP2D/SPM), lihat tagihan.teruskan_penyedia.
 * `eskalasi_manual` = tagihan yang sudah lewat tenggat SP-3 dan ditandai
 * `eskalasiTagihan()` (20_trigger.gs) — piutang PALING telat/berisiko,
 * penanganan di luar sistem (sanksi akademik/pemanggilan). Nominalnya TETAP
 * masuk `total_outstanding` (belum lunas) walau dipisah dari `per_level`.
 *
 * Cross-check (dokumentasi, BUKAN assert runtime): karena tiap tagihan
 * TERTAGIH jatuh ke tepat satu dari 3 bucket tahap di atas, dan tiap tagihan
 * ESKALASI_MANUAL jatuh ke `eskalasi_manual` saja, maka SELALU berlaku:
 *   belum_disetor.jumlah + sudah_disetor_menunggu_verifikasi_1.jumlah
 *     + verifikasi_1x.jumlah + eskalasi_manual.jumlah
 *   === per_level[0].jumlah + per_level[1].jumlah + per_level[2].jumlah
 *     + per_level[3].jumlah + eskalasi_manual.jumlah
 * — PPK bisa cross-check jumlah ini tanpa buka daftar detail.
 */
function tagihanSummary(payload, session) {
  var per = { 0: { jumlah: 0, nominal: 0 }, 1: { jumlah: 0, nominal: 0 },
              2: { jumlah: 0, nominal: 0 }, 3: { jumlah: 0, nominal: 0 } };
  var total = 0;
  var belumDisetor = { jumlah: 0, nominal: 0 };
  var sudahDisetorMenungguVerif1 = { jumlah: 0, nominal: 0 };
  var verif1 = { jumlah: 0, nominal: 0 };
  var lunasBelumDiteruskan = { jumlah: 0, nominal: 0 };
  var lunasSudahDiteruskan = { jumlah: 0, nominal: 0 };
  var eskalasiManual = { jumlah: 0, nominal: 0 };

  _tagihanJoin_().forEach(function (t) {
    if (t.status === 'TERTAGIH') {
      var lv = Math.min(Math.max(t.level_aktif, 0), 3);
      per[lv].jumlah++; per[lv].nominal += t.nominal;
      total += t.nominal;
      if (t.verif_1_oleh) {
        verif1.jumlah++; verif1.nominal += t.nominal;
      } else if (t.tgl_setor) {
        sudahDisetorMenungguVerif1.jumlah++; sudahDisetorMenungguVerif1.nominal += t.nominal;
      } else {
        belumDisetor.jumlah++; belumDisetor.nominal += t.nominal;
      }
    } else if (t.status === 'ESKALASI_MANUAL') {
      total += t.nominal;
      eskalasiManual.jumlah++; eskalasiManual.nominal += t.nominal;
    } else if (t.status === 'LUNAS') {
      var nilai = t.nilai_transfer || t.nominal;
      if (t.tgl_diteruskan_penyedia) { lunasSudahDiteruskan.jumlah++; lunasSudahDiteruskan.nominal += nilai; }
      else { lunasBelumDiteruskan.jumlah++; lunasBelumDiteruskan.nominal += nilai; }
    }
  });

  return {
    per_level: per, total_outstanding: total,
    belum_disetor: belumDisetor,
    sudah_disetor_menunggu_verifikasi_1: sudahDisetorMenungguVerif1,
    verifikasi_1x: verif1, lunas_belum_diteruskan: lunasBelumDiteruskan, lunas_sudah_diteruskan: lunasSudahDiteruskan,
    eskalasi_manual: eskalasiManual
  };
}

/**
 * tagihan.teruskan_penyedia {tagihan_id_list:[], berkas:{base64,nama_file}}
 * — tandai tagihan LUNAS yang dananya SUDAH diteruskan dari rekening Senat
 * ke penyedia. TERPISAH dari SP2D/SPM (jalur pembayaran utama LS) — ini
 * khusus dana hasil tagih-ulang gagal debet, biasanya diteruskan sekaligus
 * per-batch (mis. akhir bulan). Bukti transfer WAJIB, satu lampiran
 * ditautkan ke entri PERTAMA (pola sama seperti statusBatch,
 * 11_status_harian.gs) — bukan satu bukti per taruna.
 * Role sama seperti aksi tagihan lain (Senat/Pembina/Admin/PPK).
 */
function tagihanTeruskanPenyedia(payload, session) {
  var daftar = (payload && payload.tagihan_id_list) || [];
  if (!daftar.length) throw _fail_('tagihan_id_list wajib diisi minimal 1.');
  if (!payload.berkas || !payload.berkas.base64) throw _fail_('Bukti transfer ke penyedia wajib dilampirkan (berkas.base64).');

  return withLock(function () {
    var baris = daftar.map(function (id) { return _tagihan_(id); });
    var invalid = baris.filter(function (t) {
      return t.status !== 'LUNAS' || _tglStr_(t.tgl_diteruskan_penyedia);
    });
    if (invalid.length) {
      throw _fail_('Hanya tagihan berstatus LUNAS dan belum pernah diteruskan yang bisa dipilih — cek ulang: ' +
        invalid.map(function (t) { return t.tagihan_id; }).join(', '));
    }

    var tgl = _todayStr_();
    var total = 0;
    baris.forEach(function (t) {
      sheetUpdate(SHEETS.TAGIHAN, 'tagihan_id', t.tagihan_id, { tgl_diteruskan_penyedia: tgl });
      auditLog(session, 'tagihan.teruskan_penyedia', 'TAGIHAN', t.tagihan_id,
        { tgl_diteruskan_penyedia: '' }, { tgl_diteruskan_penyedia: tgl });
      total += Number(t.nilai_transfer) || Number(t.nominal) || 0;
    });
    lampiranSave(session, 'TAGIHAN', baris[0].tagihan_id, 'BUKTI_TERUSKAN_PENYEDIA',
      payload.berkas.base64, payload.berkas.nama_file || ('teruskan-penyedia-' + tgl + '.jpg'));
    _tagihanCacheClear_();
    return { jml_diteruskan: baris.length, total_nominal: total, tgl_diteruskan_penyedia: tgl };
  });
}

/**
 * Lapor setoran/transfer ke rekening Senat: {tagihan_id, tgl_setor, berkas}
 * — bukti (screenshot/foto transfer) WAJIB, status tetap TERTAGIH. Role
 * SENAT/PEMBINA/ADMIN/PPK (dikonfirmasi Firdaus — keempatnya boleh unggah).
 */
function tagihanSetor(payload, session) {
  var t = _tagihan_(payload && payload.tagihan_id);
  if (t.status !== 'TERTAGIH') throw _fail_('Tagihan berstatus ' + t.status + ', tidak menerima setoran.');
  var tgl = _wajibTgl_(payload && payload.tgl_setor, 'tgl_setor');
  if (!payload.berkas || !payload.berkas.base64) throw _fail_('Bukti setor wajib dilampirkan (berkas.base64).');

  lampiranSave(session, 'TAGIHAN', t.tagihan_id, 'BUKTI_SETOR',
    payload.berkas.base64, payload.berkas.nama_file || ('setor-' + t.tagihan_id + '.jpg'));
  sheetUpdate(SHEETS.TAGIHAN, 'tagihan_id', t.tagihan_id, { tgl_setor: tgl });
  auditLog(session, 'tagihan.setor', 'TAGIHAN', t.tagihan_id, null, { tgl_setor: tgl });
  _tagihanCacheClear_();
  return { tagihan_id: t.tagihan_id, tgl_setor: tgl, status: 'TERTAGIH' };
}

/**
 * Verifikasi pelunasan {tagihan_id, nilai_transfer} — siapa pun di antara
 * SENAT/PEMBINA/ADMIN/PPK (dikonfirmasi Firdaus, direvisi dari alur
 * berurutan Pembina→PPK/Admin: sekarang peran bebas, yang wajib cuma DUA
 * ORANG BERBEDA — dua staf Pembina berlainan orang pun sah). Tanda sudah
 * diverifikasi ADALAH memasukkan `nilai_transfer` (nominal yang ia lihat
 * BENAR-BENAR masuk ke rekening Senat, dibaca dari mutasi bank).
 *
 * `nilai_transfer` TIDAK WAJIB sama dengan `nominal` tagihan (dikonfirmasi
 * Firdaus, direvisi dari validasi ketat sebelumnya) — dunia nyata sering beda
 * (potongan biaya transfer antarbank, taruna kurang bayar, dst). `nominal`
 * tagihan (snapshot REKAP_BULANAN FINAL) TETAP TIDAK BERUBAH untuk keperluan
 * pelaporan; `nilai_transfer` cuma mencatat realisasi transfer sesungguhnya
 * — selisihnya tetap terlihat di data untuk rekonsiliasi, TIDAK memblokir
 * pelunasan. Satu-satunya syarat nilai: harus > 0 (bilangan bulat).
 *
 * Selisih (nominal - nilai_transfer) di ATAS `getKebijakanTagihan().
 * toleransiSelisihTransfer` (default Rp20.000, dikonfirmasi Firdaus) TETAP
 * memicu LUNAS seperti biasa, TAPI dicatat sebagai `piutang_kurang_bayar` di
 * AUDIT_LOG saat verifikasi kedua — jejak utk PPK menagih sisanya pada
 * pendebetan bulan berikutnya (proses tagih ulang tetap manual via
 * `tagihan.create` bulan depan, TIDAK otomatis — nominal tagihan baru wajib
 * berbasis REKAP_BULANAN FINAL bulan itu, yang belum ada saat ini).
 *
 * Verifikasi PERTAMA: catat sebagai verifikator 1 — kolom sheet lama
 * `verif_pembina_oleh` kini generik (lihat docs/skema-sheet.md §10), status
 * TETAP TERTAGIH. Verifikasi KEDUA — user_id WAJIB beda dari verifikator
 * pertama — memicu LUNAS.
 *
 * Efek samping WAJIB saat LUNAS: SP mana pun milik tagihan ini yang
 * `tgl_terbit` LEBIH BARU dari `tgl_setor` (taruna sudah bayar SEBELUM SP
 * itu terbit → SP jadi tak berdasar) DIHAPUS dari SURAT_PERINGATAN (bukan
 * cuma diabaikan), supaya riwayat SP tidak menyesatkan. SP yang terbit
 * PADA/SEBELUM tgl_setor tetap dipertahankan (riwayat sah, taruna memang telat).
 */
function tagihanVerifikasi(payload, session) {
  var t = _tagihan_(payload && payload.tagihan_id);
  if (t.status !== 'TERTAGIH') throw _fail_('Tagihan berstatus ' + t.status + ', tidak bisa diverifikasi.');
  var bukti = lampiranList('TAGIHAN', t.tagihan_id).filter(function (l) { return l.jenis === 'BUKTI_SETOR'; });
  if (!bukti.length) throw _fail_('Belum ada bukti setor — verifikasi ditolak.');

  var nilai = _int_(payload && payload.nilai_transfer, 'nilai_transfer');
  if (nilai <= 0) throw _fail_('Nilai transferan harus lebih dari 0.');

  var v1 = String(t.verif_pembina_oleh || '').trim();
  if (!v1) {
    sheetUpdate(SHEETS.TAGIHAN, 'tagihan_id', t.tagihan_id,
      { verif_pembina_oleh: session.user_id, nilai_transfer: nilai });
    auditLog(session, 'tagihan.verifikasi', 'TAGIHAN', t.tagihan_id,
      { verif_1_oleh: '' }, { verif_1_oleh: session.user_id, nilai_transfer: nilai });
    _tagihanCacheClear_();
    return { tagihan_id: t.tagihan_id, status: 'TERTAGIH', verif_ke: 1, verif_1_oleh: session.user_id };
  }
  if (v1 === session.user_id) {
    throw _fail_('Anda sudah memverifikasi tagihan ini sebagai verifikator pertama — perlu orang KEDUA yang berbeda untuk memicu LUNAS.');
  }

  sheetUpdate(SHEETS.TAGIHAN, 'tagihan_id', t.tagihan_id,
    { verif_2_oleh: session.user_id, nilai_transfer: nilai, status: 'LUNAS', diverifikasi_oleh: session.user_id });

  var idHapus = [];
  var tglBayar = _tglStr_(t.tgl_setor);
  if (tglBayar) {
    var spSemua = sheetRead(SHEETS.SURAT_PERINGATAN, function (s) { return String(s.tagihan_id) === String(t.tagihan_id); });
    idHapus = spSemua.filter(function (s) { return _tglStr_(s.tgl_terbit) > tglBayar; }).map(function (s) { return s.sp_id; });
    if (idHapus.length) sheetDeleteRows(SHEETS.SURAT_PERINGATAN, 'sp_id', idHapus);
  }

  // Selisih (kurang bayar) di atas toleransi → catat di AUDIT_LOG sebagai jejak
  // piutang yang perlu ditagihkan lagi pada pendebetan bulan depan (dikonfirmasi
  // Firdaus) — TIDAK memblokir LUNAS, cuma jejak; nilai aktualnya tetap terbaca
  // dari selisih_transfer (nominal - nilai_transfer) di tagihan.list.
  var selisih = Number(t.nominal) - nilai;
  var piutangKurang = selisih > getKebijakanTagihan().toleransiSelisihTransfer ? selisih : 0;

  auditLog(session, 'tagihan.verifikasi', 'TAGIHAN', t.tagihan_id,
    { status: t.status },
    { status: 'LUNAS', verif_2_oleh: session.user_id, sp_dihapus: idHapus, piutang_kurang_bayar: piutangKurang });
  _tagihanCacheClear_();
  return {
    tagihan_id: t.tagihan_id, status: 'LUNAS', verif_ke: 2, verif_2_oleh: session.user_id,
    sp_dihapus: idHapus, piutang_kurang_bayar: piutangKurang
  };
}

/**
 * tagihan.status_debet {bulan} — laporan status debet taruna→Senat PER
 * TARUNA, READ-ONLY. Membandingkan seluruh taruna ber-REKAP nominal>0
 * bulan itu (dasar permohonan debet, sama seperti cetakForm07) dengan
 * baris TAGIHAN bulan yang sama.
 *
 * Taruna TANPA baris TAGIHAN → `BERHASIL` — ini INFERENSI (absennya
 * kegagalan tercatat), BUKAN konfirmasi positif dari bank; sistem memang
 * tidak punya integrasi bank utk mengonfirmasi sukses secara aktif (lihat
 * catatan modul). Taruna BER-TAGIHAN → `GAGAL`, apa pun status
 * penyelesaiannya (`status_tagihan`: TERTAGIH/LUNAS/DIHAPUSKAN/
 * ESKALASI_MANUAL tetap dihitung "gagal debet awal" — penyelesaiannya
 * ditampilkan terpisah, tidak mengubah status_debet jadi BERHASIL lagi).
 */
function tagihanStatusDebet(payload, session) {
  var bulan = _wajibBulan_(payload && payload.bulan, 'bulan');

  var rekap = sheetRead(SHEETS.REKAP_BULANAN, function (r) {
    return _bulanStr_(r.bulan) === bulan && _int_(r.nominal || 0, 'nominal') > 0;
  });
  if (!rekap.length) throw _fail_('Belum ada rekap bernominal untuk bulan ' + bulan + '.');

  var tarunaByNit = {};
  sheetRead(SHEETS.TARUNA).forEach(function (t) { tarunaByNit[String(t.nit)] = t; });

  var tagihanByNit = {};
  _tagihanJoin_().filter(function (t) { return t.bulan === bulan; })
    .forEach(function (t) { tagihanByNit[String(t.nit)] = t; });

  var baris = rekap.map(function (r) {
    var nit = String(r.nit);
    var t = tarunaByNit[nit] || {};
    var tg = tagihanByNit[nit];
    return {
      nit: nit, nama: t.nama || '', prodi: t.prodi || '', tingkat: t.tingkat || '',
      nominal: _int_(r.nominal, 'nominal'),
      status_debet: tg ? 'GAGAL' : 'BERHASIL',
      tagihan_id: tg ? tg.tagihan_id : '',
      sebab: tg ? tg.sebab : '',
      status_tagihan: tg ? tg.status : ''
    };
  }).sort(function (a, b) {
    return (a.prodi || '').localeCompare(b.prodi || '') || (a.tingkat || '').localeCompare(b.tingkat || '') ||
      (a.nama || '').localeCompare(b.nama || '');
  });

  var jmlGagal = baris.filter(function (b) { return b.status_debet === 'GAGAL'; }).length;
  return {
    bulan: bulan, baris: baris,
    total_taruna: baris.length, jml_berhasil: baris.length - jmlGagal, jml_gagal: jmlGagal
  };
}

/** PPK hapus tagihan: catatan_hapus WAJIB → DIHAPUSKAN. */
function tagihanWaive(payload, session) {
  var t = _tagihan_(payload && payload.tagihan_id);
  if (t.status !== 'TERTAGIH') throw _fail_('Tagihan berstatus ' + t.status + ', tidak bisa dihapuskan.');
  var catatan = String((payload && payload.catatan_hapus) || '').trim();
  if (!catatan) throw _fail_('catatan_hapus WAJIB diisi untuk penghapusan tagihan.');

  sheetUpdate(SHEETS.TAGIHAN, 'tagihan_id', t.tagihan_id,
    { status: 'DIHAPUSKAN', catatan_hapus: catatan });
  auditLog(session, 'tagihan.waive', 'TAGIHAN', t.tagihan_id,
    { status: t.status }, { status: 'DIHAPUSKAN', catatan_hapus: catatan });
  _tagihanCacheClear_();
  return { tagihan_id: t.tagihan_id, status: 'DIHAPUSKAN' };
}
