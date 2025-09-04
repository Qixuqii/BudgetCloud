// src/dao/aiSummaryDao.js
import { db } from "../db.js";

/**
 * 读取某账本某月的 AI 总结
 * 约定：month 格式 'YYYY-MM'
 * 表结构示例（需与实际表一致）：id, ledger_id, month, summary_text, model, created_at, updated_at
 */
export async function getMonthlySummary(ledgerId, month) {
  const [rows] = await db.query(
    `SELECT id, ledger_id, month, content, model, created_at, updated_at
     FROM ai_summaries
     WHERE ledger_id = ? AND month = ?`,
    [ledgerId, month]
  );
  return rows[0] || null;
}
