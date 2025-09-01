// src/dao/categoryDao.js
import { db } from "../db.js";

/**
 * 获取用户的分类列表；可选按 type 过滤（'income' | 'expense'）
 */
export async function listCategoriesByUser(userId, type) {
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
 * 创建分类（避免同名重复：同一用户、同一 type 下 name 唯一）
 */
export async function createCategory({ userId, name, type }) {
  // 可先检查是否重名
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
 * 删除分类前检查是否被 transaction 引用
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
