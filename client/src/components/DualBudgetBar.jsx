export default function DualBudgetBar({ budget = 0, spending = 0 }) {
  const fm = (n) =>
    typeof n === "number"
      ? n.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "0.00";
  const ratio = budget > 0 ? spending / budget : 0;
  const pctText = ratio * 100; // show actual percent (can exceed 100)
  const pct = budget > 0 ? Math.min(100, pctText) : 0; // bar width clamped
  const color = ratio <= 0.8 ? 'bg-emerald-500' : (ratio <= 1 ? 'bg-amber-500' : 'bg-rose-500');
  return (
    <div className="mt-4 rounded-full bg-blue-700/95 p-2 shadow">
      <div className="relative h-10 w-full overflow-hidden rounded-full bg-blue-700">
        <div className={`absolute left-0 top-0 h-full ${color}`} style={{ width: `${pct}%` }} />
        <div className="relative z-10 grid h-full grid-cols-3 items-center text-white text-xs sm:text-sm">
          <div className="pl-4">Budget: ${fm(budget)}</div>
          <div className="text-center">{pctText.toFixed(2)}% consumed</div>
          <div className="pr-4 text-right">Spending: ${fm(spending)}</div>
        </div>
      </div>
    </div>
  );
}
