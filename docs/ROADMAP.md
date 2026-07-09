# TransactIQ — Roadmap

A POS for small businesses whose differentiator is a **margin-aware intelligence
layer**. The wedge: every other POS makes you hand-enter cost (so nobody does, so
their analytics can only guess). We capture cost at the one moment you can't skip
— **receiving a shipment** — via AI invoice scanning.

## Product thesis — the loop

```
Scan supplier invoice  →  stock UP + landed cost captured
Ring up a sale         →  stock DOWN + price recorded
IQ dashboard           →  margin = price − cost, by item / category / hour
```

## Decisions locked

| Decision | Choice |
|---|---|
| Target customer | **Mom-and-pop convenience & liquor stores** — older owners, few employees, barcode-scanner workflow |
| In-person card payments | **Cash-only for MVP**; Stripe Terminal seam left open |
| Primary goal | **MVP to validate** with a real shop owner first |
| The "IQ" | **Core differentiator** — schema designed for analytics from day one |
| Stack | Vite + React + TS, Firestore (`transactiq-746f9`), Firebase Auth |

## Target-customer implications (built)

- **Scan-anywhere register** — USB wedge scanners work with no field focused
  (rapid-keystroke capture); big scan-feedback banner; larger type throughout
- **Age verification** — `minAge` on products; unmissable CHECK ID prompt with
  the exact 21+ cutoff birthdate; once per sale; "ID VERIFIED" on receipt +
  audit trail (liquor-license protection)
- **Plain language** — drawer reads "Over / Short", not "variance"
- Demo catalog/invoices are a real c-store mix (tobacco/beer/wine/spirits/
  drinks/snacks) with honest margins — cigarettes: top units, worst margin

## Phases

### Phase 0 — Scaffold & schema ✅
- Vite/React/TS app, design system, Firebase config seam (stubbed)
- Domain types with **cost as a first-class field**
- Deterministic seed: 18 SKUs + ~30 days of sales
- **Landing page** and **interactive demo** (Register / AI Receiving / IQ Dashboard)

### Phase 1 — The sale ✅ (demo persistence)
- Persistent app store (reducer + localStorage) behind dispatch actions —
  components never touch storage; **Firestore adapter swaps in here** once we
  have the Firebase web config (.env). Security rules still TODO at that point.
- Barcode search, cart, sale-level discounts, cash tender, receipt
- Auto stock decrement; state survives reload
- PIN login with owner/cashier roles gating tabs (→ Firebase Auth later)

### Phase 2 — AI Receiving (the keystone) ✅ (extraction simulated)
- Upload/photo entry point → extraction pipeline (Claude vision call is the one
  stubbed piece; rotating sample invoices stand in for OCR output)
- **Per-vendor alias learning** — confirmed matches persist; repeat invoices
  from the same vendor come back 100% "learned ✓"
- Case → selling-unit pack math shown per line
- Human confirm before commit; writes **cost lots** (cost as-of date)

### Phase 3 — IQ layer ✅
- Margin dashboards, category/hour analysis (refund-aware, discount-net)
- **Reorder intelligence**: ranked by profit/day at risk, velocity from
  trailing 14d, days-of-stock, order size rounded to supplier case packs
- Daily aggregate rollups (Cloud Function) — deferred until Firestore

### Phase 4 — Run the business ✅
- Refunds with reason codes → restock + audit trail
- Cash drawer open/close, paid-in/out movements, live X report,
  Z reports with expected vs. counted variance
- Sales CSV export (QuickBooks/Xero sync later)

### Next up (to leave demo-land)
1. **Firestore + Auth wiring** — needs the Firebase web config for `.env`;
   swap the localStorage persistence for Firestore behind the same actions
2. **Real Claude vision extraction** in `extractInvoice()` (Receiving.tsx)
3. Firestore security rules + offline persistence flag

### Later (not MVP)
- Card payments (Stripe Terminal), split tender
- Multi-location, cross-store inventory
- Loyalty / gift cards / store credit
- Promotions engine

## Firestore schema (target for Phase 1)

```
businesses/{bizId}
  name, taxRate, createdAt

businesses/{bizId}/products/{productId}
  name, emoji, barcode, category, price, cost (latest landed),
  stock, reorderPoint, active

businesses/{bizId}/costLots/{lotId}          # history for accurate margin
  productId, unitCost, qty, receivedAt, vendorId, invoiceId

businesses/{bizId}/sales/{saleId}
  timestamp, cashierId, tender, subtotal, tax, total,
  lines: [{ productId, name, qty, price, cost }]   # cost FROZEN at sale time

businesses/{bizId}/vendors/{vendorId}
  name, aliasMap: { "COLD BREW 11OZ 24CT": productId }   # learned matches

businesses/{bizId}/receivings/{receivingId}
  vendorId, invoiceNo, date, status, lines: [{ productId, qty, unitCost }]

businesses/{bizId}/users/{userId}
  role: owner | manager | cashier, name

businesses/{bizId}/shifts/{shiftId}           # Phase 4
  openedBy, openedAt, closedAt, startingCash, countedCash, expectedCash
```

**Analytics-critical invariants**
1. `cost` is captured on receiving and **frozen onto each sale line** — never
   back-computed. This makes historical margin correct even as cost drifts.
2. `costLots` preserve the cost timeline; the product's `cost` is just the latest.
3. Every mutation (void/refund/discount) is attributable to a `userId`.
