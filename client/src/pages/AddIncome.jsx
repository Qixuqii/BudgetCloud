import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { selectCurrentLedgerId, selectLedgers, loadLedgers, setCurrentLedger } from '../features/ledger/ledgerSlice';
import { fetchCategories, createCategory } from '../services/categories';
import { addTransaction } from '../services/transactions';
import CategoryManager from '../components/CategoryManager';
import { toYMD } from '../utils/date';

const presetIncomeCategories = [
  'Salary',
  'Bonus',
  'Investment',
  'Gift',
  'Refund',
  'Other',
];

export default function AddIncome() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const currentLedgerId = useSelector(selectCurrentLedgerId);
  const ledgers = useSelector(selectLedgers);
  const [searchParams] = useSearchParams();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('1');
  const [tag, setTag] = useState('');
  const [date, setDate] = useState(() => toYMD(new Date()));
  const [categories, setCategories] = useState([]); // income categories
  const [categoryId, setCategoryId] = useState('');
  const [customName, setCustomName] = useState('');

  const [showCategoryManager, setShowCategoryManager] = useState(false);

  const handleManagedCategories = (list = []) => {
  const safeList = Array.isArray(list) ? list : [];
  setCategories(safeList);
  if (categoryId === 'NEW' || categoryId === '' || categoryId == null) {
    if (safeList.length === 0) {
      setCategoryId('NEW');
    }
    return;
  }
  const currentId = Number(categoryId);
  if (!safeList.some((cat) => cat.id === currentId)) {
    if (safeList.length > 0) {
      setCategoryId(safeList[0].id);
    } else {
      setCategoryId('NEW');
      setCustomName('');
    }
  }
};

useEffect(() => { dispatch(loadLedgers()); }, [dispatch]);
  useEffect(() => {
    (async () => {
      try {
        let rows = await fetchCategories('income', currentLedgerId);
        if (!rows || rows.length === 0) {
          await Promise.allSettled(
            presetIncomeCategories.map((name) => createCategory({ name, type: 'income' }))
          );
          rows = await fetchCategories('income', currentLedgerId);
        }
        const next = Array.isArray(rows) ? rows : [];
        handleManagedCategories(next);
        if (next.length > 0) {
          setCategoryId(next[0].id);
        } else {
          setCategoryId('NEW');
        }
      } catch (e) {
        handleManagedCategories([]);
        setCategoryId('NEW');
      }
    })();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentLedgerId) {
      window.alert('Please select a budget first');
      navigate('/ledgers');
      return;
    }
    if (!title.trim()) {
      window.alert('Title cannot be empty');
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      window.alert('Amount must be greater than 0');
      return;
    }

    try {
      let cid = categoryId;
      if (cid === 'NEW') {
        if (!customName.trim()) {
          window.alert('Please enter a category name');
          return;
        }
        const created = await createCategory({ name: customName.trim(), type: 'income' });
        if (created?.id) {
          const next = [...categories.filter((cat) => cat.id !== created.id), created];
          handleManagedCategories(next);
          setCategoryId(created.id);
          cid = created.id;
        } else {
          cid = created?.id;
        }
        setCustomName('');
      }
      const noteParts = [title.trim()];
      if (description.trim()) noteParts.push(description.trim());
      if (tag.trim()) noteParts.push(`#${tag.trim()}`);
      const dateApi = String(date || '').slice(0,10);

      const payload = {
        ledger_id: currentLedgerId,
        category_id: Number(cid),
        amount: amt,
        type: 'income',
        note: noteParts.join(' - '),
        date: dateApi,
      };
      await addTransaction(payload);
      window.alert('Income added successfully');
      navigate('/incomes');
    } catch (err) {
      window.alert('Failed to add income');
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:max-w-4xl">
      <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-7 shadow ring-1 ring-black/5">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Add Income</h1>
          <select
            value={currentLedgerId || ''}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return; // prevent selecting placeholder
              dispatch(setCurrentLedger(Number(v)));
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            title="Select budget"
          >
            <option value="" disabled>Select Budget</option>
            {ledgers.map((l, idx) => (
              <option key={`${l.id}-${idx}`} value={l.id}>{l.name} ({l.myRole || 'viewer'})</option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div className="mb-6">
          <label className="mb-1 block text-xs text-gray-600">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>

        {/* Description */}
        <div className="mb-6">
          <label className="mb-1 block text-xs text-gray-600">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full resize-none rounded-xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>

        {/* Amount */}
        <div className="mb-6">
          <label className="mb-1 block text-xs text-gray-600">Amount</label>
          <div className="flex items-center gap-2">
            <span className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-3 text-sm text-gray-700">$</span>
            <input type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
        </div>

        {/* Category */}
        <div className="mb-6">
          <label className="mb-1 block text-xs text-gray-600">Category</label>
          <div className="grid grid-cols-12 gap-3">
            {categoryId === 'NEW' ? (
              <input className="col-span-7 rounded-xl border border-gray-300 px-3 py-3 text-sm" placeholder="New category name" value={customName} onChange={(e) => setCustomName(e.target.value)} />
            ) : (
              <select className="col-span-7 rounded-xl border border-gray-300 px-3 py-3 text-sm" value={categoryId} onChange={(e) => setCategoryId(e.target.value === 'NEW' ? 'NEW' : Number(e.target.value))}>
                {categories.length === 0 && <option value="">No categories</option>}
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value="NEW">Custom...</option>
              </select>
            )}
            <input className="col-span-5 rounded-xl border border-gray-300 px-3 py-3 text-sm" placeholder="Tag (optional)" value={tag} onChange={(e) => setTag(e.target.value)} />
          </div>
          <button
            type="button"
            onClick={() => setShowCategoryManager(true)}
            className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            Manage categories
          </button>
        </div>

        {/* Date */}
        <div className="mb-6">
          <label className="mb-1 block text-xs text-gray-600">Date</label>
          <input
            type="date"
            lang="en"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <button type="submit" className="mt-2 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow hover:bg-blue-700">Submit</button>
      </form>

      <CategoryManager
        type="income"
        ledgerId={currentLedgerId}
        open={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
        onChange={handleManagedCategories}
      />
    </div>
  );
}
