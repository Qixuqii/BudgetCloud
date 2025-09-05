import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectCurrentLedgerId, selectLedgers, loadLedgers, setCurrentLedger } from '../features/ledger/ledgerSlice';
import { fetchCategories, createCategory } from '../services/categories';
import { addTransaction } from '../services/transactions';
import { fetchBudgets, setCategoryBudget } from '../services/ledgers';

const presetExpenseCategories = [
  'Food', 'Entertainment', 'Housing', 'Utilities', 'Transport', 'Health', 'Other'
];

export default function AddExpense() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const currentLedgerId = useSelector(selectCurrentLedgerId);
  const ledgers = useSelector(selectLedgers);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [tag, setTag] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10));
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [customName, setCustomName] = useState('');

  useEffect(() => { dispatch(loadLedgers()); }, [dispatch]);
  useEffect(() => {
    (async () => {
      try {
        let rows = await fetchCategories('expense');
        if (!rows || rows.length === 0) {
          await Promise.allSettled(
            presetExpenseCategories.map((name) => createCategory({ name, type: 'expense' }))
          );
          rows = await fetchCategories('expense');
        }
        setCategories(rows || []);
        setCategoryId(rows?.[0]?.id ?? '');
      } catch (e) {
        setCategories([]);
      }
    })();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentLedgerId) { window.alert('Please select a budget first'); navigate('/ledgers'); return; }
    if (!title.trim()) { window.alert('Title cannot be empty'); return; }
    const amt = Number(amount); if (!Number.isFinite(amt) || amt <= 0) { window.alert('Amount must be greater than 0'); return; }
    try {
      let cid = categoryId;
      if (cid === 'NEW') {
        if (!customName.trim()) { window.alert('Please enter a category name'); return; }
        const created = await createCategory({ name: customName.trim(), type: 'expense' });
        cid = created?.id;
      }
      // Ensure category has a budget in this ledger/month
      const period = new Date().toISOString().slice(0,7);
      try {
        const data = await fetchBudgets(currentLedgerId, period);
        const found = (data?.items || []).find(it => it.category_id === Number(cid));
        const hasBudget = found && Number(found.budget_amount) > 0;
        if (!hasBudget) {
          const confirmAdd = window.confirm('This category has no budget in the selected budget. Add one now?');
          if (confirmAdd) {
            const input = window.prompt('Enter budget amount for this category:', '0');
            const b = Number(input);
            if (Number.isFinite(b) && b > 0) {
              await setCategoryBudget(currentLedgerId, Number(cid), b, period);
            }
          }
        }
      } catch {}
      const noteParts = [title.trim()];
      if (description.trim()) noteParts.push(description.trim());
      if (tag.trim()) noteParts.push(`#${tag.trim()}`);
      await addTransaction({
        ledger_id: currentLedgerId,
        category_id: Number(cid),
        amount: amt,
        type: 'expense',
        note: noteParts.join(' - '),
        date,
      });
      window.alert('Expense added successfully');
      navigate('/expenses');
    } catch (err) {
      window.alert('Failed to add expense');
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:max-w-4xl">
      <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-7 shadow ring-1 ring-black/5">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Add Expense</h1>
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
        </div>

        <div className="mb-6">
          <label className="mb-1 block text-xs text-gray-600">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div className="mb-6">
          <label className="mb-1 block text-xs text-gray-600">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full resize-none rounded-xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div className="mb-6">
          <label className="mb-1 block text-xs text-gray-600">Amount</label>
          <div className="flex items-center gap-2">
            <span className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-3 text-sm text-gray-700">$</span>
            <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
        </div>
        <div className="mb-6">
          <label className="mb-1 block text-xs text-gray-600">Category</label>
          <div className="grid grid-cols-12 gap-3">
            {categoryId === 'NEW' ? (
              <input className="col-span-7 rounded-xl border border-gray-300 px-3 py-3 text-sm" placeholder="New category name" value={customName} onChange={(e) => setCustomName(e.target.value)} />
            ) : (
              <select className="col-span-7 rounded-xl border border-gray-300 px-3 py-3 text-sm" value={categoryId} onChange={(e) => setCategoryId(e.target.value === 'NEW' ? 'NEW' : Number(e.target.value))}>
                {categories.length === 0 && <option value="">No categories</option>}
                {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                <option value="NEW">Custom...</option>
              </select>
            )}
            <input className="col-span-5 rounded-xl border border-gray-300 px-3 py-3 text-sm" placeholder="Tag (optional)" value={tag} onChange={(e) => setTag(e.target.value)} />
          </div>
        </div>
        <div className="mb-6">
          <label className="mb-1 block text-xs text-gray-600">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <button type="submit" className="mt-2 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow hover:bg-blue-700">Submit</button>
      </form>
    </div>
  );
}
