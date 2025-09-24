// src/dao/categoryDao.js
import { db } from "../db.js";

/**
 * 获取用户的分类列表，可选按 type 过滤：'income' | 'expense'
 */
export async function listCategoriesByUser(userId, type, ledgerId = null) {
  // When ledgerId is provided, return categories created by any member of that ledger
  // and de-duplicate by (name, type), preferring the owner's category if present.
  if (ledgerId) {
    const params = [ledgerId];
    let sql = `
      SELECT c.id, c.user_id, c.name, c.type, c.created_at,
             l.owner_id,
             CASE WHEN l.owner_id = c.user_id THEN 1 ELSE 0 END AS is_owner
      FROM categories c
      JOIN ledger_members m ON m.user_id = c.user_id AND m.ledger_id = ?
      JOIN ledgers l ON l.id = m.ledger_id`;
    if (type) {
      sql += ` WHERE c.type = ?`;
      params.push(type);
    }
    sql += ` ORDER BY c.name ASC, c.created_at ASC`;
    const [rows] = await db.query(sql, params);
    // De-duplicate by name+type, prefer owner's record; otherwise earliest created
    const pick = new Map(); // key: `${name}|${type}` -> row
    for (const r of rows) {
      const key = `${r.name}|${r.type}`;
      const cur = pick.get(key);
      if (!cur) { pick.set(key, r); continue; }
      // If existing is not owner but this one is, replace
      if ((!cur.is_owner || cur.is_owner === 0) && r.is_owner === 1) {
        pick.set(key, r);
        continue;
      }
      // Otherwise keep the earliest created (rows already sorted by created_at ASC), so do nothing
    }
    return Array.from(pick.values()).map(({ id, user_id, name, type, created_at }) => ({ id, user_id, name, type, created_at }));
  }

  // Default: only the user's own categories
  const params = [userId];
  let sql = `SELECT id, user_id, name, type, created_at
             FROM categories
             WHERE user_id = ?`;
  if (type) {
    sql += ` AND type = ?`;
    params.push(type);
  }
  sql += ` ORDER BY created_at DESC`;
  const [rows] = await db.query(sql, params);
  return rows;
}

/**
 * 创建分类（确保同一用户、同一 type 下 name 唯一）
 */
export async function createCategory({ userId, name, type }) {
  // 先检查是否存在
  const [exists] = await db.query(
    `SELECT id FROM categories WHERE user_id = ? AND type = ? AND name = ?`,
    [userId, type, name]
  );
  if (exists.length) {
    return { duplicated: true };
  }

  const [res] = await db.query(
    `INSERT INTO categories (user_id, name, type) VALUES (?, ?, ?)`,
    [userId, name, type]
  );
  return { id: res.insertId, user_id: userId, name, type };
}

/**
 * 重命名分类（仍保持同 type 下唯一）
 */
export async function updateCategoryName({ categoryId, userId, name }) {
  const trimmed = String(name || "").trim();
  if (!trimmed) {
    return { updated: false, reason: "empty" };
  }

  const [[row]] = await db.query(
    `SELECT id, type FROM categories WHERE id = ? AND user_id = ?`,
    [categoryId, userId]
  );
  if (!row) {
    return { found: false };
  }

  const [dup] = await db.query(
    `SELECT id FROM categories WHERE user_id = ? AND type = ? AND name = ? AND id <> ?`,
    [userId, row.type, trimmed, categoryId]
  );
  if (dup.length) {
    return { duplicated: true, type: row.type };
  }

  const [res] = await db.query(
    `UPDATE categories SET name = ? WHERE id = ?`,
    [trimmed, categoryId]
  );
  return { updated: res.affectedRows > 0, type: row.type, name: trimmed };
}

/**
 * 删除分类，若被 transaction 引用则阻止删除
 * - 若被引用，返回 { inUse: true, count }
 * - 否则执行删除
 */
export async function deleteCategoryById(categoryId, userId) {
  const [[ref]] = await db.query(
    `SELECT COUNT(*) AS cnt FROM transactions WHERE category_id = ?`,
    [categoryId]
  );
  if (ref.cnt > 0) {
    return { inUse: true, count: ref.cnt };
  }

  const [res] = await db.query(
    `DELETE FROM categories WHERE id = ? AND user_id = ?`,
    [categoryId, userId]
  );
  return { deleted: res.affectedRows > 0 };
}
