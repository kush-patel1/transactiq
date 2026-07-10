// TransactIQ hardware bridge — receipt printer + cash-drawer kick.
//
// Runs on the register PC. The browser app (GitHub Pages or local dev) calls
// it over 127.0.0.1 — bound to loopback ONLY, so nothing else on the store's
// LAN can reach it.
//
// Configure the printer with the PRINTER_INTERFACE env var, e.g.:
//   PRINTER_INTERFACE="tcp://192.168.1.87"        (network thermal printer)
//   PRINTER_INTERFACE="printer:EPSON TM-T20III"   (OS print queue)
// With no PRINTER_INTERFACE set, the bridge runs in SIMULATION mode: every
// endpoint works and receipts are logged to the console — so the whole
// pipeline is testable before the physical printer arrives.

import express from 'express'

const PORT = Number(process.env.PORT ?? 9420)
const PRINTER_INTERFACE = process.env.PRINTER_INTERFACE ?? ''

// Origins allowed to call this bridge. Origin-checked allowlist, no wildcard.
const ALLOWED_ORIGINS = [
  'https://kush-patel1.github.io',
  'http://localhost:5173', // vite dev
  'http://localhost:4173', // vite preview
]

const app = express()
app.use(express.json())

app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// ---- printer -----------------------------------------------------------------
let printerPromise = null

async function getPrinter() {
  if (!PRINTER_INTERFACE) return null // simulation mode
  if (!printerPromise) {
    printerPromise = (async () => {
      const ntp = await import('node-thermal-printer')
      const ThermalPrinter = ntp.ThermalPrinter ?? ntp.printer
      const PrinterTypes = ntp.PrinterTypes ?? ntp.types
      return new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: PRINTER_INTERFACE,
        options: { timeout: 3000 },
      })
    })()
  }
  return printerPromise
}

const money = (n) => `$${Number(n).toFixed(2)}`

function receiptText(r) {
  const lines = [
    `        ${r.storeName ?? 'RECEIPT'}`,
    `  ${new Date(r.timestamp ?? Date.now()).toLocaleString()} · ${r.cashier ?? ''}`,
    '--------------------------------',
    ...(r.lines ?? []).map((l) => `${l.qty}x ${l.name}  ${money(l.lineTotal)}`),
    '--------------------------------',
    `Subtotal  ${money(r.subtotal)}`,
    ...(r.discount > 0 ? [`Discount (${r.discountPct}%)  -${money(r.discount)}`] : []),
    `Tax  ${money(r.tax)}`,
    `TOTAL  ${money(r.total)}`,
    `${r.tender === 'cash' ? 'Cash' : 'Card'}  ${money(r.total)}`,
    ...(r.tender === 'cash' && r.amountTendered != null
      ? [`Tendered  ${money(r.amountTendered)}`, `CHANGE  ${money(r.amountTendered - r.total)}`]
      : []),
    ...(r.idChecked ? ['ID VERIFIED (21+)'] : []),
    '        Thank you!',
  ]
  return lines.join('\n')
}

// ---- routes ------------------------------------------------------------------
app.get('/health', async (_req, res) => {
  if (!PRINTER_INTERFACE) return res.json({ ok: true, printer: 'simulation' })
  try {
    const printer = await getPrinter()
    const connected = await printer.isPrinterConnected()
    res.json({ ok: true, printer: connected ? 'connected' : 'offline' })
  } catch (e) {
    res.json({ ok: true, printer: 'offline', error: String(e?.message ?? e) })
  }
})

app.post('/print-receipt', async (req, res) => {
  const r = req.body ?? {}
  try {
    const printer = await getPrinter()
    if (!printer) {
      console.log('[simulated receipt]\n' + receiptText(r))
      return res.json({ ok: true, simulated: true })
    }
    printer.clear()
    printer.alignCenter()
    printer.bold(true)
    printer.println(r.storeName ?? 'RECEIPT')
    printer.bold(false)
    printer.println(new Date(r.timestamp ?? Date.now()).toLocaleString())
    if (r.cashier) printer.println(`Cashier: ${r.cashier}`)
    printer.drawLine()
    printer.alignLeft()
    for (const l of r.lines ?? []) {
      printer.leftRight(`${l.qty}x ${l.name}`.slice(0, 32), money(l.lineTotal))
    }
    printer.drawLine()
    printer.leftRight('Subtotal', money(r.subtotal))
    if (r.discount > 0) printer.leftRight(`Discount (${r.discountPct}%)`, `-${money(r.discount)}`)
    printer.leftRight('Tax', money(r.tax))
    printer.bold(true)
    printer.leftRight('TOTAL', money(r.total))
    printer.bold(false)
    printer.leftRight(r.tender === 'cash' ? 'Cash' : 'Card', money(r.total))
    if (r.tender === 'cash' && r.amountTendered != null) {
      printer.leftRight('Tendered', money(r.amountTendered))
      printer.leftRight('CHANGE', money(r.amountTendered - r.total))
    }
    if (r.idChecked) printer.println('ID VERIFIED (21+)')
    printer.alignCenter()
    printer.println('Thank you!')
    printer.cut()
    await printer.execute()
    res.json({ ok: true })
  } catch (e) {
    console.error('print failed:', e)
    res.status(500).json({ ok: false, error: String(e?.message ?? e) })
  }
})

app.post('/open-drawer', async (req, res) => {
  try {
    const printer = await getPrinter()
    if (!printer) {
      console.log(`[simulated drawer kick] reason=${req.body?.reason ?? 'sale'}`)
      return res.json({ ok: true, simulated: true })
    }
    printer.clear()
    printer.openCashDrawer() // ESC p — kick pulse through the printer's RJ11/12 port
    await printer.execute()
    res.json({ ok: true })
  } catch (e) {
    console.error('drawer kick failed:', e)
    res.status(500).json({ ok: false, error: String(e?.message ?? e) })
  }
})

// Loopback only — never expose this to the LAN.
app.listen(PORT, '127.0.0.1', () => {
  console.log(
    `TransactIQ bridge on http://127.0.0.1:${PORT} · printer: ${PRINTER_INTERFACE || 'SIMULATION (set PRINTER_INTERFACE to go live)'}`,
  )
})
