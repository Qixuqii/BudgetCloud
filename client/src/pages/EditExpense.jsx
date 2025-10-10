import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { selectCurrentLedgerId } from '../features/ledger/ledgerSlice';
import { fetchCategories, createCategory } from '../services/categories';
import { fetchTransaction, updateTransaction, deleteTransaction } from '../services/transactions';
import CategoryManager from '../components/CategoryManager';
import { fetchBudgets, setCategoryBudget, setCategoryBudgetWithReplacement, updateBudgetPeriod } from '../services/ledgers';
import { toYMD } from '../utils/date';

const presetExpenseCategories = ['Food','Entertainment','Housing','Utilities','Transport','Health','Other'];

export default function EditExpense() {
  const { id } = useParams();
  const txId = Number(id);
  const navigate = useNavigate();
  const currentLedgerId = useSelector(selectCurrentLedgerId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('1');
  const [tag, setTag] = useState('');
  const [date, setDate] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [customName, setCustomName] = useState('');
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  // Donor selection modal state
  const [donorModal, setDonorModal] = useState(null); // { donors, amount }
  const [donorSelection, setDonorSelection] = useState('');
  const donorResolveRef = useRef(null);
  const openDonorModal = (donors, amount) => new Promise((resolve) => {
    donorResolveRef.current = resolve;
    setDonorSelection('');
    setDonorModal({ donors, amount });
  });
  const closeDonorModal = () => setDonorModal(null);
  const handleDonorCancel = () => { donorResolveRef.current?.(null); closeDonorModal(); };
  const handleDonorConfirm = () => {
    const val = donorSelection;
    if (!val) donorResolveRef.current?.({ type: 'increase' });
    else donorResolveRef.current?.({ type: 'donor', donorId: Number(val) });
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

  useEffect(() => { (async () => {
    try {
      let rows = await fetchCategories('expense', currentLedgerId);
      if (!rows || rows.length === 0) {
        await Promise.allSettled(presetExpenseCategories.map(name => createCategory({ name, type: 'expense' })));
        rows = await fetchCategories('expense', currentLedgerId);
      }
      const next = Array.isArray(rows) ? rows : [];
      handleManagedCategories(next);
      if (next.length === 0) {
        setCategoryId('NEW');
      } else if (categoryId === '' || categoryId == null || categoryId === 'NEW') {
        setCategoryId(next[0].id);
      }
    } catch {}
  })(); }, []);

  useEffect(() => { (async () => {
    try {
      const tx = await fetchTransaction(txId);
      setAmount(String(tx.amount || '1'));
      const d0 = tx.date ? new Date(tx.date) : new Date();
      setDate(toYMD(d0));
      setCategoryId(tx.category_id || '');
      const note = tx.note || '';
      const parts = note.split(' - ');
      if (parts.length > 0) setTitle(parts[0] || '');
      if (parts.length > 1) setDescription(parts[1] || '');
      if (parts.length > 2) setTag(parts[2]?.replace(/^#/, '') || '');
    } catch {}
  })(); }, [txId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentLedgerId) { window.alert('Please select a budget first'); navigate('/ledgers'); return; }
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
      // Ensure selected category has a budget in the current ledger + month
      const period = (String(date || '').slice(0,7) || new Date().toISOString().slice(0,7));
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

          // Reallocation prompt to keep total unchanged, or increase total
          const donors = items
            .filter(it => it.category_id !== Number(cid))
            .map(it => ({
              ...it,
              available: Math.max(0, (Number(it.budget_amount) || 0) - (Number(it.spent_amount) || 0)),
            }))
            .filter(it => it.available > 0);
          let increaseBy = 0;
          let donorReplace = null; // {id, reduce}
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
              const avail = Number(donor.available) || 0;
              if (avail < b) { window.alert('Insufficient available budget in selected category'); return; }
              donorReplace = { id: donor.category_id, reduce: b };
            }
          } else {
            const proceed = window.confirm(`No categories to reallocate from. Increase overall total budget by $${b.toFixed(2)}?`);
            if (!proceed) return;
            increaseBy = b;
          }

          try {
            if (donorReplace) {
              await setCategoryBudgetWithReplacement(
                currentLedgerId,
                Number(cid),
                b,
                period,
                [{ category_id: donorReplace.id, amount: donorReplace.reduce }]
              );
            } else {
              await setCategoryBudget(currentLedgerId, Number(cid), b, period);
            }
            if (increaseBy > 0) {
              const currentTotal = Number(data?.total) || items.reduce((a, it) => a + (Number(it.budget_amount) || 0), 0);
              await updateBudgetPeriod(currentLedgerId, { period, totalBudget: currentTotal + increaseBy });
            }
            // Broadcast budget updated so Budget Analysis view refreshes
            try { window.dispatchEvent(new CustomEvent('budget-updated', { detail: { ledgerId: currentLedgerId, period } })); } catch {}
          } catch (err) {
            const msg = err?.response?.data?.message || 'Failed to create or adjust budget';
            if (err?.response?.data?.code === 'BUDGET_REPLACEMENT_DENIED') {
              const fails = err.response.data.details || [];
              const reason = fails.map(f => `#${f.category_id}: ${f.reason || 'insufficient'}`).join(', ');
              window.alert(`Replacement denied: ${reason}`);
            } else {
              window.alert(msg);
            }
            return;
          }
        }
      } catch {
        // if budget fetch fails, continue but keep the normal submit flow
      }
      const noteParts = [title.trim() || 'Expense'];
      if (description.trim()) noteParts.push(description.trim());
      if (tag.trim()) noteParts.push(`#${tag.trim()}`);
      const dateApi = String(date || '').slice(0,10);

      await updateTransaction(txId, {
        ledger_id: currentLedgerId,
        category_id: Number(cid),
        amount: amt,
        type: 'expense',
        note: noteParts.join(' - '),
        date: dateApi,
      });
      window.alert('Expense updated successfully');
      navigate('/expenses');
    } catch {
      window.alert('Failed to update expense');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this expense?')) return;
    try { await deleteTransaction(txId); navigate('/expenses'); } catch { window.alert('Delete failed'); }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:max-w-4xl">
      <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-7 shadow ring-1 ring-black/5">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Edit Expense</h1>
          <button type="button" onClick={handleDelete} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700">Delete</button>
        </div>

        <div className="mb-6">
          <label className="mb-1 block text-xs text-gray-600">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm" />
        </div>
        <div className="mb-6">
          <label className="mb-1 block text-xs text-gray-600">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full resize-none rounded-xl border border-gray-300 px-3 py-3 text-sm" />
        </div>
        <div className="mb-6">
          <label className="mb-1 block text-xs text-gray-600">Amount</label>
          <div className="flex items-center gap-2">
            <span className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-3 text-sm text-gray-700">$</span>
            <input type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm" />
          </div>
        </div>
        <div className="mb-6">
          <label className="mb-1 block text-xs text-gray-600">Category</label>
          {categoryId === 'NEW' ? (
            <input className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm" placeholder="New category name" value={customName} onChange={(e) => setCustomName(e.target.value)} />
          ) : (
            <select className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm" value={categoryId} onChange={(e) => setCategoryId(e.target.value === 'NEW' ? 'NEW' : Number(e.target.value))}>
              {categories.length === 0 && <option value="">No categories</option>}
              {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              <option value="NEW">Custom...</option>
            </select>
          )}
          <button
            type="button"
            onClick={() => setShowCategoryManager(true)}
            className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            Manage categories
          </button>
        </div>
        <div className="mb-6">
          <label className="mb-1 block text-xs text-gray-600">Tag</label>
          <input value={tag} onChange={(e) => setTag(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm" placeholder="Tag (optional)" />
        </div>
        <div className="mb-6">
          <label className="mb-1 block text-xs text-gray-600">Date</label>
          <input
            type="date"
            lang="en"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm"
          />
        </div>
        <button type="submit" className="mt-2 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow hover:bg-blue-700">Update</button>
      </form>

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
                <option key={d.category_id} value={d.category_id} disabled={Number(d.available || 0) < Number(donorModal.amount || 0)}>
                  {d.category_name} (${Number(d.available || 0).toFixed(2)} available)
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
