import { useMemo } from 'react';

// Horizontal bar chart for category totals with inline value labels.
// data: [{ name, amount, count? }]
export default function CategoryBarChart({ data = [], height = 320 }) {
  const { bars, chartHeight, layout, maxVal } = useMemo(() => {
    const items = Array.isArray(data) ? data.filter((d) => Number(d.amount || 0) > 0) : [];
    const top = 32;
    const bottom = 36;
    const left = 180;
    const right = 32;
    const rowGap = 36;
    const barHeight = 22;
    const chartHeight = Math.max(height, top + bottom + items.length * rowGap);
    const width = 800;
    const plotWidth = width - left - right;
    const maxVal = Math.max(1, ...items.map((d) => Number(d.amount || 0)));
    const bars = items.map((item, idx) => {
      const value = Number(item.amount || 0);
      const ratio = maxVal === 0 ? 0 : value / maxVal;
      const w = Math.max(0, ratio * plotWidth);
      const y = top + idx * rowGap;
      return {
        value,
        label: item.name || 'Uncategorized',
        count: item.count || 0,
        x: left,
        y,
        w,
        h: barHeight,
      };
    });
    return { bars, chartHeight, layout: { width, top, bottom, left, right, barHeight, rowGap, plotWidth }, maxVal };
  }, [data, height]);

  if (bars.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-gray-500">
        No category totals available for this selection.
      </div>
    );
  }

  const fm = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="relative w-full overflow-hidden">
      <svg viewBox={`0 0 800 ${chartHeight}`} className="w-full select-none">
        {/* grid lines */}
        <g className="stroke-gray-200">
          {Array.from({ length: 4 }).map((_, i) => {
            const x = layout.left + (i / 3) * layout.plotWidth;
            return <line key={i} x1={x} x2={x} y1={layout.top - 12} y2={chartHeight - layout.bottom + 12} />;
          })}
        </g>

        {/* axis labels */}
        <g className="fill-gray-400 text-[10px]">
          {Array.from({ length: 4 }).map((_, i) => {
            const ratio = i / 3;
            const x = layout.left + ratio * layout.plotWidth;
            const value = ratio * maxVal;
            return (
              <text key={i} x={x} y={chartHeight - layout.bottom + 24} textAnchor="middle">
                {fm(value)}
              </text>
            );
          })}
        </g>

        {/* bars and labels */}
        {bars.map((bar, idx) => (
          <g key={idx}>
            <text
              x={layout.left - 12}
              y={bar.y + bar.h / 2 + 4}
              textAnchor="end"
              className="fill-gray-700 text-[12px]"
            >
              {bar.label}
              {bar.count ? ` (${bar.count})` : ''}
            </text>
            <rect
              x={bar.x}
              y={bar.y}
              width={Math.max(4, bar.w)}
              height={bar.h}
              rx={6}
              className="fill-[#2563eb]"
              opacity={0.9}
            />
            <text
              x={bar.x + Math.max(4, bar.w) + 8}
              y={bar.y + bar.h / 2 + 4}
              className="fill-gray-800 text-[11px] font-semibold"
            >
              {fm(bar.value)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
