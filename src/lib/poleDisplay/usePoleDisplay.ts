import { useCallback, useEffect, useRef, useState } from 'react'
import { PROTOCOLS, type PoleProtocol } from './protocols'
import { loadDeviceSettings, saveDeviceSettings } from '../deviceSettings'

// Drives a serial VFD customer display via WebSerial (Chrome/Edge).
// Design rules:
//  - a display glitch must NEVER block or crash a sale — every write is
//    caught into `lastError`, and showLines() is a safe no-op when offline
//  - first-time connect() must be called from a click (browser requirement
//    for navigator.serial.requestPort())
//  - previously-granted ports reconnect automatically on mount, no re-prompt
//  - writes are debounced so rapid cart taps don't flood a 9600-baud link

export interface PoleDisplayState {
  supported: boolean
  connected: boolean
  connecting: boolean
  protocol: PoleProtocol
  setProtocol: (p: PoleProtocol) => void
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  showLines: (line1: string, line2: string) => void
  lastError: string | null
}

const DEBOUNCE_MS = 200

export function usePoleDisplay(): PoleDisplayState {
  const supported = typeof navigator !== 'undefined' && 'serial' in navigator
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [protocol, setProtocolState] = useState<PoleProtocol>(
    () => loadDeviceSettings().poleProtocol,
  )

  const portRef = useRef<SerialPort | null>(null)
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null)
  const pending = useRef<{ l1: string; l2: string } | null>(null)
  const timer = useRef<number | null>(null)
  const protocolRef = useRef(protocol)
  protocolRef.current = protocol

  const teardown = useCallback(async () => {
    try {
      writerRef.current?.releaseLock()
    } catch { /* already released */ }
    writerRef.current = null
    try {
      await portRef.current?.close()
    } catch { /* already closed */ }
    portRef.current = null
    setConnected(false)
  }, [])

  const openPort = useCallback(async (port: SerialPort) => {
    const { poleBaudRate } = loadDeviceSettings()
    await port.open({ baudRate: poleBaudRate, dataBits: 8, stopBits: 1, parity: 'none' })
    if (!port.writable) throw new Error('port is not writable')
    portRef.current = port
    writerRef.current = port.writable.getWriter()
    setConnected(true)
    setLastError(null)
  }, [])

  // Reconnect to a previously-granted port without prompting.
  useEffect(() => {
    if (!supported) return
    let cancelled = false
    navigator.serial!.getPorts().then(async (ports) => {
      if (cancelled || ports.length !== 1 || portRef.current) return
      try {
        await openPort(ports[0])
      } catch {
        // port unplugged or held by another app — user can hit Connect
      }
    })
    return () => {
      cancelled = true
      void teardown()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported])

  const connect = useCallback(async () => {
    if (!supported || connecting) return
    setConnecting(true)
    setLastError(null)
    try {
      const port = await navigator.serial!.requestPort()
      await openPort(port)
    } catch (e) {
      // user dismissed the picker, or the port failed to open
      setLastError(e instanceof Error ? e.message : 'could not open display')
    } finally {
      setConnecting(false)
    }
  }, [supported, connecting, openPort])

  const disconnect = useCallback(async () => {
    await teardown()
  }, [teardown])

  const flush = useCallback(async () => {
    const msg = pending.current
    pending.current = null
    const writer = writerRef.current
    if (!msg || !writer) return
    try {
      const cmds = PROTOCOLS[protocolRef.current]
      await writer.write(cmds.clear())
      await writer.write(cmds.writeLine1(msg.l1))
      await writer.write(cmds.writeLine2(msg.l2))
    } catch (e) {
      setLastError(e instanceof Error ? e.message : 'display write failed')
      await teardown() // unplugged mid-write — drop to disconnected cleanly
    }
  }, [teardown])

  const showLines = useCallback(
    (line1: string, line2: string) => {
      pending.current = { l1: line1, l2: line2 }
      if (!writerRef.current) return // no hardware — preview still renders
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        timer.current = null
        void flush()
      }, DEBOUNCE_MS)
    },
    [flush],
  )

  const setProtocol = useCallback((p: PoleProtocol) => {
    setProtocolState(p)
    saveDeviceSettings({ poleProtocol: p })
  }, [])

  return {
    supported,
    connected,
    connecting,
    protocol,
    setProtocol,
    connect,
    disconnect,
    showLines,
    lastError,
  }
}
