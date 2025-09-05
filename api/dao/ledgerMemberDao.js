import { db } from "../db.js";

export const findLedgerMembers = async (ledgerId, role) => {
    let query = `
        SELECT u.username, u.email,
               m.id AS member_id,
               m.user_id, m.role, m.joined_at
        FROM ledger_members m
        JOIN users u ON m.user_id = u.id
        WHERE m.ledger_id = ?
    `;
    const params = [ledgerId];
    if (role) {
        query += " AND m.role = ?";
        params.push(role);
    }
    const [rows] = await db.query(query, params);
    return rows;
};

export const insertLedgerMember = async (ledgerId, userId, role = "viewer") => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    if (role === 'owner') {
      await conn.query(`UPDATE ledger_members SET role = 'viewer' WHERE ledger_id = ? AND role = 'owner'`, [ledgerId]);
    }
    const [result] = await conn.query(
      `INSERT INTO ledger_members (ledger_id, user_id, role) VALUES (?, ?, ?)`,
      [ledgerId, userId, role]
    );
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

export const getMemberRole = async (ledgerId, memberId) => {
  const [[row]] = await db.query(
    `SELECT role, user_id FROM ledger_members WHERE ledger_id = ? AND id = ?`,
    [ledgerId, memberId]
  );
  return row || null;
};

export const countOwners = async (ledgerId) => {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS cnt FROM ledger_members WHERE ledger_id = ? AND role = 'owner'`,
    [ledgerId]
  );
  return Number(row?.cnt || 0);
};

export const removeLedgerMember = async (ledgerId, memberId) => {
  // Prevent removing owner
  const cur = await getMemberRole(ledgerId, memberId);
  if (!cur) return { affectedRows: 0 };
  if (cur.role === 'owner') {
    return { affectedRows: 0, forbidden: 'OWNER' };
  }
  const q = `DELETE FROM ledger_members WHERE ledger_id = ? AND id = ?`;
  const [result] = await db.query(q, [ledgerId, memberId]);
  return result;
};

export const changeLedgerMemberRole = async (ledgerId, memberId, role) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[target]] = await conn.query(
      `SELECT id, user_id, role FROM ledger_members WHERE ledger_id = ? AND id = ? FOR UPDATE`,
      [ledgerId, memberId]
    );
    if (!target) {
      await conn.rollback();
      return { affectedRows: 0 };
    }

    if (role !== 'owner' && target.role === 'owner') {
      const [[row]] = await conn.query(
        `SELECT COUNT(*) AS cnt FROM ledger_members WHERE ledger_id = ? AND role = 'owner' AND id <> ?`,
        [ledgerId, memberId]
      );
      if (Number(row.cnt || 0) === 0) {
        await conn.rollback();
        return { affectedRows: 0, error: 'SOLE_OWNER' };
      }
    }

    if (role === 'owner') {
      // Demote any other owners to viewer to keep single owner invariant
      await conn.query(
        `UPDATE ledger_members SET role = 'viewer' WHERE ledger_id = ? AND role = 'owner' AND id <> ?`,
        [ledgerId, memberId]
      );
    }

    const [res] = await conn.query(
      `UPDATE ledger_members SET role = ? WHERE ledger_id = ? AND id = ?`,
      [role, ledgerId, memberId]
    );
    await conn.commit();
    return res;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

export const transferOwnershipAndRemoveCurrent = async (ledgerId, currentOwnerUserId, newOwnerMemberId) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Verify current user is owner
    const [[me]] = await conn.query(
      `SELECT id, role FROM ledger_members WHERE ledger_id = ? AND user_id = ? FOR UPDATE`,
      [ledgerId, currentOwnerUserId]
    );
    if (!me || me.role !== 'owner') {
      await conn.rollback();
      return { ok: false, reason: 'NOT_OWNER' };
    }

    // Verify new owner member exists
    const [[target]] = await conn.query(
      `SELECT id, user_id FROM ledger_members WHERE ledger_id = ? AND id = ? FOR UPDATE`,
      [ledgerId, newOwnerMemberId]
    );
    if (!target) {
      await conn.rollback();
      return { ok: false, reason: 'TARGET_NOT_FOUND' };
    }

    // Update ledgers.owner_id to the new owner's user_id so list queries reflect transfer
    await conn.query(
      `UPDATE ledgers SET owner_id = ? WHERE id = ?`,
      [target.user_id, ledgerId]
    );

    // Make target the sole owner
    await conn.query(
      `UPDATE ledger_members SET role = 'viewer' WHERE ledger_id = ? AND role = 'owner' AND id <> ?`,
      [ledgerId, newOwnerMemberId]
    );
    await conn.query(
      `UPDATE ledger_members SET role = 'owner' WHERE ledger_id = ? AND id = ?`,
      [ledgerId, newOwnerMemberId]
    );

    // Remove current owner membership (leave)
    await conn.query(
      `DELETE FROM ledger_members WHERE ledger_id = ? AND user_id = ?`,
      [ledgerId, currentOwnerUserId]
    );

    await conn.commit();
    return { ok: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

