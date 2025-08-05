import { db } from "../db.js";

export const checkLedgerRole = (allowedRoles = []) => {
    return async (req, res, next) => {
        const  userId = req.user.id;
        const ledgerId = req.params.ledgerId || req.params.id;

        if (!ledgerId) {
            return res.status(400).json({ message: "Ledger ID is required in route parameters." });
        }

        try {
            const [rows] = await db.query(
                "SELECT role FROM ledger_members WHERE ledger_id = ? AND user_id = ?",
                [ledgerId, userId]
            );
            if (rows.length === 0){
                return res.status(403).json({ message: "User is not a member of this ledger." });
            }

            const userRole = rows[0].role;
            if (allowedRoles.length && !allowedRoles.includes(userRole)) {
                return res.status(403).json({ message: "You do not have permission to perform this action." });
            }

            req.user.roleInLedger = userRole;
            //把userRole获得的结果例如'owner'暂存到req.user，之后可以直接在controller里用
            //例如if（req.user.roleInLedger === 'owner'){...}

            next();
        } catch (err){
            console.error("checkLedgerRole error:", err);
            return res.status(500).json({ message: "Server error while checking ledger role." });
        }
    };
}