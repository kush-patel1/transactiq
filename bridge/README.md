# TransactIQ hardware bridge

A tiny local service that lets the TransactIQ web app print receipts and kick
the cash drawer. Runs on the register PC, listens on `127.0.0.1:9420` only
(unreachable from the rest of the store's network).

## Run

```bash
cd bridge
npm install
npm start                                        # simulation mode — receipts log to console
PRINTER_INTERFACE="tcp://192.168.1.87" npm start # real network thermal printer
PRINTER_INTERFACE="printer:EPSON TM-T20III" npm start # OS print queue
```

The cash drawer needs no config of its own — it's cabled into the receipt
printer (RJ11/RJ12) and opens via the standard ESC/POS kick command.

## API

| Route | Method | Purpose |
|---|---|---|
| `/health` | GET | `{ ok, printer: 'simulation' \| 'connected' \| 'offline' }` |
| `/print-receipt` | POST | Receipt JSON → paper (both cash + card sales) |
| `/open-drawer` | POST | Drawer kick (cash sales only — the app enforces this) |

CORS allows only the deployed app origin and local dev. The app treats every
bridge failure as **non-blocking**: sales always complete; you just get a
"printer offline" warning at the register.

## Packaging (later)

Target: an Electron tray app (green/red printer dot, start-on-login,
double-click installer) so a store owner never sees a terminal.
