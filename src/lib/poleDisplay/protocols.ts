// Command-byte builders for 2x20 VFD customer pole displays (e.g. SAM4S).
// These units DIP-switch between two industry-standard command sets; which one
// a given unit speaks is a physical setting on the device, so it's a runtime
// config toggle here, not a code branch.
//
// ⚠️ BRING-UP NOTE: the exact byte sequences below are the common dialects of
// each command set, written from protocol documentation — they MUST be
// confirmed against the physical unit (serial terminal at 9600 8N1) before
// first real deployment. Everything outside this file is byte-agnostic, so
// fixing them is a one-file change.

export type PoleProtocol = 'cd5220' | 'epson'

export interface PoleCommandSet {
  /** wipe both lines */
  clear(): Uint8Array
  /** write a full 20-char upper line */
  writeLine1(text: string): Uint8Array
  /** write a full 20-char lower line */
  writeLine2(text: string): Uint8Array
}

const enc = (s: string) => new TextEncoder().encode(s)
const pad20 = (s: string) => s.slice(0, 20).padEnd(20, ' ')
const cat = (...parts: (Uint8Array | number[])[]) => {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) {
    out.set(p instanceof Uint8Array ? p : new Uint8Array(p), o)
    o += p.length
  }
  return out
}

const ESC = 0x1b
const CLR = 0x0c
const CR = 0x0d

// CD5220 / "UTC standard" mode — the most common pole-display default.
// String mode: ESC 'Q' 'A' <text> CR writes the upper line,
//              ESC 'Q' 'B' <text> CR writes the lower line. CLR clears.
const cd5220: PoleCommandSet = {
  clear: () => cat([CLR]),
  writeLine1: (t) => cat([ESC, 0x51, 0x41], enc(pad20(t)), [CR]),
  writeLine2: (t) => cat([ESC, 0x51, 0x42], enc(pad20(t)), [CR]),
}

// Epson ESC/POS display mode (some units ship switched to this instead).
// US '$' col row (1-based) moves the cursor; text writes at the cursor.
const epson: PoleCommandSet = {
  clear: () => cat([CLR]),
  writeLine1: (t) => cat([0x1f, 0x24, 0x01, 0x01], enc(pad20(t))),
  writeLine2: (t) => cat([0x1f, 0x24, 0x01, 0x02], enc(pad20(t))),
}

export const PROTOCOLS: Record<PoleProtocol, PoleCommandSet> = { cd5220, epson }

export const PROTOCOL_LABELS: Record<PoleProtocol, string> = {
  cd5220: 'CD5220 / UTC (common default)',
  epson: 'Epson ESC/POS',
}

// Format a 20-char display line with a left label and right-aligned value,
// e.g. fmt20('1 Bud Light 30-pack', '$22.99') -> '1 Bud Light… $22.99'
export function fmt20(left: string, right = ''): string {
  if (!right) return pad20(left)
  const room = 20 - right.length - 1
  return `${left.slice(0, Math.max(0, room)).padEnd(Math.max(0, room), ' ')} ${right}`.slice(0, 20)
}
