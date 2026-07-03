// /realisasi/:id — detail + tombol tanda tangan digital (konfirmasi PIN) per role.
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { api } from '../../lib/api';
import { PinConfirmModal } from '../../components/pin-confirm';
import { Card } from '../../components/ui/card';
import { ErrorMessage } from '../../components/ui/error-message';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { Button } from '../../components/ui/button';
import { useToast } from '../../components/ui/toast';
import { useListCache } from '../../lib/use-list-cache';
import type { Realisasi } from './tipe';

export function HalamanRealisasiDetail() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const nav = useNavigate();
  const { toast } = useToast();
  const { data, memuat, galat, refresh } = useListCache<{ realisasi: Realisasi[] }>('realisasi.list', {});
  const [tampilPin, setTampilPin] = useState(false);

  if (memuat && !data) return <LoadingSpinner />;
  if (galat && !data) return <ErrorMessage pesan={galat} onRetry={refresh} />;
  const r = data?.realisasi?.find((x) => x.real_id === id);
  if (!r) return <ErrorMessage pesan="Realisasi tidak ditemukan." onRetry={refresh} />;

  const sudahTtd = session?.role === 'PEMBINA' ? Boolean(r.ttd_pembina_at) : Boolean(r.ttd_senat_at);
  const bisaTtd = (session?.role === 'PEMBINA' || session?.role === 'SENAT') && !sudahTtd;

  async function tandaTangan(pin: string) {
    await api('realisasi.ttd', { real_id: r!.real_id, pin });
    toast('Tanda tangan berhasil.', 'sukses');
    setTampilPin(false);
    refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <button className="text-sm text-primary" onClick={() => nav('/realisasi')}>← Kembali</button>
      <h1 className="text-xl font-bold text-primary-dark">Realisasi {r.tanggal}</h1>

      <Card className="flex flex-col gap-2">
        <Baris label="Porsi Diterima" nilai={`${r.porsi_diterima} porsi`} />
        <Baris label="Taruna Makan" nilai={`${r.jml_taruna_makan} orang`} />
        <Baris label="Ketidaksesuaian" nilai={r.ketidaksesuaian || 'Tidak ada'} />
        <Baris label="Tindak Lanjut" nilai={r.tindak_lanjut || '-'} />
        <Baris label="Geotag" nilai={`${r.geotag_lat.toFixed(6)}, ${r.geotag_lng.toFixed(6)}`} />
      </Card>

      <Card className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-gray-600">Tanda Tangan</p>
        <div className="flex items-center gap-2">
          <span className={r.ttd_pembina_at ? 'text-green-700' : 'text-gray-400'}>
            {r.ttd_pembina_at ? '✅' : '⬜'} Pembina
          </span>
          <span className={r.ttd_senat_at ? 'text-green-700' : 'text-gray-400'}>
            {r.ttd_senat_at ? '✅' : '⬜'} Senat
          </span>
        </div>
        {bisaTtd && (
          <Button onClick={() => setTampilPin(true)}>Tanda Tangan ({session?.role})</Button>
        )}
      </Card>

      {tampilPin && (
        <PinConfirmModal
          keterangan="Masukkan PIN untuk menandatangani realisasi ini."
          onBatal={() => setTampilPin(false)}
          onKonfirmasi={tandaTangan}
        />
      )}
    </div>
  );
}

function Baris({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="font-medium">{nilai}</p>
    </div>
  );
}
