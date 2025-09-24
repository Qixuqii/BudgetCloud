import { db } from "../db.js";

// 获取多条交易（支持条件过滤）
export const findTransactions = async (userId, filters) => {
  let query = `
    SELECT t.id, t.amount, t.type, t.note, t.date,
           t.category_id, t.ledger_id,
           c.name AS category_name, l.name AS ledger_name,
           u.id AS created_by_user_id, u.username AS created_by_username
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    JOIN ledgers l ON t.ledger_id = l.id
    JOIN ledger_members m ON m.ledger_id = t.ledger_id AND m.user_id = ?
    JOIN users u ON u.id = t.user_id
    WHERE 1=1`;
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
           c.name AS category_name, l.name AS ledger_name,
           u.id AS created_by_user_id, u.username AS created_by_username
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    JOIN ledgers l ON t.ledger_id = l.id
    JOIN ledger_members m ON m.ledger_id = t.ledger_id AND m.user_id = ?
    JOIN users u ON u.id = t.user_id
    WHERE t.id = ?`;
  const [rows] = await db.query(q, [userId, id]);
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
  // Controller enforces role and membership; here delete by id only
  const q = `DELETE FROM transactions WHERE id = ?`;
  const [result] = await db.query(q, [id]);
  return result;
};

// 更新交易
export const updateTransactionById = async (userId, id, fields) => {
  const setClause = Object.keys(fields).map(key => `${key} = ?`).join(", ");
  const values = Object.values(fields);
  const q = `UPDATE transactions SET ${setClause} WHERE id = ?`;
  const [result] = await db.query(q, [...values, id]);
  return result;
};
