BudgetCloud — Collaborative Budgeting & Analytics

BudgetCloud is a collaborative budgeting app that lets individuals and teams track income and expenses across shared ledgers (budgets), allocate category budgets, browse a calendar of activity, and analyze spending with clean charts.

Key components live under a React + Vite client and a Node.js + Express API backed by MySQL. Google Sign‑In is supported when configured.

—

Features

- Authentication: email/password login, logout, and optional Google Sign‑In. JWT is issued and stored in an httpOnly cookie.
- Ledgers (Budgets): create, list, view details; rename (owner/editor), delete (owner only).
- Membership & Roles: invite by username; roles include owner, editor, and viewer; change roles; transfer ownership; leave a ledger (owner must transfer first).
- Categories: personal category library (create, rename, delete). Used for both budgeting and transactions.
- Transactions: add, edit, delete income and expense entries; filter by date range, type, category; see who created a record.
- Budgeting: per‑category budget for a period (YYYY‑MM) with progress overview and category‑level table; quick “allocate remaining to Other”.
- Analytics: category analytics view with selectable date range, per‑category totals/averages, and smooth line/bar charts.
- Calendar: month view that marks income/expense presence per day with an adjacent daily transaction list; supports “All Budgets” or a specific ledger.
- AI Summaries (read‑only): fetch a precomputed monthly summary if present in the `ai_summaries` table.

—

Future Work

- AI insights generation: compute natural‑language monthly summaries with an LLM and store them, instead of only reading prefilled rows.
- Invitation flow: add accept/decline and email/link invites rather than direct owner assignment.
- Budget enforcement: warnings and optional blocking when a transaction would exceed a category or total budget; budget status badges (on‑track/at‑risk/over).
- Weekly dashboard: 7‑day spending distribution, workday vs. weekend comparison, and additional visualizations (e.g., tangential polar bar).
- Member comparisons: per‑member spending comparisons and contribution breakdowns within a ledger.
- Category adjustments: interactive prompts to reallocate budget when adding/updating transactions to keep totals invariant.
- UX polish: richer hover/expand interactions, clearer labels on charts, and explicit “created by” display across lists.
- i18n/A11y: English/Chinese localization and improved accessibility.

—

Tech Stack

- Frontend: React 18, Vite 7, Tailwind CSS, Redux Toolkit, Tremor components.
- Backend: Node.js + Express 5, MySQL (mysql2), JSON Web Tokens, Google OAuth (google‑auth‑library).
- Dev/Ops: Nodemon for dev, optional PM2 via `ecosystem.config.js` for process management.

—

Getting Started

- Prerequisites
  - Node.js 18+ and npm
  - MySQL 8+ (local or managed; SSL supported)

- Database
  - Create a database (e.g., `budget_tracker`).
  - Import the schema dumps in `Mysql/` to create tables:
    - `Mysql/budget_tracker_users.sql`
    - `Mysql/budget_tracker_ledgers.sql`
    - `Mysql/budget_tracker_ledger_members.sql`
    - `Mysql/budget_tracker_categories.sql`
    - `Mysql/budget_tracker_transactions.sql`
    - `Mysql/budget_tracker_budget_limits.sql`
    - `Mysql/budget_tracker_budget_periods.sql`
    - `Mysql/budget_tracker_ai_summaries.sql`

- Backend (API)
  - Configure environment in `api/.env` (see `api/db.js:1`). Typical keys:
    - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`
    - `DB_SSL_CA_PATH` (if your provider requires SSL)
    - `DB_CONN_LIMIT` (optional)
    - `GOOGLE_CLIENT_ID` (optional; enables Google login)
  - Install and run:
    - `cd api && npm i`
    - `npm run dev` (starts on `http://localhost:8800`)

- Frontend (Client)
  - Environment (see `client/.env` and `client/vite.config.js:1`):
    - `VITE_GOOGLE_CLIENT_ID` (optional for Google login)
    - `VITE_API_BASE=/api` (default; proxied to backend)
  - Install and run:
    - `cd client && npm i`
    - `npm run dev` (Vite dev server, proxying `/api` to the backend)

- PM2 (optional)
  - Start both processes with `pm2` using `ecosystem.config.js:1`:
    - `pm2 start ecosystem.config.js`

—

API Overview (Quick Reference)

- Auth
  - `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/google`
- Users
  - `GET /api/users/me`
- Ledgers
  - `GET /api/ledgers`, `POST /api/ledgers`
  - `GET /api/ledgers/:ledgerId`, `PATCH /api/ledgers/:ledgerId`, `DELETE /api/ledgers/:ledgerId`
- Members
  - `GET /api/ledgers/:ledgerId/members`, `POST /api/ledgers/:ledgerId/members`
  - `PUT /api/ledgers/:ledgerId/members/:memberId`, `DELETE /api/ledgers/:ledgerId/members/:memberId`
  - `POST /api/ledgers/:ledgerId/transfer-owner`, `POST /api/ledgers/:ledgerId/leave`
- Budgets
  - `GET /api/ledgers/:ledgerId/budgets`
  - `PUT /api/ledgers/:ledgerId/budgets/:categoryId`, `DELETE /api/ledgers/:ledgerId/budgets/:categoryId`
  - `PATCH /api/ledgers/:ledgerId/budgets/period`
- Categories
  - `GET /api/categories`, `POST /api/categories`
  - `PUT /api/categories/:categoryId`, `DELETE /api/categories/:categoryId`
- Transactions
  - `GET /api/transactions` (filters: `ledger_id`, `category_id`, `type`, `start_date`, `end_date`)
  - `GET /api/transactions/:id`, `POST /api/transactions`, `PUT /api/transactions/:id`, `DELETE /api/transactions/:id`
- AI Summaries
  - `GET /api/ledgers/:ledgerId/summaries/:month` (month format `YYYY-MM`)

—

Notes

- The client proxies requests starting with `/api` to the backend (see `client/vite.config.js:1`). For production, serve the API and a static client build behind a reverse proxy that maps `/api` appropriately.
- Google Sign‑In only appears if `VITE_GOOGLE_CLIENT_ID` is set on the client and `GOOGLE_CLIENT_ID` is set on the API.

