import { db } from "../db.js";

export const getLedgerMembers = (req, res) => {
    // const userId = req.user.id;
    const ledgerId = req.params.ledgerId;
    // const memberId = req.params.memberId;
    const { ledger_id, user_id, role } = req.query;

    let query = `
            SELECT u.username, u.email, 
            m.id AS member_id,
            m.user_id, m.role, m.joined_at
            FROM ledger_members m
            JOIN users u on m.user_id = u.id
            WHERE m.ledger_id = ?
            `;
    let params = [ledgerId];
    if (role) {
        query += " AND m.role = ?";
        params.push(role);
    }

    db.query(query, params, (err, data) => {
        if (err) return res.status(500).send(err);
        if (data.length === 0) {
            return res.status(404).json({ message: "No Ledger Members found" });
        }
        return res.status(200).json(data);
    })
}

export const addLedgerMember = (req, res) => {

}
export const deleteLedgerMember = (req, res) => {

}
export const updateLedgerMemberRole = (req, res) => {

}