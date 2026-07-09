import { useState } from 'react'
import type { InvoiceDoc, ScannedLine } from '../lib/types'
import { INVOICES } from '../lib/seed'
import { money } from '../lib/analytics'
import { useStore } from '../lib/store'

type Phase = 'idle' | 'scanning' | 'review' | 'done'

// In the real build, extractInvoice() sends the photo to Claude vision and
// returns structured lines. The demo returns rotating sample invoices with
// realistic OCR text, so the whole downstream pipeline is the real thing:
// alias matching, pack conversion, human confirm, cost lots.
function extractInvoice(scanCount: number): InvoiceDoc {
  return INVOICES[scanCount % INVOICES.length]
}

export default function Receiving() {
  const { state, dispatch } = useStore()
  const [phase, setPhase] = useState<Phase>('idle')
  const [invoice, setInvoice] = useState<InvoiceDoc | null>(null)
  const [lines, setLines] = useState<ScannedLine[]>([])

  function startScan() {
    setPhase('scanning')
    const doc = extractInvoice(state.receivings.length)
    // simulate OCR + AI extraction latency
    window.setTimeout(() => {
      // apply this vendor's learned aliases: exact raw-text matches confirmed
      // on a previous receiving come back at 100% confidence.
      const vendor = state.vendors.find((v) => v.name === doc.vendor)
      setInvoice(doc)
      setLines(
        doc.lines.map((l) => {
          const learned =
            !!l.matchedProductId && vendor?.aliasMap[l.raw] === l.matchedProductId
          return { ...l, learned, confidence: learned ? 1 : l.confidence }
        }),
      )
      setPhase('review')
    }, 1600)
  }

  function editQty(i: number, v: number) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, qtyReceived: v } : l)))
  }
  function editCost(i: number, v: number) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, unitCost: v } : l)))
  }

  function confirm() {
    if (!invoice) return
    dispatch({
      type: 'CONFIRM_RECEIVING',
      vendor: invoice.vendor,
      invoiceNo: invoice.invoiceNo,
      lines,
    })
    setPhase('done')
  }

  function reset() {
    setPhase('idle')
    setInvoice(null)
    setLines([])
  }

  const nameOf = (id: string | null) =>
    state.products.find((p) => p.id === id)?.name ?? 'Unmatched — pick item'
  const oldCostOf = (id: string | null) =>
    state.products.find((p) => p.id === id)?.cost

  const totalUnits = lines.reduce((s, l) => s + l.qtyReceived, 0)
  const totalCost = lines.reduce((s, l) => s + l.qtyReceived * l.unitCost, 0)
  const learnedCount = lines.filter((l) => l.learned).length

  return (
    <div className="receiving">
      <div className="section-head" style={{ textAlign: 'left', margin: '0 0 22px', maxWidth: '100%' }}>
        <span className="eyebrow">AI Receiving</span>
        <h2 style={{ fontSize: 26 }}>Scan a supplier invoice → stock & cost update themselves</h2>
        <p style={{ fontSize: 15 }}>
          This is where TransactIQ captures the number no other POS bothers with:
          your real landed cost. Confirmed matches are remembered per vendor —
          the second invoice from the same supplier matches itself.
        </p>
      </div>

      {phase === 'idle' && (
        <div className="invoice-drop">
          <h3>Drop a supplier invoice or take a photo</h3>
          <p style={{ color: 'var(--text-2)', margin: '10px 0 20px' }}>
            We’ll read the lines, match them to your catalog, and stage a receiving for your review.
            {state.receivings.length > 0 && (
              <>
                <br />
                <span style={{ color: 'var(--text-3)', fontSize: 13 }}>
                  {state.receivings.length} receiving{state.receivings.length > 1 ? 's' : ''} so far ·{' '}
                  {state.vendors.length} vendor{state.vendors.length !== 1 ? 's' : ''} learned
                </span>
              </>
            )}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={startScan}>
              Scan sample invoice
            </button>
            <label className="btn btn-ghost">
              Upload invoice photo
              <input
                type="file"
                accept="image/*,.pdf"
                hidden
                onChange={(e) => {
                  if (e.target.files?.length) startScan()
                }}
              />
            </label>
          </div>
          <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 16 }}>
            Demo simulates the vision extraction — uploads run the same pipeline on sample data.
          </p>
        </div>
      )}

      {phase === 'scanning' && (
        <div className="glass scanning">
          <h3>Reading invoice…</h3>
          <p style={{ color: 'var(--text-2)' }}>Extracting line items, matching SKUs, converting pack sizes.</p>
          <div className="scanbar"><i /></div>
        </div>
      )}

      {(phase === 'review' || phase === 'done') && invoice && (
        <>
          {learnedCount > 0 && phase === 'review' && (
            <div className="insight" style={{ marginBottom: 16 }}>
              <span className="insight-label">Learned</span>
              <span>
                {learnedCount} of {lines.length} lines matched from what you confirmed on a previous{' '}
                <strong>{invoice.vendor}</strong> invoice — no re-review needed.
              </span>
            </div>
          )}
          <div className="invoice-preview">
            {/* the "paper" invoice */}
            <div className="paper">
              <div className="p-h">{invoice.vendor}</div>
              <div className="p-row"><span>Invoice</span><span>{invoice.invoiceNo}</span></div>
              <div className="p-row"><span>Date</span><span>{invoice.date}</span></div>
              <div className="p-div" />
              {invoice.lines.map((l, i) => (
                <div className="p-row" key={i}>
                  <span style={{ maxWidth: 150 }}>{l.raw}</span>
                </div>
              ))}
              <div className="p-div" />
              <div className="p-row" style={{ fontWeight: 800 }}>
                <span>TOTAL</span><span>{money(totalCost)}</span>
              </div>
            </div>

            {/* the parsed + editable receiving */}
            <div>
              <div className="scan-head">
                <span>Matched item</span><span>Qty</span><span>Unit cost</span><span>Confidence</span>
              </div>
              <div className="scan-lines">
                {lines.map((l, i) => {
                  const prevCost = oldCostOf(l.matchedProductId)
                  const changed = prevCost != null && Math.abs(prevCost - l.unitCost) > 0.001
                  return (
                    <div className="scanline" key={i}>
                      <div>
                        <div className="match">{nameOf(l.matchedProductId)}</div>
                        <div className="raw">{l.raw}</div>
                        <div className="raw">
                          {l.caseQty} case{l.caseQty > 1 ? 's' : ''} × {l.packSize}/cs = {l.caseQty * l.packSize} units
                        </div>
                        {changed && (
                          <div className="raw" style={{ color: 'var(--cyan)' }}>
                            cost {money(prevCost!)} → {money(l.unitCost)}
                          </div>
                        )}
                      </div>
                      <input
                        type="number"
                        value={l.qtyReceived}
                        disabled={phase === 'done'}
                        onChange={(e) => editQty(i, Number(e.target.value))}
                        aria-label="Quantity received"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={l.unitCost}
                        disabled={phase === 'done'}
                        onChange={(e) => editCost(i, Number(e.target.value))}
                        aria-label="Unit cost"
                      />
                      {l.learned ? (
                        <span className="conf high" title="Matched from a previously confirmed receiving">
                          learned ✓
                        </span>
                      ) : (
                        <span className={'conf ' + (l.confidence >= 0.9 ? 'high' : 'mid')}>
                          {(l.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="totals" style={{ marginTop: 16 }}>
                <div className="row"><span>Items received</span><span>{totalUnits} units</span></div>
                <div className="row"><span>Cost lots to write</span><span>{lines.filter((l) => l.matchedProductId).length}</span></div>
                <div className="row grand"><span>Invoice cost</span><span>{money(totalCost)}</span></div>
              </div>

              {phase === 'review' ? (
                <button className="charge" onClick={confirm}>✓ Confirm receiving · update stock & cost</button>
              ) : (
                <>
                  <div className="insight" style={{ marginTop: 14 }}>
                    <span className="insight-label">Done</span>
                    <span>
                      Received {totalUnits} units, wrote {lines.filter((l) => l.matchedProductId).length} cost
                      lots, and remembered {invoice.vendor}’s naming. Open the{' '}
                      <strong>IQ Dashboard</strong> to see the margin impact.
                    </span>
                  </div>
                  <button className="btn btn-ghost" style={{ width: '100%', marginTop: 12 }} onClick={reset}>
                    Scan another invoice
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
