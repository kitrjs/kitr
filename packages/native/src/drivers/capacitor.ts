import { driverUnavailable } from '@kitr/platform'
import type { Driver, DriverOptions } from '../driver'
import type {
  ClipboardDriver,
  GeolocationDriver,
  HapticKind,
  HapticsDriver,
  Position,
  ShareDriver,
} from '../index'

/**
 * Import one Capacitor plugin on first use, so web bundles never load it. A plugin that is not
 * installed turns into `E_DRIVER_UNAVAILABLE` naming the package to install, instead of a bare
 * module-resolution error from inside the WebView.
 */
async function plugin<T>(pkg: string, load: () => Promise<T>): Promise<T> {
  try {
    return await load()
  } catch {
    throw driverUnavailable('capacitor', 'native', `install ${pkg}`)
  }
}

const clipboardPlugin = () =>
  plugin('@capacitor/clipboard', () => import('@capacitor/clipboard')).then((m) => m.Clipboard)
const sharePlugin = () =>
  plugin('@capacitor/share', () => import('@capacitor/share')).then((m) => m.Share)
const hapticsModule = () => plugin('@capacitor/haptics', () => import('@capacitor/haptics'))
const geolocationPlugin = () =>
  plugin('@capacitor/geolocation', () => import('@capacitor/geolocation')).then(
    (m) => m.Geolocation,
  )

/** Clipboard on `@capacitor/clipboard`: the OS pasteboard, with no permission prompt. */
export function capacitorClipboard(): ClipboardDriver {
  return {
    async readText() {
      const { value } = await (await clipboardPlugin()).read()
      return value ?? ''
    },
    async writeText(text) {
      await (await clipboardPlugin()).write({ string: text })
    },
  }
}

/**
 * Share sheet on `@capacitor/share`. Resolves false when dismissed. `File` objects cannot cross the
 * bridge, so a payload with `files` is not shareable here: save the file with `@kitr/files` and share its `url`.
 */
export function capacitorShare(): ShareDriver {
  return {
    canShare: (payload) => !payload.files?.length,
    async share(payload) {
      const Share = await sharePlugin()
      try {
        await Share.share({ title: payload.title, text: payload.text, url: payload.url })
        return true
      } catch (error) {
        // Dismissing the sheet rejects with "Share canceled" on both platforms.
        if (error instanceof Error && /cancel/i.test(error.message)) return false
        throw error
      }
    },
  }
}

/** Haptics on `@capacitor/haptics`: the Taptic Engine on iOS, the vibrator on Android. */
export function capacitorHaptics(): HapticsDriver {
  return {
    async impact(kind: HapticKind) {
      const { Haptics, ImpactStyle, NotificationType } = await hapticsModule()
      switch (kind) {
        case 'light':
          return Haptics.impact({ style: ImpactStyle.Light })
        case 'medium':
          return Haptics.impact({ style: ImpactStyle.Medium })
        case 'heavy':
          return Haptics.impact({ style: ImpactStyle.Heavy })
        case 'success':
          return Haptics.notification({ type: NotificationType.Success })
        case 'warning':
          return Haptics.notification({ type: NotificationType.Warning })
        case 'error':
          return Haptics.notification({ type: NotificationType.Error })
        case 'selection':
          await Haptics.selectionStart()
          await Haptics.selectionChanged()
          await Haptics.selectionEnd()
      }
    },
  }
}

interface CapacitorPosition {
  timestamp: number
  coords: {
    latitude: number
    longitude: number
    accuracy: number
    altitude?: number | null
    heading?: number | null
    speed?: number | null
  }
}

function toPosition(p: CapacitorPosition): Position {
  return {
    latitude: p.coords.latitude,
    longitude: p.coords.longitude,
    accuracy: p.coords.accuracy,
    altitude: p.coords.altitude ?? null,
    heading: p.coords.heading ?? null,
    speed: p.coords.speed ?? null,
    timestamp: p.timestamp,
  }
}

/**
 * Location on `@capacitor/geolocation` (Core Location, Fused Location). Asks for the location
 * permission first, as Android needs; rejects when it is refused.
 */
export function capacitorGeolocation(): GeolocationDriver {
  const allowed = async () => {
    const Geolocation = await geolocationPlugin()
    const { location } = await Geolocation.checkPermissions()
    if (location === 'granted') return Geolocation
    const asked = await Geolocation.requestPermissions({ permissions: ['location'] })
    if (asked.location !== 'granted')
      throw new Error('@kitr/native: location permission was denied')
    return Geolocation
  }
  return {
    async current(options) {
      const Geolocation = await allowed()
      return toPosition(
        await Geolocation.getCurrentPosition({
          enableHighAccuracy: options?.highAccuracy,
          timeout: options?.timeout,
        }),
      )
    },
    watch(listener, options) {
      let id: string | undefined
      let stopped = false
      void allowed()
        .then((Geolocation) =>
          Geolocation.watchPosition({ enableHighAccuracy: options?.highAccuracy }, (position) => {
            if (position) listener(toPosition(position))
          }).then((watchId) => {
            if (stopped) void Geolocation.clearWatch({ id: watchId })
            else id = watchId
          }),
        )
        .catch(() => {})
      return () => {
        stopped = true
        if (id === undefined) return
        const watchId = id
        id = undefined
        void geolocationPlugin().then((G) => G.clearWatch({ id: watchId }))
      }
    },
  }
}

/**
 * The native drivers for the Capacitor shell: clipboard, share sheet, haptics and geolocation on the
 * official plugins, each imported on first use. Camera and biometrics have no Capacitor driver yet
 * (`supported: false`); register one with `app.drivers.register()`.
 */
export function createCapacitorDriver(_options: DriverOptions = {}): Driver {
  return {
    name: 'capacitor',
    clipboard: capacitorClipboard(),
    share: capacitorShare(),
    haptics: capacitorHaptics(),
    geolocation: capacitorGeolocation(),
    camera: null,
    biometrics: null,
  }
}
