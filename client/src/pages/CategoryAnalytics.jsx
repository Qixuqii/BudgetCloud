import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectCurrentLedgerId, loadLedgers } from '../features/ledger/ledgerSlice';
import { fetchTransactions } from '../services/transactions';
import { Card } from '@tremor/react';
import SmoothLineChart from '../components/SmoothLineChart';
import CategoryBarChart from '../components/CategoryBarChart';

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function monthRangeToday() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const to = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: to(start), end: to(end) };
}

function enumerateDates(s, e) {
  const rows = [];
  const start = new Date(s);
  const end = new Date(e);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return rows;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    rows.push(`${y}-${m}-${day}`);
  }
  return rows;
}

export default function CategoryAnalytics() {
  const dispatch = useDispatch();
  const ledgerId = useSelector(selectCurrentLedgerId);
  const [type, setType] = useState('expense');
  const [{ start, end }, setRange] = useState(monthRangeToday());
  const [tx, setTx] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCat, setSelectedCat] = useState('');

  useEffect(() => { dispatch(loadLedgers()); }, [dispatch]);

  useEffect(() => {
    if (!ledgerId) return;
    (async () => {
      setLoading(true);
      try {
        const rows = await fetchTransactions({ ledger_id: ledgerId, start_date: start, end_date: end, type });
        setTx(Array.isArray(rows) ? rows : []);
      } finally {
        setLoading(false);
      }
    })();
  }, [ledgerId, start, end, type]);

  const totalsByCategory = useMemo(() => {
    const map = new Map();
    for (const t of tx) {
      const key = String(t.category_id ?? '');
      if (!map.has(key)) {
        map.set(key, { id: key, name: t.category_name || 'Uncategorized', amount: 0, count: 0 });
      }
      const entry = map.get(key);
      entry.amount += Number(t.amount || 0);
      entry.count += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [tx]);

  const dailySeries = useMemo(() => {
    const dates = enumerateDates(start, end);
    const ensure = (holder, key) => {
      if (!holder.has(key)) holder.set(key, new Map());
      return holder.get(key);
    };
    const perCat = new Map();
    const all = new Map();
    for (const t of tx) {
      const key = String(t.category_id ?? '');
      const day = (t.date || '').slice(0, 10);
      const amount = Number(t.amount || 0);
      const catBucket = ensure(perCat, key);
      catBucket.set(day, (catBucket.get(day) || 0) + amount);
      all.set(day, (all.get(day) || 0) + amount);
    }
    const toSeries = (bucket) => dates.map((d) => ({ date: d, amount: bucket.get(d) || 0 }));
    const result = new Map();
    result.set('', toSeries(all));
    for (const [key, bucket] of perCat.entries()) {
      result.set(key, toSeries(bucket));
    }
    return result;
  }, [tx, start, end]);

  const categoryOptions = totalsByCategory.map((c) => ({ id: String(c.id), name: c.name }));
  const showingAll = !selectedCat;

  const metrics = useMemo(() => {
    if (showingAll) {
      const amount = totalsByCategory.reduce((acc, cur) => acc + cur.amount, 0);
      const count = totalsByCategory.reduce((acc, cur) => acc + cur.count, 0);
      return {
        heading: 'All categories',
        amount,
        count,
        avg: count ? amount / count : 0,
      };
    }
    const row = totalsByCategory.find((c) => String(c.id) === String(selectedCat));
    const amount = row?.amount || 0;
    const count = row?.count || 0;
    return {
      heading: row?.name || 'Uncategorized',
      amount,
      count,
      avg: count ? amount / count : 0,
    };
  }, [selectedCat, showingAll, totalsByCategory]);

  useEffect(() => {
    if (selectedCat && totalsByCategory.some((c) => String(c.id) === String(selectedCat))) return;
    if (!selectedCat) return;
    if (totalsByCategory.length === 0) {
      setSelectedCat('');
      return;
    }
    const first = totalsByCategory[0];
    setSelectedCat(String(first.id));
  }, [selectedCat, totalsByCategory]);

  const chartData = showingAll ? totalsByCategory : dailySeries.get(String(selectedCat)) || [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-center text-xl font-semibold text-gray-900">Category Analytics</h1>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-600">Date Range</span>
          <input
            type="date"
            value={start}
            onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
            className="rounded-md border px-2 py-1"
          />
          <span className="text-gray-500">-</span>
          <input
            type="date"
            value={end}
            onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
            className="rounded-md border px-2 py-1"
          />
        </div>
        <div className="inline-flex overflow-hidden rounded-xl border">
          <button
            className={(type === 'expense' ? 'bg-blue-600 text-white' : 'text-blue-600') + ' px-3 py-1 text-sm'}
            onClick={() => setType('expense')}
          >
            Expense
          </button>
          <button
            className={(type === 'income' ? 'bg-blue-600 text-white' : 'text-blue-600') + ' border-l px-3 py-1 text-sm'}
            onClick={() => setType('income')}
          >
            Income
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {totalsByCategory.map((c) => (
          <Card
            key={c.id}
            className={'ring-1 ring-gray-200 transition-shadow ' + (String(selectedCat) === String(c.id) ? 'border-blue-500 shadow-md' : 'hover:shadow-sm')}
            onClick={() => setSelectedCat(String(c.id))}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900">{c.name}</div>
                <div className="text-xs text-gray-500">{c.count} transaction{c.count !== 1 ? 's' : ''}</div>
              </div>
              <div className="text-[10px] uppercase tracking-wide text-blue-500">{type}</div>
            </div>
            <div className="mt-3 text-right text-lg font-semibold">${fmt(c.amount)}</div>
          </Card>
        ))}
        {totalsByCategory.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed p-6 text-center text-gray-500">
            {loading ? 'Loading...' : 'No transactions in range'}
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">{metrics.heading}</div>
          <div className="mt-1 flex items-center gap-4 text-xs text-gray-600">
            <span>Total: ${fmt(metrics.amount)}</span>
            <span>Transactions: {metrics.count}</span>
            <span>Average: ${fmt(metrics.avg)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">Category view</span>
          <select
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
          >
            <option value="">All categories</option>
            {categoryOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.name}</option>
            ))}
          </select>
        </div>
      </div>

      <Card className="ring-1 ring-gray-200">
        {showingAll ? (
          <div className="p-4">
            <CategoryBarChart data={chartData} height={340} />
          </div>
        ) : (
          <div className="p-2">
            <SmoothLineChart data={chartData} color="#2563eb" height={320} showPoints={true} showValueLabels={true} />
          </div>
        )}
      </Card>
    </div>
  );
}
