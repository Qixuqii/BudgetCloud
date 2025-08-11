import { findLedgerMembers, insertLedgerMember, removeLedgerMember, changeLedgerMemberRole } from "../dao/ledgerMemberDao.js";

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
    const { user_id, role = "viewer" } = req.body;

    if (!user_id) {
        return res.status(400).json({ message: "user_id is required" });
    }

    try {
        await insertLedgerMember(ledgerId, user_id, role);
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
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Ledger member not found" });
        }
        return res.status(200).json({ message: "Ledger member role updated successfully" });
    } catch (err) {
        console.error("updateLedgerMemberRole error:", err);
        return res.status(500).json({ message: "Database error" });
    }
};

