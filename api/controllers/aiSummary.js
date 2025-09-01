// src/controllers/aiSummaryController.js
import { getMonthlySummary } from "../dao/aiSummaryDao.js";
import { canAccessLedger } from "../dao/ledgerDao.js";

/**
 * GET /api/ledgers/:ledgerId/summaries/:month
 * month: YYYY-MM（如 2025-08）
 */
export async function getLedgerMonthlySummary(req, res) {
  try {
    const userId = req.user.id;
    const ledgerId = Number(req.params.ledgerId);
    const month = String(req.params.month || "").trim();

    // 简单校验 YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: "Invalid month. Use YYYY-MM." });
    }

    // 访问控制：owner 或成员均可读
    const ok = await canAccessLedger(ledgerId, userId);
    if (!ok) return res.status(403).json({ message: "Forbidden" });

    const summary = await getMonthlySummary(ledgerId, month);
    if (!summary) {
      return res.status(404).json({ message: "No summary for this month" });
    }
    return res.json(summary);
  } catch (e) {
    console.error("getLedgerMonthlySummary error:", e);
    return res.status(500).json({ message: "Failed to fetch summary" });
  }
}
