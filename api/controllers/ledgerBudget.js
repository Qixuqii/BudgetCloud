import { getBudgetsWithProgressV2 as getBudgetsWithProgress, upsertCategoryBudget, getPeriodMeta, upsertBudgetPeriodTitle, reallocateCategoryBudget } from "../dao/ledgerBudgetDao.js";

// GET /api/ledgers/:ledgerId/budgets?period=YYYY-MM
export async function listBudgetsWithProgress(req, res) {
  try {
    const userId = req.user.id;
    const ledgerId = Number(req.params.ledgerId);
    const { period } = req.query;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const def = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    const rows = await getBudgetsWithProgress(userId, ledgerId, period);
    const meta = await getPeriodMeta(ledgerId, period || def);
    return res.json({ period: period || def, title: meta?.title || null, total: meta?.total ?? null, items: rows });
  } catch (e) {
    if (String(e.message || "").includes("Invalid period")) {
      return res.status(400).json({ message: e.message });
    }
    console.error("listBudgetsWithProgress error:", e);
    return res.status(500).json({ message: "Failed to fetch budgets" });
  }
}

// PUT /api/ledgers/:ledgerId/budgets/:categoryId?period=YYYY-MM { amount }
export async function setCategoryBudget(req, res) {
  try {
    const userId = req.user.id;
    const ledgerId = Number(req.params.ledgerId);
    const categoryId = Number(req.params.categoryId);
    const { period } = req.query;
    const { amount, replace_from, replaceFrom } = req.body || {};

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) {
      return res.status(400).json({ message: "amount must be a non-negative number" });
    }

    // Optional: reallocate from other categories atomically
    const sources = Array.isArray(replace_from) ? replace_from : (Array.isArray(replaceFrom) ? replaceFrom : null);
    if (sources && sources.length > 0) {
      const rst = await reallocateCategoryBudget({ ledgerId, categoryId, period, amount: amt, sources });
      if (!rst.ok) {
        if (rst.reason === 'REALLOCATE_FAILED') {
          return res.status(409).json({
            code: 'BUDGET_REPLACEMENT_DENIED',
            message: 'Replacement failed: source budget used or insufficient',
            details: rst.failures || []
          });
        }
        if (rst.reason === 'CATEGORY_NOT_FOUND') {
          return res.status(404).json({ message: "Category not found for current user" });
        }
        if (rst.reason === 'PERIOD_NOT_FOUND') {
          return res.status(404).json({ message: "Budget period not found" });
        }
        return res.status(500).json({ message: "Failed to set budget" });
      }
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const def = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
      return res.status(200).json({ ledger_id: ledgerId, category_id: categoryId, period: period || def, amount: amt });
    }

    // Simple upsert if no replacement requested
    const result = await upsertCategoryBudget({ userId, ledgerId, categoryId, period, amount: amt });
    if (!result.ok && result.reason === "CATEGORY_NOT_FOUND") {
      return res.status(404).json({ message: "Category not found for current user" });
    }
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const def = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    return res.status(200).json({ ledger_id: ledgerId, category_id: categoryId, period: period || def, amount: amt });
  } catch (e) {
    if (String(e.message || "").includes("Invalid period")) {
      return res.status(400).json({ message: e.message });
    }
    console.error("setCategoryBudget error:", e);
    return res.status(500).json({ message: "Failed to set budget" });
  }
}

import { deleteCategoryBudget } from "../dao/ledgerBudgetDao.js";

export async function removeCategoryBudget(req, res) {
  try {
    const ledgerId = Number(req.params.ledgerId);
    const categoryId = Number(req.params.categoryId);
    const { period } = req.query;

    const result = await deleteCategoryBudget({ ledgerId, categoryId, period });

    if (!result.ok && result.reason === "PERIOD_NOT_FOUND") {
      return res.status(404).json({ message: "Budget period not found" });
    }
    if (!result.ok) {
      return res.status(404).json({ message: "Budget not found" });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("removeCategoryBudget error:", e);
    return res.status(500).json({ message: "Failed to delete budget" });
  }
}

// PATCH /api/ledgers/:ledgerId/budgets/period  body: { period?:YYYY-MM, title?:string }
export async function updateBudgetPeriodMeta(req, res) {
  try {
    const ledgerId = Number(req.params.ledgerId);
    const { period, title, totalBudget } = req.body || {};
    const rst = await upsertBudgetPeriodTitle({ ledgerId, period, title, totalBudget });
    return res.json({ ok: true, id: rst.id });
  } catch (e) {
    if (String(e.message || "").includes("Invalid period")) {
      return res.status(400).json({ message: e.message });
    }
    console.error("updateBudgetPeriodMeta error:", e);
    return res.status(500).json({ message: "Failed to update period" });
  }
}
