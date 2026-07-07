// Geser kartu daftar verifikasi: geser kanan = setujui, geser kiri =
// tolak/kembalikan. Prompt "Beranda Kotak-Tugas", Bagian 2d.
// Gesture MURNI TAMBAHAN — anak (children) tetap bisa diklik/dinavigasi
// seperti biasa (mis. <Link> pembungkus kartu), supaya pengguna yang tidak
// menggeser (atau memakai mouse/keyboard) tidak kehilangan cara bertindak.
import { useRef, useState } from 'react';

const AMBANG_PX = 72;

export function SwipeAction({
  children, onSetujui, onTolak, labelSetujui = 'Setujui', labelTolak = 'Kembalikan'
}: {
  children: React.ReactNode;
  onSetujui?: () => void;
  onTolak?: () => void;
  labelSetujui?: string;
  labelTolak?: string;
}) {
  const [dx, setDx] = useState(0);
  const [menggeser, setMenggeser] = useState(false);
  const mulaiX = useRef<number | null>(null);

  function mulai(e: React.PointerEvent) {
    if (!onSetujui && !onTolak) return;
    mulaiX.current = e.clientX;
    setMenggeser(true);
    // Tahan pointer di elemen ini walau kartu bergeser visual di bawah jari/kursor
    // (translateX) — tanpa ini, gerakan cepat bisa "lepas" dari elemen asal.
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function gerak(e: React.PointerEvent) {
    if (mulaiX.current === null) return;
    setDx(e.clientX - mulaiX.current);
  }
  function lepas(e: React.PointerEvent) {
    if (mulaiX.current === null) return;
    if (dx > AMBANG_PX && onSetujui) onSetujui();
    else if (dx < -AMBANG_PX && onTolak) onTolak();
    e.currentTarget.releasePointerCapture(e.pointerId);
    mulaiX.current = null;
    setMenggeser(false);
    setDx(0);
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {(onSetujui || onTolak) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-4">
          <span className={`text-sm font-bold text-red-600 transition-opacity ${dx < -16 ? 'opacity-100' : 'opacity-0'}`}>
            ← {labelTolak}
          </span>
          <span className={`ml-auto text-sm font-bold text-green-600 transition-opacity ${dx > 16 ? 'opacity-100' : 'opacity-0'}`}>
            {labelSetujui} →
          </span>
        </div>
      )}
      <div
        onPointerDown={mulai}
        onPointerMove={gerak}
        onPointerUp={lepas}
        onPointerCancel={() => { mulaiX.current = null; setMenggeser(false); setDx(0); }}
        style={{ transform: `translateX(${dx}px)`, touchAction: onSetujui || onTolak ? 'pan-y' : undefined }}
        className={`relative bg-white ${menggeser ? '' : 'transition-transform duration-150'}`}
      >
        {children}
      </div>
    </div>
  );
}
