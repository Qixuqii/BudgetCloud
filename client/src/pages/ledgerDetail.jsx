import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  selectCurrentLedgerId,
  selectCurrentLedger,
  loadLedgerDetail,
} from "../features/ledger/ledgerSlice";

/* ------------------------ 工具函数 ------------------------ */
const fmtMoneyRaw = (n) =>
  typeof n === "number"
    ? n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";
const fmtMoney = (n) => `$${fmtMoneyRaw(n)}`;
const clampPct = (n) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

/* ------------------------ 组件：分类卡片 ------------------------ */
function CategoryCard({ name, spent = 0, limit = 0, txCount = 0 }) {
  const ratio = limit > 0 ? (spent / limit) : 0;
  const pct = limit > 0 ? clampPct(ratio * 100) : 0;
  const color = ratio <= 0.8 ? 'bg-emerald-500' : (ratio <= 1 ? 'bg-amber-500' : 'bg-rose-600');
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="mb-2 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 text-lg">
          🍋
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-900">{name}</div>
          <div className="text-xs text-gray-500">{txCount} transactions</div>
        </div>
      </div>

      <div className="text-sm text-gray-900">
        <span className={spent > limit && limit > 0 ? 'text-rose-600 font-medium' : ''}>{fmtMoney(spent)}</span>{" "}
        <span className="text-gray-500">/ {fmtMoney(limit)}</span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ------------------------ 组件：总预算进度（蓝条） ------------------------ */
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

/* ------------------------ 组件：Budget Analysis 表格 ------------------------ */
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
              const onTrack = pct <= 100; // 需要的话可细分阈值
              return (
                <tr key={c.id ?? idx} className="border-t border-gray-200">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                        ⏺
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
                    <span
                      className={
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 " +
                        (onTrack
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : "bg-rose-50 text-rose-700 ring-rose-200")
                      }
                    >
                      ⏳ {onTrack ? "On Track" : "Over"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {categories.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={4}>
                  No category budgets yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------ 组件：双色总进度条（底部） ------------------------ */
function DualBudgetBar({ budget = 0, spending = 0 }) {
  const ratio = budget > 0 ? (spending / budget) : 0;
  const pct = budget > 0 ? clampPct(ratio * 100) : 0;
  const color = ratio <= 0.8 ? 'bg-emerald-500' : (ratio <= 1 ? 'bg-amber-500' : 'bg-rose-500');
  return (
    <div className="mt-6 rounded-full bg-blue-700/95 p-2 shadow-lg">
      <div className="relative h-14 w-full overflow-hidden rounded-full bg-blue-700">
        {/* 左侧“已花”金色段 */}
        <div className={`absolute left-0 top-0 h-full ${color}`} style={{ width: `${pct}%` }} />
        {/* 中间/两端文案 */}
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

/* ======================== 主组件 ======================== */
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
    const s = new Date(ledger.period.start_date).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const e = new Date(ledger.period.end_date).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    return `${s} – ${e}`;
  }, [ledger]);

  if (!ledger) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-gray-500">
        加载中…
      </div>
    );
  }

  const { name, periodTitle, totals = {}, categories = [], aiSummary } = ledger;
  const { budget = 0, spent = 0 } = totals;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      {/* 顶部：标题 + 日期 + 右上角切换按钮 */}
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
            {/* 卡片视图按钮 */}
            <button
              onClick={() => setView("cards")}
              aria-pressed={view === "cards"}
              className={
                "px-3 py-1 hover:bg-blue-50 " +
                (view === "cards" ? "bg-blue-600 text-white" : "text-blue-600")
              }
              title="Cards view"
            >
              ▦
            </button>
            {/* 表格视图按钮 */}
            <button
              onClick={() => setView("table")}
              aria-pressed={view === "table"}
              className={
                "border-l border-gray-200 px-3 py-1 hover:bg-gray-50 " +
                (view === "table" ? "bg-blue-600 text-white" : "text-gray-500")
              }
              title="Table view"
            >
              ▥
            </button>
          </div>
        </div>
      </div>

      {/* 根据 view 切换两种展示 */}
      {view === "cards" ? (
        <>
          {/* 分组标题（卡片视图） */}
          <div className="mb-3 text-sm font-medium text-gray-500">
            Spending in categories with budget
          </div>

          {/* 分类卡片网格 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {categories.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed p-6 text-center text-gray-500">
                暂无分类预算，请先为分类设置本期预算。
              </div>
            ) : (
              categories.map((c) => (
                <CategoryCard
                  key={c.id}
                  name={c.name}
                  limit={c.limit}
                  spent={c.spent}
                  txCount={c.txCount}
                />
              ))
            )}
          </div>

          {/* 大蓝条：总预算进度 */}
          <BigBudgetBar budget={budget} spent={spent} />
        </>
      ) : (
        <>
          {/* 表格视图：Budget Analysis + 双色总进度条 */}
          <BudgetAnalysisTable categories={categories} />
          <DualBudgetBar budget={budget} spending={spent} />
        </>
      )}

      {/* 绿色提示块（Budget Update） */}
      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-emerald-900">
        <div className="mb-1 flex items-center gap-2 text-emerald-800">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-300 text-xs">
            i
          </span>
          <span className="font-semibold">Budget Update</span>
        </div>
        <p className="text-emerald-900">
          {aiSummary
            ? aiSummary
            : "Great job keeping an eye on your budget! Regular check-ins help you stay on track and make informed decisions."}
        </p>
      </div>

      {/* 图表区域占位（你之后接入图表库） */}
      <div className="mt-8">
        <h3 className="mb-3 text-base font-semibold text-gray-900">
          Budget Graph
        </h3>
        <div className="h-56 rounded-2xl border border-gray-200 bg-white/70 p-4 text-gray-400">
          （这里放你的图表…）
        </div>
      </div>
    </div>
  );
}
