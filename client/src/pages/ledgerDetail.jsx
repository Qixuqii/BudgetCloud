import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  selectCurrentLedgerId,
  selectCurrentLedger,
  loadLedgerDetail,
} from "../features/ledger/ledgerSlice";
import { formatDateEN } from "../utils/date";
import Tag from "../components/Tag";
import { getCategoryTheme } from "../utils/categoryTheme";

/* ------------------------ Helpers ------------------------ */
const fmtMoneyRaw = (n) =>
  typeof n === "number"
    ? n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";
const fmtMoney = (n) => `$${fmtMoneyRaw(n)}`;
const clampPct = (n) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

/* ------------------------ Category Card ------------------------ */
function CategoryCard({ name, spent = 0, txCount = 0 }) {
  const theme = getCategoryTheme(name);

  return (
    <div className="group relative rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-gray-200 transition-all duration-300 min-h-[132px] group-hover:min-h-[160px] hover:-translate-y-1 hover:shadow-[0_22px_36px_rgba(37,99,235,0.18)] hover:ring-blue-200/70">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full ${theme.bg} ${theme.fg} text-lg`}
            aria-hidden="true"
          >
            {theme.icon}
          </div>
          <div className="min-w-0">
            <div className="max-h-6 overflow-hidden text-ellipsis whitespace-nowrap text-base font-semibold text-gray-900 transition-all duration-300 group-hover:max-h-24 group-hover:text-clip group-hover:whitespace-normal">
              {name}
            </div>
            <div className="text-[13px] text-gray-500">
              {txCount} transaction{txCount === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right text-xl font-bold text-gray-900">
          {fmtMoney(spent)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------ Big Budget Bar ------------------------ */
function BigBudgetBar({ budget = 0, spent = 0 }) {
  const consumedPct = budget > 0 ? clampPct((spent / budget) * 100) : 0;
  return (
    <div className="mt-6 rounded-full bg-blue-700 px-6 py-4 text-white shadow-md">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Budget: {fmtMoney(budget)}</span>
        <span className="font-medium">{consumedPct.toFixed(2)}% consumed</span>
        <span className="font-medium">Spending: {fmtMoney(spent)}</span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-blue-800/70">
        <div
          className="h-full rounded-full bg-white/90"
          style={{ width: `${consumedPct}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------ Budget Analysis Table ------------------------ */
function BudgetAnalysisTable({ categories = [] }) {
  return (
    <div className="mt-8 rounded-2xl bg-white p-6 shadow ring-1 ring-black/5">
      <h3 className="mb-4 text-base font-semibold text-gray-900">
        Budget Analysis
      </h3>

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-0">
          <thead>
            <tr className="text-left text-sm text-gray-500">
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Budget</th>
              <th className="px-4 py-3 font-medium">Spending</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="text-sm text-gray-800">
            {categories.map((c, idx) => {
              const pct = c.limit > 0 ? clampPct((c.spent / c.limit) * 100) : 0;
              const onTrack = pct <= 100;
              return (
                <tr key={c.id ?? idx} className="border-t border-gray-200">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                        📦
                      </div>
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-gray-500">
                          {c.txCount ?? 0} transactions
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">{fmtMoney(c.limit)}</td>
                  <td className="px-4 py-4">{fmtMoney(c.spent)}</td>
                  <td className="px-4 py-4">
                    <Tag color={onTrack ? "emerald" : "rose"} size="sm">
                      {onTrack ? "On track" : "Exceeded"}
                    </Tag>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------ Dual Budget Bar (bottom) ------------------------ */
function DualBudgetBar({ budget = 0, spending = 0 }) {
  const ratio = budget > 0 ? spending / budget : 0;
  const pct = budget > 0 ? clampPct(ratio * 100) : 0;
  const color =
    ratio <= 0.8
      ? "bg-emerald-500"
      : ratio <= 1
      ? "bg-amber-500"
      : "bg-rose-500";
  return (
    <div className="mt-6 rounded-2xl bg-blue-700/95 p-2 shadow-lg">
      <div className="relative h-14 w-full overflow-hidden rounded-full bg-blue-700">
        <div
          className={`absolute left-0 top-0 h-full ${color}`}
          style={{ width: `${pct}%` }}
        />
        <div className="relative z-10 grid h-full grid-cols-3 items-center text-white">
          <div className="pl-6 text-sm">Budget: {fmtMoneyRaw(budget)}</div>
          <div className="text-center text-sm">{pct.toFixed(2)}% consumed</div>
          <div className="pr-6 text-right text-sm">
            Spending : {fmtMoneyRaw(spending)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================== Main ======================== */
export default function LedgerDetail() {
  const dispatch = useDispatch();
  const currentId = useSelector(selectCurrentLedgerId);
  const ledger = useSelector(selectCurrentLedger);
  const [view, setView] = useState("cards"); // 'cards' | 'table'

  useEffect(() => {
    if (currentId) dispatch(loadLedgerDetail(currentId));
  }, [currentId, dispatch]);

  const periodText = useMemo(() => {
    if (!ledger?.period) return "";
    return `${formatDateEN(ledger.period.start_date)} ~ ${formatDateEN(
      ledger.period.end_date
    )}`;
  }, [ledger]);

  if (!ledger) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-gray-500">
        Loading…
      </div>
    );
  }

  const { name, periodTitle, totals = {}, categories = [], aiSummary } = ledger;
  const { budget = 0, spent = 0 } = totals;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      {/* Header: title + date range + view toggle */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Budget (Spending Limit)
          </h1>
          <div className="mt-4 text-lg font-medium text-gray-900">{name}</div>
          {periodTitle && (
            <div className="mt-1 text-sm text-gray-600">{periodTitle}</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-600">{periodText}</div>
          <div className="mt-3 inline-flex overflow-hidden rounded-xl border border-gray-200">
            {/* Cards view button */}
            <button
              onClick={() => setView("cards")}
              aria-pressed={view === "cards"}
              className={
                "px-3 py-1 hover:bg-blue-50 " +
                (view === "cards" ? "bg-blue-600 text-white" : "text-blue-600")
              }
              title="Cards view"
            >
              🗂️
            </button>
            {/* Table view button */}
            <button
              onClick={() => setView("table")}
              aria-pressed={view === "table"}
              className={
                "border-l border-gray-200 px-3 py-1 hover:bg-gray-50 " +
                (view === "table" ? "bg-blue-600 text-white" : "text-gray-500")
              }
              title="Table view"
            >
              📋
            </button>
          </div>
        </div>
      </div>

      {/* Switch by view */}
      {view === "cards" ? (
        <>
          {/* Section title (cards view) */}
          <div className="mb-3 text-sm font-semibold text-gray-900">
            Expenses per category
          </div>

          {/* Categories grid */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            {categories.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed p-6 text-center text-gray-500">
                No category budgets yet. Please set budgets for this period
                first.
              </div>
            ) : (
              categories.map((c, i) => (
                <CategoryCard
                  key={c.id ?? i}
                  name={c.name}
                  spent={c.spent}
                  txCount={c.txCount}
                />
              ))
            )}
          </div>

          {/* Big blue bar */}
          <BigBudgetBar budget={budget} spent={spent} />
        </>
      ) : (
        <>
          {/* Table view: analysis + dual progress bar */}
          <BudgetAnalysisTable categories={categories} />
          <DualBudgetBar budget={budget} spending={spent} />
        </>
      )}

      {/* Info block */}
      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-emerald-900">
        <div className="mb-1 flex items-center gap-2 text-emerald-800">
          <span className="text-lg">ℹ️</span>
          <span className="font-medium">Tip</span>
        </div>
        <div>
          Keep categories on track to avoid overspending. Adjust category limits
          as needed.
        </div>
      </div>
    </div>
  );
}
