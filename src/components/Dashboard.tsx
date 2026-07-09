import { useMemo } from 'react'
import {
  totals,
  byCategory,
  topByMargin,
  heatmap,
  reorderSuggestions,
  headlineInsight,
  money,
  compactMoney,
} from '../lib/analytics'
import { useStore } from '../lib/store'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function Dashboard() {
  const { state } = useStore()
  const { products, sales } = state

  const t = useMemo(() => totals(sales), [sales])
  const cats = useMemo(() => byCategory(sales, products), [sales, products])
  const top = useMemo(() => topByMargin(sales, products, 6), [sales, products])
  const grid = useMemo(() => heatmap(sales), [sales])
  const reorder = useMemo(() => reorderSuggestions(sales, products), [sales, products])
  const insight = useMemo(() => headlineInsight(sales, products), [sales, products])

  const maxCatRev = Math.max(...cats.map((c) => c.revenue), 1)
  const heatMax = Math.max(...grid.flat(), 1)
  const refunded = sales.filter((s) => s.status === 'refunded').length

  return (
    <div className="dash">
      <div className="insight">
        <span className="insight-label">Insight</span>
        <span>{insight}</span>
      </div>

      <div className="dash-kpis">
        <Stat label="Revenue (30d)" value={compactMoney(t.revenue)} sub={refunded ? `net of ${refunded} refund${refunded > 1 ? 's' : ''}` : '▲ 12% vs. prior'} up />
        <Stat label="Gross margin" value={compactMoney(t.margin)} sub={`${t.marginPct.toFixed(1)}% of revenue`} up />
        <Stat label="Transactions" value={t.transactions.toLocaleString()} sub={`${money(t.avgBasket)} avg basket`} />
        <Stat label="Units sold" value={t.unitsSold.toLocaleString()} sub={`${products.length} active SKUs`} />
      </div>

      <div className="dash-cols">
        {/* revenue by category */}
        <div className="glass panel">
          <h3>Revenue by category</h3>
          <div className="p-sub">Where the money comes in — bar length is revenue, label shows margin.</div>
          {cats.map((c) => (
            <div className="bar-row" key={c.category}>
              <span>{c.category}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(c.revenue / maxCatRev) * 100}%` }} />
              </div>
              <span className="bar-val">{compactMoney(c.margin)}</span>
            </div>
          ))}
        </div>

        {/* top items by margin */}
        <div className="glass panel">
          <h3>Top earners by margin</h3>
          <div className="p-sub">Ranked by profit contributed, not units sold.</div>
          <table className="marg-table">
            <thead>
              <tr><th>Item</th><th>Units</th><th>Margin $</th><th>%</th></tr>
            </thead>
            <tbody>
              {top.map((r) => (
                <tr key={r.productId}>
                  <td>{r.name}</td>
                  <td>{r.unitsSold}</td>
                  <td>{money(r.margin)}</td>
                  <td className={'marg-pct' + (r.marginPct < 45 ? ' mid' : '')}>{r.marginPct.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* reorder intelligence — the Phase 3 upgrade over a plain low-stock list */}
      <div className="glass panel">
        <h3>Reorder intelligence</h3>
        <div className="p-sub">
          Ranked by <strong>profit per day at risk</strong> if the item stocks out — velocity from the
          trailing 14 days, order size rounded to your supplier’s case pack.
        </div>
        {reorder.length === 0 ? (
          <p style={{ color: 'var(--text-2)' }}>Everything’s well stocked. 🎉</p>
        ) : (
          <table className="marg-table">
            <thead>
              <tr>
                <th>Item</th><th>Stock</th><th>Sells/day</th><th>Days left</th><th>Suggested order</th><th>Profit/day at risk</th>
              </tr>
            </thead>
            <tbody>
              {reorder.map((r) => (
                <tr key={r.product.id}>
                  <td>{r.product.name}</td>
                  <td>
                    <span className="badge-amber">{r.product.stock}</span>
                  </td>
                  <td>{r.perDay.toFixed(1)}</td>
                  <td>{Number.isFinite(r.daysLeft) ? r.daysLeft.toFixed(1) : '—'}</td>
                  <td>
                    {r.suggestedQty} units · {r.suggestedCases} case{r.suggestedCases > 1 ? 's' : ''}
                  </td>
                  <td className="marg-pct">{money(r.profitPerDayAtRisk)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* heatmap */}
      <div className="glass panel">
        <h3>When you’re busy</h3>
        <div className="p-sub">Revenue by day &amp; hour — staff and restock around the peaks.</div>
        <div className="heat">
          <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gap: 4 }}>
            {DOW.map((d) => <div className="heat-day" key={d}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gap: 4 }}>
            {grid.map((row, di) => (
              <div className="heat-hours" key={di}>
                {row.slice(7, 21).map((v, hi) => {
                  const intensity = v / heatMax
                  return (
                    <div
                      key={hi}
                      className="heat-cell"
                      title={`${DOW[di]} ${hi + 7}:00 — ${money(v)}`}
                      style={{
                        background:
                          intensity < 0.02
                            ? 'var(--surface-2)'
                            : `rgba(37, 99, 235, ${0.12 + intensity * 0.88})`,
                      }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="heat-legend">
          <span>7am</span>
          <span style={{ flex: 1 }} />
          <span>less</span>
          <div style={{ width: 60, height: 8, borderRadius: 999, background: 'linear-gradient(90deg, var(--surface-2), var(--accent))' }} />
          <span>more</span>
          <span style={{ flex: 1 }} />
          <span>8pm</span>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, sub, up }: { label: string; value: string; sub: string; up?: boolean }) {
  return (
    <div className="glass stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className={'sub' + (up ? ' up' : '')}>{sub}</div>
    </div>
  )
}
