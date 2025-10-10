import { db } from "../db.js";

// Helper: validate period as YYYY-MM (local-safe)
function normalizePeriod(period) {
  // Default to current month (local time)
  if (!period) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  }
  // Accept YYYY-MM
  if (/^\d{4}-\d{2}$/.test(period)) return period;
  // Also accept YYYY-MM-DD and trim to month
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return period.slice(0, 7);
  // Try Date parse fallback (e.g., ISO string), then trim using local components
  const d = new Date(period);
  if (!isNaN(d.getTime())) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }
  throw new Error("Invalid period format. Expect YYYY-MM");
}

// Compute start/end boundaries as strings without UTC conversion
function getPeriodRange(period) {
  const [y, m] = period.split("-").map(Number);
  const pad = (n) => String(n).padStart(2, "0");
  const start = `${y}-${pad(m)}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const end = `${nextY}-${pad(nextM)}-01`; // exclusive upper bound
  return { start, end };
}

// 获取预算和支出进度（方法2：按 ledger 过滤，不检查分类 user_id）
export async function getBudgetsWithProgress(userId, ledgerId, period) {
  const p = normalizePeriod(period);
  const { start, end } = getPeriodRange(p);

  // 查周期：按精确 start_date 匹配，避免同月重复行的歧义
  const [[bp]] = await db.query(
    `SELECT id, title, start_date, end_date 
     FROM budget_periods
     WHERE ledger_id = ?
       AND start_date = ?
     ORDER BY id ASC
     LIMIT 1`,
    [ledgerId, `${p}-01`]
  );
  if (!bp) return [];

  // 查预算与支出：先聚合交易，再与预算做左连接，避免连接放大导致预算被“跟随支出”
  const [rows] = await db.query(
    `
    SELECT
      c.id AS category_id,
      c.name AS category_name,
      c.type AS category_type,
      CAST(bl.limit_amt AS DECIMAL(12,2)) AS budget_amount,
      COALESCE(tx.spent_amount, 0) AS spent_amount,
      COALESCE(tx.tx_count, 0) AS tx_count
    FROM budget_limits bl
    JOIN categories c ON bl.category_id = c.id
    LEFT JOIN (
      SELECT category_id,
             SUM(amount) AS spent_amount,
             COUNT(id)   AS tx_count
      FROM transactions
      WHERE ledger_id = ?
        AND type = 'expense'
        AND date >= ? AND date < ?
      GROUP BY category_id
    ) tx ON tx.category_id = bl.category_id
    WHERE bl.period_id = ?
    ORDER BY c.type DESC, c.name ASC
    `,
    [ledgerId, start, end, bp.id]
  );

  return rows.map((r) => {
    const progress = r.budget_amount > 0 ? Number((r.spent_amount / r.budget_amount).toFixed(4)) : null;
    const remaining = r.budget_amount > 0 ? Number((r.budget_amount - r.spent_amount).toFixed(2)) : null;
    let status = null;
    if (progress === null) {
      status = 'no_budget';
    } else if (progress < 0.8) {
      status = 'on_track';
    } else if (progress <= 1) {
      status = 'at_risk';
    } else {
      status = 'over';
    }
    return { ...r, progress, remaining, status };
  });
}

// 读取某月周期的元信息（id/title/start/end）
export async function getPeriodMeta(ledgerId, period) {
  const p = normalizePeriod(period);
  const [[row]] = await db.query(
    `SELECT id, title, start_date, end_date FROM budget_periods
     WHERE ledger_id = ? AND start_date = ?
     ORDER BY id ASC
     LIMIT 1`,
    [ledgerId, `${p}-01`]
  );
  if (!row) return null;
  const meta = { ...row };
  try {
    if (row.title && typeof row.title === 'string' && row.title.trim().startsWith('{')) {
      const obj = JSON.parse(row.title);
      if (obj && typeof obj === 'object') {
        meta.title = obj.desc ?? obj.title ?? '';
        if (obj.total != null) meta.total = Number(obj.total);
      }
    }
  } catch {}
  return meta;
}

// 插入或更新预算（仍然检查分类是否存在即可，不必限制 user_id）
export async function upsertCategoryBudget({ userId, ledgerId, categoryId, period, amount }) {
  const p = normalizePeriod(period);
  const { start, end } = getPeriodRange(p);

  // 确认周期
  const [[bp]] = await db.query(
    `SELECT id FROM budget_periods
     WHERE ledger_id = ? AND start_date = ?
     ORDER BY id DESC
     LIMIT 1`,
    [ledgerId, `${p}-01`]
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
export async function upsertBudgetPeriodTitle({ ledgerId, period, title, totalBudget }) {
  const p = normalizePeriod(period);
  const { start, end } = getPeriodRange(p);
  const [[bp]] = await db.query(
    `SELECT id FROM budget_periods WHERE ledger_id = ? AND start_date = ? ORDER BY id ASC LIMIT 1`,
    [ledgerId, `${p}-01`]
  );
  let periodId = bp?.id;
  const titleValue = (totalBudget != null)
    ? JSON.stringify({ desc: title || `${p} 月度预算`, total: Number(totalBudget) })
    : (title || `${p} 月度预算`);
  if (!periodId) {
    const [res] = await db.query(
      `INSERT INTO budget_periods (ledger_id, title, start_date, end_date)
       VALUES (?, ?, ?, DATE_SUB(?, INTERVAL 1 DAY))`,
      [ledgerId, titleValue, `${p}-01`, end]
    );
    periodId = res.insertId;
  } else {
    await db.query(`UPDATE budget_periods SET title = ? WHERE id = ?`, [titleValue, periodId]);
  }
  return { ok: true, id: periodId };
}

// Reallocate budgets atomically: set target category budget and reduce others if possible.
// sources: array of { category_id, amount } or { categoryId, reduce } etc.
export async function reallocateCategoryBudget({ ledgerId, categoryId, period, amount, sources }) {
  const p = normalizePeriod(period);
  const { start, end } = getPeriodRange(p);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Ensure or create period
    const [[bp]] = await conn.query(
      `SELECT id FROM budget_periods
       WHERE ledger_id = ? AND start_date = ?
       ORDER BY id DESC
       LIMIT 1`,
      [ledgerId, `${p}-01`]
    );
    let periodId = bp?.id;
    if (!periodId) {
      const [res] = await conn.query(
        `INSERT INTO budget_periods (ledger_id, title, start_date, end_date)
         VALUES (?, ?, ?, DATE_SUB(?, INTERVAL 1 DAY))`,
        [ledgerId, `${p} 月度预算`, `${p}-01`, end]
      );
      periodId = res.insertId;
    }

    // Validate target category exists
    const [[cat]] = await conn.query(
      `SELECT id FROM categories WHERE id = ?`,
      [categoryId]
    );
    if (!cat) {
      await conn.rollback();
      return { ok: false, reason: 'CATEGORY_NOT_FOUND' };
    }

    // Choose target period row for this category: latest row this month if exists; otherwise the latest month period
    const [[pickTarget]] = await conn.query(
      `SELECT MAX(bl.period_id) AS pid
       FROM budget_limits bl
       WHERE bl.category_id = ?
         AND bl.period_id IN (
           SELECT id FROM budget_periods WHERE ledger_id = ? AND start_date = ?
         )`,
      [categoryId, ledgerId, `${p}-01`]
    );
    const targetPid = pickTarget?.pid || periodId;

    // Upsert target category budget to desired amount on chosen period row
    await conn.query(
      `INSERT INTO budget_limits (period_id, category_id, limit_amt, rollover)
       VALUES (?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE limit_amt = VALUES(limit_amt)`,
      [targetPid, categoryId, Number(amount)]
    );

    const failures = [];
    for (const src of sources || []) {
      const srcId = Number(src?.category_id ?? src?.categoryId);
      const reduceAmt = Number(src?.amount ?? src?.reduce ?? src?.reduce_amount);
      if (!srcId || !Number.isFinite(reduceAmt) || reduceAmt <= 0) {
        failures.push({ category_id: srcId || null, reason: 'INVALID_INPUT' });
        continue;
      }

      // Pick latest budget row for this source category within the month
      const [[pickSrc]] = await conn.query(
        `SELECT MAX(bl.period_id) AS pid
         FROM budget_limits bl
         WHERE bl.category_id = ?
           AND bl.period_id IN (
             SELECT id FROM budget_periods WHERE ledger_id = ? AND start_date = ?
           )`,
        [srcId, ledgerId, `${p}-01`]
      );
      const srcPid = pickSrc?.pid;
      if (!srcPid) {
        failures.push({ category_id: srcId, reason: 'NO_BUDGET' });
        continue;
      }

      const [[lim]] = await conn.query(
        `SELECT limit_amt FROM budget_limits WHERE period_id = ? AND category_id = ?`,
        [srcPid, srcId]
      );
      if (!lim) {
        failures.push({ category_id: srcId, reason: 'NO_BUDGET' });
        continue;
      }
      const currentLimit = Number(lim.limit_amt || 0);
      const [[sumRow]] = await conn.query(
        `SELECT COALESCE(SUM(amount),0) AS spent
         FROM transactions
         WHERE ledger_id = ? AND category_id = ? AND type = 'expense'
           AND date >= ? AND date < ?`,
        [ledgerId, srcId, start, end]
      );
      const spent = Number(sumRow?.spent || 0);
      const newLimit = currentLimit - reduceAmt;
      if (newLimit < spent) {
        failures.push({ category_id: srcId, reason: 'INSUFFICIENT', current: currentLimit, spent, reduce: reduceAmt, min_allowed: spent });
        continue;
      }
      await conn.query(
        `UPDATE budget_limits SET limit_amt = ? WHERE period_id = ? AND category_id = ?`,
        [newLimit, srcPid, srcId]
      );
    }

    if (failures.length > 0) {
      await conn.rollback();
      return { ok: false, reason: 'REALLOCATE_FAILED', failures };
    }

    await conn.commit();
    return { ok: true, period_id: periodId };
  } catch (e) {
    try { await conn.rollback(); } catch {}
    throw e;
  } finally {
    conn.release();
  }
}

export async function deleteCategoryBudget({ ledgerId, categoryId, period }) {
  const p = normalizePeriod(period);

  // 找到周期（精确 start_date 匹配）
  const [[bp]] = await db.query(
    `SELECT id FROM budget_periods
     WHERE ledger_id = ? AND start_date = ?
     ORDER BY id ASC
     LIMIT 1`,
    [ledgerId, `${p}-01`]
  );
  if (!bp) return { ok: false, reason: "PERIOD_NOT_FOUND" };

  // 删除预算
  const [res] = await db.query(
    `DELETE FROM budget_limits WHERE period_id = ? AND category_id = ?`,
    [bp.id, categoryId]
  );

  return { ok: res.affectedRows > 0 };
}

// V2: 获取该月预算（合并同月重复周期），每个分类取该月最新周期的额度
export async function getBudgetsWithProgressV2(userId, ledgerId, period) {
  const p = normalizePeriod(period);
  const { start, end } = getPeriodRange(p);
  // 如果该月没有任何周期，直接返回空
  const [[exists]] = await db.query(
    `SELECT 1 AS ok FROM budget_periods WHERE ledger_id = ? AND start_date = ? LIMIT 1`,
    [ledgerId, `${p}-01`]
  );
  if (!exists) return [];

  const [rows] = await db.query(
    `
    SELECT
      c.id AS category_id,
      c.name AS category_name,
      c.type AS category_type,
      CAST(MAX(CASE WHEN bl.period_id = pick.max_pid THEN bl.limit_amt END) AS DECIMAL(12,2)) AS budget_amount,
      COALESCE(tx.spent_amount, 0) AS spent_amount,
      COALESCE(tx.tx_count, 0) AS tx_count
    FROM budget_limits bl
    JOIN (
      SELECT category_id, MAX(period_id) AS max_pid
      FROM budget_limits
      WHERE period_id IN (
        SELECT id FROM budget_periods WHERE ledger_id = ? AND start_date = ?
      )
      GROUP BY category_id
    ) pick ON pick.category_id = bl.category_id
    JOIN categories c ON bl.category_id = c.id
    LEFT JOIN (
      SELECT category_id,
             SUM(amount) AS spent_amount,
             COUNT(id)   AS tx_count
      FROM transactions
      WHERE ledger_id = ?
        AND type = 'expense'
        AND date >= ? AND date < ?
      GROUP BY category_id
    ) tx ON tx.category_id = bl.category_id
    WHERE bl.period_id IN (
      SELECT id FROM budget_periods WHERE ledger_id = ? AND start_date = ?
    )
    GROUP BY c.id, c.name, c.type
    ORDER BY c.type DESC, c.name ASC
    `,
    [ledgerId, `${p}-01`, ledgerId, start, end, ledgerId, `${p}-01`]
  );

  return rows.map((r) => {
    const progress = r.budget_amount > 0 ? Number((r.spent_amount / r.budget_amount).toFixed(4)) : null;
    const remaining = r.budget_amount > 0 ? Number((r.budget_amount - r.spent_amount).toFixed(2)) : null;
    let status = null;
    if (progress === null) {
      status = 'no_budget';
    } else if (progress < 0.8) {
      status = 'on_track';
    } else if (progress <= 1) {
      status = 'at_risk';
    } else {
      status = 'over';
    }
    return { ...r, progress, remaining, status };
  });
}
