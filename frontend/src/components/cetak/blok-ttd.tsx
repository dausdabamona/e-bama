// Blok tanda tangan cetak — dua varian:
//   BlokTtd2Kolom      : dua pihak sejajar (mis. Direktur | PPK)
//   BlokTtd3Berjenjang : tiga pihak berjenjang menurun (Form-01: Senat → Pembina → PPK)

export interface TtdPihak {
  label: string;      // mis. "Mengetahui/Menyetujui,"
  jabatan: string;    // mis. "Direktur Poltek KP Sorong,"
  nama?: string;      // kosong = blanko (garis kosong untuk ttd manual di kertas)
  nip?: string;       // kosong = tampilkan "(...........................)"
  tanggal?: string;   // sertakan prop ini (boleh string kosong) untuk memunculkan baris Tanggal/Jam
}

function TtdKolom({ pihak }: { pihak: TtdPihak }) {
  return (
    <div>
      <p>{pihak.label}</p>
      <p>{pihak.jabatan}</p>
      <div className="mt-12 font-semibold">{pihak.nama || ' '}</div>
      <p className="border-t border-black pt-0.5">
        {pihak.nip ? `NIP ${pihak.nip}` : '(...........................)'}
      </p>
      {pihak.tanggal !== undefined && (
        <p className="mt-1 text-gray-500">Tanggal/Jam: {pihak.tanggal || '……………………'}</p>
      )}
    </div>
  );
}

export function BlokTtd2Kolom({ kiri, kanan }: { kiri: TtdPihak; kanan: TtdPihak }) {
  return (
    <div className="mt-8 grid grid-cols-2 gap-4 text-center text-xs">
      <TtdKolom pihak={kiri} />
      <TtdKolom pihak={kanan} />
    </div>
  );
}

/** Satu tanda tangan di TENGAH (mis. pejabat tertinggi di bawah dua penanda tangan). */
export function BlokTtdTengah({ pihak }: { pihak: TtdPihak }) {
  return (
    <div className="mt-2 flex justify-center text-center text-xs">
      <div className="w-1/2"><TtdKolom pihak={pihak} /></div>
    </div>
  );
}

/**
 * Berjenjang: tiap pihak menjorok makin ke kanan, mencerminkan urutan alur
 * (mis. Senat → Pembina → PPK). `text-center` disamakan dengan BlokTtd2Kolom
 * (nama/garis TTD rapi di tengah kolom, bukan rata kiri); indentasi dijaga
 * kecil (ml-8/ml-16, bukan ml-16/ml-32) supaya kolom terakhir tidak mepet ke
 * tepi layar sempit (mobile-first, tanpa overflow horizontal).
 */
export function BlokTtd3Berjenjang({ pihak1, pihak2, pihak3 }: {
  pihak1: TtdPihak; pihak2: TtdPihak; pihak3: TtdPihak;
}) {
  return (
    <div className="mt-8 flex flex-col gap-6 text-center text-xs">
      <div className="w-48"><TtdKolom pihak={pihak1} /></div>
      <div className="ml-8 w-48"><TtdKolom pihak={pihak2} /></div>
      <div className="ml-16 w-48"><TtdKolom pihak={pihak3} /></div>
    </div>
  );
}
