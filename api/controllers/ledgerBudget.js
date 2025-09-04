import { getBudgetsWithProgress, upsertCategoryBudget } from "../dao/ledgerBudgetDao.js";

// GET /api/ledgers/:ledgerId/budgets?period=YYYY-MM
export async function listBudgetsWithProgress(req, res) {
  try {
    const userId = req.user.id;
    const ledgerId = Number(req.params.ledgerId);
    const { period } = req.query;
    const rows = await getBudgetsWithProgress(userId, ledgerId, period);
    return res.json({ period: period || new Date().toISOString().slice(0, 7), items: rows });
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
    const { amount } = req.body || {};

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) {
      return res.status(400).json({ message: "amount must be a non-negative number" });
    }

    const result = await upsertCategoryBudget({ userId, ledgerId, categoryId, period, amount: amt });
    if (!result.ok && result.reason === "CATEGORY_NOT_FOUND") {
      return res.status(404).json({ message: "Category not found for current user" });
    }
    return res.status(200).json({ ledger_id: ledgerId, category_id: categoryId, period: period || new Date().toISOString().slice(0, 7), amount: amt });
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
