import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db.js';
import { findTransactions, findTransactionById } from '../dao/transactionDao.js';
import { listCategoriesByUser } from '../dao/categoryDao.js';
import { getTransaction, getTransactions } from '../controllers/transaction.js';
import { getMyCategories } from '../controllers/category.js';

// In-memory dataset to simulate DB rows
const dataset = {
  users: [
    { id: 1, username: 'alice' },
    { id: 2, username: 'bob' },
    { id: 3, username: 'charlie' },
  ],
  ledgers: [
    { id: 10, name: 'Household', owner_id: 1 },
  ],
  ledger_members: [
    { ledger_id: 10, user_id: 1, role: 'owner' },
    { ledger_id: 10, user_id: 2, role: 'editor' },
  ],
  categories: [
    { id: 100, user_id: 1, name: 'Groceries', type: 'expense', created_at: '2025-01-01 00:00:00' },
    { id: 101, user_id: 1, name: 'Food', type: 'expense', created_at: '2025-01-02 00:00:00' },
    { id: 102, user_id: 2, name: 'Food', type: 'expense', created_at: '2025-01-03 00:00:00' },
    { id: 103, user_id: 2, name: 'Rent', type: 'expense', created_at: '2025-01-04 00:00:00' },
  ],
  transactions: [
    { id: 1000, ledger_id: 10, user_id: 1, amount: 50.00, type: 'expense', category_id: 100, note: '', date: '2025-01-01' },
    { id: 1001, ledger_id: 10, user_id: 2, amount: 20.00, type: 'expense', category_id: 100, note: '', date: '2025-01-02' },
  ],
};

function isMember(ledgerId, userId) {
  return dataset.ledger_members.some(m => m.ledger_id === Number(ledgerId) && m.user_id === Number(userId));
}

// Very lightweight query stub tailored to the DAO SQL strings
function createQueryStub() {
  return async (sql, params) => {
    // List
    if (
      typeof sql === 'string' &&
      sql.includes('FROM transactions t') &&
      sql.includes('JOIN categories') &&
      sql.includes('JOIN ledgers') &&
      sql.includes('JOIN ledger_members m') &&
      sql.includes('WHERE 1=1')
    ) {
      const userId = Number(params[0]);
      let ledgerFilter = null;
      // If SQL includes ledger filter, it will be after the user param
      if (sql.includes('AND t.ledger_id = ?')) {
        ledgerFilter = Number(params[params.length - 1]);
      }
      const rows = dataset.transactions
        .filter(t => isMember(t.ledger_id, userId))
        .filter(t => (ledgerFilter ? t.ledger_id === ledgerFilter : true))
        .map(t => {
          const c = dataset.categories.find(c => c.id === t.category_id);
          const l = dataset.ledgers.find(l => l.id === t.ledger_id);
          const u = dataset.users.find(u => u.id === t.user_id);
          return {
            id: t.id,
            amount: t.amount,
            type: t.type,
            note: t.note,
            date: t.date,
            category_id: t.category_id,
            ledger_id: t.ledger_id,
            category_name: c?.name,
            ledger_name: l?.name,
            created_by_user_id: u?.id,
            created_by_username: u?.username,
          };
        });
      return [rows];
    }
    // Detail
    if (
      typeof sql === 'string' &&
      sql.includes('FROM transactions t') &&
      sql.includes('JOIN categories') &&
      sql.includes('JOIN ledgers') &&
      sql.includes('JOIN ledger_members m') &&
      sql.includes('WHERE t.id = ?')
    ) {
      const userId = Number(params[0]);
      const id = Number(params[1]);
      const t = dataset.transactions.find(x => x.id === id);
      if (!t || !isMember(t.ledger_id, userId)) return [[]];
      const c = dataset.categories.find(c => c.id === t.category_id);
      const l = dataset.ledgers.find(l => l.id === t.ledger_id);
      const u = dataset.users.find(u => u.id === t.user_id);
      return [[{
        id: t.id,
        amount: t.amount,
        type: t.type,
        note: t.note,
        date: t.date,
        category_id: t.category_id,
        ledger_id: t.ledger_id,
        category_name: c?.name,
        ledger_name: l?.name,
        created_by_user_id: u?.id,
        created_by_username: u?.username,
      }]];
    }
    // Categories: membership check
    if (typeof sql === 'string' && sql.startsWith('SELECT 1 FROM ledger_members')) {
      const [ledgerId, userId] = params.map(Number);
      return [[isMember(ledgerId, userId) ? 1 : undefined]];
    }
    // Categories: list for ledger (DAO join)
    if (
      typeof sql === 'string' &&
      sql.includes('FROM categories c') &&
      sql.includes('JOIN ledger_members m') &&
      sql.includes('JOIN ledgers l')
    ) {
      const ledgerId = Number(params[0]);
      const type = sql.includes('WHERE c.type = ?') ? params[1] : null;
      // Build rows similar to DAO query
      const ownerId = dataset.ledgers.find(l => l.id === ledgerId)?.owner_id;
      const members = dataset.ledger_members.filter(m => m.ledger_id === ledgerId).map(m => m.user_id);
      const rows = dataset.categories
        .filter(c => members.includes(c.user_id))
        .filter(c => (type ? c.type === type : true))
        .sort((a,b) => a.name.localeCompare(b.name) || a.created_at.localeCompare(b.created_at))
        .map(c => ({...c, owner_id: ownerId, is_owner: c.user_id === ownerId ? 1 : 0 }));
      return [rows];
    }
    // Categories: list user-only
    if (typeof sql === 'string' && sql.includes('FROM categories') && sql.includes('WHERE user_id = ?')) {
      const userId = Number(params[0]);
      const type = sql.includes('AND type = ?') ? params[1] : null;
      const rows = dataset.categories.filter(c => c.user_id === userId).filter(c => (type ? c.type === type : true)).map(({id,user_id,name,type,created_at})=>({id,user_id,name,type,created_at}));
      return [rows];
    }
    // Fallback for unused queries in these tests
    return [[]];
  };
}

// Save original
const originalQuery = db.query;
db.query = createQueryStub();

test('DAO: members can list each other\'s transactions', async () => {
  const rows = await findTransactions(2, { ledger_id: 10 });
  assert.equal(Array.isArray(rows), true);
  assert.equal(rows.length, 2);
  const creators = rows.map(r => r.created_by_username).sort();
  assert.deepEqual(creators, ['alice', 'bob']);
});

test('DAO: member can read detail created by another user', async () => {
  const row = await findTransactionById(2, 1000);
  assert.equal(row.created_by_username, 'alice');
  assert.equal(row.ledger_id, 10);
});

test('DAO: non-member cannot list ledger transactions', async () => {
  const rows = await findTransactions(3, { ledger_id: 10 });
  assert.equal(rows.length, 0);
});

test('DAO: non-member cannot read detail', async () => {
  const row = await findTransactionById(3, 1000);
  assert.equal(row, undefined);
});

// Controller-level quick checks using mocked req/res
function mockRes() {
  const store = { statusCode: 200, jsonBody: null };
  return {
    status(code) { store.statusCode = code; return this; },
    json(obj) { store.jsonBody = obj; return this; },
    get _() { return store; }
  };
}

test('Controller: non-member getTransaction returns 404', async () => {
  const req = { user: { id: 3 }, params: { id: 1000 } };
  const res = mockRes();
  await getTransaction(req, res);
  assert.equal(res._.statusCode, 404);
});

test('Controller: member getTransactions with ledger filter sees both records', async () => {
  const req = { user: { id: 2 }, query: { ledger_id: 10 } };
  const res = mockRes();
  await getTransactions(req, res);
  assert.equal(res._.statusCode, 200);
  assert.equal(Array.isArray(res._.jsonBody), true);
  assert.equal(res._.jsonBody.length, 2);
});

// Category DAO + Controller tests
test('DAO: listCategoriesByUser with ledgerId returns combined member categories, dedup preferring owner', async () => {
  const rows = await listCategoriesByUser(2, 'expense', 10);
  const names = rows.map(r => r.name).sort();
  // Expect Food (owner wins) and Groceries + Rent in dataset (Groceries only owner, Rent only editor)
  assert.deepEqual(names, ['Food','Groceries','Rent'].sort());
  const food = rows.find(r => r.name === 'Food');
  assert.equal(food.user_id, 1); // owner
});

test('Controller: getMyCategories with ledger_id enforces membership', async () => {
  // Non-member
  const req1 = { user: { id: 3 }, query: { type: 'expense', ledger_id: 10 } };
  const res1 = mockRes();
  await getMyCategories(req1, res1);
  assert.equal(res1._.statusCode, 403);

  // Member
  const req2 = { user: { id: 2 }, query: { type: 'expense', ledger_id: 10 } };
  const res2 = mockRes();
  await getMyCategories(req2, res2);
  assert.equal(res2._.statusCode, 200);
  const names2 = (res2._.jsonBody || []).map(r => r.name).sort();
  assert.deepEqual(names2, ['Food','Groceries','Rent'].sort());
});

// Restore original after all tests
process.on('exit', () => { db.query = originalQuery; });
