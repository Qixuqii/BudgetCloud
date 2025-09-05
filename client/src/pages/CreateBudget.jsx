import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { createNewLedger, loadLedgers } from "../features/ledger/ledgerSlice";
import { fetchCategories, createCategory } from "../services/categories";
import { setCategoryBudget, updateBudgetPeriod } from "../services/ledgers";

// Categories: bootstrap with presets if user has none
const presetCategories = [
  "Food",
  "Entertainment",
  "Housing",
  "Utilities",
  "Transport",
  "Health",
  "Other",
];

export default function CreateBudget() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [allCategories, setAllCategories] = useState([]); // [{id,name,type}]
  const [items, setItems] = useState([]); // [{id, categoryId, amount}]

  useEffect(() => {
    (async () => {
      try {
        let rows = await fetchCategories('expense');
        if (!rows || rows.length === 0) {
          // Bootstrap default categories
          await Promise.allSettled(
            presetCategories.map((name) => createCategory({ name, type: 'expense' }))
          );
          rows = await fetchCategories('expense');
        }
        setAllCategories(rows || []);
        const firstId = rows?.[0]?.id ?? null;
        setItems([{ id: 1, categoryId: firstId, amount: "" }]);
      } catch (e) {
        setAllCategories([]);
      }
    })();
  }, []);

  const totalAllocated = useMemo(
    () => items.reduce((acc, it) => acc + (parseFloat(it.amount) || 0), 0),
    [items]
  );
  const remaining = useMemo(
    () => (parseFloat(totalAmount) || 0) - totalAllocated,
    [totalAmount, totalAllocated]
  );

  const addItem = () => {
    const nextId = items.length ? Math.max(...items.map((i) => i.id)) + 1 : 1;
    const defaultCat = allCategories[0]?.id ?? null;
    setItems([...items, { id: nextId, categoryId: defaultCat, amount: "" }]);
  };
  const addNewCategory = async () => {
    const name = window.prompt('New category name');
    if (!name || !name.trim()) return;
    try {
      const created = await createCategory({ name: name.trim(), type: 'expense' });
      const updated = [...allCategories, created];
      setAllCategories(updated);
    } catch (e) {
      // ignore
    }
  };
  const removeItem = (id) => setItems(items.filter((i) => i.id !== id));
  const updateItem = (id, patch) =>
    setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const allocateRemainingToOther = () => {
    const rem = Math.max(0, remaining);
    if (!Number.isFinite(rem) || rem <= 0) return;
    const otherCatId = allCategories.find((c) => c.name?.toLowerCase() === 'other')?.id || null;
    if (!otherCatId) return;
    const idx = items.findIndex((i) => i.categoryId === otherCatId);
    if (idx >= 0) {
      const cur = parseFloat(items[idx].amount) || 0;
      updateItem(items[idx].id, { amount: String(cur + rem) });
    } else {
      const nextId = items.length ? Math.max(...items.map((i) => i.id)) + 1 : 1;
      setItems([...items, { id: nextId, categoryId: otherCatId, amount: String(rem) }]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      window.alert("Title cannot be empty");
      return;
    }
    const total = parseFloat(totalAmount);
    if (!Number.isFinite(total) || total <= 0) {
      window.alert("Amount must be greater than 0");
      return;
    }

    // Create ledger, then set category budgets for current month
    try {
      const created = await dispatch(createNewLedger({ name: title })).unwrap();
      const ledgerId = created?.id;
      const period = new Date().toISOString().slice(0, 7);
      if (ledgerId) {
        // Save description as period title
        if (description && description.trim()) {
          try {
            await updateBudgetPeriod(ledgerId, { period, title: description.trim() });
          } catch {}
        }
        // Ensure categories exist for rows marked as custom (categoryId === 'NEW')
        const prepared = [];
        for (const it of items) {
          const amt = Number(it.amount);
          if (!Number.isFinite(amt) || amt <= 0) continue;
          let cid = it.categoryId;
          if (cid === 'NEW' && it.newName && it.newName.trim()) {
            try {
              const createdCat = await createCategory({ name: it.newName.trim(), type: 'expense' });
              cid = createdCat?.id;
            } catch {}
          }
          if (cid) prepared.push({ categoryId: Number(cid), amount: amt });
        }
        // Aggregate by categoryId (sum), so multiple rows of same category accumulate
        const byCat = new Map();
        for (const r of prepared) {
          byCat.set(r.categoryId, (byCat.get(r.categoryId) || 0) + r.amount);
        }
        const tasks = Array.from(byCat.entries()).map(([cid, amt]) =>
          setCategoryBudget(ledgerId, cid, amt, period)
        );
        if (tasks.length) {
          await Promise.all(tasks);
        }
      }
      await dispatch(loadLedgers());
      window.alert("Budget created successfully");
      navigate("/ledgers");
    } catch (e2) {
      window.alert("Failed to create budget");
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:max-w-4xl">
      {/* Form only (no right gradient panel) */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white p-7 shadow ring-1 ring-black/5"
      >
        <h1 className="mb-6 text-xl font-semibold text-gray-900">Create Budget</h1>

          {/* Date range */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-600">Start</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">End</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Title */}
          <div className="mb-6">
            <label className="mb-1 block text-xs text-gray-600">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="June Budget"
              className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="mb-1 block text-xs text-gray-600">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Describe your plan"
            />
          </div>

          {/* Amount */}
          <div className="mb-6">
            <label className="mb-1 block text-xs text-gray-600">Amount</label>
            <div className="flex items-center gap-2">
              <span className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-3 text-sm text-gray-700">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="1600"
                className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Categories */}
          <div className="mb-4 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Category</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={addNewCategory}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                + New
              </button>
              <button
                type="button"
                onClick={addItem}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                + Add Category
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {items.map((it) => (
              <div key={it.id} className="grid grid-cols-12 gap-4">
                {it.categoryId === 'NEW' ? (
                  <input
                    type="text"
                    value={it.newName || ''}
                    onChange={(e) => updateItem(it.id, { newName: e.target.value })}
                    placeholder="New category name"
                    className="col-span-5 rounded-xl border border-gray-300 px-3 py-3 text-sm"
                  />
                ) : (
                  <select
                    value={it.categoryId ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateItem(it.id, { categoryId: val === 'NEW' ? 'NEW' : (Number(val) || null) });
                    }}
                    className="col-span-5 rounded-xl border border-gray-300 px-3 py-3 text-sm"
                  >
                    {allCategories.length === 0 && <option value="">No categories</option>}
                    {allCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                    <option value="NEW">Custom...</option>
                  </select>
                )}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={it.amount}
                  onChange={(e) => updateItem(it.id, { amount: e.target.value })}
                  placeholder="Enter Amount"
                  className={"col-span-6 rounded-xl border border-gray-300 px-3 py-3 text-sm"}
                />
                <button
                  type="button"
                  onClick={() => removeItem(it.id)}
                  className="col-span-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"
                  title="Remove"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>

          {/* Add remaining */}
          <button
            type="button"
            onClick={allocateRemainingToOther}
            className="mt-6 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700 hover:bg-gray-50"
          >
            Add remaining amount in 'other' category
          </button>

          {/* Totals */}
          <div className="mt-6 flex items-center justify-between text-sm text-gray-700">
            <span>Total</span>
            <span>${totalAllocated.toFixed(2)}</span>
          </div>
          <div className="mt-1 text-right text-xs text-gray-500">
            Remaining: <span className={remaining < 0 ? "text-rose-600" : ""}>${remaining.toFixed(2)}</span>
          </div>

          <button
            type="submit"
            className="mt-7 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow hover:bg-blue-700"
          >
            Submit
          </button>
      </form>
    </div>
  );
}
