import express from 'express';
import { verifyToken } from "../middleware/verifyToken.js";
import { checkLedgerRole } from "../middleware/checkLedgerRole.js";
import { listBudgetsWithProgress, setCategoryBudget, updateBudgetPeriodMeta } from "../controllers/ledgerBudget.js";
import { removeCategoryBudget } from "../controllers/ledgerBudget.js";


const router = express.Router();

// View budgets and progress for a ledger (any member can view)
router.get('/:ledgerId/budgets', verifyToken, checkLedgerRole(), listBudgetsWithProgress);

// Set or update a budget for a category in a ledger (only owner)
// Allow owners and editors to set budgets
router.put('/:ledgerId/budgets/:categoryId', verifyToken, checkLedgerRole(['owner','editor']), setCategoryBudget);
router.patch('/:ledgerId/budgets/period', verifyToken, checkLedgerRole(['owner','editor']), updateBudgetPeriodMeta);

// Delete budget for category
router.delete('/:ledgerId/budgets/:categoryId', verifyToken, checkLedgerRole(['owner','editor']), removeCategoryBudget);

export default router;
