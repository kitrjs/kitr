import type {
  BiometricsDriver,
  CameraDriver,
  ClipboardDriver,
  GeolocationDriver,
  HapticKind,
  HapticsDriver,
  NativeConfig,
  ShareDriver,
  SharePayload,
} from '../index'

/* ----------------------------------------------------------------------------
 * Memory drivers (tests, server)
 * ------------------------------------------------------------------------- */

/**
 * In-memory drivers for all six capabilities, for tests and the server. `shared` and `haptics_log`
 * record what was shared and played; pass overrides to replace any driver.
 */
export function createMemoryNativeDrivers(overrides: NativeConfig['drivers'] = {}) {
  let clip = ''
  const shared: SharePayload[] = []
  const haptics: HapticKind[] = []
  return {
    clipboard: {
      readText: async () => clip,
      writeText: async (t) => {
        clip = t
      },
    } as ClipboardDriver,
    share: {
      canShare: () => true,
      share: async (p) => {
        shared.push(p)
        return true
      },
    } as ShareDriver,
    haptics: {
      impact: async (k) => {
        haptics.push(k)
      },
    } as HapticsDriver,
    geolocation: {
      current: async () => ({ latitude: 0, longitude: 0, accuracy: 1, timestamp: Date.now() }),
      watch: () => () => {},
    } as GeolocationDriver,
    camera: { capture: async () => null } as CameraDriver,
    biometrics: { available: async () => true, authenticate: async () => true } as BiometricsDriver,
    shared,
    haptics_log: haptics,
    ...overrides,
  }
}
