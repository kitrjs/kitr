import type {
  BiometricsDriver,
  CameraDriver,
  ClipboardDriver,
  GeolocationDriver,
  HapticKind,
  HapticsDriver,
  Position,
  ShareDriver,
} from '../index'

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
