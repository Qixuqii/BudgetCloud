import { formatMoneyCompact, formatMoneyRaw } from '../utils/number';

export default function BudgetAnalysisTable({ categories = [] }) {
  const fmFull = (n) => `$${formatMoneyRaw(n)}`;

  // nice pastel icon backgrounds
  const bubbles = [
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-indigo-100 text-indigo-700',
    'bg-rose-100 text-rose-700',
    'bg-sky-100 text-sky-700',
    'bg-fuchsia-100 text-fuchsia-700',
    'bg-teal-100 text-teal-700',
    'bg-lime-100 text-lime-700',
  ];

  return (
    <div className="mt-4">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((c, idx) => {
          const spent = c.spent ?? c.amount ?? 0;
          const count = c.txCount ?? c.count ?? 0;
          const limit = Number(c.limit || 0);
          const pct = limit > 0 ? Math.max(0, Math.min(100, (Number(spent) / limit) * 100)) : 0;
          const bubble = bubbles[idx % bubbles.length];
          return (
            <div
              key={c.id ?? idx}
              className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition-all hover:-translate-y-[1px] hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${bubble}`} aria-hidden="true">
                    <span className="text-base">📦</span>
                  </div>
                  <div>
                    <div className="text-base font-semibold text-gray-900">{c.name}</div>
                    <div className="text-[13px] text-gray-500">{count} transaction{count===1?'':'s'}</div>
                  </div>
                </div>
              </div>

              {/* External chips row: never occlude the bar */}
              <div className="mt-3 mb-2 flex items-center justify-between gap-2">
                <div className="max-w-[48%] truncate">
                  <span
                    className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-900 ring-1 ring-black/5 shadow"
                    title={`Budget: ${fmFull(limit)}`}
                  >
                    Budget: {formatMoneyCompact(limit)}
                  </span>
                </div>
                <div className="max-w-[48%] truncate text-right">
                  <span
                    className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-900 ring-1 ring-black/5 shadow"
                    title={`Spending: ${fmFull(spent)}`}
                  >
                    Spending: {formatMoneyCompact(spent)}
                  </span>
                </div>
              </div>

              {/* Deep blue bar with centered percent */}
              <div className="relative h-7 w-full overflow-hidden rounded-full bg-blue-700">
                <div className="absolute left-0 top-0 h-full rounded-full bg-blue-400/60" style={{ width: `${pct}%` }} />
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-[12px] font-medium text-white">
                  {pct.toFixed(2)}% consumed
                </div>
              </div>
            </div>
          );
        })}

        {categories.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed p-8 text-center text-gray-500">
            No category data
          </div>
        )}
      </div>
    </div>
  );
}
