import { createDefineConfig, getDevtools, type KitrApp } from '@kitr/core'
import { runtimeOf } from '@kitr/platform'
import { type Driver, selectDriver } from './driver'

export { type Driver, type DriverOptions, selectDriver } from './driver'
export {
  capacitorClipboard,
  capacitorGeolocation,
  capacitorHaptics,
  capacitorShare,
  createCapacitorDriver as createCapacitorNativeDrivers,
} from './drivers/capacitor'
  createElectronDriver as createElectronNativeDriver,
  type DesktopSystem,
  type ElectronNativeDriver,
  type PowerEvent,
} from './drivers/electron'
export { createMemoryNativeDrivers } from './drivers/memory'
export {
  createTauriDriver as createTauriNativeDriver,
  type TauriNativeDriver,
} from './drivers/tauri'
export {
  webBiometrics,
  webCamera,
  webClipboard,
  webGeolocation,
  webHaptics,
  webShare,
} from './drivers/web'

/**
 * Device capabilities behind one API: clipboard, share sheet, haptics, geolocation, camera and
 * biometrics. Each is its own capability, so a platform package can replace one without touching
 * the others; the web drivers use the matching browser API and report `supported: false` elsewhere.
 */

/** Reads and writes plain text on the system clipboard. */
export interface ClipboardDriver {
  /** Resolves to the clipboard's text. Browsers ask permission first and reject when refused. */
  readText(): Promise<string>
  /** Puts `text` on the clipboard. On the web, call it from a click or key press. */
  writeText(text: string): Promise<void>
}

/** What to hand to the share sheet. Every field is optional; most targets use `url` or `text`. */
export interface SharePayload {
  /** Title shown by targets that have one, such as an email subject. */
  title?: string
  /** Body text. */
  text?: string
  /** A link to share. */
  url?: string
  /** Files to share. Check `canShare({ files })` first: not every device shares files. */
  files?: File[]
}

/** Opens the system share sheet. */
export interface ShareDriver {
  /** Whether this payload can be shared here, so a share button can hide itself. */
  canShare(payload: SharePayload): boolean
  /** Resolves to true when shared, false when dismissed. */
  share(payload: SharePayload): Promise<boolean>
}

/** The feel of a haptic: three impact strengths, three outcomes and a selection tick. */
export type HapticKind =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error'
  | 'selection'

/** Plays haptic feedback (a vibration pattern on the web). */
export interface HapticsDriver {
  /** Play the feedback for `kind`. */
  impact(kind: HapticKind): Promise<void>
}

/** A location fix, in the shape of the browser's `GeolocationCoordinates` plus its time. */
export interface Position {
  /** Degrees north of the equator. */
  latitude: number
  /** Degrees east of Greenwich. */
  longitude: number
  /** Radius of uncertainty, in metres. */
  accuracy: number
  /** Metres above sea level, or null when unknown. */
  altitude?: number | null
  /** Direction of travel in degrees from north, or null when unknown. */
  heading?: number | null
  /** Metres per second, or null when unknown. */
  speed?: number | null
  /** When the fix was taken, in milliseconds since the epoch. */
  timestamp: number
}

/** Reads the device's location once or continuously. */
export interface GeolocationDriver {
  /** Resolve the current position. `highAccuracy` asks for GPS; `timeout` is in milliseconds. */
  current(options?: { highAccuracy?: boolean; timeout?: number }): Promise<Position>
  /** Call `listener` with each new position until the returned function is called. */
  watch(listener: (position: Position) => void, options?: { highAccuracy?: boolean }): () => void
}

/** A photo taken with the camera or picked from the library. */
export interface Photo {
  /** The image data (a `File` on the web). */
  blob: Blob
  /** Its MIME type, such as `image/jpeg`. */
  type: string
  /** Where the image came from. */
  source: 'camera' | 'library'
}

/** Takes or picks a photo. */
export interface CameraDriver {
  /** Take a photo (or, on the web, open the capture-enabled file input). */
  capture(options?: { source?: 'camera' | 'library'; quality?: number }): Promise<Photo | null>
}

/** Asks for a fingerprint, face or device PIN to confirm someone is at the device. */
export interface BiometricsDriver {
  /** Whether the device has an enrolled biometric or device credential. */
  available(): Promise<boolean>
  /** Prompt; resolves to true on success, false when cancelled or failed. */
  authenticate(options?: { reason?: string }): Promise<boolean>
}

/** What every capability on the `native` service carries next to its driver's methods. */
export interface Capability<T> {
  /** True when a driver exists for this capability here. */
  supported: boolean
  /** The active driver (a stand-in that rejects with `UnsupportedError` when unsupported). */
  driver: T
  /** Where the driver came from: `configured`, the registering platform, `native`, `web` or `unsupported`. */
  name: string
}

/** The `native` service: six device capabilities, each with its methods and its `supported` flag. */
export interface Native {
  /** Read and write the clipboard. */
  clipboard: Capability<ClipboardDriver> & ClipboardDriver
  /** Open the share sheet. */
  share: Capability<ShareDriver> & ShareDriver
  /** Play haptic feedback. */
  haptics: Capability<HapticsDriver> & HapticsDriver
  /** Read or follow the device's location. */
  geolocation: Capability<GeolocationDriver> & GeolocationDriver
  /** Take or pick a photo. */
  camera: Capability<CameraDriver> & CameraDriver
  /** Confirm presence with a fingerprint, face or device PIN. */
  biometrics: Capability<BiometricsDriver> & BiometricsDriver
  /** Which capabilities have a working driver, for devtools and feature gating. */
  supported(): Record<NativeCapability, boolean>
}

/** The name of one of the six capabilities, as used in `supported()` and `app.drivers.register()`. */
export type NativeCapability =
  | 'clipboard'
  | 'share'
  | 'haptics'
  | 'geolocation'
  | 'camera'
  | 'biometrics'

/** Options for `config/native.ts` and `createNative()`. */
export interface NativeConfig {
  /** Replace individual drivers (tests, custom hardware). */
  drivers?: Partial<{
    clipboard: ClipboardDriver
    share: ShareDriver
    haptics: HapticsDriver
    geolocation: GeolocationDriver
    camera: CameraDriver
    biometrics: BiometricsDriver
  }>
  /**
   * In a native shell (Electron, Tauri, Capacitor) with no native drivers, use the web drivers
   * inside the WebView instead of throwing `E_DRIVER_UNAVAILABLE`. Default false.
   */
  fallbackToWeb?: boolean
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    native: NativeConfig
  }
  interface ContainerBindings {
    native: Native
  }
  interface DriverTypes {
    clipboard: ClipboardDriver
    share: ShareDriver
    haptics: HapticsDriver
    geolocation: GeolocationDriver
    camera: CameraDriver
    biometrics: BiometricsDriver
  }
}

/** Types `config/native.ts`. Returns the object unchanged. */
export const defineConfig = createDefineConfig<NativeConfig>()

/** Thrown when a method is called on a capability that has no driver here. `capability` names it. */
export class UnsupportedError extends Error {
  constructor(public capability: NativeCapability) {
    super(`kitr/native: ${capability} is not supported on this platform`)
    this.name = 'UnsupportedError'
  }
}

/* ----------------------------------------------------------------------------
 * Service
 * ------------------------------------------------------------------------- */

function capability<T extends object>(
  name: NativeCapability,
  driver: T | null | undefined,
  label: string,
): Capability<T> & T {
  const unsupported = new Proxy({} as T, {
    get: (_, prop) => {
      if (prop === 'canShare') return () => false
      if (prop === 'available') return async () => false
      if (prop === 'watch') return () => () => {}
      return async () => {
        throw new UnsupportedError(name)
      }
    },
  })
  const target = (driver ?? unsupported) as T
  const meta: Capability<T> = {
    supported: driver != null,
    driver: target,
    name: driver ? label : 'unsupported',
  }
  // Methods run with the driver as `this`, so class-based platform drivers (private fields,
  // `this.native`) work through the wrapper.
  return new Proxy(target as object, {
    get(t, prop) {
      if (prop in meta) return meta[prop as keyof Capability<T>]
      const value = Reflect.get(t, prop)
      return typeof value === 'function' ? value.bind(t) : value
    },
    has: (t, prop) => prop in meta || Reflect.has(t, prop),
    ownKeys: (t) => [...new Set([...Reflect.ownKeys(t), ...Object.keys(meta)])],
    getOwnPropertyDescriptor: (t, prop) =>
      prop in meta
        ? { value: meta[prop as keyof Capability<T>], enumerable: true, configurable: true }
        : Reflect.getOwnPropertyDescriptor(t, prop),
  }) as Capability<T> & T
}

/**
 * Build the `native` service. Per capability it uses `config.drivers`, else the driver a platform
 * registered on `app`, else the one `selectDriver()` picks for the runtime (the web drivers in a
 * browser; in a native shell `E_DRIVER_UNAVAILABLE` unless `fallbackToWeb` is set), else an
 * unsupported stand-in.
 */
export function createNative(config: NativeConfig = {}, app?: KitrApp): Native {
  // Only asked for when some capability has neither a configured nor a registered driver.
  let selected: Driver | undefined
  const runtimeDriver = () =>
    (selected ??= selectDriver(runtimeOf(app), { fallbackToWeb: config.fallbackToWeb }))
  const pick = <K extends NativeCapability>(key: K) => {
    const configured = config.drivers?.[key] as DriverTypesOf<K> | undefined
    if (configured) return capability<DriverTypesOf<K>>(key, configured, 'configured')
    const registered = app?.drivers.describe(key)
    if (registered)
      return capability<DriverTypesOf<K>>(
        key,
        registered.driver as DriverTypesOf<K>,
        registered.platform ?? 'native',
      )
    const driver = runtimeDriver()
    return capability<DriverTypesOf<K>>(key, driver[key] as DriverTypesOf<K> | null, driver.name)
  }
  const native: Native = {
    clipboard: pick('clipboard'),
    share: pick('share'),
    haptics: pick('haptics'),
    geolocation: pick('geolocation'),
    camera: pick('camera'),
    biometrics: pick('biometrics'),
    supported: () => ({
      clipboard: native.clipboard.supported,
      share: native.share.supported,
      haptics: native.haptics.supported,
      geolocation: native.geolocation.supported,
      camera: native.camera.supported,
      biometrics: native.biometrics.supported,
    }),
  }
  if (app) getDevtools(app)?.log('native', 'capabilities', native.supported())
  return native
}

type DriverTypesOf<K extends NativeCapability> = {
  clipboard: ClipboardDriver
  share: ShareDriver
  haptics: HapticsDriver
  geolocation: GeolocationDriver
  camera: CameraDriver
  biometrics: BiometricsDriver
}[K]

/** The app's `native` service, outside React. Same as `app.container.use('native')`. */
export function useNative(app: KitrApp): Native {
  return app.container.use('native')
}
