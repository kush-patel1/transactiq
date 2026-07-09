import { useEffect, useRef } from 'react'

// Scan-anywhere: a USB barcode scanner is just a very fast keyboard.
// Buffers rapid digit keystrokes ending in Enter — no field focus needed.
// Keystrokes landing in an input/select/textarea are left alone (the field's
// own handlers deal with them, e.g. the search box's Enter handler).
export function useBarcodeScan(onScan: (code: string) => void) {
  const cb = useRef(onScan)
  cb.current = onScan // always call the latest closure — no stale state
  const buf = useRef({ s: '', last: 0 })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const b = buf.current
      const now = Date.now()
      if (now - b.last > 250) b.s = '' // human-speed gap → not a scanner
      b.last = now
      if (e.key === 'Enter') {
        if (b.s.length >= 6) cb.current(b.s)
        b.s = ''
      } else if (/^\d$/.test(e.key)) {
        b.s += e.key
      } else {
        b.s = ''
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
