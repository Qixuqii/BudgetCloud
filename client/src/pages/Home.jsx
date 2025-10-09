import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectCurrentLedgerId, selectLedgers, loadLedgers, setCurrentLedger } from "../features/ledger/ledgerSlice";
import { fetchTransactions } from "../services/transactions";
import StackedBarChart from "../components/StackedBarChart";
import CombinedCategoryDonut from "../components/CombinedCategoryDonut";
import { formatDateEN } from "../utils/date";

function monthBoundaries(offset = 0) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offset; // offset months from current
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  const to = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: to(start), end: to(end) };
}

function enumerateDates(s, e) {
  const res = [];
  const sd = new Date(s), ed = new Date(e);
  for (let d = new Date(sd); d <= ed; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    res.push(`${y}-${m}-${day}`);
  }
  return res;
}

const Home = () => {
  const dispatch = useDispatch();
  const currentLedgerId = useSelector(selectCurrentLedgerId);
  const ledgers = useSelector(selectLedgers);

  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [txCurr, setTxCurr] = useState({ income: [], expense: [] });
  const [txPrev, setTxPrev] = useState({ income: [], expense: [] });
  const [recentTx, setRecentTx] = useState([]);

  useEffect(() => { dispatch(loadLedgers()); }, [dispatch]);

  const monthRange = useMemo(() => {
    const [yy, mm] = String(month || '').split('-').map(Number);
    const start = new Date(yy, (mm || 1) - 1, 1);
    const end = new Date(yy, (mm || 1), 0);
    const to = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { cs: to(start), ce: to(end) };
  }, [month]);

  const prevMonthRange = useMemo(() => {
    const [yy, mm] = String(month || '').split('-').map(Number);
    const prev = new Date(yy, (mm || 1) - 2, 1);
    const start = new Date(prev.getFullYear(), prev.getMonth(), 1);
    const end = new Date(prev.getFullYear(), prev.getMonth() + 1, 0);
    const to = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { ps: to(start), pe: to(end) };
  }, [month]);

  useEffect(() => {
    if (!currentLedgerId) return;
    const { cs, ce } = monthRange;
    const { ps, pe } = prevMonthRange;
    (async () => {
      setLoading(true);
      try {
        const [ci, cee, pi, pee, recentList] = await Promise.all([
          fetchTransactions({ ledger_id: currentLedgerId, start_date: cs, end_date: ce, type: 'income' }),
          fetchTransactions({ ledger_id: currentLedgerId, start_date: cs, end_date: ce, type: 'expense' }),
          fetchTransactions({ ledger_id: currentLedgerId, start_date: ps, end_date: pe, type: 'income' }),
          fetchTransactions({ ledger_id: currentLedgerId, start_date: ps, end_date: pe, type: 'expense' }),
          // Recent 10 transactions across all time (by date desc)
          fetchTransactions({ ledger_id: currentLedgerId, limit: 10, order_by: 'date', order: 'desc' }),
        ]);
        setTxCurr({ income: ci || [], expense: cee || [] });
        setTxPrev({ income: pi || [], expense: pee || [] });
        setRecentTx(recentList || []);
      } finally { setLoading(false); }
    })();
  }, [currentLedgerId, monthRange, prevMonthRange]);

  const sums = (list) => list.reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const currIncome = sums(txCurr.income);
  const currExpense = sums(txCurr.expense);
  const currSavings = currIncome - currExpense;
  const prevIncome = sums(txPrev.income);
  const prevExpense = sums(txPrev.expense);
  const prevSavings = prevIncome - prevExpense;

  const delta = (now, prev) => now - prev;
  const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Daily series for stacked bars (income + expense)
  const { cs, ce } = monthRange;
  const dailySeries = useMemo(() => {
    const inc = new Map();
    const exp = new Map();
    for (const t of txCurr.income) {
      const d = (t.date || '').slice(0,10);
      inc.set(d, (inc.get(d) || 0) + Number(t.amount || 0));
    }
    for (const t of txCurr.expense) {
      const d = (t.date || '').slice(0,10);
      exp.set(d, (exp.get(d) || 0) + Number(t.amount || 0));
    }
    return enumerateDates(cs, ce).map(d => ({ date: d, income: inc.get(d) || 0, expense: exp.get(d) || 0 }));
  }, [txCurr.expense, txCurr.income]);

  // Pie: expense by category
  const pieExpense = useMemo(() => {
    const map = new Map();
    for (const t of txCurr.expense) {
      const name = t.category_name || 'Other';
      map.set(name, (map.get(name) || 0) + Number(t.amount || 0));
    }
    const arr = Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    arr.sort((a,b) => b.value - a.value);
    return arr.slice(0, 5); // top 5
  }, [txCurr.expense]);
  // Pie: income by category
  const pieIncome = useMemo(() => {
    const map = new Map();
    for (const t of txCurr.income) {
      const name = t.category_name || 'Other';
      map.set(name, (map.get(name) || 0) + Number(t.amount || 0));
    }
    const arr = Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    arr.sort((a,b) => b.value - a.value);
    return arr.slice(0, 5);
  }, [txCurr.income]);

  // Recent combined transactions (latest 10 across all dates)
  const recent = useMemo(() => {
    const list = [...(recentTx || [])]
      .sort((a, b) => {
        const da = new Date(a.date || 0).getTime();
        const db = new Date(b.date || 0).getTime();
        if (db !== da) return db - da;
        return (b.id || 0) - (a.id || 0);
      })
      .slice(0, 10);
    return list;
  }, [recentTx]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Monthly Performance Dashboard</h1>
        <div className="flex items-center gap-2">
          <select
            value={currentLedgerId || ''}
            onChange={(e)=>{ const v = e.target.value; if(!v) return; dispatch(setCurrentLedger(Number(v))); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            title="Select budget"
          >
            <option value="" disabled>Select Budget</option>
            {ledgers.map((l, idx) => (
              <option key={`${l.id}-${idx}`} value={l.id}>{l.name} ({l.myRole || 'viewer'})</option>
            ))}
          </select>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            title="Select month"
          />
        </div>
      </div>

      {/* Metrics cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[{
          title: 'Savings', value: currSavings, prev: prevSavings, goodUp: true
        }, {
          title: 'Expenses', value: currExpense, prev: prevExpense, goodUp: false
        }, {
          title: 'Income', value: currIncome, prev: prevIncome, goodUp: true
        }].map((m, idx) => {
          const d = delta(m.value, m.prev);
          const up = d >= 0;
          const good = (up && m.goodUp) || (!up && !m.goodUp);
          return (
            <div key={idx} className="rounded-2xl bg-white p-5 shadow ring-1 ring-black/5">
              <div className="text-sm text-gray-600">{m.title}</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{money(m.value)} <span className="text-sm font-normal text-gray-500">from {money(m.prev)}</span></div>
              <div className="mt-3 inline-flex items-center gap-2 text-sm">
                <span className={`inline-flex h-6 items-center rounded-full px-2 ${good ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {good ? '↑' : '↓'} {money(Math.abs(d))} to previous month
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Stacked bar: income + expense */}
        <div className="lg:col-span-2 rounded-2xl bg-white p-5 shadow ring-1 ring-black/5">
          <div className="mb-3 text-sm text-gray-600">Cashflow (Stacked)</div>
          <StackedBarChart data={dailySeries} height={280} />
        </div>
        {/* Overview: combined category donut (income + expense in one) */}
        <div className="rounded-2xl bg-white p-5 shadow ring-1 ring-black/5">
          <div className="mb-3 text-sm text-gray-600">Overview</div>
          <CombinedCategoryDonut data={useMemo(()=>{
            const map = new Map();
            for (const t of txCurr.income) {
              const k = t.category_name || 'Other';
              const v = Number(t.amount || 0);
              const row = map.get(k) || { name: k, income: 0, expense: 0 };
              row.income += v; map.set(k, row);
            }
            for (const t of txCurr.expense) {
              const k = t.category_name || 'Other';
              const v = Number(t.amount || 0);
              const row = map.get(k) || { name: k, income: 0, expense: 0 };
              row.expense += v; map.set(k, row);
            }
            // sort by total desc, take top 6 for readability
            return Array.from(map.values()).sort((a,b)=> (b.income+b.expense) - (a.income+a.expense)).slice(0,6);
          }, [txCurr])} />
        </div>
      </div>

      {/* Last incoming / recent activity */}
      <div className="mt-6 rounded-2xl bg-white p-5 shadow ring-1 ring-black/5">
        <div className="mb-3 text-sm font-semibold text-gray-900">Last incoming</div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-0">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-3 py-2 font-medium">Username</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Budget</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="text-sm text-gray-800">
              {recent.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-gray-500" colSpan={5}>
                    No recent transactions
                  </td>
                </tr>
              ) : (
                recent.map((t, idx) => {
                  const initial = String(t.created_by_username || "?").slice(0, 1).toUpperCase();
                  const amt = Number(t.amount || 0);
                  const cls = t.type === 'income' ? 'text-emerald-600' : 'text-rose-600';
                  return (
                    <tr key={`${t.id || 'row'}-${idx}`} className="border-t border-gray-200">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                            {initial}
                          </div>
                          <div className="font-medium">{t.created_by_username || 'Unknown'}</div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {t.note || t.category_name || (t.type === 'income' ? 'Income' : 'Expense')}
                      </td>
                      <td className="px-3 py-3">{formatDateEN(t.date)}</td>
                      <td className="px-3 py-3">{t.ledger_name || ''}</td>
                      <td className="px-3 py-3 text-right">
                        <span className={`font-semibold ${cls}`}>
                          {t.type === 'income' ? '+' : '-'}${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

function Donut({ data = [] }) {
  // Simple SVG donut chart
  const total = data.reduce((a,b)=>a + Number(b.value||0), 0) || 1;
  const size = 180; const stroke = 26; const r = (size - stroke) / 2; const cx = size/2; const cy = size/2;
  let acc = 0;
  const colors = ["#60a5fa","#3b82f6","#2563eb","#1d4ed8","#93c5fd"];
  const arcs = data.map((d, i) => {
    const val = Number(d.value || 0);
    const start = (acc / total) * 2 * Math.PI; acc += val; const end = (acc / total) * 2 * Math.PI;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
    return { path, color: colors[i % colors.length], value: val, name: d.name };
  });
  return (
    <div className="flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* background circle */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        {arcs.map((a, i) => (
          <path key={i} d={a.path} fill="none" stroke={a.color} strokeWidth={stroke} />
        ))}
        {/* hole */}
        {/* center text is done via HTML overlay for better fonts */}
      </svg>
    </div>
  );
}

export default Home;
