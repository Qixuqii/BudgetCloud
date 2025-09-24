import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectCurrentLedgerId, selectLedgers, loadLedgers, setCurrentLedger } from '../features/ledger/ledgerSlice';
import { fetchCategories, createCategory } from '../services/categories';
import { addTransaction } from '../services/transactions';
import CategoryManager from '../components/CategoryManager';
import { fetchBudgets, setCategoryBudget, updateBudgetPeriod } from '../services/ledgers';
import { toYMD } from '../utils/date';

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
  const [amount, setAmount] = useState('1');
  const [tag, setTag] = useState('');
  const [date, setDate] = useState(() => toYMD(new Date()));
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [customName, setCustomName] = useState('');
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  // Over-budget confirmation modal state
  const [overBudget, setOverBudget] = useState(null); // { limit, spent, remaining, payload }

  // Donor selection modal state
  const [donorModal, setDonorModal] = useState(null); // { donors, amount }
  const [donorSelection, setDonorSelection] = useState(''); // '' -> increase total; otherwise donor category_id
  const donorResolveRef = useRef(null);
  const openDonorModal = (donors, amount) => new Promise((resolve) => {
    donorResolveRef.current = resolve;
    setDonorSelection('');
    setDonorModal({ donors, amount });
  });
  const closeDonorModal = () => { setDonorModal(null); };
  const handleDonorCancel = () => {
    donorResolveRef.current?.(null);
    closeDonorModal();
  };
  const handleDonorConfirm = () => {
    const val = donorSelection;
    if (!val) {
      donorResolveRef.current?.({ type: 'increase' });
    } else {
      donorResolveRef.current?.({ type: 'donor', donorId: Number(val) });
    }
    closeDonorModal();
  };

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
        let rows = await fetchCategories('expense', currentLedgerId);
        if (!rows || rows.length === 0) {
          await Promise.allSettled(
            presetExpenseCategories.map((name) => createCategory({ name, type: 'expense' }))
          );
          rows = await fetchCategories('expense', currentLedgerId);
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
    if (!currentLedgerId) { window.alert('Please select a budget first'); navigate('/ledgers'); return; }
    if (!title.trim()) { window.alert('Title cannot be empty'); return; }
    const amt = Number(amount); if (!Number.isFinite(amt) || amt <= 0) { window.alert('Amount must be greater than 0'); return; }
    try {
      let cid = categoryId;
      if (cid === 'NEW') {
        if (!customName.trim()) { window.alert('Please enter a category name'); return; }
        const created = await createCategory({ name: customName.trim(), type: 'expense' });
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
      // Ensure category has a budget in this ledger/month
      const period = new Date().toISOString().slice(0,7);
      try {
        const data = await fetchBudgets(currentLedgerId, period);
        const items = data?.items || [];
        const found = items.find(it => it.category_id === Number(cid));
        const hasBudget = found && Number(found.budget_amount) > 0;
        if (!hasBudget) {
          const confirmAdd = window.confirm('No budget is set for this category in the selected budget. Create one now?');
          if (!confirmAdd) { window.alert('Budget creation canceled'); return; }

          const input = window.prompt('Enter a budget amount for this category (e.g., 100):', '0');
          if (input === null) { window.alert('Budget creation canceled'); return; }

          const b = Number(input);
          if (!Number.isFinite(b) || b <= 0) { window.alert('Invalid amount. Budget creation canceled'); return; }

          // Ask reallocation target to keep total unchanged
          const donors = items.filter(it => it.category_id !== Number(cid) && Number(it.budget_amount) > 0);
          let increaseBy = 0;
          let donorUpdate = null; // {id, newAmt}
          if (donors.length > 0) {
            const choice = await openDonorModal(donors, b);
            if (!choice) { window.alert('Budget creation canceled'); return; }
            if (choice.type === 'increase') {
              const proceed = window.confirm(`Increase overall total budget by $${b.toFixed(2)}?`);
              if (!proceed) return;
              increaseBy = b;
            } else {
              const donor = donors.find(d => d.category_id === choice.donorId);
              if (!donor) { window.alert('Category not found.'); return; }
              const donorAmt = Number(donor.budget_amount) || 0;
              if (donorAmt >= b) {
                donorUpdate = { id: donor.category_id, newAmt: donorAmt - b };
              } else {
                const diff = b - donorAmt;
                const proceed = window.confirm(`Selected category has only $${donorAmt.toFixed(2)}. Set it to $0 and increase total by $${diff.toFixed(2)}?`);
                if (!proceed) return;
                donorUpdate = { id: donor.category_id, newAmt: 0 };
                increaseBy = diff;
              }
            }
          } else {
            const proceed = window.confirm(`No categories to reallocate from. Increase overall total budget by $${b.toFixed(2)}?`);
            if (!proceed) return;
            increaseBy = b;
          }

          try {
            await setCategoryBudget(currentLedgerId, Number(cid), b, period);
            if (donorUpdate) await setCategoryBudget(currentLedgerId, donorUpdate.id, donorUpdate.newAmt, period);
            if (increaseBy > 0) {
              const currentTotal = Number(data?.total) || items.reduce((a, it) => a + (Number(it.budget_amount) || 0), 0);
              await updateBudgetPeriod(currentLedgerId, { period, totalBudget: currentTotal + increaseBy });
            }
          } catch {
            window.alert('Failed to create or adjust budget');
            return;
          }
        }
      } catch {
        // If budget lookup fails, proceed as before (do not block),
        // but cancellation path above will still return early.
      }
      const noteParts = [title.trim()];
      if (description.trim()) noteParts.push(description.trim());
      if (tag.trim()) noteParts.push(`#${tag.trim()}`);
      // date already in YYYY-MM-DD
      const dateApi = String(date || '').slice(0,10);

      const payload = {
        ledger_id: currentLedgerId,
        category_id: Number(cid),
        amount: amt,
        type: 'expense',
        note: noteParts.join(' - '),
        date: dateApi,
      };
      await addTransaction(payload);
      window.alert('Expense added successfully');
      navigate('/expenses');
    } catch (err) {
      const data = err?.response?.data;
      if (data?.code === 'BUDGET_EXCEEDED') {
        const r = data.details?.remaining;
        const lim = data.details?.limit;
        const spent = data.details?.spent;
        // Save state for custom confirmation modal with english buttons
        setOverBudget({ limit: lim, spent, remaining: r, payload: err?.config?.data ? JSON.parse(err.config.data) : null });
      } else {
        window.alert('Failed to add expense');
      }
    }
  };

  const handleConfirmCreateAnyway = async () => {
    const p = overBudget?.payload;
    // If we couldn't parse payload from error, rebuild from current form values
    const fallback = {
      ledger_id: currentLedgerId,
      category_id: typeof categoryId === 'number' ? categoryId : Number(categoryId),
      amount: Number(amount),
      type: 'expense',
      note: [title.trim() || 'Expense', description.trim()].filter(Boolean).join(' - ') + (tag.trim() ? ` - #${tag.trim()}` : ''),
      date: (() => { const m = String(date||'').match(/^(\d{4})\/(\d{2})\/(\d{2})$/); return m ? `${m[1]}-${m[2]}-${m[3]}` : String(date||'').slice(0,10); })(),
    };
    const retryPayload = { ...(p || fallback), allow_exceed: true };
    try {
      await addTransaction(retryPayload);
      window.alert('Expense added successfully');
      navigate('/expenses');
    } catch {
      window.alert('Failed to add expense');
    } finally {
      setOverBudget(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:max-w-4xl">
      <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-7 shadow ring-1 ring-black/5">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Add Expense</h1>
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
            <input type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
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
          <button
            type="button"
            onClick={() => setShowCategoryManager(true)}
            className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            Manage categories
          </button>
        </div>
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

      {overBudget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[90%] max-w-md rounded-2xl bg-white p-6 shadow ring-1 ring-black/5">
            <div className="mb-4 text-sm text-gray-700 whitespace-pre-line">
              {`This expense exceeds the category budget.\n` +
               `Limit: $${Number(overBudget.limit ?? 0).toFixed(2)}\n` +
               `Spent: $${Number(overBudget.spent ?? 0).toFixed(2)}\n` +
               `Remaining: $${Number(overBudget.remaining ?? 0).toFixed(2)}`}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setOverBudget(null)}
              >
                Cancel Creation
              </button>
              <button
                type="button"
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                onClick={handleConfirmCreateAnyway}
              >
                Create Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Donor selection modal */}
      {donorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[90%] max-w-md rounded-2xl bg-white p-6 shadow ring-1 ring-black/5">
            <div className="mb-4 text-sm text-gray-700">
              To keep total budget unchanged, deduct from which category?
            </div>
            <label className="mb-2 block text-xs text-gray-600">Select category to deduct</label>
            <select
              value={donorSelection}
              onChange={(e) => setDonorSelection(e.target.value)}
              className="mb-4 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Increase total budget by entered amount</option>
              {donorModal.donors.map((d) => (
                <option key={d.category_id} value={d.category_id}>
                  {d.category_name} ($
                  {Number(d.budget_amount || 0).toFixed(2)})
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={handleDonorCancel} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={handleDonorConfirm} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">Confirm</button>
            </div>
          </div>
        </div>
      )}

      <CategoryManager
        type="expense"
        ledgerId={currentLedgerId}
        open={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
        onChange={handleManagedCategories}
      />
    </div>
  );
}
