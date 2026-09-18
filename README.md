# Lumora Labs — Affiliate Commission Platform

Interview challenge scaffold for the Lumora Labs CPA reporting product.

The brief leaves several choices open on purpose. Where it is silent, I decided and recorded the reason here so a reviewer can challenge those calls.

## Stack

- **Backend:** Express + TypeScript + Drizzle ORM + PostgreSQL
- **Frontend:** React + Vite + Tailwind CSS + React Query + Formik
- **Cache:** in-memory cache abstraction (Redis-swappable later)
- **Run:** Docker Compose (`db` + `api` + `web`) — one command

## Admin login

- **Email:** `abhai0548@gmail.com`
- **Password:** `Lumora@Admin#2026$Kx9!`

## Decisions (brief was silent)

### CSV import: Docker / CLI bootstrap, not a frontend upload screen

**Decision:** Treat `backend/initial-seeds/orders.csv` and `backend/initial-seeds/rules.csv` as the source of truth for first load. Import them automatically on `docker compose up` (API boot), and expose the same path as `npm run initial-seeds` for local re-runs. I did **not** build a UI “upload CSV” feature.

**Why:**

- The brief asks for import into a store of my design, and says a slow import is acceptable. It does **not** require a manager-facing upload flow.
- Reviewers must reach a working app with data loaded after one command. Baking the CSVs into the API image and running the importer at boot meets that directly.
- Time is better spent on the commission engine, performance report (&lt;2s), rule editor (overlap + preview), and audit view — the parts the brief grades hardest.
- Re-import is still available without the UI: `npm run initial-seeds`, or `FORCE_INITIAL_SEEDS=true npm run initial-seeds` to force upsert again.
- Import runs are recorded in `data_imports` so the choice is still observable in the database.

**What I would do in production:** keep the same importer as a job/CLI, and only then add an optional admin upload that writes to object storage and enqueues the same pipeline — not a separate import implementation.

## One command (reviewer path)

```bash
docker compose up --build
```

Then open **http://localhost:8080**

On API boot Docker will:

1. wait for Postgres
2. run migrations
3. seed admin user
4. import `backend/initial-seeds` rules + orders CSVs
5. start the API

- API health: http://localhost:4000/api/health
- Login: `abhai0548@gmail.com` / `Lumora@Admin#2026$Kx9!`

Compose starts **Postgres + API (migrate / admin seed / CSV import) + Web (nginx)**.

### Re-import seeds manually

```bash
cd backend
npm run initial-seeds

# force re-upsert even if rows already exist:
FORCE_INITIAL_SEEDS=true npm run initial-seeds
```

## Local dev (optional, without full Compose app containers)

### 1. Database only

```bash
docker compose up -d db
```

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run db:setup
npm run initial-seeds
npm run dev
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

UI: `http://localhost:5173`

## Database schema (complete for the challenge)

| Table | Purpose |
|---|---|
| `users` | Auth / admin access |
| `affiliates` / `sub_affiliates` | Partner directory for filters |
| `products` / `product_price_points` | Catalogue helpers for rule editor + filters |
| `cpa_rules` | CPA contracts (scopes, dates, specificity) |
| `orders` | Order facts + precomputed commission fields |
| `order_commission_audits` | Per-order audit header (who won) |
| `order_rule_evaluations` | Candidate rules + why each lost/won |
| `daily_performance_stats` | Rollups for sub-2s performance report |
| `data_imports` | CSV import run tracking |
| `recalc_jobs` | Commission rebuild jobs after rule edits |

## Built so far

- Reusable Express API structure (errors, auth, validation, cache)
- Full challenge schema (above)
- Seeded admin user
- Initial CSV import on Docker boot + `npm run initial-seeds`
- Admin shell: sidebar, header, footer
- Login + Users table (search, filters, CSV/PDF export)
- Shared UI: Button (with spinner), ComponentLoader, SearchableSelect, Formik forms, axios API client, lazy pages
