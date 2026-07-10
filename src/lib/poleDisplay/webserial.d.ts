// Minimal WebSerial API surface (Chrome/Edge). TypeScript's lib.dom doesn't
// ship these yet; declaring just what we use avoids a types-package dependency.

interface SerialPortOpenOptions {
  baudRate: number
  dataBits?: number
  stopBits?: number
  parity?: 'none' | 'even' | 'odd'
}

interface SerialPort {
  open(options: SerialPortOpenOptions): Promise<void>
  close(): Promise<void>
  readonly writable: WritableStream<Uint8Array> | null
}

interface Serial {
  requestPort(): Promise<SerialPort>
  getPorts(): Promise<SerialPort[]>
}

interface Navigator {
  readonly serial?: Serial
}
