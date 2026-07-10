import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import type {
  AuditEntry,
  CartLine,
  CostLot,
  Product,
  Receiving,
  Sale,
  SaleLine,
  ScannedLine,
  Shift,
  Tender,
  User,
  Vendor,
} from './types'
import { CATALOG, SALES, TAX_RATE, USERS } from './seed'
import { round2, shiftExpected } from './analytics'

// Persistent app store. This is the "backend" of the demo: a reducer over the
// full business state, persisted to localStorage. Phase 1 of the real build
// swaps the persistence layer for Firestore behind these same actions —
// components never touch storage directly, only dispatch.

const STORAGE_KEY = 'transactiq-state'
const STATE_VERSION = 5 // v5: cash/card tender split + amountTendered

export interface AppState {
  __v: number
  products: Product[]
  sales: Sale[]
  costLots: CostLot[]
  vendors: Vendor[]
  receivings: Receiving[]
  shifts: Shift[]
  audit: AuditEntry[]
  users: User[]
  currentUserId: string | null
  lastSale: Sale | null // most recent sale, for the receipt view
}

export type Action =
  | { type: 'LOGIN'; userId: string }
  | { type: 'LOGOUT' }
  | {
      type: 'COMMIT_SALE'
      cart: CartLine[]
      discountPct: number
      idChecked?: boolean
      tender: Tender
      amountTendered?: number
    }
  | { type: 'REFUND_SALE'; saleId: string; reason: string }
  | {
      type: 'CONFIRM_RECEIVING'
      vendor: string
      invoiceNo: string
      lines: ScannedLine[]
    }
  | { type: 'ADD_PRODUCT'; product: Omit<Product, 'id'> }
  | { type: 'UPDATE_PRODUCT'; productId: string; patch: Partial<Omit<Product, 'id' | 'stock'>> }
  | { type: 'ADJUST_STOCK'; productId: string; delta: number; reason: string }
  | { type: 'OPEN_SHIFT'; startingCash: number }
  | { type: 'CASH_MOVEMENT'; label: string; amount: number }
  | { type: 'CLOSE_SHIFT'; countedCash: number }
  | { type: 'RESET' }

function freshState(): AppState {
  return {
    __v: STATE_VERSION,
    products: CATALOG.map((p) => ({ ...p })),
    sales: SALES.map((s) => ({ ...s })),
    costLots: [],
    vendors: [],
    receivings: [],
    shifts: [],
    audit: [],
    users: USERS,
    currentUserId: null,
    lastSale: null,
  }
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return freshState()
    const parsed = JSON.parse(raw) as AppState
    if (parsed.__v !== STATE_VERSION) return freshState() // schema drift → reseed
    return parsed
  } catch {
    return freshState()
  }
}

function audit(
  state: AppState,
  action: AuditEntry['action'],
  detail: string,
): AuditEntry {
  return {
    id: `a${state.audit.length}-${Date.now().toString(36)}`,
    timestamp: Date.now(),
    userId: state.currentUserId ?? 'system',
    action,
    detail,
  }
}

const openShiftOf = (state: AppState): Shift | null =>
  state.shifts.find((s) => !s.closedAt) ?? null

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOGIN': {
      const next = { ...state, currentUserId: action.userId }
      const u = state.users.find((x) => x.id === action.userId)
      return { ...next, audit: [...state.audit, audit(next, 'LOGIN', `${u?.name ?? action.userId} signed in`)] }
    }

    case 'LOGOUT':
      return { ...state, currentUserId: null }

    case 'COMMIT_SALE': {
      if (!state.currentUserId || !action.cart.length) return state
      const shift = openShiftOf(state)
      const products = state.products.map((p) => ({ ...p }))
      const lines: SaleLine[] = action.cart.map((c) => {
        const p = products.find((x) => x.id === c.productId)!
        p.stock = Math.max(0, p.stock - c.qty)
        return { productId: p.id, name: p.name, qty: c.qty, price: p.price, cost: p.cost }
      })
      const subtotal = round2(lines.reduce((s, l) => s + l.price * l.qty, 0))
      const discount = round2((subtotal * action.discountPct) / 100)
      const tax = round2((subtotal - discount) * TAX_RATE)
      const sale: Sale = {
        id: `s-${state.sales.length}-${Date.now().toString(36)}`,
        timestamp: Date.now(),
        lines,
        subtotal,
        discountPct: action.discountPct,
        discount,
        tax,
        total: round2(subtotal - discount + tax),
        tender: action.tender,
        amountTendered:
          action.tender === 'cash' && action.amountTendered != null
            ? round2(action.amountTendered)
            : undefined,
        cashierId: state.currentUserId,
        shiftId: shift?.id ?? null,
        status: 'completed',
        idChecked: action.idChecked || undefined,
      }
      const detail =
        `sale ${sale.id} · ${lines.reduce((n, l) => n + l.qty, 0)} items · $${sale.total.toFixed(2)} · ${action.tender}` +
        (sale.amountTendered != null ? ` · tendered $${sale.amountTendered.toFixed(2)}` : '') +
        (discount > 0 ? ` · ${action.discountPct}% discount (−$${discount.toFixed(2)})` : '') +
        (action.idChecked ? ' · ID checked' : '')
      return {
        ...state,
        products,
        sales: [...state.sales, sale],
        lastSale: sale,
        audit: [...state.audit, audit(state, 'SALE', detail)],
      }
    }

    case 'REFUND_SALE': {
      if (!state.currentUserId) return state
      const sale = state.sales.find((s) => s.id === action.saleId)
      if (!sale || sale.status === 'refunded') return state
      // restock every line
      const products = state.products.map((p) => {
        const back = sale.lines
          .filter((l) => l.productId === p.id)
          .reduce((n, l) => n + l.qty, 0)
        return back ? { ...p, stock: p.stock + back } : p
      })
      const sales = state.sales.map((s) =>
        s.id === sale.id
          ? {
              ...s,
              status: 'refunded' as const,
              refund: {
                timestamp: Date.now(),
                reason: action.reason,
                byUserId: state.currentUserId!,
              },
            }
          : s,
      )
      return {
        ...state,
        products,
        sales,
        audit: [
          ...state.audit,
          audit(state, 'REFUND', `refunded ${sale.id} · $${sale.total.toFixed(2)} · ${action.reason}`),
        ],
      }
    }

    case 'CONFIRM_RECEIVING': {
      if (!state.currentUserId) return state
      const now = Date.now()
      // stock up + refresh landed cost
      const products = state.products.map((p) => {
        const match = action.lines.find((l) => l.matchedProductId === p.id)
        if (!match) return p
        return { ...p, stock: p.stock + match.qtyReceived, cost: match.unitCost }
      })
      // one cost lot per line — the margin history depends on these
      const costLots: CostLot[] = [
        ...state.costLots,
        ...action.lines
          .filter((l) => l.matchedProductId)
          .map((l, i) => ({
            id: `lot-${state.costLots.length + i}-${now.toString(36)}`,
            productId: l.matchedProductId!,
            qty: l.qtyReceived,
            unitCost: l.unitCost,
            receivedAt: now,
            vendor: action.vendor,
            invoiceNo: action.invoiceNo,
          })),
      ]
      // vendor alias learning: remember raw-text → product mappings
      const existing = state.vendors.find((v) => v.name === action.vendor)
      const aliasAdds = Object.fromEntries(
        action.lines
          .filter((l) => l.matchedProductId)
          .map((l) => [l.raw, l.matchedProductId!]),
      )
      const vendors: Vendor[] = existing
        ? state.vendors.map((v) =>
            v.name === action.vendor
              ? { ...v, aliasMap: { ...v.aliasMap, ...aliasAdds } }
              : v,
          )
        : [
            ...state.vendors,
            { id: `v${state.vendors.length}`, name: action.vendor, aliasMap: aliasAdds },
          ]
      const receiving: Receiving = {
        id: `r${state.receivings.length}-${now.toString(36)}`,
        vendor: action.vendor,
        invoiceNo: action.invoiceNo,
        timestamp: now,
        byUserId: state.currentUserId,
        lines: action.lines,
      }
      const units = action.lines.reduce((n, l) => n + l.qtyReceived, 0)
      return {
        ...state,
        products,
        costLots,
        vendors,
        receivings: [...state.receivings, receiving],
        audit: [
          ...state.audit,
          audit(state, 'RECEIVE', `${action.vendor} ${action.invoiceNo} · ${units} units across ${action.lines.length} lines`),
        ],
      }
    }

    case 'ADD_PRODUCT': {
      if (!state.currentUserId) return state
      const product: Product = {
        ...action.product,
        id: `p-${Date.now().toString(36)}`,
      }
      return {
        ...state,
        products: [...state.products, product],
        audit: [
          ...state.audit,
          audit(state, 'PRODUCT_ADD', `added ${product.name} · $${product.price.toFixed(2)} / cost $${product.cost.toFixed(2)} · ${product.stock} in stock`),
        ],
      }
    }

    case 'UPDATE_PRODUCT': {
      if (!state.currentUserId) return state
      const before = state.products.find((p) => p.id === action.productId)
      if (!before) return state
      return {
        ...state,
        products: state.products.map((p) =>
          p.id === action.productId ? { ...p, ...action.patch } : p,
        ),
        audit: [
          ...state.audit,
          audit(state, 'PRODUCT_EDIT', `edited ${before.name}`),
        ],
      }
    }

    case 'ADJUST_STOCK': {
      if (!state.currentUserId || !action.delta) return state
      const before = state.products.find((p) => p.id === action.productId)
      if (!before) return state
      const newStock = Math.max(0, before.stock + action.delta)
      return {
        ...state,
        products: state.products.map((p) =>
          p.id === action.productId ? { ...p, stock: newStock } : p,
        ),
        audit: [
          ...state.audit,
          audit(
            state,
            'STOCK_ADJUST',
            `${before.name}: ${action.delta > 0 ? '+' : ''}${action.delta} (${action.reason}) · stock ${before.stock} → ${newStock}`,
          ),
        ],
      }
    }

    case 'OPEN_SHIFT': {
      if (!state.currentUserId || openShiftOf(state)) return state
      const shift: Shift = {
        id: `sh${state.shifts.length}`,
        openedByUserId: state.currentUserId,
        openedAt: Date.now(),
        startingCash: round2(action.startingCash),
        movements: [],
      }
      return {
        ...state,
        shifts: [...state.shifts, shift],
        audit: [
          ...state.audit,
          audit(state, 'SHIFT_OPEN', `drawer opened with $${shift.startingCash.toFixed(2)} float`),
        ],
      }
    }

    case 'CASH_MOVEMENT': {
      const shift = openShiftOf(state)
      if (!state.currentUserId || !shift || !action.amount) return state
      const move = {
        timestamp: Date.now(),
        label: action.label || (action.amount > 0 ? 'Paid in' : 'Paid out'),
        amount: round2(action.amount),
        byUserId: state.currentUserId,
      }
      return {
        ...state,
        shifts: state.shifts.map((s) =>
          s.id === shift.id ? { ...s, movements: [...s.movements, move] } : s,
        ),
        audit: [
          ...state.audit,
          audit(state, 'CASH_MOVE', `${move.label}: ${move.amount > 0 ? '+' : ''}$${move.amount.toFixed(2)}`),
        ],
      }
    }

    case 'CLOSE_SHIFT': {
      const shift = openShiftOf(state)
      if (!state.currentUserId || !shift) return state
      const expected = shiftExpected(shift, state.sales)
      const counted = round2(action.countedCash)
      return {
        ...state,
        shifts: state.shifts.map((s) =>
          s.id === shift.id
            ? {
                ...s,
                closedAt: Date.now(),
                closedByUserId: state.currentUserId!,
                countedCash: counted,
                expectedCash: expected,
              }
            : s,
        ),
        audit: [
          ...state.audit,
          audit(
            state,
            'SHIFT_CLOSE',
            `drawer closed · expected $${expected.toFixed(2)} · counted $${counted.toFixed(2)} · variance ${counted - expected >= 0 ? '+' : '−'}$${Math.abs(round2(counted - expected)).toFixed(2)}`,
          ),
        ],
      }
    }

    case 'RESET':
      return freshState()

    default:
      return state
  }
}

// ---- context ----------------------------------------------------------------
interface StoreCtx {
  state: AppState
  dispatch: Dispatch<Action>
  currentUser: User | null
  openShift: Shift | null
}

const Ctx = createContext<StoreCtx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // storage full/blocked — demo continues in memory
    }
  }, [state])

  const value: StoreCtx = {
    state,
    dispatch,
    currentUser: state.users.find((u) => u.id === state.currentUserId) ?? null,
    openShift: state.shifts.find((s) => !s.closedAt) ?? null,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): StoreCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}
