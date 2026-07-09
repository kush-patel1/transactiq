import { Link } from 'react-router-dom'
import Nav from '../components/Nav'
import { SALES, CATALOG } from '../lib/seed'
import { totals, compactMoney } from '../lib/analytics'

const t = totals(SALES)

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

const ICONS = {
  invoice: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M4 20h16M7 16v-4m5 4V8m5 8v-6" />
    </svg>
  ),
  barcode: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M4 7v10M8 7v10M11 7v10M15 7v10M19 7v10" />
    </svg>
  ),
  box: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8" />
    </svg>
  ),
  cash: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="7" width="18" height="10" rx="1.5" />
      <circle cx="12" cy="12" r="2.2" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M12 3l8 3v6c0 4.4-3.2 7.7-8 9-4.8-1.3-8-4.6-8-9V6l8-3z" />
    </svg>
  ),
}

const FEATURES = [
  { ico: ICONS.invoice, title: 'AI Receiving', body: 'Snap a supplier invoice. TransactIQ reads it, matches each line to your catalog, and updates stock — capturing your true cost automatically.' },
  { ico: ICONS.chart, title: 'Margin Intelligence', body: 'Not just "what sold" — what actually made money. Live margin by item, category, and hour, because we capture cost on every unit.' },
  { ico: ICONS.barcode, title: 'Scan-First Register', body: 'Works with the USB barcode scanner you already own — scan anytime, no clicking first. Built-in ID check prompts on beer, wine, and tobacco protect your license.' },
  { ico: ICONS.box, title: 'Smart Inventory', body: 'Auto-decrement on every sale, reorder-point alerts, and restock suggestions ranked by what earns you the most.' },
  { ico: ICONS.cash, title: 'Drawer & Shifts', body: 'Open and close the drawer, see exactly what should be in it, and know at a glance if you’re over or short at end of day.' },
  { ico: ICONS.shield, title: 'Staff & Audit', body: 'PIN logins for you and your cashiers, with a full trail of every sale, refund, discount, and drawer event.' },
]

const STEPS = [
  { n: '1', title: 'Receive', body: 'Scan the supplier invoice when a shipment arrives. Stock goes up, and your real cost lands in the system — no hand-typing.' },
  { n: '2', title: 'Sell', body: 'Ring up sales at the register. Every line remembers the price you charged and the cost you paid.' },
  { n: '3', title: 'Know', body: 'The IQ dashboard turns that into margin: what earns, what stalls, when you’re busy, what to reorder.' },
]

export default function Landing() {
  return (
    <>
      <Nav />

      {/* hero */}
      <header className="hero">
        <div className="hero-glow" />
        <div className="container hero-grid">
          <div>
            <span className="pill">Built for convenience & liquor stores</span>
            <h1>
              The register that tells you <span className="gradient-text">what’s actually making you money.</span>
            </h1>
            <p className="lede">
              TransactIQ is a point-of-sale for convenience and liquor stores.
              It works with the barcode scanner you already own — and it captures
              your cost on every item, so it shows real profit, not just sales.
            </p>
            <div className="hero-cta">
              <Link to="/demo" className="btn btn-primary">Try the live demo →</Link>
              <a href="#how" className="btn btn-ghost">See how it works</a>
            </div>
            <p className="hero-note">No signup · runs on realistic sample data</p>
          </div>

          {/* mini dashboard preview */}
          <div className="glass hero-card">
            <div className="hero-card-head">
              <strong>QuickStop Mart · last 30 days</strong>
              <span className="pill" style={{ padding: '3px 10px', fontSize: 11.5 }}>LIVE</span>
            </div>
            <div className="kpi-row">
              <div className="kpi">
                <div className="label">Revenue</div>
                <div className="value">{compactMoney(t.revenue)}</div>
                <div className="delta">▲ 12%</div>
              </div>
              <div className="kpi">
                <div className="label">Margin</div>
                <div className="value gradient-text">{compactMoney(t.margin)}</div>
                <div className="delta">{t.marginPct.toFixed(0)}%</div>
              </div>
              <div className="kpi">
                <div className="label">Baskets</div>
                <div className="value">{t.transactions.toLocaleString()}</div>
                <div className="delta">▲ 5%</div>
              </div>
            </div>
            <MiniBars />
          </div>
        </div>
      </header>

      {/* how it works — the loop */}
      <section className="section" id="how">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">The TransactIQ loop</span>
            <h2>Cost in, margin out.</h2>
            <p>
              Every other POS makes you hand-enter cost, so nobody does, so their
              analytics can only guess. We capture it at the one moment you can’t skip.
            </p>
          </div>
          <div className="loop">
            {STEPS.map((s) => (
              <div key={s.n} className="glass loop-step">
                <div className="n">{s.n}</div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* features */}
      <section className="section" id="features" style={{ background: 'var(--bg-2)' }}>
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Everything a shop needs</span>
            <h2>Table-stakes POS, plus the part they forgot.</h2>
            <p>The essentials done well — with an intelligence layer bolted to the core, not sprinkled on top.</p>
          </div>
          <div className="features">
            {FEATURES.map((f) => (
              <div key={f.title} className="glass feature">
                <div className="ico">{f.ico}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* pricing */}
      <section className="section" id="pricing">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Simple pricing</span>
            <h2>Priced for a corner shop, not a chain.</h2>
            <p>Flat monthly. No per-transaction surcharge on your own cash sales.</p>
          </div>
          <div className="pricing">
            <div className="glass plan">
              <h3>Starter</h3>
              <div className="price">$0<span>/mo</span></div>
              <p style={{ color: 'var(--text-2)', fontSize: 15 }}>Single register to get going.</p>
              <ul>
                <li>Register + cash checkout</li>
                <li>Up to 100 products</li>
                <li>Basic sales reports</li>
                <li>1 staff account</li>
              </ul>
              <Link to="/demo" className="btn btn-ghost">Start free</Link>
            </div>
            <div className="glass plan featured">
              <span className="pill" style={{ alignSelf: 'flex-start', marginBottom: 8 }}>Most popular</span>
              <h3>Pro</h3>
              <div className="price">$49<span>/mo</span></div>
              <p style={{ color: 'var(--text-2)', fontSize: 15 }}>The full margin-intelligence loop.</p>
              <ul>
                <li>Everything in Starter</li>
                <li>AI receiving / invoice scan</li>
                <li>Margin & inventory intelligence</li>
                <li>Unlimited products & staff</li>
                <li>Drawer, shifts & audit trail</li>
              </ul>
              <Link to="/demo" className="btn btn-primary">Try Pro demo →</Link>
            </div>
            <div className="glass plan">
              <h3>Multi-store</h3>
              <div className="price">$129<span>/mo</span></div>
              <p style={{ color: 'var(--text-2)', fontSize: 15 }}>For a couple of locations.</p>
              <ul>
                <li>Everything in Pro</li>
                <li>Up to 5 locations</li>
                <li>Cross-store inventory</li>
                <li>Consolidated reporting</li>
                <li>Priority support</li>
              </ul>
              <Link to="/demo" className="btn btn-ghost">Talk to us</Link>
            </div>
          </div>
        </div>
      </section>

      {/* cta */}
      <section className="section">
        <div className="container">
          <div className="cta-band">
            <h2>See your margin, not just your sales.</h2>
            <p>Poke around a fully working register, scan a supplier invoice, and watch the numbers move.</p>
            <Link to="/demo" className="btn btn-primary">Open the live demo →</Link>
          </div>
        </div>
      </section>

      <footer className="foot">
        <div className="container foot-inner">
          <span>© 2026 TransactIQ · {CATALOG.length} demo SKUs · project transactiq-746f9</span>
          <span>Built for small businesses.</span>
        </div>
      </footer>
    </>
  )
}

// tiny inline sparkline-style bars for the hero card
function MiniBars() {
  const bars = [42, 55, 38, 61, 48, 70, 66, 80, 58, 74, 63, 88]
  const max = Math.max(...bars)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 90 }}>
      {bars.map((b, i) => (
        <div
          key={i}
          title={`Day ${i + 1}`}
          style={{
            flex: 1,
            height: `${(b / max) * 100}%`,
            borderRadius: 6,
            background: 'var(--grad)',
            opacity: 0.35 + (b / max) * 0.65,
          }}
        />
      ))}
    </div>
  )
}
