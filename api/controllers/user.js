import { db } from "../db.js";

export async function getMe(req, res) {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const [rows] = await db.query(
      "SELECT id, email, username FROM users WHERE id = ?",
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("getMe error:", err);
    return res.status(500).json({ message: "Failed to fetch user info" });
  }
}
