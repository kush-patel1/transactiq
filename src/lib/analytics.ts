import type { Product, Sale, Shift, User } from './types'

export const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export const compactMoney = (n: number) =>
  n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'k' : money(n)

export const round2 = (n: number) => Math.round(n * 100) / 100

// Refunded sales are excluded from every revenue/margin metric.
const completed = (sales: Sale[]) => sales.filter((s) => s.status === 'completed')

export interface CategoryStat {
  category: string
  revenue: number
  margin: number
}

export interface ItemMargin {
  productId: string
  name: string
  emoji: string
  unitsSold: number
  revenue: number
  margin: number
  marginPct: number
}

export interface Totals {
  revenue: number
  margin: number
  marginPct: number
  transactions: number
  avgBasket: number
  unitsSold: number
}

export function totals(sales: Sale[]): Totals {
  let gross = 0
  let cogs = 0
  let unitsSold = 0
  let discounts = 0
  const done = completed(sales)
  for (const s of done) {
    discounts += s.discount
    for (const l of s.lines) {
      gross += l.price * l.qty
      cogs += l.cost * l.qty
      unitsSold += l.qty
    }
  }
  const revenue = gross - discounts // net of discounts
  const margin = revenue - cogs
  return {
    revenue,
    margin,
    marginPct: revenue ? (margin / revenue) * 100 : 0,
    transactions: done.length,
    avgBasket: done.length ? revenue / done.length : 0,
    unitsSold,
  }
}

export function byCategory(sales: Sale[], catalog: Product[]): CategoryStat[] {
  const cat = new Map<string, CategoryStat>()
  const catOf = new Map(catalog.map((p) => [p.id, p.category]))
  for (const s of completed(sales)) {
    for (const l of s.lines) {
      const c = catOf.get(l.productId) ?? 'Other'
      const row = cat.get(c) ?? { category: c, revenue: 0, margin: 0 }
      row.revenue += l.price * l.qty
      row.margin += (l.price - l.cost) * l.qty
      cat.set(c, row)
    }
  }
  return [...cat.values()].sort((a, b) => b.revenue - a.revenue)
}

export function topByMargin(
  sales: Sale[],
  catalog: Product[],
  limit = 6,
): ItemMargin[] {
  const map = new Map<string, ItemMargin>()
  const meta = new Map(catalog.map((p) => [p.id, p]))
  for (const s of completed(sales)) {
    for (const l of s.lines) {
      const p = meta.get(l.productId)
      const row =
        map.get(l.productId) ??
        {
          productId: l.productId,
          name: l.name,
          emoji: p?.emoji ?? '📦',
          unitsSold: 0,
          revenue: 0,
          margin: 0,
          marginPct: 0,
        }
      row.unitsSold += l.qty
      row.revenue += l.price * l.qty
      row.margin += (l.price - l.cost) * l.qty
      map.set(l.productId, row)
    }
  }
  const rows = [...map.values()]
  for (const r of rows) r.marginPct = r.revenue ? (r.margin / r.revenue) * 100 : 0
  return rows.sort((a, b) => b.margin - a.margin).slice(0, limit)
}

// day-of-week (0=Sun) x hour bucket revenue, for the heatmap.
export function heatmap(sales: Sale[]): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () =>
    Array<number>(24).fill(0),
  )
  for (const s of completed(sales)) {
    const d = new Date(s.timestamp)
    grid[d.getUTCDay()][d.getUTCHours()] += s.total
  }
  return grid
}

// ---- reorder intelligence ---------------------------------------------------
// Ranked by profit-per-day at risk (velocity × unit margin), not by raw stock.
export interface ReorderSuggestion {
  product: Product
  perDay: number // units sold per day, trailing 14d
  daysLeft: number // stock / perDay
  suggestedQty: number // units, to cover ~14 days, rounded up to full cases
  suggestedCases: number
  profitPerDayAtRisk: number
}

export function reorderSuggestions(
  sales: Sale[],
  catalog: Product[],
  nowTs = Date.now(),
): ReorderSuggestion[] {
  const windowMs = 14 * 86_400_000
  const soldInWindow = new Map<string, number>()
  for (const s of completed(sales)) {
    if (nowTs - s.timestamp > windowMs) continue
    for (const l of s.lines) {
      soldInWindow.set(l.productId, (soldInWindow.get(l.productId) ?? 0) + l.qty)
    }
  }
  const out: ReorderSuggestion[] = []
  for (const p of catalog) {
    const perDay = (soldInWindow.get(p.id) ?? 0) / 14
    const daysLeft = perDay > 0 ? p.stock / perDay : Infinity
    const urgent = p.stock <= p.reorderPoint || daysLeft <= 10
    if (!urgent) continue
    const needed = Math.max(0, Math.ceil(perDay * 14 - p.stock))
    const cases = Math.max(1, Math.ceil(needed / p.packSize))
    out.push({
      product: p,
      perDay,
      daysLeft,
      suggestedQty: cases * p.packSize,
      suggestedCases: cases,
      profitPerDayAtRisk: perDay * (p.price - p.cost),
    })
  }
  return out.sort((a, b) => b.profitPerDayAtRisk - a.profitPerDayAtRisk)
}

// ---- drawer / shift math ------------------------------------------------------
// Expected cash = starting float + cash sales rung during the shift
// (refunded shift sales net to zero: cash came in, then went back out)
// + signed paid-in/paid-out movements.
export function shiftExpected(shift: Shift, sales: Sale[]): number {
  const cashSales = sales
    .filter((s) => s.shiftId === shift.id && s.status === 'completed')
    .reduce((t, s) => t + s.total, 0)
  const moves = shift.movements.reduce((t, m) => t + m.amount, 0)
  return round2(shift.startingCash + cashSales + moves)
}

export interface ShiftReport {
  transactions: number
  gross: number
  discounts: number
  tax: number
  refunds: number
  expected: number
}

export function shiftReport(shift: Shift, sales: Sale[]): ShiftReport {
  const inShift = sales.filter((s) => s.shiftId === shift.id)
  const done = inShift.filter((s) => s.status === 'completed')
  return {
    transactions: done.length,
    gross: round2(done.reduce((t, s) => t + s.total, 0)),
    discounts: round2(done.reduce((t, s) => t + s.discount, 0)),
    tax: round2(done.reduce((t, s) => t + s.tax, 0)),
    refunds: inShift.filter((s) => s.status === 'refunded').length,
    expected: shift.expectedCash ?? shiftExpected(shift, sales),
  }
}

// ---- export -------------------------------------------------------------------
export function salesToCsv(sales: Sale[], users: User[]): string {
  const nameOf = new Map(users.map((u) => [u.id, u.name]))
  const esc = (v: string) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v)
  const rows = [
    'id,datetime,cashier,status,subtotal,discount,tax,total,items',
    ...sales.map((s) =>
      [
        s.id,
        new Date(s.timestamp).toISOString(),
        nameOf.get(s.cashierId) ?? s.cashierId,
        s.status,
        s.subtotal.toFixed(2),
        s.discount.toFixed(2),
        s.tax.toFixed(2),
        s.total.toFixed(2),
        esc(s.lines.map((l) => `${l.qty}x ${l.name}`).join('; ')),
      ].join(','),
    ),
  ]
  return rows.join('\n')
}

// A tiny "insight" the IQ layer surfaces — the kind of line a dashboard wouldn't.
export function headlineInsight(sales: Sale[], catalog: Product[]): string {
  const top = topByMargin(sales, catalog, 3)
  const cats = byCategory(sales, catalog)
  if (!top.length || !cats.length) return 'Start selling to unlock insights.'
  const bestCat = cats.reduce((a, b) => (b.margin > a.margin ? b : a))
  const star = top[0]
  return `${star.name} drove ${money(star.margin)} in profit this month at a ${star.marginPct.toFixed(0)}% margin — your ${bestCat.category} shelf is your highest earner overall.`
}
