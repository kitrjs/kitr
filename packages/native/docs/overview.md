---
title: Overview
description: Clipboard, share sheet, haptics, location, camera and fingerprint unlock, each with a web fallback.
order: 0
---

# Native

## What it is

`@kitr/native` is a `native` service with six capabilities: clipboard, share, haptics, geolocation, camera and biometrics. Each says whether it is `supported`, uses the browser API by default, and can be swapped for a native driver. React hooks wrap each one.

Runs in the browser and in desktop and mobile shells. For files, use [files](/packages/files).

## Install

```sh
kitr add native
```

Adds `@kitr/native` and its provider. No config file. [Every change](/packages/native/guide#install).

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

Click **Copy link**: the label reads **Copied** and the URL is on the clipboard. The button hides itself where there is no Clipboard API. Next in the guide: [Copy your first link](/packages/native/guide#copy-your-first-link).

## Built on

| Capability | Web driver built on |
| --- | --- |
| Clipboard | [Clipboard API](https://developer.mozilla.org/docs/Web/API/Clipboard_API) |
| Share | [Web Share API](https://developer.mozilla.org/docs/Web/API/Web_Share_API) |
| Haptics | [`navigator.vibrate`](https://developer.mozilla.org/docs/Web/API/Navigator/vibrate) |
| Geolocation | [Geolocation API](https://developer.mozilla.org/docs/Web/API/Geolocation_API) |
| Camera | A file input with `capture` |
| Biometrics | [WebAuthn](https://developer.mozilla.org/docs/Web/API/Web_Authentication_API) with the device's own authenticator |

kitr adds the `supported` flag, `UnsupportedError`, the hooks, memory drivers for tests and a driver slot per capability.

## Problems it solves

- **Feature detection in every component.** [Check what the device supports](/packages/native/guide#check-what-the-device-supports).
- **Sharing that only works on phones.** [Open the share sheet](/packages/native/guide#open-the-share-sheet).
- **Feedback that feels flat.** [Give haptic feedback](/packages/native/guide#give-haptic-feedback).
- **Location and camera with different APIs per platform.** [Read the current location](/packages/native/guide#read-the-current-location).
- **Locking a screen behind a fingerprint.** [Unlock with biometrics](/packages/native/guide#unlock-with-biometrics).
- **Unsupported devices crashing.** [Handle unsupported capabilities](/packages/native/guide#handle-unsupported-capabilities).

## Further reading

- [Guide](/packages/native/guide).
- [API reference](/packages/native/api).
- [Web Share API on MDN](https://developer.mozilla.org/docs/Web/API/Web_Share_API) and [WebAuthn on MDN](https://developer.mozilla.org/docs/Web/API/Web_Authentication_API).
- [Platform](/packages/platform), [Mobile](/packages/mobile) and [Uploads](/packages/uploads).
