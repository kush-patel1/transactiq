import { useEffect, useMemo, useRef, useState } from 'react'
import type { CartLine, Product, Sale } from '../lib/types'
import { TAX_RATE, STORE_NAME } from '../lib/seed'
import { money, round2 } from '../lib/analytics'
import { useStore } from '../lib/store'

const DISCOUNTS = [0, 5, 10, 15]

// Two-letter tile monogram, e.g. "Bud Light 12-pack" -> "BL"
const monogram = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

// The legal cutoff birthday for 21+ sales, computed fresh each render.
function ageCutoffDate(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 21)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

type ScanFlash = { kind: 'ok' | 'fail'; text: string; at: number } | null

export default function Register() {
  const { state, dispatch, currentUser, openShift } = useStore()
  const products = state.products
  const [cart, setCart] = useState<CartLine[]>([])
  const [query, setQuery] = useState('')
  const [discountPct, setDiscountPct] = useState(0)
  const [awaitingReceipt, setAwaitingReceipt] = useState(false)
  const [startCash, setStartCash] = useState('150')
  const [idChecked, setIdChecked] = useState(false)
  const [agePrompt, setAgePrompt] = useState<Product | null>(null)
  const [flash, setFlash] = useState<ScanFlash>(null)

  // Keep latest products/cart in refs so the global scan listener never goes stale.
  const productsRef = useRef(products)
  productsRef.current = products

  function showFlash(kind: 'ok' | 'fail', text: string) {
    setFlash({ kind, text, at: Date.now() })
  }
  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), 3000)
    return () => window.clearTimeout(t)
  }, [flash])

  function add(p: Product, viaScan = false) {
    // Age-restricted: prompt for ID once per transaction, then remember.
    if (p.minAge && !idChecked) {
      setAgePrompt(p)
      return
    }
    let added = false
    setCart((prev) => {
      const line = prev.find((l) => l.productId === p.id)
      const inCart = line?.qty ?? 0
      if (inCart >= p.stock) return prev // don't oversell
      added = true
      if (line) return prev.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l))
      return [...prev, { productId: p.id, qty: 1 }]
    })
    if (viaScan) {
      if (added || p.stock > 0) showFlash('ok', `${p.name} — ${money(p.price)}`)
      else showFlash('fail', `${p.name} is out of stock`)
    }
  }

  function scanBarcode(code: string) {
    const p = productsRef.current.find((x) => x.barcode === code)
    if (!p) {
      showFlash('fail', `Barcode ${code} not found`)
      return
    }
    if (p.stock === 0) {
      showFlash('fail', `${p.name} is out of stock`)
      return
    }
    add(p, true)
  }

  // Scan-anywhere: a USB barcode scanner is just a very fast keyboard.
  // Buffer rapid digit keystrokes ending in Enter — no need to click anything
  // first. (When focus is in an input, the search box's own handler takes over.)
  const scanRef = useRef({ buf: '', last: 0 })
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const s = scanRef.current
      const now = Date.now()
      if (now - s.last > 250) s.buf = '' // human-speed gap → not a scanner
      s.last = now
      if (e.key === 'Enter') {
        if (s.buf.length >= 6) scanBarcode(s.buf)
        s.buf = ''
      } else if (/^\d$/.test(e.key)) {
        s.buf += e.key
      } else {
        s.buf = ''
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idChecked]) // rebind so add() sees current idChecked

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.barcode.includes(q),
    )
  }, [products, query])

  // A real drawer can't ring sales until a shift is open.
  if (!openShift) {
    return (
      <div className="register-lock glass">
        <h3 style={{ margin: '0 0 8px' }}>Open the drawer to start selling</h3>
        <p style={{ color: 'var(--text-2)', fontSize: 15, marginTop: 0 }}>
          Count your starting cash. Everything from here to close-out is tracked,
          so the drawer always adds up.
        </p>
        <div className="mini-form">
          <span style={{ color: 'var(--text-3)', fontWeight: 700 }}>Starting cash $</span>
          <input
            className="mini-input"
            type="number"
            value={startCash}
            onChange={(e) => setStartCash(e.target.value)}
            aria-label="Starting cash"
          />
        </div>
        <button
          className="charge"
          style={{ maxWidth: 320 }}
          onClick={() => dispatch({ type: 'OPEN_SHIFT', startingCash: Number(startCash) || 0 })}
        >
          Open drawer · start shift
        </button>
      </div>
    )
  }

  const stockOf = (id: string) => products.find((p) => p.id === id)?.stock ?? 0

  function changeQty(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.productId !== id) return l
          const max = stockOf(id)
          return { ...l, qty: Math.min(max, Math.max(0, l.qty + delta)) }
        })
        .filter((l) => l.qty > 0),
    )
  }

  // Enter in the search box: exact barcode → add (scanner with cursor in box).
  function onSearchKey(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return
    const hit = products.find((p) => p.barcode === query.trim())
    if (hit && hit.stock > 0) {
      add(hit, true)
      setQuery('')
    }
  }

  const detailed = cart.map((l) => {
    const p = products.find((x) => x.id === l.productId)!
    return { ...l, product: p, lineTotal: p.price * l.qty }
  })
  const subtotal = round2(detailed.reduce((s, l) => s + l.lineTotal, 0))
  const discount = round2((subtotal * discountPct) / 100)
  const tax = round2((subtotal - discount) * TAX_RATE)
  const total = round2(subtotal - discount + tax)
  const hasRestricted = detailed.some((l) => l.product.minAge)

  function charge() {
    if (!cart.length) return
    dispatch({ type: 'COMMIT_SALE', cart, discountPct, idChecked: hasRestricted && idChecked })
    setAwaitingReceipt(true)
    setCart([])
    setDiscountPct(0)
    setQuery('')
    setIdChecked(false)
  }

  return (
    <div className="register">
      <div>
        {/* live scan feedback — big and legible from across the counter */}
        <div
          className={'scan-banner' + (flash ? ` show ${flash.kind}` : '')}
          role="status"
          aria-live="polite"
        >
          {flash ? (flash.kind === 'ok' ? '✓ ' : '✗ ') + flash.text : 'Ready to scan'}
        </div>
        <input
          className="search"
          placeholder="🔎 Scan any barcode, anytime — or search by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKey}
          aria-label="Search or scan product"
        />
        <div className="product-grid">
          {filtered.map((p) => {
            const low = p.stock <= p.reorderPoint
            return (
              <button
                key={p.id}
                className="product"
                onClick={() => add(p)}
                disabled={p.stock === 0}
                title={p.stock === 0 ? 'Out of stock' : `Add ${p.name}`}
              >
                <div className="monogram-row">
                  <span className="monogram">{monogram(p.name)}</span>
                  {p.minAge && <span className="age-tag">21+</span>}
                </div>
                <div className="name">{p.name}</div>
                <div className="meta">
                  <span className="price">{money(p.price)}</span>
                  <span className={'stock' + (low ? ' low' : '')}>
                    {p.stock === 0 ? 'out' : `${p.stock} left`}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <aside className="cart glass">
        <h3>Current sale</h3>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 10 }}>
          Cashier: {currentUser?.name} · shift {openShift.id}
          {idChecked && <span style={{ color: 'var(--green)', fontWeight: 700 }}> · ID checked ✓</span>}
        </div>
        <div className="cart-items">
          {detailed.length === 0 ? (
            <div className="cart-empty">Scan a barcode or tap a product to start.</div>
          ) : (
            detailed.map((l) => (
              <div key={l.productId} className="line">
                <button className="qtybtn" onClick={() => changeQty(l.productId, -1)} aria-label="Decrease">–</button>
                <span className="qty">{l.qty}</span>
                <button className="qtybtn" onClick={() => changeQty(l.productId, 1)} aria-label="Increase">+</button>
                <span className="li-name">{l.product.name}</span>
                <span className="li-price">{money(l.lineTotal)}</span>
              </div>
            ))
          )}
        </div>
        <div className="totals">
          <div className="row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          <div className="row">
            <span>
              Discount{' '}
              <select
                className="discount-select"
                value={discountPct}
                onChange={(e) => setDiscountPct(Number(e.target.value))}
                aria-label="Discount percent"
              >
                {DISCOUNTS.map((d) => (
                  <option key={d} value={d}>{d}%</option>
                ))}
              </select>
            </span>
            <span>−{money(discount)}</span>
          </div>
          <div className="row"><span>Tax ({(TAX_RATE * 100).toFixed(0)}%)</span><span>{money(tax)}</span></div>
          <div className="row grand"><span>Total</span><span>{money(total)}</span></div>
        </div>
        <button className="charge" onClick={charge} disabled={!cart.length}>
          Charge {money(total)} · Cash
        </button>
      </aside>

      {agePrompt && (
        <AgeCheck
          product={agePrompt}
          onConfirm={() => {
            setIdChecked(true)
            setAgePrompt(null)
            // re-run the add now that ID is verified
            const p = agePrompt
            setCart((prev) => {
              const line = prev.find((l) => l.productId === p.id)
              if (line && line.qty >= p.stock) return prev
              if (line) return prev.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l))
              return [...prev, { productId: p.id, qty: 1 }]
            })
            showFlash('ok', `${p.name} — ${money(p.price)}`)
          }}
          onCancel={() => {
            setAgePrompt(null)
            showFlash('fail', `${agePrompt.name} removed — no valid ID`)
          }}
        />
      )}

      {awaitingReceipt && state.lastSale && (
        <Receipt
          sale={state.lastSale}
          cashierName={currentUser?.name ?? ''}
          onClose={() => setAwaitingReceipt(false)}
        />
      )}
    </div>
  )
}

// Big, unmissable ID prompt for age-restricted items.
function AgeCheck({
  product,
  onConfirm,
  onCancel,
}: {
  product: Product
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="age-card glass" onClick={(e) => e.stopPropagation()}>
        <div className="age-badge">{product.minAge}+</div>
        <h2 style={{ margin: '10px 0 4px' }}>CHECK ID</h2>
        <p style={{ color: 'var(--text-2)', fontSize: 16, margin: '0 0 6px' }}>
          {product.name} is age-restricted ({product.minAge}+)
        </p>
        <p className="age-cutoff">
          Customer must be born on or before
          <strong> {ageCutoffDate()}</strong>
        </p>
        <button className="charge" style={{ marginTop: 8 }} onClick={onConfirm}>
          ✓ ID checked — add item
        </button>
        <button
          className="btn btn-ghost"
          style={{ width: '100%', marginTop: 10 }}
          onClick={onCancel}
        >
          ✗ No valid ID — cancel
        </button>
      </div>
    </div>
  )
}

function Receipt({
  sale,
  cashierName,
  onClose,
}: {
  sale: Sale
  cashierName: string
  onClose: () => void
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="receipt" onClick={(e) => e.stopPropagation()}>
        <h4>{STORE_NAME.toUpperCase()}</h4>
        <div className="r-sub">
          powered by TransactIQ · {new Date(sale.timestamp).toLocaleString()} · {cashierName}
        </div>
        {sale.lines.map((l) => (
          <div key={l.productId} className="r-line">
            <span>{l.qty}× {l.name}</span>
            <span>{money(l.price * l.qty)}</span>
          </div>
        ))}
        <div className="r-div" />
        <div className="r-line"><span>Subtotal</span><span>{money(sale.subtotal)}</span></div>
        {sale.discount > 0 && (
          <div className="r-line"><span>Discount ({sale.discountPct}%)</span><span>−{money(sale.discount)}</span></div>
        )}
        <div className="r-line"><span>Tax</span><span>{money(sale.tax)}</span></div>
        <div className="r-line r-total"><span>TOTAL</span><span>{money(sale.total)}</span></div>
        <div className="r-line"><span>Cash</span><span>{money(sale.total)}</span></div>
        {sale.idChecked && (
          <div className="r-line"><span>ID VERIFIED (21+)</span><span>✓</span></div>
        )}
        <div className="r-thanks">Thank you! · Stock updated · Sale logged to IQ</div>
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 18 }} onClick={onClose}>
          New sale
        </button>
      </div>
    </div>
  )
}
