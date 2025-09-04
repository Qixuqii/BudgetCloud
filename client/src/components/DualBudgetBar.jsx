export default function DualBudgetBar({ budget = 0, spending = 0 }) {
  const fm = (n) =>
    typeof n === "number"
      ? n.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "0.00";
  const pct = budget > 0 ? Math.min(100, (spending / budget) * 100) : 0;
  return (
    <div className="mt-4 rounded-full bg-blue-700/95 p-2 shadow">
      <div className="relative h-10 w-full overflow-hidden rounded-full bg-blue-700">
        <div className="absolute left-0 top-0 h-full bg-amber-500" style={{ width: `${pct}%` }} />
        <div className="relative z-10 grid h-full grid-cols-3 items-center text-white text-xs sm:text-sm">
          <div className="pl-4">Budget: ${fm(budget)}</div>
          <div className="text-center">{pct.toFixed(2)}% consumed</div>
          <div className="pr-4 text-right">Spending: ${fm(spending)}</div>
        </div>
      </div>
    </div>
  );
}

