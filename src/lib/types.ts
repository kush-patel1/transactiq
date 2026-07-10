// Core domain types for TransactIQ.
// NOTE: `cost` is first-class on every product and captured per receiving lot,
// because margin (price - cost) is the whole point of the IQ layer.

export type Role = 'owner' | 'cashier'

export interface User {
  id: string
  name: string
  emoji: string
  role: Role
  pin: string // demo-grade auth; real build swaps this for Firebase Auth
}

export interface Product {
  id: string
  name: string
  emoji: string
  barcode: string
  category: Category
  price: number // retail price, per unit
  cost: number // latest landed cost, per unit (from receiving)
  stock: number
  reorderPoint: number
  packSize: number // selling units per supplier case (for order/receiving math)
  minAge?: number // age-restricted item (beer/wine/spirits/tobacco = 21)
}

export type Category =
  | 'Tobacco'
  | 'Beer'
  | 'Wine'
  | 'Spirits'
  | 'Drinks'
  | 'Snacks'
  | 'Grocery'
  | 'Other'

export interface CartLine {
  productId: string
  qty: number
}

export interface SaleLine {
  productId: string
  name: string
  qty: number
  price: number // price at time of sale
  cost: number // cost at time of sale — frozen for accurate historical margin
}

export type SaleStatus = 'completed' | 'refunded'

// Card runs on the store's standalone terminal (cashier keys the total in);
// TransactIQ only records which tender was used — no card data ever touches us.
export type Tender = 'cash' | 'card'

export interface Sale {
  id: string
  timestamp: number // epoch ms
  lines: SaleLine[]
  subtotal: number
  discountPct: number
  discount: number // dollar amount taken off subtotal
  tax: number
  total: number
  tender: Tender
  amountTendered?: number // cash only — what the customer handed over
  cashierId: string
  shiftId: string | null // null for pre-drawer (seed) sales
  status: SaleStatus
  idChecked?: boolean // cashier confirmed ID for age-restricted items
  refund?: { timestamp: number; reason: string; byUserId: string }
}

// A parsed line off a scanned supplier invoice.
export interface ScannedLine {
  raw: string // OCR text as it appeared on the invoice
  matchedProductId: string | null
  caseQty: number // cases on the invoice
  packSize: number // selling units per case
  qtyReceived: number // in selling units (caseQty * packSize, editable)
  unitCost: number // landed cost per selling unit
  confidence: number // 0..1 match confidence
  learned?: boolean // matched via a previously-confirmed vendor alias
}

export interface InvoiceDoc {
  vendor: string
  invoiceNo: string
  date: string
  lines: ScannedLine[]
}

export interface Receiving {
  id: string
  vendor: string
  invoiceNo: string
  timestamp: number
  byUserId: string
  lines: ScannedLine[]
}

// Cost history — one lot per received invoice line, so historical margin
// stays correct as cost drifts between shipments.
export interface CostLot {
  id: string
  productId: string
  qty: number
  unitCost: number
  receivedAt: number
  vendor: string
  invoiceNo: string
}

export interface Vendor {
  id: string
  name: string
  // learned mapping: raw invoice text -> productId ("remember this match")
  aliasMap: Record<string, string>
}

export interface CashMovement {
  timestamp: number
  label: string
  amount: number // signed: paid-in positive, paid-out negative
  byUserId: string
}

export interface Shift {
  id: string
  openedByUserId: string
  openedAt: number
  startingCash: number
  movements: CashMovement[]
  closedAt?: number
  closedByUserId?: string
  countedCash?: number
  expectedCash?: number // frozen at close for the Z report
}

export interface AuditEntry {
  id: string
  timestamp: number
  userId: string
  action:
    | 'LOGIN'
    | 'SALE'
    | 'REFUND'
    | 'RECEIVE'
    | 'SHIFT_OPEN'
    | 'SHIFT_CLOSE'
    | 'CASH_MOVE'
    | 'PRODUCT_ADD'
    | 'PRODUCT_EDIT'
    | 'STOCK_ADJUST'
  detail: string
}
