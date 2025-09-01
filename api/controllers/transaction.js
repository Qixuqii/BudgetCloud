import { findTransactions, findTransactionById, insertTransaction, removeTransaction, updateTransactionById } from "../dao/transactionDao.js";

export const getTransactions = async (req, res) => {
  try {
    const rows = await findTransactions(req.user.id, req.query);
    if (rows.length === 0) return res.status(404).json({ message: "No transactions found" });
    return res.status(200).json(rows);
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
  const { ledger_id, category_id, amount, type, note = "", date = new Date().toISOString().slice(0, 10) } = req.body;

  if (!ledger_id || !category_id || !amount || !type) {
    return res.status(400).json({ message: "Must provide ledger_id, category_id, amount, and type" });
  }
  if (type !== "income" && type !== "expense") {
    return res.status(400).json({ message: "type must be either 'income' or 'expense'" });
  }

  try {
    const result = await insertTransaction(userId, { ledger_id, category_id, amount, type, note, date });
    return res.status(201).json({ message: "Transaction added successfully", transaction_id: result.insertId });
  } catch (err) {
    return res.status(500).json({ message: "Database insert fail", error: err });
  }
};

export const deleteTransaction = async (req, res) => {
  try {
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
    const result = await updateTransactionById(userId, transactionId, fields);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Transaction not found or unauthorized" });
    return res.status(200).json({ message: "Transaction updated successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Update failed", error: err });
  }
};
