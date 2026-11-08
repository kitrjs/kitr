---
title: Overview
description: Clipboard, share sheet, haptics, location, camera and fingerprint unlock, each with a web fallback.
order: 0
---

# Native

Copy a link, open the share sheet, buzz the phone when an order goes through, read where someone is standing, take a photo, ask for a fingerprint: every app reaches for these sooner or later, and every platform has its own API for each one. Components end up checking `navigator.share`, `window.Capacitor` and the user agent before doing anything.

`@kitr/native` puts the six capabilities behind one service that says what works here and falls back when it doesn't.

## What it is

`@kitr/native` is a `native` service with six capabilities: clipboard, share, haptics, geolocation, camera and biometrics. Each reports whether it is `supported` on this device, has a web driver built on the matching browser API, and can be replaced by a native driver without changing the code that calls it. React hooks (`useClipboard`, `useShare`, `useGeolocation`, `useNative`) wrap the service, and an `UnsupportedError` tells you exactly which capability is missing.

It runs in the browser and in desktop and mobile shells. It does not sign people in: for that use [auth](/packages/auth), and for files people open and save use [files](/packages/files).

## Install

```sh
kitr add native
```

This installs `@kitr/native` and registers the provider in `kitrrc.ts`. There is no config file. The guide's [Install](/packages/native/guide#install) section lists every change.

## Quick start

`useClipboard()` copies text and flips `copied` to `true` for 1.5 seconds, long enough for a "Copied" label:

```tsx
// app/features/invoices/copy-invoice-link.tsx
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

Render `<CopyInvoiceLink invoiceId="inv_1042" />` on the invoice page. Ada clicks **Copy link**, the label reads **Copied**, and `https://app.acme.com/invoices/inv_1042` is on her clipboard. The button hides itself where the page has no Clipboard API, which is the case on plain `http://` pages other than `localhost`. In the desktop and mobile shells the same hook uses the native clipboard. The guide continues from here: [Copy your first link](/packages/native/guide#copy-your-first-link).

## Built on

| Capability | Web driver built on |
| --- | --- |
| Clipboard | [Clipboard API](https://developer.mozilla.org/docs/Web/API/Clipboard_API) |
| Share | [Web Share API](https://developer.mozilla.org/docs/Web/API/Web_Share_API) |
| Haptics | [`navigator.vibrate`](https://developer.mozilla.org/docs/Web/API/Navigator/vibrate) |
| Geolocation | [Geolocation API](https://developer.mozilla.org/docs/Web/API/Geolocation_API) |
| Camera | A file input with `capture` |
| Biometrics | [WebAuthn](https://developer.mozilla.org/docs/Web/API/Web_Authentication_API) with the device's own authenticator |

kitr adds the `supported` flag, the typed `UnsupportedError`, the React hooks, memory drivers for tests and a driver slot per capability that [mobile](/packages/mobile), [desktop](/packages/desktop) or your own code can fill.

## Problems it solves

- **Feature detection in every component.** Ask `native.share.supported` once; the service already knows. See [Check what the device supports](/packages/native/guide#check-what-the-device-supports).
- **Sharing that only works on phones.** The share sheet where there is one, a copied link where there is not. See [Open the share sheet](/packages/native/guide#open-the-share-sheet).
- **Feedback that feels flat.** Haptic taps on success and failure, ignored where unsupported. See [Give haptic feedback](/packages/native/guide#give-haptic-feedback).
- **Location and camera with different APIs per platform.** One call each, with the same result shape. See [Read the current location](/packages/native/guide#read-the-current-location) and [Take a photo](/packages/native/guide#take-a-photo).
- **Locking a screen behind a fingerprint.** `biometrics.authenticate()` on the device, verified by your server. See [Unlock with biometrics](/packages/native/guide#unlock-with-biometrics).
- **Unsupported devices crashing.** `UnsupportedError` is typed, so the fallback is a branch, not a catch-all. See [Handle unsupported capabilities](/packages/native/guide#handle-unsupported-capabilities).

## Further reading

- [Guide](/packages/native/guide): install, configure and every task.
- [API reference](/packages/native/api): every export and type.
- [Web Share API on MDN](https://developer.mozilla.org/docs/Web/API/Web_Share_API) and [WebAuthn on MDN](https://developer.mozilla.org/docs/Web/API/Web_Authentication_API): what each browser supports.
- [Platform](/packages/platform), [Mobile](/packages/mobile) and [Uploads](/packages/uploads): where the app runs, the shell native drivers plug into, and where photos go.
