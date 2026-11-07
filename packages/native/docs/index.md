---
title: Native
description: Clipboard, share sheet, haptics, location, camera and fingerprint unlock, each with a web fallback.
order: 1
---

# Native

Copy a link, open the share sheet, buzz the phone when an order goes through, read where someone is standing, take a photo, ask for a fingerprint: every app reaches for these sooner or later, and every platform has its own API for each one. `kitr/native` puts the six behind one `native` service. Each capability has a web driver built on the matching browser API, reports whether it works on this device, and can be replaced by a native driver without changing the code that calls it.

The web drivers use the [Clipboard API](https://developer.mozilla.org/docs/Web/API/Clipboard_API), [Web Share](https://developer.mozilla.org/docs/Web/API/Web_Share_API), [`navigator.vibrate`](https://developer.mozilla.org/docs/Web/API/Navigator/vibrate), the [Geolocation API](https://developer.mozilla.org/docs/Web/API/Geolocation_API), a file input with `capture`, and [WebAuthn](https://developer.mozilla.org/docs/Web/API/Web_Authentication_API) with the device's own authenticator. kitr adds the `supported` flag, a typed `UnsupportedError`, React hooks, memory drivers for tests and a driver slot per capability.

It runs in the browser and in desktop and mobile shells. It does not sign people in: for that use [Auth](/packages/auth), and for files people open and save use [Files](/packages/files).

This guide follows Acme's order screen at `app.acme.com`: Ada copies an invoice link, shares it with Grace, photographs a delivery note and unlocks the invoices page with her fingerprint.

## Install

```sh
kitr add native
```

What `kitr add` does:

- Installs `@kitr/native` and adds it to `packages` in `kitrrc.ts`.
- Adds `() => import('@kitr/native/provider')` to `providers` in `kitrrc.ts`.
- Adds a `## kitr: native` section to `AGENTS.md`: the six capabilities come from `useNative()`, `useClipboard()`, `useShare()` and `useGeolocation()` in `kitr/native/react`, check `.supported` (or `canShare`) before showing a button, and an unsupported capability rejects with `UnsupportedError`.

It writes no config file and adds no environment variables or scripts. `kitr add native` asks no questions, and no kit includes it. It adds [platform](/packages/platform) first when the project lacks it. The web drivers work on their own, and a desktop or mobile platform you add later registers its own drivers. To preview the changes:

```sh
kitr add native --dry-run
```

`kitr remove native` removes the provider, the `packages` entry, the dependency and the `AGENTS.md` section, and deletes `config/native.ts` if you created one. It then lists the files that still import `kitr/native`.

## Configure

`kitr/native` has no config file. The provider picks a driver per capability on its own: a driver you configure, else one a platform package registered, else the web driver. To replace drivers for the whole app, create `config/native.ts` yourself. The app loads every file in `config/` under its file name:

```ts
// config/native.ts
import { defineConfig } from 'kitr/native'
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

The same object goes to `createNative(config, app)` when you build the service by hand, as in tests. Writing a driver is covered under [Extend](#extend).

## Copy your first link

`useClipboard()` copies text and flips `copied` to `true` for 1.5 seconds, long enough for a "Copied" label:

```tsx
// app/features/invoices/copy-invoice-link.tsx
import { useClipboard } from 'kitr/native/react'

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
import { CopyInvoiceLink } from '#app/features/invoices/copy-invoice-link'
import { getRouteApi } from 'kitr/router'

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

Ada clicks **Copy link**, the label reads **Copied**, and `https://app.acme.com/invoices/inv_1042` is on her clipboard. Pass another duration as the first argument: `useClipboard(3000)`. The button hides itself where the page has no Clipboard API, which is the case on plain `http://` pages other than `localhost`.

## Check what the device supports

Every capability carries three fields next to its methods:

| Field | Description |
| --- | --- |
| `supported` | `true` when a driver exists for this capability. |
| `name` | Where the driver came from: `'configured'`, the registering platform (such as `'mobile'`), `'native'` when the platform gave no name, `'web'`, or `'unsupported'`. |
| `driver` | The driver object itself. |

`native.supported()` reports all six at once. In a component, read the service with `useNative()`:

```tsx
// app/features/orders/device-features.tsx
import { useNative } from 'kitr/native/react'

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

The example result is desktop Chrome: no Web Share on Linux, no vibration. When the [Devtools](/packages/devtools) provider is installed, the service logs the same object under `native` as it starts.

The web camera driver always exists in a browser, because it only opens a file input. On a laptop with no camera that input opens the file picker instead.

## Copy and paste text

Outside the hook, `native.clipboard` has `writeText(text)` and `readText()`:

```tsx
// app/features/orders/paste-order-number.tsx
import { useNative } from 'kitr/native/react'
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

Browsers ask permission before a page reads the clipboard, and reject with the browser's own `NotAllowedError` when the person says no. Writing needs no prompt but must happen during a click or key press. Call `writeText` from the handler, not from an effect.

## Open the share sheet

`useShare()` returns `{ supported, canShare, share }`. Show a share button where the device has a share sheet and fall back to copying everywhere else:

```tsx
// app/features/invoices/share-invoice.tsx
import { useClipboard, useShare } from 'kitr/native/react'

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

`share()` resolves to `true` when Ada picked a target and `false` when she closed the sheet. Any other failure rejects with the browser's error, for example `NotAllowedError` when `share()` was not called from a click. `canShare` from the hook is `false` when the capability is unsupported, so it is safe to call everywhere.

To act on the result:

```tsx
// app/features/invoices/use-share-invoice.ts
import { useShare } from 'kitr/native/react'

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

The payload takes `files: File[]` as well. Browsers that cannot share files say so through `canShare`, so check with the files included:

```tsx
// app/features/invoices/share-invoice-pdf.tsx
import { useShare } from 'kitr/native/react'

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

Where the browser has `navigator.share` but no `navigator.canShare`, the web driver answers `false` for any payload with files and `true` otherwise.

## Give haptic feedback

`haptics.impact(kind)` plays a short vibration. Use it to confirm something the person did, such as placing an order:

```tsx
// app/features/orders/place-order-button.tsx
import { useNative } from 'kitr/native/react'

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

The web driver maps each kind to a [vibration pattern](https://developer.mozilla.org/docs/Web/API/Vibration_API) in milliseconds. Only some Android browsers vibrate; Safari and desktop browsers have no `navigator.vibrate`, so `supported` is `false` there.

| Kind | Web pattern (ms) | Use it for |
| --- | --- | --- |
| `selection` | `5` | Moving through a picker or toggling a switch |
| `light` | `10` | A small tap, such as adding a line to an order |
| `medium` | `20` | A firmer tap |
| `heavy` | `40` | A strong tap |
| `success` | `[15, 40, 15]` | An order placed, a payment taken |
| `warning` | `[30, 60, 30]` | Something needs a look |
| `error` | `[50, 50, 50, 50, 50]` | A failed action |

Don't call `impact` without checking `supported` first: on an unsupported device it rejects with `UnsupportedError`, and a haptic is never worth an error message.

## Read the current location

`geolocation.current()` resolves to a `Position` once. Acme's drivers check in at a delivery address:

```tsx
// app/features/orders/check-in-button.tsx
import { useNative } from 'kitr/native/react'

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

On the web the call rejects with the browser's [`GeolocationPositionError`](https://developer.mozilla.org/docs/Web/API/GeolocationPositionError): `code` 1 when Ada denies the prompt, 2 when no position is available and 3 on timeout. `accuracy` is in metres; `altitude`, `heading` and `speed` are `null` when the device does not know them.

## Follow the location

`useGeolocation()` reads the position once on mount. With `watch: true` it keeps `position` fresh until the component unmounts:

```tsx
// app/features/orders/delivery-tracker.tsx
import { useGeolocation } from 'kitr/native/react'

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

`error` holds a failure of the first read only. The web driver's watch has no error callback, so a permission revoked while watching stops updates without setting `error`.

Outside React, `watch` returns a function that stops it:

```ts
// app/features/orders/track-delivery.ts
import type { Native } from 'kitr/native'

export function trackDelivery(native: Native, report: (lat: number, lng: number) => void) {
  const stop = native.geolocation.watch((p) => report(p.latitude, p.longitude), {
    highAccuracy: true,
  })
  return stop
}
```

On an unsupported device `watch` returns a no-op stop function instead of throwing.

## Take a photo

`camera.capture()` resolves to a `Photo` (`{ blob, type, source }`) or `null` when the person cancels. Grace photographs a signed delivery note and attaches it to the order:

```tsx
// app/features/orders/attach-delivery-note.tsx
import { useNative } from 'kitr/native/react'

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

On the web, `capture()` opens a hidden `<input type="file" accept="image/*">`. With `source: 'camera'` it adds `capture="environment"`, which opens the rear camera on phones; desktop browsers show the file picker either way. Call it from a click, or the browser refuses to open the input. To send the photo to your server, [Uploads](/packages/uploads) takes the `blob` as is.

## Unlock with biometrics

`biometrics.available()` says whether the device has Touch ID, Face ID, Windows Hello or a screen lock set up. `authenticate()` shows the prompt and resolves to `true` on success and `false` when the person cancels or fails:

```tsx
// app/features/invoices/invoice-lock.tsx
import { useNative } from 'kitr/native/react'
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

`available()` resolves to `false` on an unsupported device rather than throwing, so you can call it without checking `supported`.

On the web the driver uses WebAuthn with the platform authenticator. The first `authenticate()` registers a credential for this site on this device, and that prompt is itself the check. It saves the credential id in `localStorage` under `kitr:biometrics:credential`; later calls ask for that credential, so the person sees the fingerprint or PIN prompt instead of a passkey picker. If the device no longer has the credential, the driver forgets the id and the next call registers a new one. A cancel keeps the id. The web driver does not show `reason`; native drivers pass it to the system prompt.

> **Warning**
> `authenticate()` proves someone is at the device. It does not prove who they are to your server, and a script on the page can skip the check. Never unlock data on the server because the client said `true`. For sign-in, verify a passkey assertion on the server with [Auth](/packages/auth).

To keep the credential id under another key, for example one per signed-in user, configure the web driver yourself:

```ts
// config/native.ts
import { defineConfig, webBiometrics } from 'kitr/native'

export default defineConfig({
  drivers: {
    biometrics: webBiometrics({ storageKey: 'acme:biometrics:credential' }) ?? undefined,
  },
})
```

`webBiometrics()` returns `null` where the browser has no WebAuthn, which `?? undefined` turns into "use the default".

## Handle unsupported capabilities

A capability with no driver still exists on the service, with `supported: false` and `name: 'unsupported'`. Most methods reject with `UnsupportedError`; three answer safely instead so that feature checks never throw:

| Call | Unsupported result |
| --- | --- |
| `share.canShare(payload)` | `false` |
| `biometrics.available()` | `false` |
| `geolocation.watch(listener)` | A stop function that does nothing |
| Every other method | Rejects with `UnsupportedError` |

Catch it by class and read `capability`:

```ts
// app/features/invoices/copy-or-explain.ts
import { type Native, UnsupportedError } from 'kitr/native'

export async function copyInvoiceNumber(native: Native, invoiceId: string) {
  try {
    await native.clipboard.writeText(invoiceId)
    return 'Copied'
  } catch (error) {
    if (error instanceof UnsupportedError) return `Copy ${invoiceId} by hand`
    // error.capability => 'clipboard'
    // error.message => 'kitr/native: clipboard is not supported on this platform'
    throw error
  }
}
```

Checking `supported` before rendering the button is the better habit. Catching `UnsupportedError` is for code paths where you cannot hide the control.

## Use it outside React

Outside components, read the service from the app's container. `useNative(app)` from `kitr/native` does the same thing:

```ts
// app/features/orders/after-place.ts
import type { KitrApp } from 'kitr/app'
import { useNative } from 'kitr/native'

export async function afterOrderPlaced(app: KitrApp, orderId: string) {
  const native = useNative(app) // same as app.container.use('native')
  if (native.haptics.supported) await native.haptics.impact('success')
  if (native.clipboard.supported) await native.clipboard.writeText(orderId)
}
```

Methods are bound to their driver, so `const { writeText } = native.clipboard` works too. To build a service with no app at all, call `createNative(config)`; with no `config.drivers` and no app it uses the web drivers.

## Where each capability comes from

For each capability the service takes the first of these that exists:

1. The driver in `config.drivers`, named `'configured'`.
2. A driver a provider registered with `app.drivers.register('<capability>', driver, { platform })`, named after `platform`.
3. The web driver, named `'web'`.
4. Nothing: `supported: false`, named `'unsupported'`.

| Capability | Web driver | Works in |
| --- | --- | --- |
| `clipboard` | `webClipboard()`, Clipboard API | Every current browser, on HTTPS or `localhost` |
| `share` | `webShare()`, Web Share | Safari, Chrome on Android, ChromeOS and Windows, Edge |
| `haptics` | `webHaptics()`, `navigator.vibrate` | Chrome and Firefox on Android |
| `geolocation` | `webGeolocation()`, Geolocation API | Every current browser, on HTTPS |
| `camera` | `webCamera()`, file input with `capture` | Every browser |
| `biometrics` | `webBiometrics()`, WebAuthn platform authenticator | Browsers with WebAuthn, on HTTPS |

Desktop and mobile shells run the app in a webview, so the web drivers apply there too. Today [Desktop](/packages/desktop) (Electron), [Tauri](/packages/tauri) and [Mobile](/packages/mobile) register only `platform` and `storage` drivers, none of these six. To use the native clipboard, Face ID or real haptics in a shell, register a driver as shown under [Extend](#extend).

## Errors

| Error | When | What to do |
| --- | --- | --- |
| `UnsupportedError` (`capability` set) | A method other than `canShare`, `available` or `watch` on a capability with no driver. | Check `supported` before showing the control. |
| `NotAllowedError` (browser) | Clipboard read denied, or `share()` / `writeText()` not called from a click. | Call from an event handler; explain the permission. |
| `GeolocationPositionError` (browser) | `current()` denied (code 1), unavailable (2) or timed out (3). | Show a message, and offer a manual address. |

`share()` resolving to `false` and `authenticate()` or `capture()` resolving to `false` / `null` are cancels, not errors.

## Testing

`createMemoryNativeDrivers()` returns six drivers that work in Node and in a DOM test, plus two logs: `shared` (every payload passed to `share`) and `haptics_log` (every kind passed to `impact`). Its defaults:

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
// app/features/invoices/share-invoice.test.tsx
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { createMemoryNativeDrivers } from 'kitr/native'
import { nativeProvider } from 'kitr/native/provider'
import { createTestApp } from 'kitr/testing'
import { renderWithKitr } from 'kitr/testing/react'
import { describe, expect, it } from 'vitest'
import { InvoiceLock } from './invoice-lock'
import { ShareInvoice } from './share-invoice'

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

To test a fallback, leave a capability out on purpose. `createNative()` with no drivers in Node reports every capability unsupported:

```ts
// app/features/invoices/copy-or-explain.test.ts
import { createNative } from 'kitr/native'
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

Each capability has its own driver interface. A driver is a plain object (or a class instance: methods run with the driver as `this`):

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

Register a driver from a provider's `register()`, so it is in place before the `native` service is built. This one gives the Capacitor shell real haptics with [`@capacitor/haptics`](https://capacitorjs.com/docs/apis/haptics). Install it with `pnpm add @capacitor/haptics`, then create the provider with `kitr make:provider native_drivers`:

```ts
// app/providers/native_drivers_provider.ts
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { defineProvider } from 'kitr/app'
import type { HapticKind, HapticsDriver } from 'kitr/native'

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

Add `() => import('#app/providers/native_drivers_provider')` to `providers` in `kitrrc.ts`. Inside the iOS or Android app, `native.haptics.name` is now `'mobile'` and `impact('success')` plays the system success pattern; in the browser the web driver still applies. A registered driver has priority 10 by default, and a higher `priority` wins when two providers register the same capability.

The Electron shell runs Node only in the main process, so a native driver there calls main over IPC. Add a channel to the IPC contract the desktop platform wrote, handle it in main with Electron's [`clipboard`](https://www.electronjs.org/docs/latest/api/clipboard) module, and wrap the client in a driver:

```ts
// app/native/electron-clipboard.ts
import { createIpcClient } from 'kitr/desktop/client'
import type { ClipboardDriver } from 'kitr/native'

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
import { handleIpc } from 'kitr/desktop/main'

handleIpc<{ 'clipboard.read': () => string; 'clipboard.write': (text: string) => void }>(ipcMain, {
  'clipboard.read': () => clipboard.readText(),
  'clipboard.write': (_event, text) => clipboard.writeText(text),
})
// ...
```

Then set it in `config/native.ts`, as shown under [Configure](#configure). `electronClipboard()` returns `undefined` in a plain browser, so the web driver still applies to the web build. The types are under `ClipboardDriver`, `ShareDriver`, `HapticsDriver`, `GeolocationDriver`, `CameraDriver` and `BiometricsDriver` in the [API reference](/packages/native/api).

## Next steps

- [API reference](/packages/native/api)
- [Platform](/packages/platform): where the app runs, online state, deep links and the back button.
- [Auth](/packages/auth): sign-in and passkeys verified on the server.
- [Uploads](/packages/uploads): send photos from `camera.capture()` to your server.
- [Mobile](/packages/mobile): the Capacitor shell that native drivers plug into.
- [Web Share API on MDN](https://developer.mozilla.org/docs/Web/API/Web_Share_API): which browsers share files and which only share links.
