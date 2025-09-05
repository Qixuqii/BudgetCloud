import { db } from "../db.js";

// Helper: validate period as YYYY-MM
function normalizePeriod(period) {
  // Default to current month
  if (!period) return new Date().toISOString().slice(0, 7);
  // Accept YYYY-MM
  if (/^\d{4}-\d{2}$/.test(period)) return period;
  // Also accept YYYY-MM-DD and trim to month
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return period.slice(0, 7);
  // Try Date parse fallback (e.g., ISO string), then trim
  const d = new Date(period);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 7);
  throw new Error("Invalid period format. Expect YYYY-MM");
}

function getPeriodRange(period) {
  const [y, m] = period.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const next  = new Date(y, m, 1);
  const toDateStr = (d) => d.toISOString().slice(0, 10);
  return { start: toDateStr(start), end: toDateStr(next) };
}

// 获取预算和支出进度（方法2：按 ledger 过滤，不检查分类 user_id）
export async function getBudgetsWithProgress(userId, ledgerId, period) {
  const p = normalizePeriod(period);
  const { start, end } = getPeriodRange(p);

  // 查周期（改成按月份匹配）
  const [[bp]] = await db.query(
    `SELECT id, title, start_date, end_date 
     FROM budget_periods
     WHERE ledger_id = ?
       AND DATE_FORMAT(start_date, '%Y-%m') = ?`,
    [ledgerId, p]
  );
  if (!bp) return [];

  // 查预算和支出
  const [rows] = await db.query(
    `
    SELECT
      c.id AS category_id,
      c.name AS category_name,
      c.type AS category_type,
      COALESCE(SUM(bl.limit_amt), 0) AS budget_amount,
      COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS spent_amount
    FROM budget_limits bl
    JOIN categories c ON bl.category_id = c.id
    LEFT JOIN transactions t
      ON t.category_id = c.id
     AND t.ledger_id = ?
     AND t.type = 'expense'
     AND t.date >= ? AND t.date < ?
    WHERE bl.period_id = ?
    GROUP BY c.id, c.name, c.type
    ORDER BY c.type DESC, c.name ASC
    `,
    [ledgerId, start, end, bp.id]
  );

  return rows.map((r) => ({
    ...r,
    progress: r.budget_amount > 0 ? Number((r.spent_amount / r.budget_amount).toFixed(4)) : null,
    remaining: r.budget_amount > 0 ? Number((r.budget_amount - r.spent_amount).toFixed(2)) : null,
  }));
}

// 读取某月周期的元信息（id/title/start/end）
export async function getPeriodMeta(ledgerId, period) {
  const p = normalizePeriod(period);
  const [[row]] = await db.query(
    `SELECT id, title, start_date, end_date FROM budget_periods
     WHERE ledger_id = ? AND DATE_FORMAT(start_date, '%Y-%m') = ?`,
    [ledgerId, p]
  );
  return row || null;
}

// 插入或更新预算（仍然检查分类是否存在即可，不必限制 user_id）
export async function upsertCategoryBudget({ userId, ledgerId, categoryId, period, amount }) {
  const p = normalizePeriod(period);
  const { start, end } = getPeriodRange(p);

  // 确认周期
  const [[bp]] = await db.query(
    `SELECT id FROM budget_periods
     WHERE ledger_id = ? AND start_date = ? AND end_date = DATE_SUB(?, INTERVAL 1 DAY)`,
    [ledgerId, `${p}-01`, end]
  );

  let periodId;
  if (bp) {
    periodId = bp.id;
  } else {
    const [res] = await db.query(
      `INSERT INTO budget_periods (ledger_id, title, start_date, end_date)
       VALUES (?, ?, ?, DATE_SUB(?, INTERVAL 1 DAY))`,
      [ledgerId, `${p} 月度预算`, `${p}-01`, end]
    );
    periodId = res.insertId;
  }

  // 确认分类存在
  const [[cat]] = await db.query(
    `SELECT id FROM categories WHERE id = ?`,
    [categoryId]
  );
  if (!cat) return { ok: false, reason: "CATEGORY_NOT_FOUND" };

  // UPSERT
  const q = `
    INSERT INTO budget_limits (period_id, category_id, limit_amt, rollover)
    VALUES (?, ?, ?, 0)
    ON DUPLICATE KEY UPDATE limit_amt = VALUES(limit_amt)
  `;
  await db.query(q, [periodId, categoryId, amount]);

  return { ok: true, period_id: periodId };
}

// 更新或创建周期的标题（描述）
export async function upsertBudgetPeriodTitle({ ledgerId, period, title }) {
  const p = normalizePeriod(period);
  const { start, end } = getPeriodRange(p);
  const [[bp]] = await db.query(
    `SELECT id FROM budget_periods WHERE ledger_id = ? AND start_date = ? AND end_date = DATE_SUB(?, INTERVAL 1 DAY)`,
    [ledgerId, `${p}-01`, end]
  );
  let periodId = bp?.id;
  if (!periodId) {
    const [res] = await db.query(
      `INSERT INTO budget_periods (ledger_id, title, start_date, end_date)
       VALUES (?, ?, ?, DATE_SUB(?, INTERVAL 1 DAY))`,
      [ledgerId, title || `${p} 月度预算`, `${p}-01`, end]
    );
    periodId = res.insertId;
  } else {
    await db.query(`UPDATE budget_periods SET title = ? WHERE id = ?`, [title || `${p} 月度预算`, periodId]);
  }
  return { ok: true, id: periodId };
}

export async function deleteCategoryBudget({ ledgerId, categoryId, period }) {
  const p = normalizePeriod(period);

  // 找到周期
  const [[bp]] = await db.query(
    `SELECT id FROM budget_periods
     WHERE ledger_id = ? AND DATE_FORMAT(start_date, '%Y-%m') = ?`,
    [ledgerId, p]
  );
  if (!bp) return { ok: false, reason: "PERIOD_NOT_FOUND" };

  // 删除预算
  const [res] = await db.query(
    `DELETE FROM budget_limits WHERE period_id = ? AND category_id = ?`,
    [bp.id, categoryId]
  );

  return { ok: res.affectedRows > 0 };
}
