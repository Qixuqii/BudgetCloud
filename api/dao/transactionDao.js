import { db } from "../db.js";

// 获取多条交易（支持条件过滤）
export const findTransactions = async (userId, filters) => {
  let query = `
    SELECT t.id, t.amount, t.type, t.note, t.date,
           t.category_id, t.ledger_id,
           c.name AS category_name, l.name AS ledger_name
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    JOIN ledgers l ON t.ledger_id = l.id
    WHERE t.user_id = ?`;
  const params = [userId];

  if (filters.category_id) {
    query += " AND t.category_id = ?";
    params.push(filters.category_id);
  }
  if (filters.ledger_id) {
    query += " AND t.ledger_id = ?";
    params.push(filters.ledger_id);
  }
  if (filters.min_amount) {
    query += " AND t.amount >= ?";
    params.push(filters.min_amount);
  }
  if (filters.max_amount) {
    query += " AND t.amount <= ?";
    params.push(filters.max_amount);
  }
  if (filters.type) {
    query += " AND t.type = ?";
    params.push(filters.type);
  }
  if (filters.start_date) {
    query += " AND t.date >= ?";
    params.push(filters.start_date);
  }
  if (filters.end_date) {
    query += " AND t.date <= ?";
    params.push(filters.end_date);
  }

  const [rows] = await db.query(query, params);
  return rows;
};

// 获取单条交易
export const findTransactionById = async (userId, id) => {
  const q = `
    SELECT t.id, t.amount, t.type, t.note, t.date,
           t.category_id, t.ledger_id,
           c.name AS category_name, l.name AS ledger_name
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    JOIN ledgers l ON t.ledger_id = l.id
    WHERE t.id = ? AND t.user_id = ?`;
  const [rows] = await db.query(q, [id, userId]);
  return rows[0];
};

// 插入交易
export const insertTransaction = async (userId, { ledger_id, category_id, amount, type, note, date }) => {
  const q = `
    INSERT INTO transactions (user_id, ledger_id, category_id, amount, type, note, date)
    VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const [result] = await db.query(q, [userId, ledger_id, category_id, amount, type, note, date]);
  return result;
};

// 删除交易
export const removeTransaction = async (userId, id) => {
  const q = `DELETE FROM transactions WHERE user_id = ? AND id = ?`;
  const [result] = await db.query(q, [userId, id]);
  return result;
};

// 更新交易
export const updateTransactionById = async (userId, id, fields) => {
  const setClause = Object.keys(fields).map(key => `${key} = ?`).join(", ");
  const values = Object.values(fields);
  const q = `UPDATE transactions SET ${setClause} WHERE user_id = ? AND id = ?`;
  const [result] = await db.query(q, [...values, userId, id]);
  return result;
};
