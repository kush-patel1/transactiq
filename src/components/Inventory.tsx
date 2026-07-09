import { useMemo, useState } from 'react'
import type { Category, Product } from '../lib/types'
import { money, round2 } from '../lib/analytics'
import { useStore } from '../lib/store'
import { useBarcodeScan } from '../lib/useBarcodeScan'
import BarcodeChooser from './BarcodeChooser'

const CATEGORIES: Category[] = [
  'Tobacco', 'Beer', 'Wine', 'Spirits', 'Drinks', 'Snacks', 'Grocery', 'Other',
]
const ADJUST_REASONS = ['count correction', 'damaged', 'expired', 'theft / shrink', 'other']

// Form draft — strings so inputs stay controlled while the user types.
interface Draft {
  id?: string
  name: string
  barcode: string
  category: Category
  price: string
  cost: string
  stock: string
  reorderPoint: string
  packSize: string
  restricted: boolean
}
const emptyDraft = (): Draft => ({
  name: '', barcode: '', category: 'Drinks', price: '', cost: '',
  stock: '0', reorderPoint: '5', packSize: '1', restricted: false,
})
const draftFrom = (p: Product): Draft => ({
  id: p.id, name: p.name, barcode: p.barcode, category: p.category,
  price: String(p.price), cost: String(p.cost), stock: String(p.stock),
  reorderPoint: String(p.reorderPoint), packSize: String(p.packSize),
  restricted: !!p.minAge,
})

export default function Inventory() {
  const { state, dispatch } = useStore()
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<'All' | Category>('All')
  const [lowOnly, setLowOnly] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [chooser, setChooser] = useState<Product[] | null>(null)
  const [adjustingId, setAdjustingId] = useState<string | null>(null)
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState(ADJUST_REASONS[0])

  const products = state.products

  // Scan a barcode anywhere on this tab:
  //   known (one match)  → opens that product's edit form
  //   known (shared UPC) → chooser, then edit the picked one
  //   unknown            → Add Product form, barcode prefilled
  function openForBarcode(code: string) {
    const matches = products.filter((p) => p.barcode === code)
    if (matches.length === 0) setDraft({ ...emptyDraft(), barcode: code })
    else if (matches.length === 1) setDraft(draftFrom(matches[0]))
    else setChooser(matches)
  }
  useBarcodeScan(openForBarcode)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      if (cat !== 'All' && p.category !== cat) return false
      if (lowOnly && p.stock > p.reorderPoint) return false
      if (q && !p.name.toLowerCase().includes(q) && !p.barcode.includes(q)) return false
      return true
    })
  }, [products, query, cat, lowOnly])

  const kpis = useMemo(() => {
    const costValue = products.reduce((t, p) => t + p.stock * p.cost, 0)
    const retailValue = products.reduce((t, p) => t + p.stock * p.price, 0)
    const low = products.filter((p) => p.stock <= p.reorderPoint).length
    return { costValue, retailValue, low }
  }, [products])

  function applyAdjust(p: Product) {
    const d = Math.round(Number(delta))
    if (!d) return
    dispatch({ type: 'ADJUST_STOCK', productId: p.id, delta: d, reason })
    setAdjustingId(null)
    setDelta('')
    setReason(ADJUST_REASONS[0])
  }

  return (
    <div className="dash">
      <div className="dash-kpis">
        <Kpi label="Active SKUs" value={String(products.length)} sub={`${filtered.length} shown`} />
        <Kpi label="Inventory at cost" value={money(kpis.costValue)} sub="what your shelves cost you" />
        <Kpi label="Inventory at retail" value={money(kpis.retailValue)} sub={`${money(kpis.retailValue - kpis.costValue)} potential margin`} />
        <Kpi label="At / below reorder" value={String(kpis.low)} sub="items to reorder" warn={kpis.low > 0} />
      </div>

      <div className="glass panel">
        <div className="inv-head">
          <div>
            <h3>Products</h3>
            <div className="p-sub" style={{ marginBottom: 0 }}>
              Scan any barcode to edit that product — unknown barcodes open the
              add form. Stock changes go through adjustments so everything is audited.
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setDraft(emptyDraft())}>
            + Add product
          </button>
        </div>

        <div className="mini-form" style={{ marginTop: 14 }}>
          <input
            className="mini-input"
            style={{ width: 240 }}
            placeholder="Scan a barcode, or search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // scanner with cursor in the box: exact barcode + Enter → edit/add
              if (e.key !== 'Enter') return
              const code = query.trim()
              if (/^\d{6,}$/.test(code)) {
                setQuery('')
                openForBarcode(code)
              }
            }}
            aria-label="Search products"
          />
          <select
            className="discount-select"
            value={cat}
            onChange={(e) => setCat(e.target.value as 'All' | Category)}
            aria-label="Filter by category"
          >
            <option value="All">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            className={'btn btn-ghost' + (lowOnly ? ' inv-filter-on' : '')}
            style={{ padding: '8px 14px', fontSize: 13.5 }}
            onClick={() => setLowOnly(!lowOnly)}
          >
            {lowOnly ? '✓ ' : ''}Low stock only
          </button>
        </div>

        <table className="marg-table">
          <thead>
            <tr>
              <th>Item</th><th>Barcode</th><th>Category</th><th>Price</th><th>Cost</th>
              <th>Margin</th><th>Stock</th><th>Reorder at</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const marginPct = p.price ? ((p.price - p.cost) / p.price) * 100 : 0
              const low = p.stock <= p.reorderPoint
              return (
                <tr key={p.id}>
                  <td>
                    {p.name}
                    {p.minAge && <span className="age-tag" style={{ marginLeft: 7 }}>21+</span>}
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--text-3)' }}>{p.barcode || '—'}</td>
                  <td>{p.category}</td>
                  <td>{money(p.price)}</td>
                  <td>{money(p.cost)}</td>
                  <td className={'marg-pct' + (marginPct < 25 ? ' mid' : '')}>{marginPct.toFixed(0)}%</td>
                  <td>{low ? <span className="badge-amber">{p.stock}</span> : p.stock}</td>
                  <td>{p.reorderPoint}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {adjustingId === p.id ? (
                      <span className="mini-form" style={{ margin: 0, justifyContent: 'flex-end' }}>
                        <input
                          className="mini-input"
                          style={{ width: 72 }}
                          type="number"
                          placeholder="±qty"
                          value={delta}
                          autoFocus
                          onChange={(e) => setDelta(e.target.value)}
                          aria-label="Adjustment quantity"
                        />
                        <select
                          className="discount-select"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          aria-label="Adjustment reason"
                        >
                          {ADJUST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 13 }} onClick={() => applyAdjust(p)}>
                          Apply
                        </button>
                        <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 13 }} onClick={() => setAdjustingId(null)}>
                          ✕
                        </button>
                      </span>
                    ) : (
                      <>
                        <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 13, marginRight: 6 }} onClick={() => setDraft(draftFrom(p))}>
                          Edit
                        </button>
                        <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 13 }} onClick={() => { setAdjustingId(p.id); setDelta('') }}>
                          Adjust
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ color: 'var(--text-3)', textAlign: 'center', padding: 24 }}>No products match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {chooser && (
        <BarcodeChooser
          products={chooser}
          subtitle="This barcode is shared by several products (break-packs). Which one do you want to edit?"
          onPick={(p) => {
            setChooser(null)
            setDraft(draftFrom(p))
          }}
          onCancel={() => setChooser(null)}
        />
      )}

      {draft && (
        <ProductModal
          draft={draft}
          sharedWith={products.filter(
            (p) => draft.barcode.trim() && p.barcode === draft.barcode.trim() && p.id !== draft.id,
          )}
          onChange={setDraft}
          onCancel={() => setDraft(null)}
          onSave={() => {
            const d = draft
            const base = {
              name: d.name.trim(),
              emoji: '',
              barcode: d.barcode.trim(),
              category: d.category,
              price: round2(Math.max(0, Number(d.price) || 0)),
              cost: round2(Math.max(0, Number(d.cost) || 0)),
              reorderPoint: Math.max(0, Math.round(Number(d.reorderPoint) || 0)),
              packSize: Math.max(1, Math.round(Number(d.packSize) || 1)),
              minAge: d.restricted ? 21 : undefined,
            }
            if (!base.name) return
            if (d.id) {
              dispatch({ type: 'UPDATE_PRODUCT', productId: d.id, patch: base })
            } else {
              dispatch({
                type: 'ADD_PRODUCT',
                product: { ...base, stock: Math.max(0, Math.round(Number(d.stock) || 0)) },
              })
            }
            setDraft(null)
          }}
        />
      )}
    </div>
  )
}

function Kpi({ label, value, sub, warn }: { label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className="glass stat">
      <div className="label">{label}</div>
      <div className="value" style={warn ? { color: 'var(--amber)' } : undefined}>{value}</div>
      <div className="sub">{sub}</div>
    </div>
  )
}

function ProductModal({
  draft,
  sharedWith,
  onChange,
  onSave,
  onCancel,
}: {
  draft: Draft
  sharedWith: Product[]
  onChange: (d: Draft) => void
  onSave: () => void
  onCancel: () => void
}) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch })
  const isEdit = !!draft.id
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="form-card glass" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 16 }}>{isEdit ? 'Edit product' : 'Add product'}</h3>
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="f-name">Product name</label>
            <input id="f-name" value={draft.name} autoFocus onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="f-barcode">Barcode (UPC)</label>
            <input id="f-barcode" value={draft.barcode} onChange={(e) => set({ barcode: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="f-cat">Category</label>
            <select id="f-cat" value={draft.category} onChange={(e) => set({ category: e.target.value as Category })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {sharedWith.length > 0 && (
            <div className="share-note">
              This barcode is also on <strong>{sharedWith.map((p) => p.name).join(', ')}</strong>.
              That’s fine — it’s how break-packs work (a 6-pack split from a 30-pack keeps
              the same UPC). Scanning it will ask which product is being sold.
            </div>
          )}
          <div className="field">
            <label htmlFor="f-price">Price $</label>
            <input id="f-price" type="number" step="0.01" value={draft.price} onChange={(e) => set({ price: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="f-cost">Cost $ (per unit)</label>
            <input id="f-cost" type="number" step="0.01" value={draft.cost} onChange={(e) => set({ cost: e.target.value })} />
          </div>
          {!isEdit && (
            <div className="field">
              <label htmlFor="f-stock">Starting stock</label>
              <input id="f-stock" type="number" value={draft.stock} onChange={(e) => set({ stock: e.target.value })} />
            </div>
          )}
          <div className="field">
            <label htmlFor="f-reorder">Reorder at</label>
            <input id="f-reorder" type="number" value={draft.reorderPoint} onChange={(e) => set({ reorderPoint: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="f-pack">Units per case</label>
            <input id="f-pack" type="number" value={draft.packSize} onChange={(e) => set({ packSize: e.target.value })} />
          </div>
          <label className="field check-row full">
            <input
              type="checkbox"
              checked={draft.restricted}
              onChange={(e) => set({ restricted: e.target.checked })}
            />
            Age-restricted (21+) — register will prompt for ID
          </label>
        </div>
        {isEdit && (
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '12px 0 0' }}>
            Stock isn’t edited here — use Adjust (with a reason) or Receiving, so every change is audited.
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={!draft.name.trim()}>
            {isEdit ? 'Save changes' : 'Add product'}
          </button>
        </div>
      </div>
    </div>
  )
}
