import { findTransactions, findTransactionById, insertTransaction, removeTransaction, updateTransactionById } from "../dao/transactionDao.js";
import { db } from "../db.js";

export const getTransactions = async (req, res) => {
  try {
    const rows = await findTransactions(req.user.id, req.query);
    // 返回 200 + 空数组，避免前端频繁看到 404
    return res.status(200).json(rows || []);
  } catch (err) {
    return res.status(500).json({ message: "Database error", error: err });
  }
};

export const getTransaction = async (req, res) => {
  try {
    const row = await findTransactionById(req.user.id, req.params.id);
    if (!row) return res.status(404).json({ message: "Transaction not found" });
    return res.status(200).json(row);
  } catch (err) {
    return res.status(500).json({ message: "Database error", error: err });
  }
};

export const addTransaction = async (req, res) => {
  const userId = req.user.id;
  const { ledger_id, category_id, amount, type, note = "", date = new Date().toISOString().slice(0, 10), allow_exceed = false } = req.body;

  if (!ledger_id || !category_id || !amount || !type) {
    return res.status(400).json({ message: "Must provide ledger_id, category_id, amount, and type" });
  }
  if (type !== "income" && type !== "expense") {
    return res.status(400).json({ message: "type must be either 'income' or 'expense'" });
  }

  try {
    // Enforce role: only owner/editor of the target ledger can add transactions
    const [[roleRow]] = await db.query(
      `SELECT role FROM ledger_members WHERE ledger_id = ? AND user_id = ?`,
      [ledger_id, userId]
    );
    if (!roleRow) {
      return res.status(403).json({ message: "User is not a member of this ledger" });
    }
    if (!['owner', 'editor'].includes(roleRow.role)) {
      return res.status(403).json({ message: "Viewer cannot add transactions to this ledger" });
    }

    // Budget enforcement: for expenses, do not allow exceeding a defined category budget for the month
    // unless the client explicitly allows exceed (manual confirmation by the user)
    if (type === 'expense' && !allow_exceed) {
      try {
        const period = String(date).slice(0, 7); // YYYY-MM
        // Find budget period for the ledger and month (exact start_date match)
        const [[bp]] = await db.query(
          `SELECT id FROM budget_periods WHERE ledger_id = ? AND start_date = ?`,
          [ledger_id, `${period}-01`]
        );
        if (bp) {
          // Compute safe local month boundaries
          const [yy, mm] = period.split('-').map(Number);
          const pad = (n) => String(n).padStart(2, '0');
          const startStr = `${yy}-${pad(mm)}-01`;
          const nextY = mm === 12 ? yy + 1 : yy;
          const nextM = mm === 12 ? 1 : mm + 1;
          const nextStr = `${nextY}-${pad(nextM)}-01`;
          // Get category limit (if any)
          const [[lim]] = await db.query(
            `SELECT limit_amt FROM budget_limits WHERE period_id = ? AND category_id = ?`,
            [bp.id, category_id]
          );
          if (lim) {
            const [[sumRow]] = await db.query(
              `SELECT COALESCE(SUM(amount),0) AS spent
               FROM transactions
               WHERE ledger_id = ? AND category_id = ? AND type = 'expense'
                 AND date >= ? AND date < ?`,
              [ledger_id, category_id, startStr, nextStr]
            );
            const spent = Number(sumRow?.spent || 0);
            const limitAmt = Number(lim.limit_amt || 0);
            const nextSpent = spent + Number(amount);
            if (limitAmt >= 0 && nextSpent > limitAmt) {
              const remaining = Math.max(0, limitAmt - spent);
              return res.status(409).json({
                code: 'BUDGET_EXCEEDED',
                message: 'Adding this expense would exceed the category budget for this period',
                details: { limit: limitAmt, spent, remaining }
              });
            }
          }
        }
      } catch (e) {
        // If budget check fails unexpectedly, fall through to allow insert to avoid blocking
      }
    }

    const result = await insertTransaction(userId, { ledger_id, category_id, amount, type, note, date });
    return res.status(201).json({ message: "Transaction added successfully", transaction_id: result.insertId });
  } catch (err) {
    return res.status(500).json({ message: "Database insert fail", error: err });
  }
};

export const deleteTransaction = async (req, res) => {
  try {
    // Ensure requester is member with sufficient role
    const current = await findTransactionById(req.user.id, req.params.id);
    if (!current) return res.status(404).json({ message: "Transaction not found" });

    const [[roleRow]] = await db.query(
      `SELECT role FROM ledger_members WHERE ledger_id = ? AND user_id = ?`,
      [current.ledger_id, req.user.id]
    );
    if (!roleRow || !['owner','editor'].includes(roleRow.role)) {
      return res.status(403).json({ message: "You do not have permission to perform this action." });
    }

    const result = await removeTransaction(req.user.id, req.params.id);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Transaction not found" });
    return res.status(200).json({ message: "Transaction deleted successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Delete failed", error: err });
  }
};

export const updateTransaction = async (req, res) => {
  const userId = req.user.id;
  const transactionId = req.params.id;
  const allowed = ["ledger_id", "category_id", "amount", "type", "note", "date"];
  const fields = {};

  for (const key of allowed) {
    if (req.body[key] !== undefined) fields[key] = req.body[key];
  }
  if (Object.keys(fields).length === 0) return res.status(400).json({ message: "No fields to update." });

  if (fields.type && fields.type !== "income" && fields.type !== "expense") {
    return res.status(400).json({ message: "type must be 'income' or 'expense'" });
  }

  try {
    // Optional enforcement on updates that could exceed budget
    if (['ledger_id','category_id','amount','type','date'].some(k => fields[k] !== undefined)) {
      const current = await findTransactionById(userId, transactionId);
      if (current) {
        const newLedger = fields.ledger_id ?? current.ledger_id;
        const newCategory = fields.category_id ?? current.category_id;
        const newAmount = Number(fields.amount ?? current.amount);
        const newType = fields.type ?? current.type;
        const newDate = String(fields.date ?? current.date);
        // Role enforcement for update on target ledger
        const [[roleRow]] = await db.query(
          `SELECT role FROM ledger_members WHERE ledger_id = ? AND user_id = ?`,
          [newLedger, userId]
        );
        if (!roleRow || !['owner','editor'].includes(roleRow.role)) {
          return res.status(403).json({ message: "You do not have permission to perform this action." });
        }
        if (newType === 'expense') {
          try {
            const period = newDate.slice(0,7);
            const [[bp]] = await db.query(
              `SELECT id FROM budget_periods WHERE ledger_id = ? AND start_date = ?`,
              [newLedger, `${period}-01`]
            );
            if (bp) {
              const [yy, mm] = period.split('-').map(Number);
              const pad = (n) => String(n).padStart(2, '0');
              const startStr = `${yy}-${pad(mm)}-01`;
              const nextY = mm === 12 ? yy + 1 : yy;
              const nextM = mm === 12 ? 1 : mm + 1;
              const nextStr = `${nextY}-${pad(nextM)}-01`;
              const [[lim]] = await db.query(
                `SELECT limit_amt FROM budget_limits WHERE period_id = ? AND category_id = ?`,
                [bp.id, newCategory]
              );
              if (lim) {
                const [[sumRow]] = await db.query(
                  `SELECT COALESCE(SUM(amount),0) AS spent
                   FROM transactions
                   WHERE ledger_id = ? AND category_id = ? AND type = 'expense'
                     AND date >= ? AND date < ? AND id <> ?`,
                  [newLedger, newCategory, startStr, nextStr, transactionId]
                );
                const spentExcl = Number(sumRow?.spent || 0);
                const limitAmt = Number(lim.limit_amt || 0);
                if (spentExcl + newAmount > limitAmt) {
                  const remaining = Math.max(0, limitAmt - spentExcl);
                  return res.status(409).json({
                    code: 'BUDGET_EXCEEDED',
                    message: 'Updating this expense would exceed the category budget for this period',
                    details: { limit: limitAmt, spent: spentExcl, remaining }
                  });
                }
              }
            }
          } catch {}
        }
      }
    }
    const result = await updateTransactionById(userId, transactionId, fields);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Transaction not found or unauthorized" });
    return res.status(200).json({ message: "Transaction updated successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Update failed", error: err });
  }
};
