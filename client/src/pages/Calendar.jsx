import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectCurrentLedgerId, selectLedgers, loadLedgers, setCurrentLedger } from '../features/ledger/ledgerSlice';
import { fetchTransactions } from '../services/transactions';
import { formatDateEN, formatMonthEN } from '../utils/date';

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function fmtYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function CalendarPage() {
  const dispatch = useDispatch();
  const currentLedgerId = useSelector(selectCurrentLedgerId);
  const ledgers = useSelector(selectLedgers);
  const [pickedLedger, setPickedLedger] = useState(() => (currentLedgerId ? String(currentLedgerId) : 'ALL'));
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => fmtYMD(new Date()));
  const [items, setItems] = useState([]); // monthly transactions
  const [loading, setLoading] = useState(false);
  const [editMonth, setEditMonth] = useState(false);

  const monthStart = useMemo(() => startOfMonth(cursor), [cursor]);
  const monthEnd = useMemo(() => endOfMonth(cursor), [cursor]);
  const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;

  // build calendar cells (Sun -> Sat)
  const cells = useMemo(() => {
    const firstDay = monthStart.getDay(); // 0..6, Sun start
    const daysInMonth = monthEnd.getDate();
    const arr = [];
    for (let i = 0; i < firstDay; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), d));
    }
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [monthStart, monthEnd]);

  // map yyyy-mm-dd => { income:boolean, expense:boolean, list:[] }
  const dayMap = useMemo(() => {
    const map = new Map();
    for (const t of items) {
      const key = (t.date || '').slice(0, 10);
      if (!map.has(key)) map.set(key, { income: false, expense: false, list: [] });
      const v = map.get(key);
      if (t.type === 'income') v.income = true;
      if (t.type === 'expense') v.expense = true;
      v.list.push(t);
    }
    return map;
  }, [items]);

  const selectedList = dayMap.get(selected)?.list || [];
  const selectedTotal = selectedList.reduce((acc, t) => acc + Number(t.amount || 0), 0);

  useEffect(() => { dispatch(loadLedgers()); }, [dispatch]);
  // Keep local selection in sync when global current ledger changes (unless viewing ALL)
  useEffect(() => {
    if (!currentLedgerId) return;
    if (pickedLedger !== 'ALL' && pickedLedger !== String(currentLedgerId)) {
      setPickedLedger(String(currentLedgerId));
    }
  }, [currentLedgerId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = { start_date: fmtYMD(monthStart), end_date: fmtYMD(monthEnd) };
        if (pickedLedger && pickedLedger !== 'ALL') {
          params.ledger_id = Number(pickedLedger);
        }
        const rows = await fetchTransactions(params);
        setItems(rows || []);
        // If selected not in this month, default to first day of current month
        const sYM = selected.slice(0, 7);
        if (sYM !== monthKey) setSelected(fmtYMD(monthStart));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [pickedLedger, monthKey]);

  const monthTitle = formatMonthEN(monthStart);
  const monthValue = `${monthStart.getFullYear()}-${String(monthStart.getMonth()+1).padStart(2, '0')}`;

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 py-8 md:grid-cols-2">
      {/* Left: Calendar */}
      <div className="rounded-2xl bg-white p-6 shadow ring-1 ring-black/5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {editMonth ? (
              <>
                <input
                  type="month"
                  value={monthValue}
                  onChange={(e) => {
                    const [yy, mm] = (e.target.value || '').split('-').map(Number);
                    if (yy && mm) {
                      const ns = new Date(yy, mm - 1, 1);
                      setCursor(ns);
                      setSelected(fmtYMD(ns));
                    }
                  }}
                  className="rounded-md border px-2 py-1 text-xs"
                />
                <button
                  className="rounded-md border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                  onClick={() => setEditMonth(false)}
                  title="Done"
                >Done</button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-gray-900">{monthTitle}</h2>
                <button
                  className="rounded-md border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                  onClick={() => setEditMonth(true)}
                  title="Edit Month"
                >Edit</button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={pickedLedger}
              onChange={(e) => {
                const v = e.target.value;
                setPickedLedger(v);
                if (v !== 'ALL') dispatch(setCurrentLedger(Number(v)));
              }}
              className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
              title="Select budget"
            >
              <option value="ALL">All Budgets</option>
              {ledgers.map((l) => (
                <option key={l.id} value={String(l.id)}>{l.name} ({l.myRole || 'viewer'})</option>
              ))}
            </select>
            <button
              className="rounded-md border px-2 py-1 text-sm hover:bg-gray-50"
              onClick={() => setCursor(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))}
            >
              {'<'}
            </button>
            <button
              className="rounded-md border px-2 py-1 text-sm hover:bg-gray-50"
              onClick={() => setCursor(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))}
            >
              {'>'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-xs text-gray-500">
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={`${d}-${i}`} className="py-1">{d}</div>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-2">
          {cells.map((d, idx) => {
            if (!d) return <div key={idx} className="h-16 rounded-xl bg-gray-50" />;
            const key = fmtYMD(d);
            const info = dayMap.get(key);
            const isSelected = selected === key;
            return (
              <button
                key={idx}
                onClick={() => setSelected(key)}
                className={
                  "flex h-16 flex-col items-center justify-center rounded-xl border text-sm " +
                  (isSelected ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50')
                }
                title={key}
              >
                <div className="text-base font-medium">{d.getDate()}</div>
                <div className="mt-1 flex items-center gap-1">
                  {/* income dot */}
                  <span className={
                    "h-1.5 w-1.5 rounded-full " + (info?.income ? 'bg-emerald-500' : 'bg-gray-200')
                  } />
                  {/* expense dot */}
                  <span className={
                    "h-1.5 w-1.5 rounded-full " + (info?.expense ? 'bg-rose-500' : 'bg-gray-200')
                  } />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: List */}
      <div className="rounded-2xl bg-white p-6 shadow ring-1 ring-black/5">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Transactions for {formatDateEN(selected)}</h3>
            <div className="text-xs text-gray-500">Total Transactions: {selectedList.length}</div>
          </div>
          <div className="text-sm text-gray-700">Total Amount: ${selectedTotal.toFixed(2)}</div>
        </div>
        {loading ? (
          <div className="py-12 text-center text-gray-500">Loading...</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {selectedList.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className={
                    "inline-flex h-8 w-8 items-center justify-center rounded-full text-white " +
                    (t.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500')
                  }>
                    {t.type === 'income' ? '+' : '-'}
                  </span>
                  <div>
                    <div className="font-medium text-gray-900">{t.note || (t.type === 'income' ? 'Income' : 'Expense')}</div>
                    <div className="text-xs text-gray-500">Category #{t.category_id}</div>
                  </div>
                </div>
                <div className="text-sm font-medium text-gray-900">${Number(t.amount || 0).toFixed(2)}</div>
              </li>
            ))}
            {selectedList.length === 0 && (
              <li className="py-8 text-center text-gray-500">No transactions</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
