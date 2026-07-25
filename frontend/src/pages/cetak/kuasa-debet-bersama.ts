// Helper MURNI bersama untuk dokumen kuasa debet rekening taruna — dipakai
// Form-07 (usulan pemblokiran & pendebetan bank) & halaman "Taruna Keluar
// Kampus". Hanya fungsi/tipe murni + hook fetch tanpa-cache; TIDAK memuat
// komponen render spesifik (tiap halaman merender dokumennya sendiri).
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';

export interface BarisKuasaDebet {
  nit: string; nama: string; prodi: string; tingkat: string; bank: string; no_rekening_lengkap: string;
  nama_pemilik: string; nominal: number; nilai_debet: number; hari_makan: number; rekening_lengkap_ada: boolean;
}

const BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
/** '2026-07-08' → '8 Juli 2026'. */
export function tglIndo(s: string): string {
  const p = (s || '').split('-');
  if (p.length !== 3) return s || '';
  return `${Number(p[2])} ${BULAN_ID[Number(p[1]) - 1]} ${p[0]}`;
}
/** Tambah n hari ke tanggal 'YYYY-MM-DD' → 'YYYY-MM-DD'. */
export function tambahHari(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export const URUT_TINGKAT: Record<string, number> = { I: 1, II: 2, III: 3, '1': 1, '2': 2, '3': 3 };
export function urutBaris(a: BarisKuasaDebet, b: BarisKuasaDebet): number {
  return (URUT_TINGKAT[a.tingkat] ?? 9) - (URUT_TINGKAT[b.tingkat] ?? 9)
    || a.prodi.localeCompare(b.prodi) || a.nama.localeCompare(b.nama);
}
/** Kelompokkan baris per bank (urut BSI dulu, lalu BNI, lalu lainnya). */
export function kelompokBank(baris: BarisKuasaDebet[]): { bank: string; rows: BarisKuasaDebet[] }[] {
  const map = new Map<string, BarisKuasaDebet[]>();
  baris.forEach((b) => {
    const k = b.rekening_lengkap_ada ? b.bank : 'TANPA_REKENING';
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(b);
  });
  const urutBank = (k: string) => (k === 'BSI' ? 0 : k === 'BNI' ? 1 : k === 'TANPA_REKENING' ? 9 : 5);
  return Array.from(map.entries())
    .sort((x, y) => urutBank(x[0]) - urutBank(y[0]))
    .map(([bank, rows]) => ({ bank, rows: rows.slice().sort(urutBaris) }));
}
/** Sub-kelompokkan baris (dalam satu bank) per Prodi/Tingkat — utk subtotal per grup. */
export function kelompokProdiTingkat(rows: BarisKuasaDebet[]): { prodi: string; tingkat: string; rows: BarisKuasaDebet[] }[] {
  const map = new Map<string, BarisKuasaDebet[]>();
  rows.forEach((b) => {
    const k = `${b.tingkat}|${b.prodi}`;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(b);
  });
  return Array.from(map.entries())
    .map(([k, rs]) => {
      const [tingkat, prodi] = k.split('|');
      return { prodi, tingkat, rows: rs.slice().sort(urutBaris) };
    })
    .sort((a, b) => (URUT_TINGKAT[a.tingkat] ?? 9) - (URUT_TINGKAT[b.tingkat] ?? 9) || a.prodi.localeCompare(b.prodi));
}

/**
 * Unduh data blokir & pendebetan SATU bank sebagai CSV yang terbuka rapi di
 * Excel. BOM + `sep=,` supaya Excel memakai koma & diakritik benar; No. Rekening
 * dibungkus `="..."` agar tampil sebagai TEKS (bukan notasi ilmiah). Data sudah
 * di memori (halaman TANPA cache Dexie).
 */
export function unduhExcelBank(
  bank: string, rows: BarisKuasaDebet[], bulan: string, rekSenat?: string, rekSenatNama?: string, prefixNama = 'Form07-Blokir'
): void {
  const q = (v: string | number) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const labelBank = bank === 'TANPA_REKENING' ? 'TANPA-REKENING' : bank;
  const urut = rows.slice().sort(urutBaris);
  const header = ['No', 'NIT', 'Nama Taruna', 'Prodi', 'Tingkat', 'Bank', 'No. Rekening',
    'Nama Pemilik Rekening', 'Nilai Debet (Rp)', 'Rekening Tujuan (Senat)', 'Nama Rekening Senat'];
  const barisData = urut.map((b, i) => [
    q(i + 1), q(b.nit), q(b.nama), q(b.prodi), q(b.tingkat),
    q(bank === 'TANPA_REKENING' ? '' : b.bank),
    b.rekening_lengkap_ada ? `="${b.no_rekening_lengkap}"` : q('BELUM DIISI ADMIN'),
    q(b.nama_pemilik || b.nama), b.nilai_debet,
    rekSenat ? `="${rekSenat}"` : q(''), q(rekSenatNama || '')
  ].join(','));
  const total = urut.reduce((s, b) => s + b.nilai_debet, 0);
  const barisTotal = [q('TOTAL'), '', '', '', '', '', '', q(`${urut.length} taruna`), total, '', ''].join(',');
  const teks = 'sep=,\r\n' + [header.map(q).join(','), ...barisData, barisTotal].join('\r\n') + '\r\n';
  const blob = new Blob(['﻿' + teks], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${prefixNama}-Bank-${labelBank}-${bulan}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Fetch langsung ke GAS — TIDAK ambilCache/simpanCache (tidak pernah masuk Dexie). */
export function useTanpaCache<T>(action: string, payload?: unknown) {
  const [data, setData] = useState<T | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const payloadKey = JSON.stringify(payload ?? {});

  useEffect(() => {
    let aktif = true;
    setMemuat(true); setGalat('');
    (async () => {
      try {
        const hasil = await api<T>(action, payload);
        if (aktif) setData(hasil);
      } catch (e) {
        if (aktif) setGalat(e instanceof Error ? e.message : 'Gagal memuat.');
      } finally {
        if (aktif) setMemuat(false);
      }
    })();
    return () => { aktif = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, payloadKey, tick]);

  return { data, memuat, galat, refresh };
}
