// src/dao/ledgerDao.js
import { db } from "../db.js";

/**
 * 新建账本，并把 owner 记录写入 ledger_members（原子事务）
 */
export async function createLedgerWithOwner({ name, ownerId }) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [res] = await conn.query(
      "INSERT INTO ledgers (name, owner_id) VALUES (?, ?)",
      [name, ownerId]
    );
    const ledgerId = res.insertId;

    await conn.query(
      "INSERT INTO ledger_members (ledger_id, user_id, role) VALUES (?, ?, 'owner')",
      [ledgerId, ownerId]
    );

    await conn.commit();
    return { id: ledgerId, name, owner_id: ownerId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * 按用户查询其可见账本
 */
export async function listLedgersByUser(userId) {
  const [rows] = await db.query(
    `
    SELECT DISTINCT l.id,
           l.name,
           l.owner_id,
           u.username AS owner_name,
           l.created_at
    FROM ledgers l
    JOIN users u ON u.id = l.owner_id
    LEFT JOIN ledger_members m ON m.ledger_id = l.id
    WHERE l.owner_id = ? OR m.user_id = ?
    ORDER BY l.created_at DESC
    `,
    [userId, userId]
  );
  return rows;
}

/**
 * 获取账本详情
 */
export async function getLedgerById(ledgerId, userId) {
  const [[ledger]] = await db.query(
    `
    SELECT l.id,
           l.name,
           l.owner_id,
           u.username AS owner_name,
           l.created_at
    FROM ledgers l
    JOIN users u ON u.id = l.owner_id
    WHERE l.id = ?
    `,
    [ledgerId]
  );
  if (!ledger) return null;

  // Fetch member list with usernames for this ledger
  const [members] = await db.query(
    `
    SELECT m.id AS member_id,
           m.user_id,
           u.username,
           u.email,
           m.role,
           m.joined_at
    FROM ledger_members m
    JOIN users u ON u.id = m.user_id
    WHERE m.ledger_id = ?
    ORDER BY u.username ASC
    `,
    [ledgerId]
  );

  const [[membership]] = await db.query(
    `
    SELECT 1 AS ok FROM ledgers l
    LEFT JOIN ledger_members m ON m.ledger_id = l.id AND m.user_id = ?
    WHERE l.id = ? AND (l.owner_id = ? OR m.user_id IS NOT NULL)
    `,
    [userId, ledgerId, userId]
  );

  return {
    ...ledger,
    member_count: members.length,
    members,
    accessible: !!membership,
  };
}

export async function updateLedgerName(ledgerId, ownerId, newName) {
  const [res] = await db.query(
    "UPDATE ledgers SET name = ? WHERE id = ? AND owner_id = ?",
    [newName, ledgerId, ownerId]
  );
  return res.affectedRows > 0;
}

export async function deleteLedger(ledgerId, ownerId) {
  const [res] = await db.query(
    "DELETE FROM ledgers WHERE id = ? AND owner_id = ?",
    [ledgerId, ownerId]
  );
  return res.affectedRows > 0;
}

export async function canAccessLedger(ledgerId, userId) {
  const [[row]] = await db.query(
    `
    SELECT 1 AS ok
    FROM ledgers l
    LEFT JOIN ledger_members m ON m.ledger_id = l.id AND m.user_id = ?
    WHERE l.id = ? AND (l.owner_id = ? OR m.user_id IS NOT NULL)
    `,
    [userId, ledgerId, userId]
  );
  return !!row;
}

export async function isOwner(ledgerId, userId) {
  const [[row]] = await db.query(
    "SELECT 1 AS ok FROM ledgers WHERE id = ? AND owner_id = ?",
    [ledgerId, userId]
  );
  return !!row;
}
