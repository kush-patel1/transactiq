# TransactIQ

A point-of-sale for convenience & liquor stores with a **margin-aware
intelligence layer**. It captures your true cost at receiving (via AI invoice
scanning) so it can show you real profit — not just sales.

**Live demo:** https://kush-patel1.github.io/transactiq/

> Firebase project: `transactiq-746f9`

## Deployment

Every push to `main` auto-deploys to GitHub Pages via
[.github/workflows/deploy.yml](.github/workflows/deploy.yml):
the workflow builds with `--base=/<repo>/` (project sites live on a subpath),
copies `index.html` → `404.html` so deep links like `/demo` survive refreshes,
and publishes `dist/` with `actions/deploy-pages`. The router picks up the
subpath automatically via `basename={import.meta.env.BASE_URL}`.

## Quick start

```bash
npm install
npm run dev
# open http://localhost:5173
```

- `/` — marketing landing page
- `/demo` — the full app (persists to localStorage; "Reset demo" reseeds):
  - **Sign in** — Kush (owner, PIN 1234) or Sam (cashier, PIN 5678); roles gate tabs
  - **Register** — requires an open drawer; tap/scan products, discounts,
    cash checkout, receipt, live stock decrement
  - **AI Receiving** — scan/upload a supplier invoice → review matches →
    stock + cost lots update; vendors *learn* confirmed matches (rescan to see)
  - **IQ Dashboard** (owner) — margin KPIs, top earners, reorder intelligence
    ranked by profit-at-risk, busy-hours heatmap
  - **Back Office** (owner) — refunds with reason codes, cash drawer & shift
    reconciliation (X/Z reports), audit trail, sales CSV export

## Structure

```
src/
  lib/
    types.ts       domain model (cost is first-class; lots, shifts, audit)
    seed.ts        users, catalog, deterministic 30-day sales, sample invoices
    analytics.ts   margin / reorder / shift / CSV / insight helpers
    store.tsx      persistent app store (reducer + context + localStorage)
    firebase.ts    config seam for transactiq-746f9 (stubbed until wired)
  components/       Register, Receiving, Dashboard, BackOffice, Nav
  pages/            Landing, Demo
docs/ROADMAP.md    phases (0–4 built) + target Firestore schema
```

## Next steps

See [docs/ROADMAP.md](docs/ROADMAP.md). To leave demo-land: copy `.env.example`
→ `.env` with the Firebase web config, then swap the localStorage persistence
for Firestore behind the same store actions, and wire real Claude vision into
`extractInvoice()` in Receiving.
