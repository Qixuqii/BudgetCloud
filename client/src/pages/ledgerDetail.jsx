import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  selectCurrentLedgerId,
  selectCurrentLedger,
  loadLedgerDetail,
} from "../features/ledger/ledgerSlice";
import { formatDateEN } from "../utils/date";
import Tag from "../components/Tag";
import BudgetGraph from "../components/BudgetGraph";
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

// Analyze categories and totals to generate contextual tips
function buildBudgetTips(categories = [], totals = { budget: 0, spent: 0 }) {
  const over = [];
  const risk = [];
  const ok = [];
  const noBudget = [];
  for (const c of categories) {
    const limit = Number(c.limit) || 0;
    const spent = Number(c.spent) || 0;
    if (limit <= 0) { noBudget.push(c); continue; }
    const r = spent / limit;
    if (r > 1) over.push(c);
    else if (r >= 0.8) risk.push(c);
    else ok.push(c);
  }

  const tips = [];
  const { budget = 0, spent = 0 } = totals || {};
  if (budget > 0) {
    if (spent > budget) {
      tips.push(`Overall spending is over budget by $${(spent - budget).toFixed(2)}`);
    } else {
      tips.push(`Overall remaining budget: $${(budget - spent).toFixed(2)}`);
    }
  }

  if (over.length) {
    const names = over.map(c => c.name).slice(0, 3).join(", ");
    const more = over.length > 3 ? ` +${over.length - 3} more` : "";
    tips.push(`Over-budget categories: ${names}${more}`);
  }
  if (risk.length) {
    const names = risk.map(c => c.name).slice(0, 3).join(", ");
    const more = risk.length > 3 ? ` +${risk.length - 3} more` : "";
    tips.push(`At-risk categories nearing limit: ${names}${more}`);
  }
  if (!over.length && !risk.length && ok.length) {
    tips.push("Great job — all categories on track.");
  }
  if (noBudget.length) {
    const names = noBudget.map(c => c.name).slice(0, 3).join(", ");
    const more = noBudget.length > 3 ? ` +${noBudget.length - 3} more` : "";
    tips.push(`No budget set for: ${names}${more}`);
  }

  // Severity decides container styling
  const severity = over.length ? "rose" : (risk.length ? "amber" : "emerald");
  return { tips, severity };
}

/* ------------------------ Category Card ------------------------ */
function CategoryCard({ name, spent = 0, txCount = 0, limit = 0 }) {
  const theme = getCategoryTheme(name);
  const ratio = limit > 0 ? spent / limit : 0;
  const pctText = ratio * 100; // show actual percent (can exceed 100)
  const pct = limit > 0 ? clampPct(pctText) : 0; // ring clamped

  return (
    <div className="group relative rounded-2xl bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-gray-200 transition-all duration-300 min-h-[118px] hover:-translate-y-1 hover:shadow-[0_22px_36px_rgba(37,99,235,0.18)] hover:ring-blue-200/70">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`relative flex h-11 w-11 items-center justify-center rounded-full ${theme.bg} ${theme.fg} text-base`}
            aria-hidden="true"
            title={limit > 0 ? `${pctText.toFixed(0)}% of budget used` : undefined}
          >
            <div className="transition-opacity duration-200 group-hover:opacity-0">
              {theme.icon}
            </div>
            <div className="pointer-events-none absolute inset-0 hidden items-center justify-center group-hover:flex">
              <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full">
                <circle cx="24" cy="24" r="20" className="stroke-gray-300" strokeWidth="4" fill="none" />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  className=""
                  strokeWidth="4"
                  fill="none"
                  strokeLinecap="round"
                  style={{
                    stroke: "currentColor",
                    strokeDasharray: `${2 * Math.PI * 20}`,
                    strokeDashoffset: `${(1 - pct / 100) * (2 * Math.PI * 20)}`,
                    transform: "rotate(-90deg)",
                    transformOrigin: "center",
                  }}
                />
              </svg>
              <div className={`z-10 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold leading-none ${theme.fg}`}>
                {pctText.toFixed(0)}%
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <div className="max-h-6 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-gray-900 transition-all duration-300 group-hover:max-h-24 group-hover:text-clip group-hover:whitespace-normal md:text-base">
              {name}
            </div>
            <div className="text-xs text-gray-500">
              {txCount} transaction{txCount === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        <div className="shrink-0 whitespace-nowrap text-right text-base font-bold text-gray-900 md:text-lg">
          {fmtMoney(spent)}/{fmtMoney(limit)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------ Big Budget Bar ------------------------ */
function BigBudgetBar({ budget = 0, spent = 0 }) {
  const ratio = budget > 0 ? spent / budget : 0;
  const textPct = ratio * 100; // show actual percent (can exceed 100)
  const consumedPct = budget > 0 ? clampPct(textPct) : 0; // bar width clamped
  return (
    <div className="mt-6 rounded-full bg-blue-700 px-6 py-4 text-white shadow-md">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Budget: {fmtMoney(budget)}</span>
        <span className="font-medium">{textPct.toFixed(2)}% consumed</span>
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
              const ratio = c.limit > 0 ? c.spent / c.limit : 0;
              const pct = c.limit > 0 ? clampPct(ratio * 100) : 0;
              let status = "No Budget";
              let color = "gray";
              if (c.limit > 0) {
                if (ratio < 0.8) {
                  status = "On Track";
                  color = "emerald";
                } else if (ratio <= 1) {
                  status = "At Risk";
                  color = "amber";
                } else {
                  status = "Over";
                  color = "rose";
                }
              }
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
                    <Tag color={color} size="sm">{status}</Tag>
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
  const pctText = ratio * 100; // show actual percent
  const pct = budget > 0 ? clampPct(pctText) : 0; // bar width clamped
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
          <div className="text-center text-sm">{pctText.toFixed(2)}% consumed</div>
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
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (currentId) dispatch(loadLedgerDetail({ id: currentId, period: month }));
  }, [currentId, month, dispatch]);

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
  const advice = buildBudgetTips(categories, totals);

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
          <div className="mb-2 flex items-center justify-end gap-2">
            <label className="text-xs text-gray-500" htmlFor="ledger-month-picker">Month</label>
            <input
              id="ledger-month-picker"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
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

          {/* Categories grid: 1 / 2 / 3 columns for better readability */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                  limit={c.limit}
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

      {/* Info block (dynamic tips) */}
      <div className={`mt-6 rounded-2xl p-5 text-sm leading-6 ring-1 ${
        advice.severity === "rose"
          ? "bg-rose-50 text-rose-900 ring-rose-200"
          : advice.severity === "amber"
          ? "bg-amber-50 text-amber-900 ring-amber-200"
          : "bg-emerald-50 text-emerald-900 ring-emerald-200"
      }`}>
        <div className="mb-1 flex items-center gap-2">
          <span className="text-lg">ℹ️</span>
          <span className="font-medium">Tips</span>
        </div>
        <ul className="list-disc pl-5">
          {advice.tips.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>

      {/* Budget graph under the tips */}
      <BudgetGraph categories={categories} />
    </div>
  );
}
