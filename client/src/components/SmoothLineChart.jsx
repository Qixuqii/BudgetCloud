import { useMemo, useRef, useState } from 'react';

// Simple smooth line chart with Catmull-Rom to Bezier conversion.
// Props:
// - data: [{ date: 'YYYY-MM-DD', amount: number }]
// - color: string (hex)
// - height: number (px)
// - showPoints: boolean
// - showValueLabels: boolean (draw amount on top of points)
export default function SmoothLineChart({ data = [], color = '#2563eb', height = 280, showPoints = true, showValueLabels = false }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null); // {x, y, raw}

  const { path, areaPath, pts, maxVal } = useMemo(() => {
    const margin = { top: 16, right: 16, bottom: 28, left: 40 };
    const width = 800;
    const plotH = height - margin.top - margin.bottom;
    const plotW = width - margin.left - margin.right;
    const items = Array.isArray(data) ? data : [];
    const values = items.map((d) => Number(d.amount || 0));
    const maxVal = Math.max(1, ...values);
    const minVal = 0;

    const count = Math.max(1, items.length);
    const xAt = (i) => margin.left + (count === 1 ? plotW / 2 : (i / (count - 1)) * plotW);
    const yAt = (v) => margin.top + (maxVal === minVal ? plotH / 2 : (1 - (v - minVal) / (maxVal - minVal)) * plotH);

    const pts = items.map((d, i) => ({ x: xAt(i), y: yAt(Number(d.amount || 0)), raw: d }));

    let d = '';
    if (pts.length > 0) {
      d += `M ${pts[0].x} ${pts[0].y}`;
      const tension = 0.5;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
        const cp1x = p1.x + (p2.x - p0.x) * (tension / 6);
        const cp1y = p1.y + (p2.y - p0.y) * (tension / 6);
        const cp2x = p2.x - (p3.x - p1.x) * (tension / 6);
        const cp2y = p2.y - (p3.y - p1.y) * (tension / 6);
        d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
      }
    }

    let areaPath = '';
    if (pts.length > 0) {
      areaPath = d + ` L ${pts[pts.length - 1].x} ${margin.top + plotH}` +
        ` L ${pts[0].x} ${margin.top + plotH} Z`;
    }

    return { path: d, areaPath, pts, maxVal };
  }, [data, height]);

  const colorStroke = color;
  const colorFill = color;

  const onMouseMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let best = null;
    for (const p of pts) {
      if (!best || Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
    }
    if (best) setHover(best);
  };

  const onLeave = () => setHover(null);

  const formatAmount = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="relative w-full overflow-hidden">
      <svg
        ref={svgRef}
        viewBox={`0 0 800 ${height}`}
        className="w-full select-none"
        onMouseMove={onMouseMove}
        onMouseLeave={onLeave}
      >
        <g className="stroke-gray-200">
          {Array.from({ length: 4 }).map((_, i) => (
            <line key={i} x1={40} x2={760} y1={16 + (i * (height - 44)) / 3} y2={16 + (i * (height - 44)) / 3} />
          ))}
        </g>

        {areaPath && (
          <path d={areaPath} fill={colorFill} opacity="0.08" />
        )}

        {path && (
          <path d={path} fill="none" stroke={colorStroke} strokeWidth="2.5" />
        )}

        {showPoints && (
          <g>
            {pts.map((p, idx) => (
              <circle key={`point-${idx}`} cx={p.x} cy={p.y} r={3} fill="#ffffff" stroke={colorStroke} strokeWidth="2" />
            ))}
          </g>
        )}

        {showValueLabels && (
          <g className="fill-gray-600 text-[10px] font-semibold">
            {pts.map((p, idx) => {
              const amount = formatAmount(p.raw?.amount);
              const y = Math.max(18, p.y - 10);
              return (
                <text key={`label-${idx}`} x={p.x} y={y} textAnchor="middle">
                  {amount}
                </text>
              );
            })}
          </g>
        )}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-3 rounded-md bg-white px-2 py-1 text-xs text-gray-700 shadow ring-1 ring-black/5"
          style={{ left: `${(hover.x / 800) * 100}%`, top: hover.y }}
        >
          <div className="font-medium">{hover.raw?.date}</div>
          <div>${formatAmount(hover.raw?.amount)}</div>
        </div>
      )}
    </div>
  );
}
