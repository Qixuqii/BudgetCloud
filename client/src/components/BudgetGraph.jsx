export default function BudgetGraph({ categories = [] }) {
  const fm = (n) =>
    typeof n === "number"
      ? n.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "0.00";

  const limits = categories.map((c) => Number(c.limit) || 0);
  const spends = categories.map((c) => Number(c.spent) || 0);
  const maxVal = Math.max(1, ...limits, ...spends);

  const ticks = [0.25, 0.5, 0.75, 1];

  return (
    <div className="mt-4 overflow-visible rounded-2xl bg-white p-4 shadow ring-1 ring-black/5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">Budget Graph</h3>
        <div className="flex items-center gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
            <span>budget</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-teal-500 inline-block" />
            <span>spending</span>
          </div>
        </div>
      </div>

      <div className="relative h-80 w-full overflow-visible md:h-96">
        {/* y-axis labels */}
        <div className="absolute left-0 top-8 bottom-0 w-16 select-none text-xs text-gray-500">
          {ticks.map((t, i) => (
            <div
              key={i}
              className="absolute pr-2"
              style={{ bottom: `${t * 100}%` }}
            >
              ${fm(maxVal * t)}
            </div>
          ))}
          <div className="absolute bottom-0 pr-2">$0.00</div>
        </div>

        {/* grid lines */}
        <div className="absolute left-16 right-0 bottom-0 top-8">
          {ticks.map((t, i) => (
            <div
              key={i}
              className="absolute right-0 h-px w-full border-t border-dashed border-gray-300"
              style={{ bottom: `${t * 100}%` }}
            />
          ))}
          <div className="absolute bottom-0 right-0 h-px w-full border-t border-gray-300" />
        </div>

        {/* bars */}
        <div className="absolute left-16 right-0 bottom-0 top-8 flex items-end gap-3 overflow-visible pb-10">
          {categories.map((c, idx) => {
            const limit = Number(c.limit) || 0;
            const spent = Number(c.spent) || 0;
            const hBudget = Math.max(0, Math.min(100, (limit / maxVal) * 100));
            const hSpent = Math.max(0, Math.min(100, (spent / maxVal) * 100));
            return (
              <div
                key={c.id ?? idx}
                className="group relative flex h-full min-w-[56px] flex-1 items-end justify-center"
              >
                {/* tooltip */}
                <div className="pointer-events-none absolute top-2 left-0 z-10 max-w-[260px] whitespace-nowrap rounded-xl bg-white p-3 text-xs shadow-xl ring-1 ring-black/10 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <div className="mb-2 border-b border-gray-200 pb-1 text-[13px] font-semibold capitalize text-gray-900">
                    {c.name}
                  </div>
                  <div className="flex items-center justify-between gap-6 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-gray-600">
                      <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
                      budget
                    </div>
                    <div className="font-medium text-gray-900">${fm(limit)}</div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-6 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-gray-600">
                      <span className="h-2 w-2 rounded-full bg-teal-500 inline-block" />
                      spending
                    </div>
                    <div className="font-medium text-gray-900">${fm(spent)}</div>
                  </div>
                </div>

                {/* bars */}
                <div className="flex h-full items-end gap-1.5">
                  <div
                    className="w-4 rounded-t bg-blue-500 sm:w-5"
                    style={{ height: `${hBudget}%` }}
                    title={`budget: $${fm(limit)}`}
                  />
                  <div
                    className="w-4 rounded-t bg-teal-500 sm:w-5"
                    style={{ height: `${hSpent}%` }}
                    title={`spending: $${fm(spent)}`}
                  />
                </div>

                {/* x label */}
                <div className="absolute -bottom-7 w-24 truncate text-center text-[11px] text-gray-600">
                  {c.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
