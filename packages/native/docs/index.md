---
title: Native
description: Clipboard, share sheet, haptics, location, camera and fingerprint unlock, each with a web fallback.
order: 1
---

# Native

Copy a link, share, buzz the phone, read the location, take a photo, ask for a fingerprint: every platform has its own API for each. `@kitr/native` puts all six behind one `native` service. Each works in the browser, tells you whether the device supports it, and can switch to a native driver without changing your code.

> [!SUMMARY]
> Gives you clipboard, share sheet, haptics, location, camera and fingerprint unlock behind one service, each with a web fallback. Add it with `kitr add native`; the overview is at [/packages/native](/packages/native).

It runs in the browser and in desktop and mobile shells. It does not sign people in (use [Auth](/packages/auth)) or open and save files (use [Files](/packages/files)). The examples follow Acme's order screen at `app.acme.com`.

## Install

```sh
kitr add native
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add` does:

- Installs `@kitr/native` and adds it to `packages` in `kitrrc.ts`.
- Adds `() => import('@kitr/native/provider')` to `providers` in `kitrrc.ts`.
- Adds a `## kitr: native` section to `AGENTS.md`: the six capabilities come from `useNative()`, `useClipboard()`, `useShare()` and `useGeolocation()` in `@kitr/native/react`, check `.supported` (or `canShare`) before showing a button, and an unsupported capability rejects with `UnsupportedError`.

No kit includes it. `kitr add native` adds [platform](/packages/platform) first when the project lacks it.

`kitr remove native` removes the provider, the `packages` entry, the dependency and the `AGENTS.md` section, and deletes `config/native.ts` if you created one. It then lists the files that still import `@kitr/native`.

</details>

To preview the changes:

```sh
kitr add native --dry-run
```

## Configure

The provider picks a driver per capability on its own, so you need no config to start. To replace drivers for the whole app, create `config/native.ts`:

```ts
// config/native.ts
import { defineConfig } from '@kitr/native'
import { electronClipboard } from '#app/native/electron-clipboard'

export default defineConfig({
  drivers: {
    clipboard: electronClipboard(),
  },
})
```

| Option | Default | Description |
| --- | --- | --- |
| `drivers` | `{}` | Drivers that win over registered and web drivers, one key per capability. |
| `drivers.clipboard` | registered, else `webClipboard()` | A `ClipboardDriver`: `readText()` and `writeText(text)`. |
| `drivers.share` | registered, else `webShare()` | A `ShareDriver`: `canShare(payload)` and `share(payload)`. |
| `drivers.haptics` | registered, else `webHaptics()` | A `HapticsDriver`: `impact(kind)`. |
| `drivers.geolocation` | registered, else `webGeolocation()` | A `GeolocationDriver`: `current(options)` and `watch(listener, options)`. |
| `drivers.camera` | registered, else `webCamera()` | A `CameraDriver`: `capture(options)`. |
| `drivers.biometrics` | registered, else `webBiometrics()` | A `BiometricsDriver`: `available()` and `authenticate(options)`. |
| `fallbackToWeb` | `false` | In a native shell with no driver for a capability, use the web drivers inside the webview instead of throwing `E_DRIVER_UNAVAILABLE`. |

Writing a driver is covered under [Extend](#extend); the order drivers are chosen in is under [Where each capability comes from](#where-each-capability-comes-from).

## Copy your first link

`useClipboard()` copies text and flips `copied` to `true` for 1.5 seconds, long enough for a "Copied" label:

```tsx
// app/components/invoices/copy-invoice-link.tsx
import { useClipboard } from '@kitr/native/react'

export function CopyInvoiceLink({ invoiceId }: { invoiceId: string }) {
  const { copy, copied, supported } = useClipboard()
  if (!supported) return null
  const url = `https://app.acme.com/invoices/${invoiceId}`
  return (
    <button type="button" onClick={() => copy(url)}>
      {copied ? 'Copied' : 'Copy link'}
    </button>
  )
}
```

Render it on the invoice page:

```ts
// app/routes.ts
r.page('/invoices/$invoiceId', { lazy: () => import('./pages/invoices/invoiceId') })
```

```tsx
// app/pages/invoices/invoiceId.tsx
import { CopyInvoiceLink } from '#app/components/invoices/copy-invoice-link'
import { getRouteApi } from '@kitr/router'

const route = getRouteApi('/invoices/$invoiceId')

export default function InvoicePage() {
  const { invoiceId } = route.useParams()
  return (
    <main>
      <h1>Invoice {invoiceId}</h1>
      <CopyInvoiceLink invoiceId={invoiceId} />
    </main>
  )
}
```

Clicking **Copy link** puts `https://app.acme.com/invoices/inv_1042` on the clipboard and the label reads **Copied**. Pass another duration as the first argument: `useClipboard(3000)`. The button hides itself where there is no Clipboard API, such as plain `http://` pages other than `localhost`.

## Check what the device supports

Every capability carries three fields next to its methods:

| Field | Description |
| --- | --- |
| `supported` | `true` when a driver exists for this capability. |
| `name` | Where the driver came from: `'configured'`, the registering platform (such as `'mobile'`), `'native'` when the platform gave no name, `'web'`, or `'unsupported'`. |
| `driver` | The driver object itself. |

`native.supported()` reports all six at once. In a component, read the service with `useNative()`:

```tsx
// app/components/orders/device-features.tsx
import { useNative } from '@kitr/native/react'

export function DeviceFeatures() {
  const native = useNative()
  const features = native.supported()
  // => { clipboard: true, share: false, haptics: false, geolocation: true, camera: true, biometrics: true }
  return (
    <ul>
      {Object.entries(features).map(([name, on]) => (
        <li key={name}>
          {name}: {on ? native[name as keyof typeof features].name : 'not on this device'}
        </li>
      ))}
    </ul>
  )
}
```

The example result is desktop Chrome: no Web Share on Linux, no vibration. The web camera driver always exists in a browser, because it only opens a file input.

## Copy and paste text

Outside the hook, `native.clipboard` has `writeText(text)` and `readText()`:

```tsx
// app/components/orders/paste-order-number.tsx
import { useNative } from '@kitr/native/react'
import { useState } from 'react'

export function PasteOrderNumber({ onFound }: { onFound: (orderId: string) => void }) {
  const { clipboard } = useNative()
  const [error, setError] = useState<string | null>(null)
  if (!clipboard.supported) return null
  async function paste() {
    try {
      const text = await clipboard.readText()
      const match = text.match(/ord_\d+/)
      if (match) onFound(match[0])
      else setError('No order number on the clipboard')
    } catch {
      setError('Allow clipboard access to paste')
    }
  }
  return (
    <>
      <button type="button" onClick={paste}>Paste order number</button>
      {error && <p role="alert">{error}</p>}
    </>
  )
}
```

Browsers ask permission before a page reads the clipboard, and reject with `NotAllowedError` when the person says no.

> [!WARNING] Write from a click
> `writeText` must run during a click or key press. Call it from the handler, not from an effect.

## Open the share sheet

`useShare()` returns `{ supported, canShare, share }`. Show a share button where the device has a share sheet and fall back to copying everywhere else:

```tsx
// app/components/invoices/share-invoice.tsx
import { useClipboard, useShare } from '@kitr/native/react'

export function ShareInvoice({ invoiceId, total }: { invoiceId: string; total: string }) {
  const { canShare, share } = useShare()
  const { copy, copied } = useClipboard()
  const payload = {
    title: `Acme invoice ${invoiceId}`,
    text: `Invoice ${invoiceId} for ${total}`,
    url: `https://app.acme.com/invoices/${invoiceId}`,
  }
  if (canShare(payload))
    return (
      <button type="button" onClick={() => share(payload)}>
        Share
      </button>
    )
  return (
    <button type="button" onClick={() => copy(payload.url)}>
      {copied ? 'Copied' : 'Copy link'}
    </button>
  )
}
```

`share()` resolves to `true` when a target was picked and `false` when the sheet was closed. Other failures reject with the browser's error, such as `NotAllowedError` when `share()` was not called from a click. `canShare` is `false` when unsupported, so it is safe to call everywhere. To act on the result:
```tsx
// app/hooks/invoices/use-share-invoice.ts
import { useShare } from '@kitr/native/react'

export function useShareInvoice() {
  const { share } = useShare()
  return async (invoiceId: string) => {
    const shared = await share({ url: `https://app.acme.com/invoices/${invoiceId}` })
    // => true when sent, false when Ada closed the sheet
    return shared ? 'Invoice shared' : null
  }
}
```

## Share a file

The payload takes `files: File[]` too. Check `canShare` with the files included:

```tsx
// app/components/invoices/share-invoice-pdf.tsx
import { useShare } from '@kitr/native/react'

export function ShareInvoicePdf({ invoiceId }: { invoiceId: string }) {
  const { canShare, share } = useShare()
  async function sharePdf() {
    const response = await fetch(`/api/invoices/${invoiceId}/pdf`)
    const file = new File([await response.blob()], `acme-${invoiceId}.pdf`, {
      type: 'application/pdf',
    })
    if (!canShare({ files: [file] })) {
      window.open(`/api/invoices/${invoiceId}/pdf`)
      return
    }
    await share({ title: `Invoice ${invoiceId}`, files: [file] })
  }
  return (
    <button type="button" onClick={sharePdf}>
      Send PDF
    </button>
  )
}
```

## Give haptic feedback

`haptics.impact(kind)` plays a short vibration. Use it to confirm something the person did, such as placing an order:

```tsx
// app/components/orders/place-order-button.tsx
import { useNative } from '@kitr/native/react'

export function PlaceOrderButton({ onPlace }: { onPlace: () => Promise<void> }) {
  const { haptics } = useNative()
  async function place() {
    try {
      await onPlace()
      if (haptics.supported) await haptics.impact('success')
    } catch {
      if (haptics.supported) await haptics.impact('error')
    }
  }
  return (
    <button type="button" onClick={place}>
      Place order
    </button>
  )
}
```

The web driver maps each kind to a [vibration pattern](https://developer.mozilla.org/docs/Web/API/Vibration_API). Only some Android browsers vibrate; Safari and desktop browsers report `supported: false`.

| Kind | Web pattern (ms) | Use it for |
| --- | --- | --- |
| `selection` | `5` | Moving through a picker or toggling a switch |
| `light` | `10` | A small tap, such as adding a line to an order |
| `medium` | `20` | A firmer tap |
| `heavy` | `40` | A strong tap |
| `success` | `[15, 40, 15]` | An order placed, a payment taken |
| `warning` | `[30, 60, 30]` | Something needs a look |
| `error` | `[50, 50, 50, 50, 50]` | A failed action |

> [!WARNING] Check supported
> On an unsupported device `impact` rejects with `UnsupportedError`. Check `supported` first.

## Read the current location

`geolocation.current()` resolves to a `Position` once:

```tsx
// app/components/orders/check-in-button.tsx
import { useNative } from '@kitr/native/react'

export function CheckInButton({ orderId }: { orderId: string }) {
  const { geolocation } = useNative()
  if (!geolocation.supported) return null
  async function checkIn() {
    try {
      const position = await geolocation.current({ highAccuracy: true, timeout: 10_000 })
      // => { latitude: 51.5072, longitude: -0.1276, accuracy: 12, altitude: null, heading: null, speed: null, timestamp: 1767225600000 }
      await fetch(`/api/orders/${orderId}/check-in`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ latitude: position.latitude, longitude: position.longitude }),
      })
    } catch (error) {
      // GeolocationPositionError: code 1 denied, 2 unavailable, 3 timed out
      console.warn('No location', error)
    }
  }
  return (
    <button type="button" onClick={checkIn}>
      Check in at delivery
    </button>
  )
}
```

| Option | Default | Description |
| --- | --- | --- |
| `highAccuracy` | `false` | Ask for GPS-level accuracy. Slower and uses more battery. |
| `timeout` | none | Give up after this many milliseconds. |

On the web the call rejects with a [`GeolocationPositionError`](https://developer.mozilla.org/docs/Web/API/GeolocationPositionError): `code` 1 when denied, 2 when unavailable and 3 on timeout. `accuracy` is in metres; `altitude`, `heading` and `speed` are `null` when unknown.

## Follow the location

`useGeolocation()` reads the position once on mount. With `watch: true` it keeps `position` fresh until the component unmounts:

```tsx
// app/components/orders/delivery-tracker.tsx
import { useGeolocation } from '@kitr/native/react'

export function DeliveryTracker() {
  const { position, error, supported } = useGeolocation({ watch: true, highAccuracy: true })
  if (!supported) return <p>Location is not available on this device.</p>
  if (error) return <p role="alert">Location blocked: {error.message}</p>
  if (!position) return <p>Finding you…</p>
  return (
    <p>
      {position.latitude.toFixed(4)}, {position.longitude.toFixed(4)} (±{Math.round(position.accuracy)} m)
    </p>
  )
}
```

`error` holds a failure of the first read only. Outside React, `watch` returns a function that stops it:

```ts
// app/lib/orders/track-delivery.ts
import type { Native } from '@kitr/native'

export function trackDelivery(native: Native, report: (lat: number, lng: number) => void) {
  const stop = native.geolocation.watch((p) => report(p.latitude, p.longitude), {
    highAccuracy: true,
  })
  return stop
}
```

## Take a photo

`camera.capture()` resolves to a `Photo` (`{ blob, type, source }`) or `null` when the person cancels:

```tsx
// app/components/orders/attach-delivery-note.tsx
import { useNative } from '@kitr/native/react'

export function AttachDeliveryNote({ orderId }: { orderId: string }) {
  const { camera } = useNative()
  async function attach(source: 'camera' | 'library') {
    const photo = await camera.capture({ source })
    if (!photo) return
    // => { blob: File, type: 'image/jpeg', source: 'camera' }
    const body = new FormData()
    body.append('note', photo.blob, `delivery-${orderId}.jpg`)
    await fetch(`/api/orders/${orderId}/delivery-note`, { method: 'POST', body })
  }
  return (
    <>
      <button type="button" onClick={() => attach('camera')}>Take photo</button>
      <button type="button" onClick={() => attach('library')}>Choose photo</button>
    </>
  )
}
```

| Option | Default | Description |
| --- | --- | --- |
| `source` | `'camera'` | `'camera'` opens the camera; `'library'` opens the photo library or file picker. |
| `quality` | none | A hint for native drivers. The web driver ignores it and returns the file as picked. |

On the web, `capture()` opens a hidden file input; with `source: 'camera'` phones open the rear camera and desktop browsers show the file picker. Call it from a click. To send the photo to your server, [Uploads](/packages/uploads) takes the `blob` as is.

## Unlock with biometrics

`biometrics.available()` says whether the device has Touch ID, Face ID, Windows Hello or a screen lock set up. `authenticate()` shows the prompt and resolves to `true` on success and `false` when the person cancels or fails:

```tsx
// app/components/invoices/invoice-lock.tsx
import { useNative } from '@kitr/native/react'
import { type ReactNode, useEffect, useState } from 'react'

export function InvoiceLock({ children }: { children: ReactNode }) {
  const { biometrics, haptics } = useNative()
  const [available, setAvailable] = useState<boolean | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  useEffect(() => {
    biometrics.available().then(setAvailable)
  }, [biometrics])
  if (available === null) return null
  if (!available || unlocked) return <>{children}</>
  async function unlock() {
    const ok = await biometrics.authenticate({ reason: 'Open Acme invoices' })
    if (ok) {
      setUnlocked(true)
      if (haptics.supported) await haptics.impact('success')
    }
  }
  return (
    <button type="button" onClick={unlock}>
      Unlock invoices
    </button>
  )
}
```

`available()` resolves to `false` on an unsupported device rather than throwing. On the web the driver uses WebAuthn: the first `authenticate()` registers this device and later calls show the fingerprint or PIN prompt. Only native drivers show `reason`.

> [!WARNING] Not a server check
> `authenticate()` proves someone is at the device, not who they are, and a script on the page can skip it. Never unlock server data because the client said `true`. For sign-in, verify a passkey on the server with [Auth](/packages/auth).

<details>
<summary>Keep the credential id under another key</summary>

For example one per signed-in user:

```ts
// config/native.ts
import { defineConfig, webBiometrics } from '@kitr/native'

export default defineConfig({
  drivers: {
    biometrics: webBiometrics({ storageKey: 'acme:biometrics:credential' }) ?? undefined,
  },
})
```

`webBiometrics()` returns `null` where the browser has no WebAuthn, which `?? undefined` turns into "use the default".

</details>

## Handle unsupported capabilities

A capability with no driver still exists, with `supported: false` and `name: 'unsupported'`. Most methods reject with `UnsupportedError`; three answer safely so feature checks never throw:

| Call | Unsupported result |
| --- | --- |
| `share.canShare(payload)` | `false` |
| `biometrics.available()` | `false` |
| `geolocation.watch(listener)` | A stop function that does nothing |
| Every other method | Rejects with `UnsupportedError` |

Catch it by class and read `capability`:

```ts
// app/lib/invoices/copy-or-explain.ts
import { type Native, UnsupportedError } from '@kitr/native'

export async function copyInvoiceNumber(native: Native, invoiceId: string) {
  try {
    await native.clipboard.writeText(invoiceId)
    return 'Copied'
  } catch (error) {
    if (error instanceof UnsupportedError) return `Copy ${invoiceId} by hand`
    // error.capability => 'clipboard'
    // error.message => '@kitr/native: clipboard is not supported on this platform'
    throw error
  }
}
```

Prefer checking `supported` before rendering the control; catch `UnsupportedError` where you cannot hide it.

## Use it outside React

Outside components, read the service from the app's container:

```ts
// app/lib/orders/after-place.ts
import type { KitrApp } from '@kitr/kitr/app'
import { useNative } from '@kitr/native'

export async function afterOrderPlaced(app: KitrApp, orderId: string) {
  const native = useNative(app) // same as app.container.use('native')
  if (native.haptics.supported) await native.haptics.impact('success')
  if (native.clipboard.supported) await native.clipboard.writeText(orderId)
}
```

To build a service with no app, call `createNative(config)`; with no drivers it uses the web drivers.

## Where each capability comes from

<details>
<summary>How a driver is chosen</summary>

For each capability the service takes the first of these that exists:

1. The driver in `config.drivers`, named `'configured'`.
2. A driver a provider registered with `app.drivers.register('<capability>', driver, { platform })`, named after `platform`.
3. The driver `selectDriver(runtime)` picks, where `runtime` is `platform.runtime` (`web`, `electron`, `tauri` or `capacitor`). On `web` that is the web driver, named `'web'`, or nothing (`supported: false`, named `'unsupported'`) where the browser lacks the API. A native runtime uses its own driver, named after the runtime, and throws `E_DRIVER_UNAVAILABLE` while it has none.
4. In a native shell with `fallbackToWeb: true`, the web driver, named `'web'`.

| Capability | Web driver | Works in |
| --- | --- | --- |
| `clipboard` | `webClipboard()`, Clipboard API | Every current browser, on HTTPS or `localhost` |
| `share` | `webShare()`, Web Share | Safari, Chrome on Android, ChromeOS and Windows, Edge |
| `haptics` | `webHaptics()`, `navigator.vibrate` | Chrome and Firefox on Android |
| `geolocation` | `webGeolocation()`, Geolocation API | Every current browser, on HTTPS |
| `camera` | `webCamera()`, file input with `capture` | Every browser |
| `biometrics` | `webBiometrics()`, WebAuthn platform authenticator | Browsers with WebAuthn, on HTTPS |

In a Capacitor shell the [Capacitor drivers](#capacitor) answer, and in Electron and Tauri the drivers under [Use it in Electron and Tauri](#use-it-in-electron-and-tauri). Set `fallbackToWeb: true` to use the browser drivers instead.

</details>

### Capacitor

In the [Mobile](/packages/mobile) shell the service uses the phone's own APIs through Capacitor plugins, named `'capacitor'` in `native.clipboard.name`. Each plugin is an optional peer dependency, so the web build never loads them.

| Capability | Plugin | Notes |
| --- | --- | --- |
| `clipboard` | `@capacitor/clipboard` | No permission prompt. iOS shows its "pasted from" banner on reads. |
| `share` | `@capacitor/share` | Cannot share files; save with [Files](/packages/files) and share the `url`. |
| `haptics` | `@capacitor/haptics` | `light`, `medium` and `heavy` are impacts, `success`, `warning` and `error` are notifications, `selection` plays the selection start, change and end ticks. |
| `geolocation` | `@capacitor/geolocation` | Asks for permission first. Needs `NSLocationWhenInUseUsageDescription` on iOS and the location permissions on Android. |
| `camera`, `biometrics` | none | `supported: false`. Register a driver as shown under [Extend](#extend). |

`kitr add native` installs the four plugins when the project has the mobile platform; `kitr new --kit mobile` installs all of them. Without the mobile platform, add them yourself:

```sh
pnpm add @capacitor/clipboard @capacitor/share @capacitor/haptics @capacitor/geolocation
```

A missing plugin does not fall back to the webview. The call rejects with `E_DRIVER_UNAVAILABLE` and the package to install:

```tsx
// app/components/copy-link.tsx
import { useClipboard } from '@kitr/native/react'

export function CopyInvoiceLink({ url }: { url: string }) {
  const clipboard = useClipboard()
  return (
    <button type="button" onClick={() => clipboard.writeText(url).catch((error) => console.warn(error.message))}>
      Copy invoice link
    </button>
  )
}
// without @capacitor/clipboard => "@kitr/native has no capacitor driver: install @capacitor/clipboard. ..."
```

## Use it in Electron and Tauri

A desktop has a clipboard and, on a Mac, Touch ID, but no share sheet, haptic motor or GPS. The desktop drivers leave those `null`, so `supported` is `false` for them.

| Capability | Electron | Tauri |
| --- | --- | --- |
| `clipboard` | Electron `clipboard` in the main process | `@tauri-apps/plugin-clipboard-manager` |
| `biometrics` | Touch ID on macOS (`systemPreferences.promptTouchID`); `available()` is `false` elsewhere | `null` (the biometric plugin is mobile-only) |
| `share`, `haptics`, `geolocation`, `camera` | `null` | `null` |

Both drivers also carry a `system` object for desktop needs beyond the six capabilities. Import the driver to use it:

```ts
// app/system.ts
import { createElectronNativeDriver } from '@kitr/native'

const { system } = createElectronNativeDriver()

/** Open Acme's docs in the browser, follow dark mode and pause syncing on battery. */
export async function watchTheMachine() {
  await system.openExternal('https://acme.com/docs') // http, https, mailto and tel only
  console.log(await system.platform(), await system.appVersion(), await system.isDark()) // => linux 1.4.0 true
  const stopTheme = system.onTheme((dark) => console.log(dark ? 'dark' : 'light'))
  const stopPower = system.onPower((event) => console.log(event)) // 'suspend' | 'resume' | 'battery' | 'ac'
  return () => {
    stopTheme()
    stopPower()
  }
}
```

| `system` member | Electron | Tauri |
| --- | --- | --- |
| `openExternal(url)` | `shell.openExternal` through `kitr:shell:open` | `plugin-opener`'s `openUrl` |
| `platform()` | `process.platform`: `darwin`, `win32`, `linux` | `plugin-os`'s `platform()`: `macos`, `windows`, `linux` |
| `appVersion()` | `app.getVersion()` | `@tauri-apps/api/app` |
| `isDark()`, `onTheme(listener)` | `nativeTheme` | The window's `theme()` and `onThemeChanged` |
| `isOnline()` | `net.isOnline()` | `navigator.onLine` |
| `onPower(listener)`, `isOnBattery()` | `powerMonitor`: suspend, resume, battery, AC | Not available |

`openExternal` refuses anything but `http:`, `https:`, `mailto:` and `tel:` links. In Electron, pass `externalProtocols` to `handleKitrIpc()` to allow more.

<details>
<summary>Requirements for each shell</summary>

- **Electron:** `handleKitrIpc()` in `main.ts` and `exposeIpc()` in the preload script, which a desktop project already has. Without the `kitrIpc` bridge, creating the service throws `E_DRIVER_UNAVAILABLE`. Touch ID needs a Mac with Touch ID and a signed app.
- **Tauri:** `@tauri-apps/plugin-clipboard-manager`, `@tauri-apps/plugin-os`, `@tauri-apps/plugin-opener` and `@tauri-apps/api`, which `kitr add tauri` and `kitr add native` install. A missing one rejects with `E_DRIVER_UNAVAILABLE` naming the package. The Tauri scaffold writes the matching crates and permissions in `src-tauri`.

</details>

## Errors

| Error | When | What to do |
| --- | --- | --- |
| `E_DRIVER_UNAVAILABLE` (`KitrError`, `data.runtime`, `data.package`) | The app runs in Electron, Tauri or Capacitor and no native driver is registered. | Register a driver with `app.drivers.register()`, or set `fallbackToWeb: true` in `config/native.ts` to run the web driver inside the webview. |
| `UnsupportedError` (`capability` set) | A method other than `canShare`, `available` or `watch` on a capability with no driver. | Check `supported` before showing the control. |
| `NotAllowedError` (browser) | Clipboard read denied, or `share()` / `writeText()` not called from a click. | Call from an event handler; explain the permission. |
| `GeolocationPositionError` (browser) | `current()` denied (code 1), unavailable (2) or timed out (3). | Show a message, and offer a manual address. |

A `false` from `share()` or `authenticate()`, or a `null` from `capture()`, is a cancel, not an error.

## Testing

`createMemoryNativeDrivers()` returns six drivers for Node and DOM tests, plus two logs: `shared` (every `share` payload) and `haptics_log` (every `impact` kind):

| Capability | Memory behaviour |
| --- | --- |
| `clipboard` | Keeps the last written text in memory. |
| `share` | `canShare` is `true`; `share` records the payload and resolves `true`. |
| `haptics` | Records the kind. |
| `geolocation` | `current()` resolves `{ latitude: 0, longitude: 0, accuracy: 1, timestamp: Date.now() }`; `watch` never calls back. |
| `camera` | `capture()` resolves `null`. |
| `biometrics` | `available()` and `authenticate()` resolve `true`. |

Pass overrides to replace one, and hand the result to the app through `config.native.drivers`:

```tsx
// app/components/invoices/share-invoice.test.tsx
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { createMemoryNativeDrivers } from '@kitr/native'
import { nativeProvider } from '@kitr/native/provider'
import { createTestApp } from '@kitr/testing'
import { renderWithKitr } from '@kitr/testing/react'
import { describe, expect, it } from 'vitest'
import { InvoiceLock } from './invoice-lock'
import { ShareInvoice } from '#app/components/invoices/share-invoice'

describe('invoice sharing', () => {
  it('shares the invoice link and records it', async () => {
    const drivers = createMemoryNativeDrivers()
    const app = await createTestApp({
      providers: [nativeProvider],
      config: { native: { drivers } },
    })
    renderWithKitr(<ShareInvoice invoiceId="inv_1042" total="$1,280.00" />, { app })
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    await waitFor(() => expect(drivers.shared).toHaveLength(1))
    expect(drivers.shared[0]).toEqual({
      title: 'Acme invoice inv_1042',
      text: 'Invoice inv_1042 for $1,280.00',
      url: 'https://app.acme.com/invoices/inv_1042',
    })
  })

  it('falls back to copying when there is no share sheet', async () => {
    const drivers = createMemoryNativeDrivers({
      share: { canShare: () => false, share: async () => false },
    })
    const app = await createTestApp({
      providers: [nativeProvider],
      config: { native: { drivers } },
    })
    renderWithKitr(<ShareInvoice invoiceId="inv_1042" total="$1,280.00" />, { app })
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await screen.findByRole('button', { name: 'Copied' })
    const native = app.container.use('native')
    expect(await native.clipboard.readText()).toBe('https://app.acme.com/invoices/inv_1042')
  })

  it('unlocks invoices with a fingerprint and buzzes', async () => {
    const drivers = createMemoryNativeDrivers()
    const app = await createTestApp({
      providers: [nativeProvider],
      config: { native: { drivers } },
    })
    renderWithKitr(
      <InvoiceLock>
        <p>Invoice list</p>
      </InvoiceLock>,
      { app },
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Unlock invoices' }))
    await screen.findByText('Invoice list')
    expect(drivers.haptics_log).toEqual(['success'])
  })
})
```

`createNative()` with no drivers in Node reports every capability unsupported, which tests a fallback:

```ts
// app/lib/invoices/copy-or-explain.test.ts
import { createNative } from '@kitr/native'
import { expect, it } from 'vitest'
import { copyInvoiceNumber } from './copy-or-explain'

it('asks for a manual copy when there is no clipboard', async () => {
  const native = createNative()
  expect(native.clipboard.supported).toBe(false)
  expect(await copyInvoiceNumber(native, 'inv_1042')).toBe('Copy inv_1042 by hand')
})
```

A location fix for a test is one override: `createMemoryNativeDrivers({ geolocation: { current: async () => ({ latitude: 51.5, longitude: -0.12, accuracy: 5, timestamp: 0 }), watch: () => () => {} } })`.

## Extend

Each capability has its own driver interface. A driver is a plain object or class instance:

```ts
interface ClipboardDriver {
  readText(): Promise<string>
  writeText(text: string): Promise<void>
}
interface ShareDriver {
  canShare(payload: SharePayload): boolean
  share(payload: SharePayload): Promise<boolean> // true shared, false dismissed
}
interface HapticsDriver {
  impact(kind: HapticKind): Promise<void>
}
interface GeolocationDriver {
  current(options?: { highAccuracy?: boolean; timeout?: number }): Promise<Position>
  watch(listener: (position: Position) => void, options?: { highAccuracy?: boolean }): () => void
}
interface CameraDriver {
  capture(options?: { source?: 'camera' | 'library'; quality?: number }): Promise<Photo | null>
}
interface BiometricsDriver {
  available(): Promise<boolean>
  authenticate(options?: { reason?: string }): Promise<boolean> // false on cancel
}
```

Register a driver from a provider's `register()`, so it is in place before the service is built. This one gives the Capacitor shell real haptics with [`@capacitor/haptics`](https://capacitorjs.com/docs/apis/haptics). Run `pnpm add @capacitor/haptics` and `kitr make:provider native-drivers`, then:

```ts
// app/providers/native-drivers-provider.ts
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { defineProvider } from '@kitr/kitr/app'
import type { HapticKind, HapticsDriver } from '@kitr/native'

const impacts = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy }
const notices = {
  success: NotificationType.Success,
  warning: NotificationType.Warning,
  error: NotificationType.Error,
}

function capacitorHaptics(): HapticsDriver {
  return {
    async impact(kind: HapticKind) {
      if (kind === 'selection') return Haptics.selectionChanged()
      if (kind in notices) return Haptics.notification({ type: notices[kind as keyof typeof notices] })
      return Haptics.impact({ style: impacts[kind as keyof typeof impacts] })
    },
  }
}

export default defineProvider({
  name: 'native-drivers',
  register(app) {
    if (Capacitor.isNativePlatform())
      app.drivers.register('haptics', capacitorHaptics(), { platform: 'mobile' })
  },
})
```

Add `() => import('#app/providers/native-drivers-provider')` to `providers` in `kitrrc.ts`. Inside the app, `native.haptics.name` is now `'mobile'`; in the browser the web driver still applies. A higher `priority` wins when two providers register the same capability (default 10).

Electron runs Node only in the main process, so a driver there calls main over IPC. Add a channel to the desktop IPC contract, handle it in main with Electron's [`clipboard`](https://www.electronjs.org/docs/latest/api/clipboard), and wrap the client in a driver:

```ts
// app/native/electron-clipboard.ts
import { createIpcClient } from '@kitr/desktop/client'
import type { ClipboardDriver } from '@kitr/native'

type ClipboardIpc = {
  'clipboard.read': () => string
  'clipboard.write': (text: string) => void
}

const ipc = createIpcClient<ClipboardIpc>()

export function electronClipboard(): ClipboardDriver | undefined {
  if (!ipc.available) return undefined
  return {
    readText: () => ipc.invoke('clipboard.read'),
    writeText: (text) => ipc.invoke('clipboard.write', text),
  }
}
```

```ts
// platforms/app/main.ts
import { clipboard, ipcMain } from 'electron'
import { handleIpc } from '@kitr/desktop/main'

handleIpc<{ 'clipboard.read': () => string; 'clipboard.write': (text: string) => void }>(ipcMain, {
  'clipboard.read': () => clipboard.readText(),
  'clipboard.write': (_event, text) => clipboard.writeText(text),
})
// ...
```

Then set it in `config/native.ts`, as shown under [Configure](#configure). `electronClipboard()` returns `undefined` in a plain browser, so the web build keeps the web driver.

## Next steps

- [API reference](/packages/native/api): every export with its signature.
- [Auth](/packages/auth): sign-in and passkeys verified on the server.
- [Uploads](/packages/uploads): send photos from `camera.capture()` to your server.
