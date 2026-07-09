import { useState } from 'react'
import {
  money,
  round2,
  salesToCsv,
  shiftExpected,
  shiftReport,
} from '../lib/analytics'
import { useStore } from '../lib/store'

const REFUND_REASONS = ['customer return', 'damaged item', 'ring error', 'other']

const fmtTime = (ts: number) =>
  new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function BackOffice() {
  const { state } = useStore()

  return (
    <div className="dash">
      <DrawerPanel />
      <SalesHistory />
      <div className="dash-cols">
        <AuditTrail />
        <ExportPanel />
      </div>
      <div style={{ color: 'var(--text-3)', fontSize: 12, textAlign: 'center' }}>
        {state.sales.length.toLocaleString()} sales · {state.receivings.length} receivings ·{' '}
        {state.costLots.length} cost lots · {state.audit.length} audit entries — persisted locally,
        Firestore adapter pending web config
      </div>
    </div>
  )
}

// ---- drawer & shifts ---------------------------------------------------------
function DrawerPanel() {
  const { state, dispatch, openShift } = useStore()
  const [startCash, setStartCash] = useState('150')
  const [moveAmt, setMoveAmt] = useState('')
  const [moveLabel, setMoveLabel] = useState('')
  const [counted, setCounted] = useState('')

  const userName = (id: string) => state.users.find((u) => u.id === id)?.name ?? id
  const closed = [...state.shifts].filter((s) => s.closedAt).reverse()

  function move(sign: 1 | -1) {
    const amt = Math.abs(Number(moveAmt))
    if (!amt) return
    dispatch({ type: 'CASH_MOVEMENT', label: moveLabel, amount: sign * amt })
    setMoveAmt('')
    setMoveLabel('')
  }

  return (
    <div className="glass panel">
      <h3>Cash drawer &amp; shifts</h3>
      <div className="p-sub">Open with a counted float, track paid-in/out, reconcile at close. Z reports below.</div>

      {openShift ? (
        <OpenShiftView
          countedInput={counted}
          setCountedInput={setCounted}
          moveAmt={moveAmt}
          setMoveAmt={setMoveAmt}
          moveLabel={moveLabel}
          setMoveLabel={setMoveLabel}
          onMove={move}
        />
      ) : (
        <div className="mini-form" style={{ marginBottom: 18 }}>
          <span style={{ color: 'var(--text-3)', fontWeight: 700 }}>Starting cash $</span>
          <input
            className="mini-input"
            type="number"
            value={startCash}
            onChange={(e) => setStartCash(e.target.value)}
            aria-label="Starting cash"
          />
          <button
            className="btn btn-primary"
            style={{ padding: '9px 18px' }}
            onClick={() => dispatch({ type: 'OPEN_SHIFT', startingCash: Number(startCash) || 0 })}
          >
            Open drawer
          </button>
        </div>
      )}

      {closed.length > 0 && (
        <>
          <h4 style={{ margin: '18px 0 10px', fontSize: 14 }}>Closed shifts (Z reports)</h4>
          <table className="marg-table">
            <thead>
              <tr>
                <th>Shift</th><th>Opened</th><th>Closed</th><th>Sales</th><th>Should have</th><th>Counted</th><th>Over / Short</th>
              </tr>
            </thead>
            <tbody>
              {closed.map((s) => {
                const rep = shiftReport(s, state.sales)
                const variance = round2((s.countedCash ?? 0) - (s.expectedCash ?? 0))
                return (
                  <tr key={s.id}>
                    <td>{s.id} · {userName(s.openedByUserId)}</td>
                    <td>{fmtTime(s.openedAt)}</td>
                    <td>{s.closedAt ? fmtTime(s.closedAt) : '—'}</td>
                    <td>{rep.transactions}{rep.refunds ? ` (−${rep.refunds} ref)` : ''}</td>
                    <td>{money(s.expectedCash ?? 0)}</td>
                    <td>{money(s.countedCash ?? 0)}</td>
                    <td className={variance === 0 ? 'marg-pct' : 'variance-bad'}>
                      {variance === 0
                        ? 'Even ✓'
                        : variance > 0
                          ? `Over ${money(variance)}`
                          : `Short ${money(Math.abs(variance))}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

function OpenShiftView({
  countedInput,
  setCountedInput,
  moveAmt,
  setMoveAmt,
  moveLabel,
  setMoveLabel,
  onMove,
}: {
  countedInput: string
  setCountedInput: (v: string) => void
  moveAmt: string
  setMoveAmt: (v: string) => void
  moveLabel: string
  setMoveLabel: (v: string) => void
  onMove: (sign: 1 | -1) => void
}) {
  const { state, dispatch, openShift } = useStore()
  if (!openShift) return null
  const rep = shiftReport(openShift, state.sales)
  const expected = shiftExpected(openShift, state.sales)
  const moves = openShift.movements.reduce((t, m) => t + m.amount, 0)

  return (
    <>
      {/* X report — live snapshot of the open drawer */}
      <div className="drawer-stats">
        <div className="kpi">
          <div className="label">Starting float</div>
          <div className="value">{money(openShift.startingCash)}</div>
        </div>
        <div className="kpi">
          <div className="label">Cash sales ({rep.transactions})</div>
          <div className="value">{money(rep.gross)}</div>
        </div>
        <div className="kpi">
          <div className="label">Paid in/out</div>
          <div className="value">{moves >= 0 ? '+' : '−'}{money(Math.abs(moves))}</div>
        </div>
        <div className="kpi">
          <div className="label">Expected in drawer</div>
          <div className="value gradient-text">{money(expected)}</div>
        </div>
      </div>

      <div className="mini-form" style={{ marginTop: 14 }}>
        <input
          className="mini-input"
          type="number"
          placeholder="Amount"
          value={moveAmt}
          onChange={(e) => setMoveAmt(e.target.value)}
          aria-label="Cash movement amount"
        />
        <input
          className="mini-input"
          style={{ width: 160 }}
          placeholder="Label (e.g. bank drop)"
          value={moveLabel}
          onChange={(e) => setMoveLabel(e.target.value)}
          aria-label="Cash movement label"
        />
        <button className="btn btn-ghost" style={{ padding: '9px 14px' }} onClick={() => onMove(1)}>+ Cash in</button>
        <button className="btn btn-ghost" style={{ padding: '9px 14px' }} onClick={() => onMove(-1)}>− Cash out</button>
      </div>

      <div className="mini-form" style={{ marginTop: 10 }}>
        <span style={{ color: 'var(--text-3)', fontWeight: 700 }}>Counted cash $</span>
        <input
          className="mini-input"
          type="number"
          value={countedInput}
          onChange={(e) => setCountedInput(e.target.value)}
          aria-label="Counted cash"
        />
        <button
          className="btn btn-primary"
          style={{ padding: '9px 18px' }}
          disabled={countedInput === ''}
          onClick={() => {
            dispatch({ type: 'CLOSE_SHIFT', countedCash: Number(countedInput) || 0 })
            setCountedInput('')
          }}
        >
          Close drawer · Z report
        </button>
      </div>

      {openShift.movements.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-2)' }}>
          {openShift.movements.map((m, i) => (
            <div key={i} className="lowstock-item">
              <span>{m.label}</span>
              <span>{m.amount > 0 ? '+' : '−'}{money(Math.abs(m.amount))}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ---- sales history + refunds ---------------------------------------------------
function SalesHistory() {
  const { state, dispatch, currentUser } = useStore()
  const [refundingId, setRefundingId] = useState<string | null>(null)
  const [reason, setReason] = useState(REFUND_REASONS[0])

  const recent = [...state.sales].reverse().slice(0, 20)
  const userName = (id: string) => state.users.find((u) => u.id === id)?.name ?? id
  const isOwner = currentUser?.role === 'owner'

  return (
    <div className="glass panel">
      <h3>Sales history</h3>
      <div className="p-sub">Latest 20 of {state.sales.length.toLocaleString()} sales. Refunds restock items and hit the audit trail.</div>
      <table className="marg-table">
        <thead>
          <tr><th>Time</th><th>Cashier</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {recent.map((s) => (
            <tr key={s.id} style={s.status === 'refunded' ? { opacity: 0.55 } : undefined}>
              <td>{fmtTime(s.timestamp)}</td>
              <td>{userName(s.cashierId)}</td>
              <td>{s.lines.reduce((n, l) => n + l.qty, 0)}</td>
              <td>{money(s.total)}{s.discount > 0 ? ` (−${s.discountPct}%)` : ''}</td>
              <td>
                {s.status === 'refunded' ? (
                  <span className="badge-amber" title={s.refund?.reason}>refunded</span>
                ) : (
                  <span className="marg-pct">completed</span>
                )}
              </td>
              <td style={{ textAlign: 'right' }}>
                {isOwner && s.status === 'completed' && (
                  refundingId === s.id ? (
                    <span className="mini-form" style={{ margin: 0, justifyContent: 'flex-end' }}>
                      <select
                        className="discount-select"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        aria-label="Refund reason"
                      >
                        {REFUND_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '5px 12px', fontSize: 13 }}
                        onClick={() => {
                          dispatch({ type: 'REFUND_SALE', saleId: s.id, reason })
                          setRefundingId(null)
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '5px 10px', fontSize: 13 }}
                        onClick={() => setRefundingId(null)}
                      >
                        ✕
                      </button>
                    </span>
                  ) : (
                    <button
                      className="btn btn-ghost"
                      style={{ padding: '5px 12px', fontSize: 13 }}
                      onClick={() => setRefundingId(s.id)}
                    >
                      Refund
                    </button>
                  )
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---- audit trail ---------------------------------------------------------------
function AuditTrail() {
  const { state } = useStore()
  const recent = [...state.audit].reverse().slice(0, 15)
  const userName = (id: string) => state.users.find((u) => u.id === id)?.name ?? id

  return (
    <div className="glass panel">
      <h3>Audit trail</h3>
      <div className="p-sub">Who did what — every sale, refund, receiving, and drawer event.</div>
      {recent.length === 0 ? (
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>No activity yet this session.</p>
      ) : (
        recent.map((a) => (
          <div key={a.id} className="lowstock-item" style={{ gap: 10 }}>
            <span style={{ fontSize: 13 }}>
              <strong>{userName(a.userId)}</strong>{' '}
              <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>{a.action}</span>{' '}
              <span style={{ color: 'var(--text-2)' }}>{a.detail}</span>
            </span>
            <span style={{ color: 'var(--text-3)', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtTime(a.timestamp)}</span>
          </div>
        ))
      )}
    </div>
  )
}

// ---- export ---------------------------------------------------------------------
function ExportPanel() {
  const { state } = useStore()

  function exportCsv() {
    const csv = salesToCsv(state.sales, state.users)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'transactiq-sales.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="glass panel">
      <h3>Exports</h3>
      <div className="p-sub">Hand your accountant a clean file — QuickBooks/Xero sync comes later.</div>
      <button className="btn btn-primary" onClick={exportCsv}>
        Download sales CSV ({state.sales.length.toLocaleString()} rows)
      </button>
      <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 14 }}>
        Includes id, datetime, cashier, status, subtotal, discount, tax, total, and line items.
      </p>
    </div>
  )
}
