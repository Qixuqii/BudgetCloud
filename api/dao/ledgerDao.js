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
export async function listLedgersByUser(userId, period) {
  // Normalize period to YYYY-MM; default to current month
  const p = (() => {
    if (period && /^\d{4}-\d{2}$/.test(period)) return period;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  })();

  const [rows] = await db.query(
    `
    SELECT 
      l.id,
      l.name,
      l.owner_id,
      u.username AS owner_name,
      l.created_at,
      CAST(
        COALESCE(
          /* prefer JSON total in period title when valid */
          NULLIF(
            CASE WHEN JSON_VALID(bp.title) THEN JSON_UNQUOTE(JSON_EXTRACT(bp.title, '$.total')) ELSE NULL END,
            ''
          ),
          SUM(bl.limit_amt),
          0
        ) AS DOUBLE
      ) AS totalBudget,
      ? AS durationText,
      CASE WHEN l.owner_id = ? THEN 'owner' ELSE COALESCE(m.role, 'viewer') END AS myRole
    FROM ledgers l
    JOIN users u ON u.id = l.owner_id
    /* bind membership only for current user to avoid duplicates */
    LEFT JOIN ledger_members m ON m.ledger_id = l.id AND m.user_id = ?
    /* Budget period for the requested month */
    LEFT JOIN budget_periods bp 
      ON bp.ledger_id = l.id 
     AND bp.start_date = CONCAT(?, '-01')
     AND bp.id = (
       SELECT MIN(p2.id)
       FROM budget_periods p2
       WHERE p2.ledger_id = l.id
         AND p2.start_date = CONCAT(?, '-01')
     )
    LEFT JOIN budget_limits bl ON bl.period_id = bp.id
    WHERE l.owner_id = ? OR m.user_id IS NOT NULL
    GROUP BY l.id, l.name, l.owner_id, owner_name, l.created_at, bp.title
    ORDER BY l.created_at DESC
    `,
    [p, userId, userId, p, p, userId]
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

export async function updateLedgerName(ledgerId, userId, newName) {
  // Role check is enforced by route middleware; update by id only
  const [res] = await db.query(
    "UPDATE ledgers SET name = ? WHERE id = ?",
    [newName, ledgerId]
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
