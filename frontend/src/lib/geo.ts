// Ambil geotag dari GPS browser; fallback input manual dengan peringatan.
export interface Geotag {
  lat: number;
  lng: number;
  manual: boolean;
}

export function ambilGeotag(): Promise<Geotag> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Perangkat tidak mendukung GPS. Isi koordinat manual.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, manual: false }),
      () => reject(new Error('Gagal mengambil lokasi GPS. Isi koordinat manual.')),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  });
}
