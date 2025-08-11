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
    const q = `
        INSERT INTO ledger_members (ledger_id, user_id, role)
        VALUES (?, ?, ?)
    `;
    const [result] = await db.query(q, [ledgerId, userId, role]);
    return result;
};

export const removeLedgerMember = async (ledgerId, memberId) => {
    const q = `DELETE FROM ledger_members WHERE ledger_id = ? AND id = ?`;
    const [result] = await db.query(q, [ledgerId, memberId]);
    return result;
};

export const changeLedgerMemberRole = async (ledgerId, memberId, role) => {
    const q = `UPDATE ledger_members SET role = ? WHERE ledger_id = ? AND id = ?`;
    const [result] = await db.query(q, [role, ledgerId, memberId]);
    return result;
};

