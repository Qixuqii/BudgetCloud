import http from './http.js';

export const fetchLedgers = () => 
    http.get('/ledgers').then(res => res.data);

// 2. 创建新账本
export const createLedger = (payload) =>
  http.post('/ledgers', payload).then(res => res.data);

export const updateLedger =(id, payload) =>
    http.patch(`/ledgers/${id}`, payload).then(res => res.data);

// 5. 删除或退出账本
export const deleteLedger = (id) =>
  http.delete(`/ledgers/${id}`).then(res => res.data);

// 6. 成员相关接口
export const fetchMembers = (id) =>
  http.get(`/ledgers/${id}/members`).then(res => res.data);

export const inviteMember = (id, payload) =>
  http.post(`/ledgers/${id}/members`, payload).then(res => res.data);

export const updateMemberRole = (id, memberId, role) =>
  http.put(`/ledgers/${id}/members/${memberId}`, { role }).then(res => res.data);

export const removeMember = (id, memberId) =>
  http.delete(`/ledgers/${id}/members/${memberId}`).then(res => res.data);

export const transferOwner = (id, newOwnerMemberId) =>
  http.post(`/ledgers/${id}/transfer-owner`, { newOwnerMemberId }).then(res => res.data);

export const leaveLedger = (id) =>
  http.post(`/ledgers/${id}/leave`).then(res => res.data);

// 8. 设置分类预算（当月），仅用于创建时批量写入
export const setCategoryBudget = (ledgerId, categoryId, amount, period) =>
  http.put(`/ledgers/${ledgerId}/budgets/${categoryId}`, { amount }, { params: period ? { period } : undefined }).then(res => res.data);

export const removeCategoryBudget = (ledgerId, categoryId, period) =>
  http.delete(`/ledgers/${ledgerId}/budgets/${categoryId}`, { params: period ? { period } : undefined }).then(res => res.data);

export const updateBudgetPeriod = (ledgerId, { period, title, totalBudget }) =>
  http.patch(`/ledgers/${ledgerId}/budgets/period`, { period, title, totalBudget }).then(res => res.data);

// Fetch budgets list for a ledger + period
export const fetchBudgets = (ledgerId, period) =>
  http.get(`/ledgers/${ledgerId}/budgets`, { params: period ? { period } : undefined }).then(res => res.data);

// 7. 账本详情（聚合基础信息 + 当月预算进度 + AI 总结）
export const fetchLedgerDetail = async (id, period) => {
  // 默认当前月 YYYY-MM
  const p = (period && /^\d{4}-\d{2}$/.test(period))
    ? period
    : new Date().toISOString().slice(0, 7);

  // 并发请求：基础信息、预算进度、AI 总结
  const [baseRes, budgetRes] = await Promise.all([
    http.get(`/ledgers/${id}`),
    http.get(`/ledgers/${id}/budgets`, { params: { period: p } }),
  ]);

  const base = baseRes.data || {};
  const budgetData = budgetRes.data || { period: p, items: [], title: null, total: null };
  const ai = null; // disable AI summary fetch to avoid noisy 500s

  // 将 budgets.items 适配前端需要的 categories 结构
  const categories = (budgetData.items || []).map((r) => ({
    id: r.category_id,
    name: r.category_name,
    limit: typeof r.budget_amount === 'string' ? Number(r.budget_amount) : (r.budget_amount || 0),
    spent: typeof r.spent_amount === 'string' ? Number(r.spent_amount) : (r.spent_amount || 0),
    txCount: r.tx_count || 0,
  }));

  // 计算 totals
  const totals = categories.reduce((acc, c) => {
    acc.budget += Number(c.limit || 0);
    acc.spent += Number(c.spent || 0);
    return acc;
  }, { budget: 0, spent: 0 });
  // If server provides a custom total (overall budget), prefer it
  if (budgetData.total != null && Number.isFinite(Number(budgetData.total))) {
    totals.budget = Number(budgetData.total);
  }

  // 生成 period 的起止日期（用于 UI 文案）
  const [yy, mm] = p.split('-').map(Number);
  const start = new Date(yy, mm - 1, 1);
  const nextMonth = new Date(yy, mm, 1);
  const end = new Date(nextMonth - 1);
  const pad = (n) => String(n).padStart(2, '0');
  const periodObj = {
    start_date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    end_date: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  };

  return {
    id: base.id,
    name: base.name,
    period: periodObj,
    periodTitle: budgetData.title || null,
    totals,
    categories,
    aiSummary: ai ? ai.summary_text : null,
  };
}
