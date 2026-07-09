import type { Product } from '../lib/types'
import { money } from '../lib/analytics'

// One barcode, several products — the break-pack case: a 6-pack made by
// splitting a 30-pack carries the same UPC, but sells at a different price.
export default function BarcodeChooser({
  products,
  subtitle,
  onPick,
  onCancel,
}: {
  products: Product[]
  subtitle: string
  onPick: (p: Product) => void
  onCancel: () => void
}) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="form-card glass" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 4 }}>One barcode, multiple products</h3>
        <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '0 0 6px' }}>{subtitle}</p>
        <p style={{ color: 'var(--text-3)', fontSize: 12.5, margin: '0 0 14px', fontFamily: 'var(--mono)' }}>
          {products[0]?.barcode}
        </p>
        <div className="chooser-list">
          {products.map((p) => (
            <button key={p.id} className="chooser-opt" onClick={() => onPick(p)}>
              <span className="chooser-name">
                {p.name}
                {p.minAge && <span className="age-tag" style={{ marginLeft: 7 }}>21+</span>}
              </span>
              <span className="chooser-meta">
                {p.stock === 0 ? 'out of stock' : `${p.stock} in stock`}
              </span>
              <span className="chooser-price">{money(p.price)}</span>
            </button>
          ))}
        </div>
        <button className="btn btn-ghost" style={{ width: '100%', marginTop: 12 }} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
