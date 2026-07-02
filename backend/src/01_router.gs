/**
 * 01_router.gs — Titik masuk Web App (doPost/doGet)
 *
 * Diisi pada TAHAP 2. Akan memuat:
 * - doPost(e)  : parse {action, token, payload} → ACTION_MAP {action:{handler,roles[]}}
 *                → validasi token & role → handler(payload, session)
 *                → amplop seragam {ok:true,data} / {ok:false,error} (ContentService JSON)
 * - doGet(e)   : health check → {ok:true, data:{app:'e-BAMA', version}}
 * - ACTION_MAP : tabel routing seluruh endpoint (didaftarkan bertahap per modul)
 * - Error handler global: error tak terduga → AUDIT_LOG aksi ERROR,
 *                balas {ok:false, error:'Terjadi kesalahan server'} (tanpa stack trace)
 *
 * CATATAN CORS: frontend mengirim POST Content-Type text/plain berisi JSON
 * agar GAS tidak memicu preflight; balasan berupa JSON polos.
 */
