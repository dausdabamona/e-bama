// Grafik batang sederhana 6 bulan — SVG murni, tanpa library chart.
export function GrafikBatang({ data }: { data: { label: string; nilai: number }[] }) {
  const lebar = 320, tinggi = 160, pad = 24;
  const maks = Math.max(1, ...data.map((d) => d.nilai));
  const lebarBatang = (lebar - pad * 2) / data.length;

  return (
    <svg viewBox={`0 0 ${lebar} ${tinggi}`} className="w-full" role="img" aria-label="Grafik nominal rekap 6 bulan">
      {data.map((d, i) => {
        const h = maks > 0 ? (d.nilai / maks) * (tinggi - pad * 2) : 0;
        const x = pad + i * lebarBatang + lebarBatang * 0.15;
        const w = lebarBatang * 0.7;
        const y = tinggi - pad - h;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={w} height={h} rx={3} fill="#0d9488" />
            <text x={x + w / 2} y={tinggi - pad + 14} textAnchor="middle" fontSize="9" fill="#6b7280">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
