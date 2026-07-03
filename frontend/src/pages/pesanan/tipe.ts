// Tipe data Pesanan bersama (list, detail, buat)
export interface Pesanan {
  pesanan_id: string;
  tgl_makan: string;
  kontrak_id: string;
  jml_taruna: number;
  menu: string;
  catatan: string;
  status: 'DRAFT' | 'DIAJUKAN' | 'DIKEMBALIKAN' | 'DISETUJUI' | 'TERKIRIM';
  created_by: string;
  verif_by: string;
  verif_at: string;
  revisi_dari: string;
}

export interface Lampiran {
  lamp_id: string;
  ref_type: string;
  ref_id: string;
  jenis: string;
  drive_file_id: string;
  nama_file: string;
  uploaded_by: string;
  timestamp: string;
}

export function urlDrive(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}
