import { findLedgerMembers, insertLedgerMember, removeLedgerMember, changeLedgerMemberRole, getMemberRole, countOwners, transferOwnershipAndRemoveCurrent } from "../dao/ledgerMemberDao.js";
import { db } from "../db.js";

export const getLedgerMembers = async (req, res) => {
    const ledgerId = req.params.ledgerId;
    const { role } = req.query;

    try {
        const rows = await findLedgerMembers(ledgerId, role);
        if (rows.length === 0) {
            return res.status(404).json({ message: "No Ledger Members found" });
        }
        return res.status(200).json(rows);
    } catch (err) {
        return res.status(500).send(err);
    }
};

export const addLedgerMember = async (req, res) => {
    const ledgerId = req.params.ledgerId;
    const { username, user_id, role = "viewer" } = req.body || {};

    try {
        let targetUserId = null;
        if (username && typeof username === 'string' && username.trim()) {
            const uname = username.trim();
            const [[u]] = await db.query(`SELECT id FROM users WHERE username = ?`, [uname]);
            if (!u) return res.status(404).json({ message: "User not found" });
            targetUserId = Number(u.id);
        } else if (user_id) {
            targetUserId = Number(user_id);
        } else {
            return res.status(400).json({ message: "username is required" });
        }

        // Prevent duplicates for clearer response than generic DB error
        const [[exists]] = await db.query(
            `SELECT id FROM ledger_members WHERE ledger_id = ? AND user_id = ?`,
            [ledgerId, targetUserId]
        );
        if (exists) {
            return res.status(409).json({ message: "User is already a member" });
        }

        await insertLedgerMember(ledgerId, targetUserId, role);
        return res.status(201).json({ message: "Ledger member added successfully" });
    } catch (err) {
        console.error("addLedgerMember error:", err);
        return res.status(500).json({ message: "Database error" });
    }
};

export const deleteLedgerMember = async (req, res) => {
    const ledgerId = req.params.ledgerId;
    const memberId = req.params.memberId;

    try {
        const target = await getMemberRole(ledgerId, memberId);
        if (!target) return res.status(404).json({ message: "Ledger member not found" });
        if (target.role === 'owner') {
            return res.status(400).json({ message: "Owner cannot be removed. Transfer ownership first." });
        }
        const result = await removeLedgerMember(ledgerId, memberId);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Ledger member not found" });
        }
        return res.status(200).json({ message: "Ledger member deleted successfully" });
    } catch (err) {
        console.error("deleteLedgerMember error:", err);
        return res.status(500).json({ message: "Database error" });
    }
};

export const updateLedgerMemberRole = async (req, res) => {
    const ledgerId = req.params.ledgerId;
    const memberId = req.params.memberId;
    const { role } = req.body;

    if (!role) {
        return res.status(400).json({ message: "role is required" });
    }

    try {
        const result = await changeLedgerMemberRole(ledgerId, memberId, role);
        if (result.error === 'SOLE_OWNER') {
            return res.status(400).json({ message: "Cannot demote the sole owner. Transfer ownership first." });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Ledger member not found" });
        }
        return res.status(200).json({ message: "Ledger member role updated successfully" });
    } catch (err) {
        console.error("updateLedgerMemberRole error:", err);
        return res.status(500).json({ message: "Database error" });
    }
};

export const transferOwnership = async (req, res) => {
    const ledgerId = Number(req.params.ledgerId);
    const { newOwnerMemberId } = req.body || {};
    if (!Number.isFinite(newOwnerMemberId)) {
        return res.status(400).json({ message: "newOwnerMemberId is required" });
    }
    try {
        const rst = await transferOwnershipAndRemoveCurrent(ledgerId, req.user.id, Number(newOwnerMemberId));
        if (!rst.ok) {
            if (rst.reason === 'NOT_OWNER') return res.status(403).json({ message: "Only current owner can transfer." });
            if (rst.reason === 'TARGET_NOT_FOUND') return res.status(404).json({ message: "Target member not found." });
            return res.status(400).json({ message: "Transfer failed" });
        }
        return res.json({ ok: true });
    } catch (e) {
        console.error("transferOwnership error:", e);
        return res.status(500).json({ message: "Failed to transfer ownership" });
    }
}

export const leaveLedger = async (req, res) => {
    const ledgerId = Number(req.params.ledgerId);
    const userId = req.user.id;
    try {
        const [[row]] = await db.query(
            `SELECT id, role FROM ledger_members WHERE ledger_id = ? AND user_id = ?`,
            [ledgerId, userId]
        );
        if (!row) return res.status(404).json({ message: "Membership not found" });
        if (row.role === 'owner') {
            return res.status(400).json({ message: "Owner must transfer ownership before leaving" });
        }
        await db.query(`DELETE FROM ledger_members WHERE ledger_id = ? AND user_id = ?`, [ledgerId, userId]);
        return res.json({ ok: true });
    } catch (e) {
        console.error("leaveLedger error:", e);
        return res.status(500).json({ message: "Failed to leave ledger" });
    }
}

