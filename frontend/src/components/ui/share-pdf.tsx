// Tombol "Bagikan" untuk dokumen/PDF yang sudah tergenerate (mis. link Drive
// dari cetak.formNN atau surat SP) — pakai Web Share API kalau tersedia
// (langsung ke WhatsApp/aplikasi lain di perangkat), fallback ke wa.me.
// Prompt "Beranda Kotak-Tugas", Bagian 2f.
//
// PENTING (pagar pengaman prompt): hanya bagikan URL/dokumen yang pengguna
// pilih sendiri lewat prop `url` — komponen ini TIDAK menambahkan data lain.
// Pemanggil bertanggung jawab tidak mengoper URL yang membocorkan data
// sensitif (rekening, daftar per-taruna).
import { Button } from './button';

export function SharePdf({
  url, judul, teks, label = 'Bagikan', className = ''
}: {
  url: string;
  judul?: string;
  teks?: string;
  label?: string;
  className?: string;
}) {
  function bukaWa(pesan: string) {
    const teksWa = encodeURIComponent(`${pesan}\n${url}`);
    window.open(`https://wa.me/?text=${teksWa}`, '_blank', 'noopener');
  }

  async function bagikan() {
    const pesan = teks || judul || 'Dokumen e-BAMA';
    if (navigator.share) {
      try {
        await navigator.share({ title: judul, text: pesan, url });
        return;
      } catch (e) {
        // Pengguna membatalkan share sheet secara sengaja (AbortError) — hormati,
        // JANGAN dilanjutkan ke wa.me. Kegagalan LAIN (mis. tak ada target share,
        // browser tak sungguh mendukung) tetap lanjut ke fallback di bawah.
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    bukaWa(pesan);
  }

  return (
    <Button varian="garis" className={className} onClick={() => void bagikan()}>
      {label}
    </Button>
  );
}
