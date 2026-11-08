import { createDefineConfig, getDevtools, type KitrApp } from '@kitr/core'

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

const hasWindow = () => typeof window !== 'undefined' && typeof navigator !== 'undefined'

/* ----------------------------------------------------------------------------
 * Web drivers
 * ------------------------------------------------------------------------- */

/** Clipboard driver on the Clipboard API. Null where `navigator.clipboard` is missing (no HTTPS, no browser). */
export function webClipboard(): ClipboardDriver | null {
  if (!hasWindow() || !navigator.clipboard) return null
  return {
    readText: () => navigator.clipboard.readText(),
    writeText: (text) => navigator.clipboard.writeText(text),
  }
}

/** Share driver on Web Share. Resolves false when dismissed; null where `navigator.share` is missing. */
export function webShare(): ShareDriver | null {
  if (!hasWindow() || typeof navigator.share !== 'function') return null
  return {
    canShare: (payload) =>
      navigator.canShare ? navigator.canShare(payload) : !payload.files?.length,
    async share(payload) {
      try {
        await navigator.share(payload)
        return true
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return false
        throw error
      }
    },
  }
}

// kitr-allow-module-state: lookup table built once at import, never mutated
const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  selection: 5,
  success: [15, 40, 15],
  warning: [30, 60, 30],
  error: [50, 50, 50, 50, 50],
}

/** Haptics driver that maps each kind to a `navigator.vibrate` pattern. Null where vibration is missing. */
export function webHaptics(): HapticsDriver | null {
  if (!hasWindow() || typeof navigator.vibrate !== 'function') return null
  return {
    impact: async (kind) => {
      navigator.vibrate(PATTERNS[kind])
    },
  }
}

function toPosition(p: GeolocationPosition): Position {
  return {
    latitude: p.coords.latitude,
    longitude: p.coords.longitude,
    accuracy: p.coords.accuracy,
    altitude: p.coords.altitude,
    heading: p.coords.heading,
    speed: p.coords.speed,
    timestamp: p.timestamp,
  }
}

/** Geolocation driver on the browser Geolocation API. Null where `navigator.geolocation` is missing. */
export function webGeolocation(): GeolocationDriver | null {
  if (!hasWindow() || !navigator.geolocation) return null
  return {
    current: (options = {}) =>
      new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition((p) => resolve(toPosition(p)), reject, {
          enableHighAccuracy: options.highAccuracy,
          timeout: options.timeout,
        }),
      ),
    watch: (listener, options = {}) => {
      const id = navigator.geolocation.watchPosition((p) => listener(toPosition(p)), undefined, {
        enableHighAccuracy: options.highAccuracy,
      })
      return () => navigator.geolocation.clearWatch(id)
    },
  }
}

/**
 * Camera driver that opens a hidden image file input, with `capture` for the camera source.
 * Resolves null when cancelled; null itself only where there is no `document`.
 */
export function webCamera(): CameraDriver | null {
  if (typeof document === 'undefined') return null
  return {
    capture: (options = {}) =>
      new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        if (options.source !== 'library') input.setAttribute('capture', 'environment')
        input.style.display = 'none'
        input.onchange = () => {
          const file = input.files?.[0]
          resolve(file ? { blob: file, type: file.type, source: options.source ?? 'camera' } : null)
          input.remove()
        }
        input.oncancel = () => {
          resolve(null)
          input.remove()
        }
        document.body.appendChild(input)
        input.click()
      }),
  }
}

/**
 * WebAuthn user verification with a platform authenticator (Touch ID, Windows Hello, Android
 * screen lock). The first call registers a device-only credential for this site (that prompt is
 * itself the check); later calls ask for that credential by id, so people without a passkey get
 * the fingerprint or PIN prompt rather than an empty passkey picker. A local presence check, like
 * the native ones: to prove identity to your server, verify a WebAuthn assertion there.
 */
export function webBiometrics(options: { storageKey?: string } = {}): BiometricsDriver | null {
  if (!hasWindow() || typeof PublicKeyCredential === 'undefined') return null
  const key = options.storageKey ?? 'kitr:biometrics:credential'
  const store = {
    get: () => {
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    },
    set: (value: string | null) => {
      try {
        if (value === null) localStorage.removeItem(key)
        else localStorage.setItem(key, value)
      } catch {}
    },
  }
  const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  const fromB64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))
  const challenge = () => crypto.getRandomValues(new Uint8Array(32))
  const cancelled = (error: unknown) =>
    error instanceof Error && (error.name === 'NotAllowedError' || error.name === 'AbortError')
  return {
    available: () =>
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.().catch(() => false) ??
      Promise.resolve(false),
    async authenticate() {
      const id = store.get()
      try {
        if (id) {
          const credential = await navigator.credentials.get({
            publicKey: {
              challenge: challenge(),
              allowCredentials: [{ type: 'public-key', id: fromB64(id) }],
              userVerification: 'required',
              timeout: 60_000,
            },
          })
          return credential !== null
        }
        const created = (await navigator.credentials.create({
          publicKey: {
            challenge: challenge(),
            rp: { name: document.title || location.hostname },
            user: {
              id: crypto.getRandomValues(new Uint8Array(16)),
              name: 'device-unlock',
              displayName: 'This device',
            },
            pubKeyCredParams: [
              { type: 'public-key', alg: -7 },
              { type: 'public-key', alg: -257 },
            ],
            authenticatorSelection: {
              authenticatorAttachment: 'platform',
              userVerification: 'required',
              residentKey: 'discouraged',
            },
            timeout: 60_000,
          },
        })) as PublicKeyCredential | null
        if (!created) return false
        store.set(toB64(created.rawId))
        return true
      } catch (error) {
        // A stored credential the device no longer has: forget it so the next call registers anew.
        if (id && !cancelled(error)) store.set(null)
        return false
      }
    },
  }
}

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
 * registered on `app`, else the web driver, else an unsupported stand-in.
 */
export function createNative(config: NativeConfig = {}, app?: KitrApp): Native {
  const pick = <K extends NativeCapability>(key: K, web: () => DriverTypesOf<K> | null) => {
    const configured = config.drivers?.[key] as DriverTypesOf<K> | undefined
    if (configured) return capability<DriverTypesOf<K>>(key, configured, 'configured')
    const registered = app?.drivers.describe(key)
    if (registered)
      return capability<DriverTypesOf<K>>(
        key,
        registered.driver as DriverTypesOf<K>,
        registered.platform ?? 'native',
      )
    return capability<DriverTypesOf<K>>(key, web(), 'web')
  }
  const native: Native = {
    clipboard: pick('clipboard', webClipboard),
    share: pick('share', webShare),
    haptics: pick('haptics', webHaptics),
    geolocation: pick('geolocation', webGeolocation),
    camera: pick('camera', webCamera),
    biometrics: pick('biometrics', webBiometrics),
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
