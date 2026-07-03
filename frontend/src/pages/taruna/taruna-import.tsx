// /taruna/impor (Admin) — impor CSV taruna; validasi rek_mask SEBELUM disimpan,
// baris dengan nomor rekening lengkap ditolak dengan pesan jelas.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { useToast } from '../../components/ui/toast';
import { api } from '../../lib/api';
import { bacaFileTeks, parseCsv } from '../../lib/csv';
import { validasiRekMask } from './tipe';

interface BarisPreview {
  nit: string; nama: string; prodi: string; tingkat: string; kelas: string;
  bank: string; rekMentah: string; status: string;
  valid: boolean; pesan: string;
}

const KOLOM = ['nit', 'nama', 'prodi', 'tingkat', 'kelas', 'bank', 'rek', 'status'];

function validasiBaris(kolomIdx: Record<string, number>, row: string[]): BarisPreview {
  const ambil = (k: string) => (kolomIdx[k] !== undefined ? (row[kolomIdx[k]] ?? '').trim() : '');
  const nit = ambil('nit'), nama = ambil('nama'), bank = (ambil('bank') || 'BNI').toUpperCase();
  const rekMentah = ambil('rek');
  const status = (ambil('status') || 'AKTIF').toUpperCase();

  let pesan = '';
  if (!nit) pesan = 'NIT kosong.';
  else if (!nama) pesan = 'Nama kosong.';
  else if (bank !== 'BNI' && bank !== 'BSI') pesan = 'Bank harus BNI atau BSI.';
  else if (status !== 'AKTIF' && status !== 'NONAKTIF') pesan = 'Status harus AKTIF atau NONAKTIF.';
  else {
    const v = validasiRekMask(rekMentah);
    if (!v.ok) pesan = v.pesan;
  }

  return {
    nit, nama, prodi: ambil('prodi'), tingkat: ambil('tingkat'), kelas: ambil('kelas'),
    bank, rekMentah, status, valid: !pesan, pesan
  };
}

export function HalamanTarunaImpor() {
  const nav = useNavigate();
  const { toast } = useToast();
  const [baris, setBaris] = useState<BarisPreview[]>([]);
  const [proses, setProses] = useState(false);
  const [progres, setProgres] = useState(0);

  async function pilihFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const teks = await bacaFileTeks(file);
    const semua = parseCsv(teks);
    if (semua.length < 2) { toast('File CSV kosong atau tidak valid.', 'galat'); return; }

    const header = semua[0].map((h) => h.trim().toLowerCase());
    const kolomIdx: Record<string, number> = {};
    KOLOM.forEach((k) => { const i = header.indexOf(k); if (i >= 0) kolomIdx[k] = i; });
    if (kolomIdx.nit === undefined || kolomIdx.nama === undefined || kolomIdx.rek === undefined) {
      toast('Header CSV wajib memuat kolom: nit, nama, rek (opsional: prodi, tingkat, kelas, bank, status).', 'galat');
      return;
    }

    setBaris(semua.slice(1).map((row) => validasiBaris(kolomIdx, row)));
  }

  const jmlValid = baris.filter((b) => b.valid).length;
  const jmlError = baris.length - jmlValid;

  async function impor() {
    setProses(true);
    let sukses = 0, gagal = 0;
    for (let i = 0; i < baris.length; i++) {
      setProgres(i + 1);
      const b = baris[i];
      if (!b.valid) { gagal++; continue; }
      try {
        const v = validasiRekMask(b.rekMentah);
        await api('taruna.upsert', {
          nit: b.nit, nama: b.nama, prodi: b.prodi, tingkat: b.tingkat, kelas: b.kelas,
          bank: b.bank, rek_mask: v.ok ? v.nilai.replace(/\D/g, '') : '', status: b.status
        });
        sukses++;
      } catch {
        gagal++;
      }
    }
    setProses(false);
    toast(`${sukses} taruna berhasil diimpor, ${gagal} gagal/dilewati.`, sukses > 0 ? 'sukses' : 'galat');
    if (sukses > 0) nav('/taruna');
  }

  return (
    <div className="flex flex-col gap-4">
      <button className="text-sm text-primary" onClick={() => nav('/taruna')}>← Kembali</button>
      <h1 className="text-xl font-bold text-primary-dark">Impor Data Taruna (CSV)</h1>

      <Card className="flex flex-col gap-2">
        <p className="text-sm text-gray-500">
          Kolom wajib: <code>nit, nama, rek</code>. Opsional: <code>prodi, tingkat, kelas, bank, status</code>.
          Kolom <code>rek</code> HANYA boleh 4 digit terakhir — nomor rekening lengkap akan ditolak.
        </p>
        <input type="file" accept=".csv,text/csv" onChange={(e) => void pilihFile(e)}
          className="min-h-tap rounded-xl border border-gray-300 px-3 py-2.5 text-sm" />
      </Card>

      {baris.length > 0 && (
        <>
          <Card className="flex items-center justify-between text-sm">
            <span className="text-green-700">{jmlValid} baris valid</span>
            <span className="text-red-600">{jmlError} baris bermasalah</span>
          </Card>

          <Card className="max-h-96 overflow-y-auto overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-1 pr-2">NIT</th>
                  <th className="py-1 pr-2">Nama</th>
                  <th className="py-1 pr-2">Rek</th>
                  <th className="py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {baris.map((b, i) => (
                  <tr key={i} className={`border-b border-gray-100 ${b.valid ? '' : 'bg-red-50'}`}>
                    <td className="py-1 pr-2">{b.nit}</td>
                    <td className="py-1 pr-2">{b.nama}</td>
                    <td className="py-1 pr-2">{b.rekMentah}</td>
                    <td className="py-1">
                      {b.valid ? <span className="text-green-700">OK</span> : <span className="text-red-600">{b.pesan}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Button onClick={() => void impor()} disabled={proses || jmlValid === 0}>
            {proses ? `Mengimpor ${progres}/${baris.length}…` : `Impor ${jmlValid} Taruna Valid`}
          </Button>
        </>
      )}
    </div>
  );
}
