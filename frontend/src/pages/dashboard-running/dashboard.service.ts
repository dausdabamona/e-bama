// dashboard.service.ts — pembungkus tipis di atas action dashboard.running.
//
// CATATAN KONVENSI: pola "file service" ini BARU di frontend e-BAMA — seluruh
// halaman lain (rekap.tsx, kokpit-ppk.tsx, dst.) memanggil api()/useListCache()
// langsung di komponen tanpa lapisan service terpisah. Dibuat sesuai
// permintaan eksplisit (nama file + method persis ditentukan) — bukan
// mengganti pola project, hanya menambah satu file baru yang berdiri sendiri.
import { api } from '../../lib/api';
import type { RunningDashboard } from './tipe';

/**
 * Ambil data Dashboard Rekap Bulan Berjalan untuk satu bulan+tahun.
 * Tipis — tidak menambah logika, hanya memanggil action `dashboard.running`
 * (backend/src/27_dashboard.gs) dengan tipe hasil yang sudah dideklarasikan.
 */
export function getRunningDashboard(bulan: number, tahun: number): Promise<RunningDashboard> {
  return api<RunningDashboard>('dashboard.running', { bulan, tahun });
}
