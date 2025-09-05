import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectCurrentLedgerId, loadLedgers, setCurrentLedger, selectLedgers } from '../features/ledger/ledgerSlice';
import { fetchTransactions, deleteTransaction } from '../services/transactions';
import { useNavigate } from 'react-router-dom';

export default function Expenses() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const currentLedgerId = useSelector(selectCurrentLedgerId);
  const ledgers = useSelector(selectLedgers);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = { type: 'expense' };
      if (currentLedgerId) params.ledger_id = currentLedgerId;
      const rows = await fetchTransactions(params);
      setItems(rows || []);
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { dispatch(loadLedgers()); }, [dispatch]);
  useEffect(() => { load(); }, [currentLedgerId]);

  const handleDelete = async (id) => {
    try { await deleteTransaction(id); } catch {}
    load();
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="text-sm text-gray-500">Expense</div>
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={currentLedgerId || ''}
            onChange={(e) => dispatch(setCurrentLedger(Number(e.target.value)))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            title="Select budget"
          >
            <option value="">Select Budget</option>
            {ledgers.map((l) => (
              <option key={l.id} value={l.id}>{l.name} ({l.myRole || 'viewer'})</option>
            ))}
          </select>
          <button
            onClick={() => navigate('/expenses/new')}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-50"
            disabled={!currentLedgerId || (ledgers.find(l=>l.id===currentLedgerId)?.myRole === 'viewer')}
            title={(!currentLedgerId ? 'Select a budget first' : (ledgers.find(l=>l.id===currentLedgerId)?.myRole==='viewer' ? 'Viewer cannot add expenses' : 'Add expense'))}
          >
            + Add Expense
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-gray-500">No expenses yet.</div>
      ) : (
        <ul className="space-y-4">
          {items.map((t) => (
            <li key={t.id} className="flex items-start justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">💳</div>
                <div>
                  <div className="text-sm text-gray-500">{t.category_name || 'Expense'} · {t.ledger_name || ''}</div>
                  <div className="text-xl font-semibold text-gray-900">{t.note || 'Spending'}</div>
                  <div className="mt-2 grid grid-cols-2 gap-6 text-sm text-gray-700">
                    <div>
                      <div className="text-gray-500">Amount</div>
                      <div>${Number(t.amount || 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Date</div>
                      <div>{new Date(t.date).toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/expenses/${t.id}/edit`)}
                  className="rounded-full bg-indigo-50 p-2 text-indigo-600 hover:bg-indigo-100"
                  title="Edit"
                >✏️</button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="rounded-full bg-rose-50 p-2 text-rose-600 hover:bg-rose-100"
                  title="Delete"
                >🗑️</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
