import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { saveLedger, loadLedgers } from "../features/ledger/ledgerSlice";
import { fetchCategories, createCategory } from "../services/categories";
import {
  fetchLedgerDetail,
  setCategoryBudget,
  removeCategoryBudget,
  updateBudgetPeriod,
} from "../services/ledgers";
import Tag from "../components/Tag";
import CategoryManager from "../components/CategoryManager";

const presetCategories = [
  "Food",
  "Entertainment",
  "Housing",
  "Utilities",
  "Transport",
  "Health",
  "Other",
];

export default function EditBudget() {
  const { id } = useParams();
  const ledgerId = Number(id);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [totalBudget, setTotalBudget] = useState("");
  const [allCategories, setAllCategories] = useState([]); // [{id,name,type}]
  const [items, setItems] = useState([]); // [{id, categoryId|'NEW', newName?, amount}]
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const isCategoryTaken = (catId, excludeId) =>
    items.some((entry) => entry.id !== excludeId && entry.categoryId === catId);

  const findFirstAvailableCategoryId = (existingItems) => {
    const used = new Set(
      (existingItems ?? [])
        .map((entry) => entry.categoryId)
        .filter((id) => id != null && id !== "NEW")
    );
    const available = allCategories.find((cat) => !used.has(cat.id));
    return available?.id ?? null;
  };

  const handleManagedCategories = (list = []) => {
    const safeList = Array.isArray(list) ? list : [];
    setAllCategories(safeList);
    setItems((prev) =>
      prev.map((entry) => {
        if (entry.categoryId === "NEW" || entry.categoryId == null) {
          return entry;
        }
        return safeList.some((cat) => cat.id === entry.categoryId)
          ? entry
          : { ...entry, categoryId: "NEW", newName: "" };
      })
    );
  };

  const [initialCatAmounts, setInitialCatAmounts] = useState(new Map()); // Map<categoryId, amount>

  const period = useMemo(() => month, [month]);

  useEffect(() => {
    (async () => {
      try {
        // Load categories (bootstrap if empty)
        let cats = await fetchCategories("expense", ledgerId);
        if (!cats || cats.length === 0) {
          await Promise.allSettled(
            presetCategories.map((name) =>
              createCategory({ name, type: "expense" })
            )
          );
          cats = await fetchCategories("expense", ledgerId);
        }
        const safeCats = Array.isArray(cats) ? cats : [];

        // Load ledger detail (including current month budgets)
        const detail = await fetchLedgerDetail(ledgerId, period);
        setTitle(detail?.name || "");
        setDesc(detail?.periodTitle || "");
        setTotalBudget(
          detail?.totals?.budget != null ? String(detail.totals.budget) : ""
        );
        const rows = (detail?.categories || [])
          .filter((c) => Number(c.limit) > 0)
          .map((c, idx) => ({
            id: idx + 1,
            categoryId: c.id,
            amount: String(c.limit),
          }));

        const fallbackId = safeCats.length > 0 ? safeCats[0].id : "NEW";
        const initialItems = rows.length
          ? rows
          : [{ id: 1, categoryId: fallbackId, amount: "" }];
        setItems(initialItems);
        const initMap = new Map();
        for (const r of rows) initMap.set(r.categoryId, Number(r.amount));
        setInitialCatAmounts(initMap);
        handleManagedCategories(safeCats);
      } catch (e) {
        // noop
      }
    })();
  }, [ledgerId, period]);

  const totalAllocated = useMemo(
    () => items.reduce((acc, it) => acc + (parseFloat(it.amount) || 0), 0),
    [items]
  );

  const addItem = () => {
    setItems((prev) => {
      const nextId = prev.length ? Math.max(...prev.map((i) => i.id)) + 1 : 1;
      const availableId = findFirstAvailableCategoryId(prev);
      return [
        ...prev,
        { id: nextId, categoryId: availableId ?? "NEW", amount: "" },
      ];
    });
  };
  const removeItem = (id) => setItems(items.filter((i) => i.id !== id));
  const updateItem = (id, patch) =>
    setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  // Add remaining amount helper
  const remainingForItem = (_id) => {
    // Remaining should be based on the current total allocation,
    // so that after one +R click it becomes 0 for subsequent clicks.
    const tot = Number(totalBudget);
    if (!Number.isFinite(tot) || tot <= 0) return 0;
    const sumAll = items.reduce(
      (acc, it) => acc + (parseFloat(it.amount) || 0),
      0
    );
    const rem = tot - sumAll;
    return rem > 0 ? rem : 0;
  };
  const addRemainingToItem = (id) => {
    const current = items.find((it) => it.id === id);
    if (!current) return;
    const add = remainingForItem(id);
    const next = ((parseFloat(current.amount) || 0) + add).toFixed(2);
    updateItem(id, { amount: String(next) });
  };

  const addNewCategory = async () => {
    const name = window.prompt("New category name");
    if (!name || !name.trim()) return;
    try {
      const created = await createCategory({
        name: name.trim(),
        type: "expense",
      });
      if (created?.id) {
        const updated = [
          ...allCategories.filter((cat) => cat.id !== created.id),
          created,
        ];
        handleManagedCategories(updated);
      }
    } catch {
      window.alert("Failed to create category");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      window.alert("Title cannot be empty");
      return;
    }
    try {
      // Update ledger name
      await dispatch(
        saveLedger({ id: ledgerId, changes: { name: title.trim() } })
      ).unwrap();

      // Prepare budgets (create custom categories if any), aggregate by category
      const prepared = [];
      for (const it of items) {
        const amt = Number(it.amount);
        if (!Number.isFinite(amt) || amt <= 0) continue;
        let cid = it.categoryId;
        if (cid === "NEW" && it.newName && it.newName.trim()) {
          try {
            const created = await createCategory({
              name: it.newName.trim(),
              type: "expense",
            });
            cid = created?.id;
          } catch {}
        }
        if (cid) prepared.push({ categoryId: Number(cid), amount: amt });
      }
      const byCat = new Map();
      for (const r of prepared)
        byCat.set(r.categoryId, (byCat.get(r.categoryId) || 0) + r.amount);

      // Validate total budget > sum of category budgets
      const sumCat = Array.from(byCat.values()).reduce((a, b) => a + b, 0);
      const tot = Number(totalBudget);
      if (Number.isFinite(tot) && tot > 0) {
        if (sumCat > tot) {
          window.alert(
            "Total budget must be greater than sum of category budgets"
          );
          return;
        }
      }

      // Update period meta (description/title + total budget if provided)
      await updateBudgetPeriod(ledgerId, {
        period,
        title: desc?.trim() || undefined,
        totalBudget: Number.isFinite(tot) && tot > 0 ? tot : undefined,
      });

      // Compute deletions: in initial but not in new (or amount 0)
      const newIds = new Set(Array.from(byCat.keys()));
      const deletes = [];
      for (const [cid] of initialCatAmounts.entries()) {
        if (!newIds.has(cid)) deletes.push(cid);
      }

      // Apply changes
      const ops = [];
      for (const [cid, amt] of byCat.entries())
        ops.push(setCategoryBudget(ledgerId, cid, amt, period));
      for (const cid of deletes)
        ops.push(removeCategoryBudget(ledgerId, cid, period));
      if (ops.length) await Promise.all(ops);

      await dispatch(loadLedgers());
      window.alert("Budget updated successfully");
      navigate(`/ledgers/${ledgerId}`);
    } catch (err) {
      window.alert("Failed to update budget");
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white p-7 shadow ring-1 ring-black/5"
      >
        <h1 className="mb-6 text-xl font-semibold text-gray-900">
          Edit Budget
        </h1>

        {/* Title */}
        <div className="mb-6">
          <label className="mb-1 block text-xs text-gray-600">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Period month + Description */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-gray-600">Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">
              Description
            </label>
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Describe this month's plan"
              className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">
              Total Budget
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={totalBudget}
              onChange={(e) => setTotalBudget(e.target.value)}
              placeholder="Overall monthly budget"
              className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        {/* Category actions */}
        <div className="mb-4 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Category Budgets (Current Month)
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCategoryManager(true)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-gray-50"
            >
              Manage
            </button>
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

        {/* Rows */}
        <div className="flex flex-col gap-4">
          {items.map((it) => (
            <div key={it.id} className="grid grid-cols-12 gap-4">
              {it.categoryId === "NEW" ? (
                <input
                  type="text"
                  value={it.newName || ""}
                  onChange={(e) =>
                    updateItem(it.id, { newName: e.target.value })
                  }
                  placeholder="New category name"
                  className="col-span-5 rounded-xl border border-gray-300 px-3 py-3 text-sm"
                />
              ) : (
                <select
                  value={it.categoryId ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    const nextId = val === "NEW" ? "NEW" : Number(val) || null;
                    if (
                      nextId !== "NEW" &&
                      nextId != null &&
                      isCategoryTaken(nextId, it.id)
                    ) {
                      window.alert(
                        "This category is already selected for this budget."
                      );
                      return;
                    }
                    updateItem(it.id, {
                      categoryId: nextId,
                      newName: nextId === "NEW" ? it.newName : undefined,
                    });
                  }}
                  className="col-span-5 rounded-xl border border-gray-300 px-3 py-3 text-sm"
                >
                  {allCategories.length === 0 && (
                    <option value="">No categories</option>
                  )}
                  {allCategories.map((c) => (
                    <option
                      key={c.id}
                      value={c.id}
                      disabled={
                        isCategoryTaken(c.id, it.id) && it.categoryId !== c.id
                      }
                    >
                      {c.name}
                    </option>
                  ))}
                  <option value="NEW">Custom...</option>
                </select>
              )}
              <input
                type="number"
                min="0"
                step="1"
                value={it.amount}
                onChange={(e) => updateItem(it.id, { amount: e.target.value })}
                placeholder="Enter Amount"
                className="col-span-5 rounded-xl border border-gray-300 px-3 py-3 text-sm"
              />
              <button
                type="button"
                onClick={() => addRemainingToItem(it.id)}
                className="col-span-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50"
                title="Add remaining amount"
              >
                +R
              </button>
              <button
                type="button"
                onClick={() => removeItem(it.id)}
                className="col-span-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"
                title="Remove"
              >
                Del
              </button>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="mt-6 flex items-center justify-between text-sm text-gray-700">
          <span>Total</span>
          <span>${totalAllocated.toFixed(2)}</span>
        </div>
        <div className="mt-1 flex items-center justify-end">
          {Number(totalBudget) > 0 ? (
            <Tag
              color={totalAllocated > Number(totalBudget) ? "rose" : "emerald"}
              size="sm"
            >
              {totalAllocated > Number(totalBudget)
                ? `Exceeded by $${(
                    totalAllocated - Number(totalBudget)
                  ).toFixed(2)}`
                : `Remaining: $${(Number(totalBudget) - totalAllocated).toFixed(
                    2
                  )}`}
            </Tag>
          ) : (
            <Tag color="gray" size="sm">
              No total budget set
            </Tag>
          )}
        </div>

        <button
          type="submit"
          className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow hover:bg-blue-700"
        >
          Update
        </button>
      </form>

      <CategoryManager
        type="expense"
        ledgerId={ledgerId}
        open={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
        onChange={handleManagedCategories}
      />
    </div>
  );
}
