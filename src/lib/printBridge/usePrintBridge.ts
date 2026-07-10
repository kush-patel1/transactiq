import { useCallback, useEffect, useRef, useState } from 'react'
import type { Tender } from '../types'

// Talks to the local hardware bridge (bridge/server.js) on the register PC.
// Loopback HTTP from an https page is allowed by browsers (localhost is a
// trustworthy origin). Everything here is best-effort: the bridge being down
// must never block a sale.

const BASE_URL = 'http://127.0.0.1:9420'
const HEALTH_POLL_MS = 15_000
const TIMEOUT_MS = 1500

export interface ReceiptPayload {
  storeName: string
  timestamp: number
  cashier: string
  lines: { qty: number; name: string; lineTotal: number }[]
  subtotal: number
  discount: number
  discountPct: number
  tax: number
  total: number
  tender: Tender
  amountTendered?: number
  idChecked?: boolean
}

export interface BridgeResult {
  ok: boolean
  simulated?: boolean
  error?: string
}

export interface PrintBridgeState {
  available: boolean // bridge answered its last health check
  printer: 'connected' | 'offline' | 'simulation' | null
  printReceipt: (payload: ReceiptPayload) => Promise<BridgeResult>
  openDrawer: () => Promise<BridgeResult>
}

async function call(path: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const t = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    return await fetch(`${BASE_URL}${path}`, { ...init, signal: ctrl.signal })
  } finally {
    window.clearTimeout(t)
  }
}

export function usePrintBridge(): PrintBridgeState {
  const [available, setAvailable] = useState(false)
  const [printer, setPrinter] = useState<PrintBridgeState['printer']>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    async function check() {
      try {
        const res = await call('/health')
        const body = (await res.json()) as { ok: boolean; printer?: string }
        if (!alive.current) return
        setAvailable(!!body.ok)
        setPrinter((body.printer as PrintBridgeState['printer']) ?? null)
      } catch {
        if (!alive.current) return
        setAvailable(false)
        setPrinter(null)
      }
    }
    void check()
    const iv = window.setInterval(check, HEALTH_POLL_MS)
    return () => {
      alive.current = false
      window.clearInterval(iv)
    }
  }, [])

  const post = useCallback(async (path: string, body: unknown): Promise<BridgeResult> => {
    try {
      const res = await call(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return (await res.json()) as BridgeResult
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'bridge unreachable' }
    }
  }, [])

  const printReceipt = useCallback(
    (payload: ReceiptPayload) => post('/print-receipt', payload),
    [post],
  )
  const openDrawer = useCallback(() => post('/open-drawer', { reason: 'sale' }), [post])

  return { available, printer, printReceipt, openDrawer }
}
