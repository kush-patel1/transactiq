import type { PoleProtocol } from './poleDisplay/protocols'

// Hardware preferences are per-machine/browser (a serial-port permission is
// physically tied to one register PC), so they live in their own localStorage
// key — deliberately NOT in the business-data AppState that will eventually
// sync to Firestore.

const KEY = 'transactiq-device-settings'

export interface DeviceSettings {
  poleProtocol: PoleProtocol
  poleBaudRate: number
}

const DEFAULTS: DeviceSettings = {
  poleProtocol: 'cd5220',
  poleBaudRate: 9600,
}

export function loadDeviceSettings(): DeviceSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<DeviceSettings>) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveDeviceSettings(patch: Partial<DeviceSettings>): DeviceSettings {
  const next = { ...loadDeviceSettings(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage blocked — settings just won't persist this session
  }
  return next
}
