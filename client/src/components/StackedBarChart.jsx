import { useMemo, useRef, useState } from 'react';

// Simple stacked bar chart for daily income/expense.
// Props:
// - data: [{ date: 'YYYY-MM-DD', income: number, expense: number }]
// - height: number px
export default function StackedBarChart({ data = [], height = 280 }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null); // {x,y,item}

  const { bars, maxVal, dims, labels } = useMemo(() => {
    const margin = { top: 16, right: 16, bottom: 28, left: 60 };
    const width = 800; // intrinsic width; container scales via viewBox
    const h = height;
    const plotW = width - margin.left - margin.right;
    const plotH = h - margin.top - margin.bottom;
    const items = Array.isArray(data) ? data : [];

    const maxVal = Math.max(1, ...items.map(d => Number(d.income || 0) + Number(d.expense || 0)));
    const n = Math.max(1, items.length);
    const band = plotW / n;
    const gap = Math.max(2, band * 0.25);
    const barW = Math.max(1, band - gap);
    const xAt = (i) => margin.left + i * band + (band - barW) / 2;
    const hFor = (v) => (maxVal <= 0 ? 0 : (Number(v || 0) / maxVal) * plotH);

    const bars = items.map((d, i) => {
      const x = xAt(i);
      const hExp = hFor(d.expense);
      const hInc = hFor(d.income);
      const yExp = margin.top + (plotH - hExp);
      const yInc = yExp - hInc;
      return {
        x, barW,
        expense: { x, y: yExp, w: barW, h: hExp },
        income: { x, y: Math.max(margin.top, yInc), w: barW, h: hInc },
        raw: d,
      };
    });
    // Build sparse x-axis labels (about 6 labels including endpoints)
    const nLabels = Math.min(6, n);
    const step = Math.max(1, Math.round((n - 1) / (nLabels - 1)));
    const idxs = new Set();
    for (let i = 0; i < n; i += step) idxs.add(i);
    idxs.add(n - 1);
    const fmtX = (s) => {
      const m = Number(s?.slice(5,7) || 0);
      const d = Number(s?.slice(8,10) || 0);
      return m && d ? `${m}/${d}` : (s || '');
    };
    const xLabels = Array.from(idxs).sort((a,b)=>a-b).map(i => ({ x: xAt(i) + barW/2, text: fmtX(items[i]?.date) }));

    return { bars, maxVal, dims: { width, h, margin, plotW, plotH }, labels: { x: xLabels } };
  }, [data, height]);

  const onMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Map client pixels to SVG viewBox coordinates
    const scaleX = 800 / rect.width;
    const scaleY = height / rect.height;
    const sx = x * scaleX;
    const sy = y * scaleY;
    // only respond when the cursor is within the chart plotting area
    const top = (dims?.margin?.top ?? 16);
    const bottom = top + (dims?.plotH ?? (height - 44));
    if (sy < top || sy > bottom) { setHover(null); return; }

    // find the bar that the cursor is currently inside
    let inside = null;
    for (const b of bars) {
      if (sx >= b.x && sx <= b.x + b.barW) { inside = b; break; }
    }
    if (!inside) { setHover(null); return; }

    const cx = inside.x + inside.barW / 2;
    const tyRatio = ((dims?.margin?.top ?? 16) + 6) / height; // percent for responsive top
    setHover({ x: cx, y: Math.min(inside.expense.y, inside.income.y), tyRatio, item: inside.raw, bar: inside });
  };
  const onLeave = () => setHover(null);

  const fm = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="relative w-full overflow-hidden">
      <svg
        ref={svgRef}
        viewBox={`0 0 800 ${height}`}
        className="w-full select-none"
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        {/* grid lines */}
        <g className="stroke-gray-200">
          {Array.from({ length: 4 }).map((_, i) => (
            <line key={i} x1={(dims?.margin?.left ?? 60) - 4} x2={800 - (dims?.margin?.right ?? 16)} y1={16 + (i * (height - 44)) / 3} y2={16 + (i * (height - 44)) / 3} />
          ))}
        </g>

        {/* y-axis labels */}
        <g className="fill-gray-400 text-[10px]">
          {Array.from({ length: 5 }).map((_, i) => {
            const y = 16 + (i * (height - 44)) / 4;
            const val = (maxVal * (1 - i / 4));
            return (
              <text key={i} x={(dims?.margin?.left ?? 60) - 6} y={y + 3} textAnchor="end">{fm(val)}</text>
            );
          })}
        </g>

        {/* bars */}
        <g>
          {bars.map((b, idx) => (
            <g key={idx}>
              {/* hover background band for alignment */}
              {hover && hover.item?.date === b.raw.date && (
                <rect x={b.x - 2} y={dims.margin.top} width={b.barW + 4} height={dims.plotH} fill="#3b82f6" opacity="0.06" />
              )}
              {/* expense bottom (rose) */}
              <rect x={b.expense.x} y={b.expense.y} width={b.expense.w} height={b.expense.h} fill="#ef4444" opacity="0.9" rx="3" />
              {/* income top (emerald) */}
              <rect x={b.income.x} y={b.income.y} width={b.income.w} height={b.income.h} fill="#10b981" opacity="0.9" rx="3" />
              {hover && hover.item?.date === b.raw.date && (
                <rect x={b.x - 1} y={dims.margin.top} width={b.barW + 2} height={dims.plotH} fill="none" stroke="#93c5fd" strokeWidth="1.5" />
              )}
              {hover && hover.item?.date === b.raw.date && (
                <g className="fill-gray-700 text-[10px]">
                  {b.income.h > 10 && (
                    <text x={b.income.x + b.income.w / 2} y={b.income.y - 4} textAnchor="middle">Inc {fm(b.raw.income)}</text>
                  )}
                  {b.expense.h > 10 && (
                    <text x={b.expense.x + b.expense.w / 2} y={b.expense.y + b.expense.h + 12} textAnchor="middle">Exp {fm(b.raw.expense)}</text>
                  )}
                </g>
              )}
            </g>
          ))}
        </g>

        {/* x-axis labels */}
        <g className="fill-gray-400 text-[10px]">
          {labels.x.map((lb, i) => (
            <text key={i} x={lb.x} y={height - 8} textAnchor="middle">{lb.text}</text>
          ))}
        </g>
      </svg>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
        <div className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background:'#ef4444' }} /> Expense</div>
        <div className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background:'#10b981' }} /> Income</div>
      </div>

      {/* Tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-3 rounded-md bg-white px-2 py-1 text-xs text-gray-700 shadow ring-1 ring-black/5"
          style={{ left: `${(hover.x / 800) * 100}%`, top: `${(hover.tyRatio ?? 0.05) * 100}%` }}
        >
          <div className="font-medium">{hover.item?.date}</div>
          <div>Income: {fm(hover.item?.income)}</div>
          <div>Expense: {fm(hover.item?.expense)}</div>
          <div className="mt-1 border-t pt-1">Total: {fm((hover.item?.income || 0) + (hover.item?.expense || 0))}</div>
        </div>
      )}
    </div>
  );
}
