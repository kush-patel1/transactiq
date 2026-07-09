import type { InvoiceDoc, Product, Sale, SaleLine, User } from './types'

export const TAX_RATE = 0.07
export const STORE_NAME = 'QuickStop Mart'

// Demo staff. PINs are shown in the login UI on purpose — this is demo-grade
// auth that Firebase Auth replaces when we wire the real backend.
export const USERS: User[] = [
  { id: 'u1', name: 'Kush', emoji: '🧑‍💼', role: 'owner', pin: '1234' },
  { id: 'u2', name: 'Sam', emoji: '🧑‍🍳', role: 'cashier', pin: '5678' },
]

// ---- deterministic PRNG so the demo dashboard is stable across reloads ----
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20240708)
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]

// ---- catalog: realistic small-retail sample data ----------------------------
// Margins tell the real story: cigarettes are the top seller but the WORST
// earner (~14%); coffee, candy, and accessories quietly carry the store.
export const CATALOG: Product[] = [
  { id: 'p01', name: 'Marlboro Red (pack)', emoji: '🚬', barcode: '028200003843', category: 'Tobacco', price: 9.49, cost: 8.15, stock: 80, reorderPoint: 40, packSize: 10, minAge: 21 },
  { id: 'p02', name: 'Newport Menthol (pack)', emoji: '🚬', barcode: '026100008431', category: 'Tobacco', price: 9.99, cost: 8.6, stock: 55, reorderPoint: 30, packSize: 10, minAge: 21 },
  { id: 'p03', name: 'Bud Light 12-pack', emoji: '🍺', barcode: '018200530616', category: 'Beer', price: 12.99, cost: 9.75, stock: 26, reorderPoint: 12, packSize: 2, minAge: 21 },
  { id: 'p04', name: 'Modelo 6-pack', emoji: '🍻', barcode: '080660956435', category: 'Beer', price: 10.49, cost: 7.9, stock: 22, reorderPoint: 10, packSize: 4, minAge: 21 },
  { id: 'p05', name: 'Tall Boy Lager 24oz', emoji: '🍺', barcode: '034100004316', category: 'Beer', price: 2.99, cost: 1.95, stock: 48, reorderPoint: 24, packSize: 24, minAge: 21 },
  { id: 'p06', name: 'Cabernet 750ml', emoji: '🍷', barcode: '085000019306', category: 'Wine', price: 11.99, cost: 7.25, stock: 18, reorderPoint: 8, packSize: 12, minAge: 21 },
  { id: 'p07', name: 'Vodka 750ml', emoji: '🍸', barcode: '082000712893', category: 'Spirits', price: 15.99, cost: 10.4, stock: 15, reorderPoint: 6, packSize: 12, minAge: 21 },
  { id: 'p08', name: 'Bourbon 750ml', emoji: '🥃', barcode: '081128000516', category: 'Spirits', price: 17.99, cost: 12.1, stock: 12, reorderPoint: 6, packSize: 6, minAge: 21 },
  { id: 'p09', name: 'Coke 20oz', emoji: '🥤', barcode: '049000042566', category: 'Drinks', price: 2.49, cost: 1.1, stock: 65, reorderPoint: 30, packSize: 24 },
  { id: 'p10', name: 'Energy Drink 16oz', emoji: '⚡', barcode: '070847811169', category: 'Drinks', price: 3.49, cost: 1.85, stock: 40, reorderPoint: 20, packSize: 24 },
  { id: 'p11', name: 'Water 1L', emoji: '💧', barcode: '068274000034', category: 'Drinks', price: 1.79, cost: 0.55, stock: 50, reorderPoint: 24, packSize: 24 },
  { id: 'p12', name: 'Hot Coffee 16oz', emoji: '☕', barcode: '099999000167', category: 'Drinks', price: 1.99, cost: 0.4, stock: 100, reorderPoint: 30, packSize: 50 },
  { id: 'p13', name: 'Potato Chips', emoji: '🥔', barcode: '028400090865', category: 'Snacks', price: 2.99, cost: 1.05, stock: 45, reorderPoint: 20, packSize: 12 },
  { id: 'p14', name: 'Candy Bar', emoji: '🍫', barcode: '040000424314', category: 'Snacks', price: 1.99, cost: 0.72, stock: 90, reorderPoint: 40, packSize: 36 },
  { id: 'p15', name: 'Beef Jerky 3.25oz', emoji: '🥩', barcode: '017082876683', category: 'Snacks', price: 7.99, cost: 4.1, stock: 20, reorderPoint: 10, packSize: 12 },
  { id: 'p16', name: 'Ice Bag 7lb', emoji: '🧊', barcode: '099999000389', category: 'Grocery', price: 2.99, cost: 0.9, stock: 30, reorderPoint: 15, packSize: 1 },
  { id: 'p17', name: 'Whole Milk (gal)', emoji: '🥛', barcode: '011110491008', category: 'Grocery', price: 4.79, cost: 3.3, stock: 16, reorderPoint: 8, packSize: 4 },
  { id: 'p18', name: 'Phone Charger', emoji: '🔌', barcode: '099999000662', category: 'Other', price: 12.99, cost: 3.5, stock: 10, reorderPoint: 5, packSize: 10 },
]

// popularity weights: smokes + beer + soda dominate the ticket count
const WEIGHT: Record<string, number> = {
  p01: 10, p02: 6, p03: 7, p04: 6, p05: 8, p06: 3, p07: 4, p08: 3, p09: 9,
  p10: 6, p11: 5, p12: 7, p13: 5, p14: 8, p15: 3, p16: 4, p17: 4, p18: 1,
}
const WEIGHTED_IDS: string[] = CATALOG.flatMap((p) =>
  Array<string>(WEIGHT[p.id] ?? 1).fill(p.id),
)

// hourly demand curve (index = hour 0..23): morning coffee/smokes bump,
// heavy evening beer run, open late.
const HOUR_CURVE = [0,0,0,0,0,1,3,6,7,5,4,5,6,5,4,5,7,9,10,9,7,5,3,1]

// ---- generate ~30 days of sales --------------------------------------------
function buildSales(): Sale[] {
  const sales: Sale[] = []
  const now = Date.UTC(2026, 6, 8, 20, 0, 0) // 2026-07-08, fixed "now"
  const dayMs = 86_400_000
  let counter = 0

  for (let d = 29; d >= 0; d--) {
    const dayStart = now - d * dayMs
    const dow = new Date(dayStart).getUTCDay()
    const weekendBoost = dow === 0 || dow === 6 ? 1.5 : 1
    for (let h = 0; h < 24; h++) {
      const expected = HOUR_CURVE[h] * weekendBoost * (0.7 + rand() * 0.6)
      const nTxns = Math.round(expected / 3)
      for (let t = 0; t < nTxns; t++) {
        const ts = dayStart + h * 3_600_000 + Math.floor(rand() * 3_600_000)
        const nItems = 1 + Math.floor(rand() * 3)
        const lines: SaleLine[] = []
        for (let i = 0; i < nItems; i++) {
          const pid = pick(WEIGHTED_IDS)
          const prod = CATALOG.find((p) => p.id === pid)!
          const existing = lines.find((l) => l.productId === pid)
          if (existing) {
            existing.qty += 1
          } else {
            lines.push({ productId: pid, name: prod.name, qty: 1 + (rand() < 0.15 ? 1 : 0), price: prod.price, cost: prod.cost })
          }
        }
        const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0)
        const tax = Math.round(subtotal * TAX_RATE * 100) / 100
        const restricted = lines.some(
          (l) => CATALOG.find((p) => p.id === l.productId)?.minAge,
        )
        sales.push({
          id: `s${(counter++).toString().padStart(5, '0')}`,
          timestamp: ts,
          lines,
          subtotal: Math.round(subtotal * 100) / 100,
          discountPct: 0,
          discount: 0,
          tax,
          total: Math.round((subtotal + tax) * 100) / 100,
          tender: 'cash',
          cashierId: counter % 2 === 0 ? 'u1' : 'u2',
          shiftId: null, // seed history predates drawer tracking
          status: 'completed',
          idChecked: restricted || undefined,
        })
      }
    }
  }
  return sales.sort((a, b) => a.timestamp - b.timestamp)
}

export const SALES: Sale[] = buildSales()

// Sample distributor invoices for the AI-receiving demo. Raw text mimics OCR.
// Scans alternate vendors; re-scanning a vendor shows its learned aliases.
export const INVOICES: InvoiceDoc[] = [
  {
    vendor: 'Capital Beverage Distributing',
    invoiceNo: 'CB-77120',
    date: '2026-07-07',
    lines: [
      { raw: 'BUD LT 12PK CANS CS/2', matchedProductId: 'p03', caseQty: 3, packSize: 2, qtyReceived: 6, unitCost: 9.6, confidence: 0.96 },
      { raw: 'MODELO ESP 6PK BTL 4/CS', matchedProductId: 'p04', caseQty: 2, packSize: 4, qtyReceived: 8, unitCost: 7.8, confidence: 0.93 },
      { raw: 'TALLBOY LAGER 24OZ 24CS', matchedProductId: 'p05', caseQty: 1, packSize: 24, qtyReceived: 24, unitCost: 1.9, confidence: 0.88 },
      { raw: 'CAB SAUV 750 12/CS', matchedProductId: 'p06', caseQty: 1, packSize: 12, qtyReceived: 12, unitCost: 7.1, confidence: 0.85 },
      { raw: 'VODKA 80PF 750ML 12CS', matchedProductId: 'p07', caseQty: 1, packSize: 12, qtyReceived: 12, unitCost: 10.25, confidence: 0.91 },
      { raw: 'WHSKY BRBN 750 6CS', matchedProductId: 'p08', caseQty: 1, packSize: 6, qtyReceived: 6, unitCost: 11.95, confidence: 0.78 },
    ],
  },
  {
    vendor: 'Core-Mark Distribution',
    invoiceNo: 'CM-30988',
    date: '2026-07-08',
    lines: [
      { raw: 'MARL RED KING BX 10CT', matchedProductId: 'p01', caseQty: 2, packSize: 10, qtyReceived: 20, unitCost: 8.05, confidence: 0.97 },
      { raw: 'NWPRT MENTH BX 10CT', matchedProductId: 'p02', caseQty: 1, packSize: 10, qtyReceived: 10, unitCost: 8.5, confidence: 0.95 },
      { raw: 'COKE 20Z PET 24CS', matchedProductId: 'p09', caseQty: 2, packSize: 24, qtyReceived: 48, unitCost: 1.05, confidence: 0.92 },
      { raw: 'ENRGY DRNK 16OZ 24', matchedProductId: 'p10', caseQty: 1, packSize: 24, qtyReceived: 24, unitCost: 1.8, confidence: 0.9 },
      { raw: 'CANDY CHOC KING 36CT', matchedProductId: 'p14', caseQty: 1, packSize: 36, qtyReceived: 36, unitCost: 0.7, confidence: 0.89 },
      { raw: 'JERKY ORIG 3.25OZ 12', matchedProductId: 'p15', caseQty: 1, packSize: 12, qtyReceived: 12, unitCost: 4.0, confidence: 0.82 },
    ],
  },
]
