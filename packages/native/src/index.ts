import { createDefineConfig, getDevtools, type KitrApp } from '@kitr/core'

/**
 * Device capabilities behind one API: clipboard, share sheet, haptics, geolocation, camera and
 * biometrics. Each is its own capability, so a platform package can replace one without touching
 * the others; the web drivers use the matching browser API and report `supported: false` elsewhere.
 */

export interface ClipboardDriver {
  readText(): Promise<string>
  writeText(text: string): Promise<void>
}

export interface SharePayload {
  title?: string
  text?: string
  url?: string
  files?: File[]
}

export interface ShareDriver {
  canShare(payload: SharePayload): boolean
  /** Resolves to true when shared, false when dismissed. */
  share(payload: SharePayload): Promise<boolean>
}

export type HapticKind =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error'
  | 'selection'

export interface HapticsDriver {
  impact(kind: HapticKind): Promise<void>
}

export interface Position {
  latitude: number
  longitude: number
  accuracy: number
  altitude?: number | null
  heading?: number | null
  speed?: number | null
  timestamp: number
}

export interface GeolocationDriver {
  current(options?: { highAccuracy?: boolean; timeout?: number }): Promise<Position>
  watch(listener: (position: Position) => void, options?: { highAccuracy?: boolean }): () => void
}

export interface Photo {
  blob: Blob
  type: string
  /** Where the image came from. */
  source: 'camera' | 'library'
}

export interface CameraDriver {
  /** Take a photo (or, on the web, open the capture-enabled file input). */
  capture(options?: { source?: 'camera' | 'library'; quality?: number }): Promise<Photo | null>
}

export interface BiometricsDriver {
  /** Whether the device has an enrolled biometric or device credential. */
  available(): Promise<boolean>
  /** Prompt; resolves to true on success, false when cancelled or failed. */
  authenticate(options?: { reason?: string }): Promise<boolean>
}

export interface Capability<T> {
  supported: boolean
  driver: T
  name: string
}

export interface Native {
  clipboard: Capability<ClipboardDriver> & ClipboardDriver
  share: Capability<ShareDriver> & ShareDriver
  haptics: Capability<HapticsDriver> & HapticsDriver
  geolocation: Capability<GeolocationDriver> & GeolocationDriver
  camera: Capability<CameraDriver> & CameraDriver
  biometrics: Capability<BiometricsDriver> & BiometricsDriver
  /** Which capabilities have a working driver, for devtools and feature gating. */
  supported(): Record<NativeCapability, boolean>
}

export type NativeCapability =
  | 'clipboard'
  | 'share'
  | 'haptics'
  | 'geolocation'
  | 'camera'
  | 'biometrics'

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

export const defineConfig = createDefineConfig<NativeConfig>()

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

export function webClipboard(): ClipboardDriver | null {
  if (!hasWindow() || !navigator.clipboard) return null
  return {
    readText: () => navigator.clipboard.readText(),
    writeText: (text) => navigator.clipboard.writeText(text),
  }
}

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

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  selection: 5,
  success: [15, 40, 15],
  warning: [30, 60, 30],
  error: [50, 50, 50, 50, 50],
}

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

export function useNative(app: KitrApp): Native {
  return app.container.use('native')
}
