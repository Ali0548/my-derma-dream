# Lumora Labs — Affiliate Commission Platform

Interview challenge scaffold for the Lumora Labs CPA reporting product.

## Stack

- **Backend:** Express + TypeScript + Drizzle ORM + PostgreSQL
- **Frontend:** React + Vite + Tailwind CSS + React Query + Formik
- **Cache:** in-memory cache abstraction (Redis-swappable later)
- **Run DB locally:** Docker Compose (Postgres only in this commit)

## Admin login

- **Email:** `abhai0548@gmail.com`
- **Password:** `Lumora@Admin#2026$Kx9!`

## One command (reviewer path)

```bash
docker compose up --build
```

Then open **http://localhost:8080**

- API health: http://localhost:4000/api/health
- Login: `abhai0548@gmail.com` / `Lumora@Admin#2026$Kx9!`

Compose starts **Postgres + API (migrate/seed) + Web (nginx)**.

## Local dev (optional, without Docker app containers)

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

## First-slice scope

- Reusable Express API structure (errors, auth, validation, cache)
- Full challenge schema (above)
- Seeded admin user
- Admin shell: sidebar, header, footer
- Login + Users table (search, filters, CSV/PDF export)
- Shared UI: Button (with spinner), ComponentLoader, SearchableSelect, Formik forms, axios API client, lazy pages
