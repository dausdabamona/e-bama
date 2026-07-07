// Tombol unduh template CSV — dipakai di setiap halaman impor CSV supaya
// pengguna punya contoh header+baris yang benar sebelum mengisi data sendiri.
import { unduhCsv } from '../../lib/csv';
import { Button } from './button';

export function TombolTemplateCsv({ namaFile, header, contoh, label = '📥 Unduh Template CSV' }: {
  namaFile: string;
  header: string[];
  contoh: (string | number)[][];
  label?: string;
}) {
  return (
    <Button type="button" varian="garis" onClick={() => unduhCsv(namaFile, header, contoh)}>
      {label}
    </Button>
  );
}
