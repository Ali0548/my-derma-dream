# Lumora Labs — Affiliate Commission Platform

Interview submission for the Lumora Labs CPA reporting challenge.

I built a full-stack app that imports the two CSVs, resolves commissions with a
specificity-based engine, and exposes three manager screens: **Performance**,
**CPA Rules** (overlap + preview), and **Order Audit**.

The brief leaves several choices open on purpose. Where it is silent, I decided
and recorded the reason here. This README is the source of truth for *what* I
built, *why*, how to start it, and what to do when something fails.

---

## Prerequisites

- **Docker Desktop** (or Docker Engine + Compose v2) running
- Ports **8080** (web) and **4000** (API) free on the host
- ~2 GB free disk for images + Postgres volume + ~200k-order import

---

## One command (reviewer path)

From this folder (`my-derma-dream/`):

```bash
docker compose up --build
```

Then open **http://localhost:8080**

### Admin login

| | |
|---|---|
| **Email** | `abhai0548@gmail.com` |
| **Password** | `Lumora@Admin#2026$Kx9!` |

> Compose escapes `$` as `$$` in `docker-compose.yml`. The real password still
> contains a **single** `$` before `Kx9!` (as shown above).

### First boot — expect a wait

A **slow import is acceptable** (brief §4.1). The first `docker compose up --build`:

1. Builds API + web images (a few minutes the first time)
2. Starts Postgres and waits until healthy
3. Runs migrations + admin seed
4. Imports `backend/initial-seeds/rules.csv` + `orders.csv` (~200k orders)
5. Recalculates commissions + daily performance rollups
6. Starts the API and warms the full-year report cache
7. Serves the UI on **8080**

Later boots skip re-import / recalc when data is already present (much faster).

**Ready checks:**

| Check | URL / command |
|---|---|
| UI | http://localhost:8080 |
| API health | http://localhost:4000/api/health |
| Logs | `docker compose logs -f api` |

Useful Compose commands:

```bash
docker compose up --build          # foreground (see import progress)
docker compose up -d --build       # detached
docker compose ps                  # container status
docker compose logs -f api         # follow API / import / recalc
docker compose down                # stop (keeps DB + report-cache volumes)
docker compose down -v             # stop + wipe volumes (full re-import next up)
```

---

## Brief compliance checklist

| Brief item | Status | Where |
|---|---|---|
| **4.1** Import both CSVs into a designed schema | Done | Docker boot + `npm run initial-seeds` |
| **4.2** Commission engine (resolve + calculate) | Done | `backend/src/modules/commission/engine.ts` |
| **4.3** Performance: day columns, affiliate → sub | Done | `/app/performance` |
| **4.3** Five metrics (Revenue, Spend, ROAS, Sales, AOV) | Done | Same |
| **4.3** Filters: date, affiliate, sub, product, price | Done | Same |
| **4.3** ROAS toggle (front-end / total) | Done | Same; client-side after year cache |
| **4.3** Full year &lt; 2s | Done | Pre-agg + API/disk cache + browser IndexedDB |
| **4.4** Rule CRUD without SQL | Done | `/app/rules` modal |
| **4.4** Overlap detection + who wins | Done | Live panel + example walkthrough |
| **4.4** Preview a sale | Done | Rules page “Preview a sale” |
| **4.5** Audit: winning rule + why others skipped | Done | `/app/audit` + Performance eye |
| **5.1** Git history (not one squash) | Reviewer verifies | Repo commit history |
| **5.2** One-command run | Done | `docker compose up --build` |
| **5.3** Tests | Done | `cd backend && npm test` |
| **5.4** README decisions / cuts / 10M | Done | This file |
| **5.5** Screen recording | Candidate delivers | Checklist below |

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Backend | Express + TypeScript + Drizzle + PostgreSQL | Typed schema I can defend; Postgres handles ~200k orders |
| Frontend | React + Vite + Tailwind + React Query + Formik | Fast UI, shared forms/tables, cacheable queries |
| Cache | API memory + disk volume; browser memory + IndexedDB | Survive restarts and refresh without re-downloading the year pack |
| Run | Docker Compose | One reviewer command as the brief asks |

Money is stored as Postgres **`numeric`** and rounded to 2 decimals in the engine —
never JS float as the source of truth for persisted commissions.

---

## What Compose starts

| Service | Port | Role |
|---|---|---|
| `db` | internal | Postgres 16 (`lumora` / `lumora` / db `lumora`) |
| `api` | `4000` | Migrate, seed, CSV import, recalc, warm cache, Express API |
| `web` | `8080` | Nginx + React build; `/api` proxied to the API |

Seed files live at:

- `backend/initial-seeds/orders.csv`
- `backend/initial-seeds/rules.csv`

---

## Troubleshooting / error cases

### Port already in use (`8080` or `4000`)

```bash
# Windows (PowerShell): find who owns the port
netstat -ano | findstr :8080
netstat -ano | findstr :4000
```

Stop the other process, or change the left-hand ports in `docker-compose.yml`
(e.g. `"8081:80"`).

### Docker Desktop not running

Symptom: `Cannot connect to the Docker daemon` / `error during connect`.  
Start Docker Desktop, wait until it is healthy, retry `docker compose up --build`.

### First boot looks “stuck”

Import + commission recalc on ~200k orders takes several minutes. Watch:

```bash
docker compose logs -f api
```

You should see migrate → seed → initial-seeds progress → recalc progress →
`listening` / server start. Do **not** assume failure just because the UI is not
instant on a cold volume.

### API unhealthy / UI loads but login fails

1. `docker compose ps` — `api` and `db` should be up; `db` healthy.
2. Open http://localhost:4000/api/health
3. `docker compose logs api --tail 100`
4. Confirm password: `Lumora@Admin#2026$Kx9!` (one `$`)

### Empty Performance / no orders

Usually means import or recalc did not finish (or volumes were wiped mid-run).

```bash
docker compose logs api --tail 200
docker compose down -v
docker compose up --build
```

`-v` wipes Postgres + report cache so the next boot does a full import again.

### Force re-import or force recalc (advanced)

Inside the API container / local backend:

```bash
# re-import CSVs even if rows exist
FORCE_INITIAL_SEEDS=true npm run initial-seeds

# recompute commissions even if none pending
FORCE_RECALC=true node dist/jobs/recalcCommissions.js
```

(In Docker, the normal boot path already runs these once; force flags are for recovery.)

### Performance still slow after first open

1. Hard refresh once so the new frontend + IndexedDB key load.
2. Stay on Overview a few seconds (shell prefetches the year pack).
3. Product / price filters intentionally hit the server (they change the pack).
4. ROAS / dates / affiliate / sub should be near-instant from the year cache.

### Login works, then 401 on API calls

JWT expired or cleared `localStorage`. Sign out and sign in again.
Secret is set in Compose (`JWT_SECRET`); do not mix old tokens from a previous wipe.

### Rule save / Performance looks stale

Saving a rule triggers commission recalc + report cache invalidation. Large
recalcs take time; refresh Performance after the job finishes (API logs show
progress). If needed, restart API after recalc: `docker compose restart api`.

### Browser IndexedDB corruption

Clear site data for `http://localhost:8080` (or use the Performance “Retry”
path that clears the year cache), then reload. The year pack will download again.

### Wrong folder

Always run Compose from **`my-derma-dream/`** (the directory that contains
`docker-compose.yml`), not from the parent “Full Stack Dev Challenge” folder.

---

## Decisions (brief was silent)

### 1. CSV import: Docker / CLI bootstrap, not a frontend upload screen

**Decision:** Seed CSVs in `backend/initial-seeds/` import on API boot. Same path
via `npm run initial-seeds`. No UI upload.

**Why:** Brief requires import + one-command run, not a manager upload flow. Time
went to engine, &lt;2s report, overlap/preview, audit. Runs recorded in `data_imports`.

### 2. Specificity score

| Scope field filled | Points |
|---|---|
| Product | +1 |
| Price point | +2 |
| Affiliate | +4 |
| Sub-affiliate | +8 |

Empty = “any” (0 points). Among rules that match date + scope, **highest score wins**.
Ties: later `effective_from`, then higher `rule_id`.

**Why:** Matches the brief ladder in one number for audit / overlap UI.

### 3. Percent vs fixed CPA

- **Percent:** of **front-end product price only** (upsells excluded) — per brief.
- **Fixed:** flat dollars per matched order. Price point is only a **scope filter**,
  not the payout formula (e.g. “price = $69, pay fixed $87”).

Paying **above 100%** of front-end is allowed; brief says margin comes from upsells.

### 4. Effective dates

Order date must fall in `[effective_from, effective_to]` (`effective_to` null = open).
Last week’s rate and today’s rate are different rules / ranges — historical orders
keep the rate that was live on that day after recalc.

### 5. Performance: pre-aggregate + year cache + client slice

1. `daily_performance_stats` stores both front-end and total revenue, spend, sales.
2. API returns one compact full-year pack:
   cell = `[sales, frontendRevenue, totalRevenue, spend]`.
3. Browser keeps it in **memory + IndexedDB**. ROAS / dates / partner filters slice
   **client-side**.
4. Product / price filters hit the **server** (different fact slice).
5. Day columns = days with activity in the filtered view; horizontal virtualization
   keeps paint fast.
6. Admin shell prefetches Performance chunk + year pack after login.

**Why:** &lt;2s at full year failed when we re-downloaded / re-painted huge JSON on
every toggle. Cache-once matches how managers use the screen.

### 6. Performance “eye”

Shows **rules that paid that affiliate** in the date range (not a raw order dump),
plus win reason + evaluation DataTable. Row badge: **Won by R0xxx · +N other rules**.

### 7. Rule overlap UX

Live overlap counts + dropdown of **real** draft ↔ competitor pairs with Order A/B
stories (product, price, affiliate, sub). Full list behind “Show all N…”.

### 8. Auth

Seeded JWT admin. Brief did not require multi-tenant auth.

### 9. No matching rule

Commission `0`, status `no_rule`; audit lists why candidates were skipped / none matched.

### 10. Blank affiliate on orders

Shown as `(direct)` in reporting.

---

## Ambiguities — what I did

| Topic | Ambiguity | Decision |
|---|---|---|
| Empty CSV scope cells | Confirmed “any” | Empty string = wildcard |
| Price `49` vs `49.00` | Formatting | Normalize when match/store |
| “Inherit from level above” | Sounds like tree walk | All matching rules compete; highest specificity wins (nested scopes still override) |
| ROAS with spend 0 | Silent | Show “—” / null, not Infinity |
| Import twice | Silent | Skip if data present unless `FORCE_INITIAL_SEEDS=true` |
| Recalc twice | Silent | Skip if no pending unless `FORCE_RECALC=true` |

---

## Database schema

| Table | Purpose |
|---|---|
| `users` | Auth |
| `affiliates` / `sub_affiliates` | Partner directory |
| `products` / `product_price_points` | Catalogue / filters |
| `cpa_rules` | Contracts |
| `orders` | Facts + applied rule / commission / win reason |
| `order_commission_audits` | Audit header |
| `order_rule_evaluations` | Each candidate + why |
| `daily_performance_stats` | Report rollups |
| `data_imports` | Import runs |
| `recalc_jobs` | Rebuild jobs after rule edits |

---

## Screens & screen-recording checklist (brief §5.5)

Record 5–10 minutes. Talk while you click.

1. **Performance** (`/app/performance`)
   - Full year loads (mention cache)
   - Change a filter (date or affiliate)
   - Toggle **Front-end ROAS** ↔ **Total ROAS**
   - Expand an affiliate → sub-affiliates
   - Optional: eye → winning rule explanation
2. **Order Audit** (`/app/audit`)
   - Open one order id
   - Explain why the winner beat others (specificity / scope / dates)
3. **CPA Rules** (`/app/rules`)
   - Create **or** edit a rule that overlaps an existing one
   - Show overlap warning / example walkthrough
   - Save (mention background recalc)

Login first at `/login` if needed.

---

## Tests

```bash
cd backend
npm test
```

Covers specificity, commission math (fixed vs percent), overlap competition, and
date-window cases. No full Playwright suite in this submission — engine tests protect
the money path; I would add E2E for Performance in production.

---

## Local dev (optional)

### Database only

```bash
docker compose up -d db
```

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run db:setup
npm run initial-seeds
npm run dev
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

UI: `http://localhost:5173` with `VITE_API_BASE_URL` pointing at the API.

---

## What I would do at ~10 million orders

- Keep daily/hourly **rollups** as the only Performance source of truth
- Shared **Redis** (or edge cache) for compact dual-revenue packs
- **Partition** orders / stats by month; archive cold data
- Rule-edit recalc as a **queued worker** with progress + prefix cache invalidation
- Optional columnar store for ad-hoc analytics; Postgres remains system of record
- Chunked / columnar browser payloads if year packs grow past a few MB

---

## What I cut

- No CSV **upload UI** (bootstrap only) — deliberate
- No invite / password-reset flows
- No mobile-first day matrix (laptop desk tool; virtualization helps)
- No Redis in Compose (disk + memory enough for one-box review)

---

## Project layout

```
my-derma-dream/
  docker-compose.yml
  README.md              ← this file
  backend/               Express, Drizzle, importer, engine, tests, initial-seeds/
  frontend/              React (Performance, Rules, Audit, Users)
```

Shared UI conventions: `Button` → `Spinner`, `FormSubmitButton`, `ComponentLoader`,
`AppForm` + fields, `SearchableSelect`, `DataTable`, `api/*` helpers.

---

## Business reminder (why this product exists)

Partners can look “expensive” on front-end alone (CPA near or above the product
price). **Total ROAS** includes upsells so managers can see who actually makes money —
the question the brief asks the system to answer.
