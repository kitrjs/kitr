---
title: Native
description: Clipboard, share sheet, haptics, location, camera and fingerprint unlock, each with a web fallback.
order: 1
---

# Native

Six device capabilities behind one `native` service. Each one has a web driver (Clipboard API, Web Share, `navigator.vibrate`, Geolocation, a capture-enabled file input, WebAuthn) and reports `supported` so a button can hide itself where the device cannot do it. Mobile and desktop packages register drivers per capability, so the app code stays the same.

## Install

```sh
kitr add native
```

## In a component

```tsx
import { useClipboard, useShare, useGeolocation, useNative } from 'kitr/native/react'

function ShareLink({ url }: { url: string }) {
  const { copy, copied } = useClipboard()
  const { canShare, share } = useShare()
  return canShare({ url })
    ? <button onClick={() => share({ url })}>Share</button>
    : <button onClick={() => copy(url)}>{copied ? 'Copied' : 'Copy link'}</button>
}

function Unlock() {
  const { biometrics, haptics } = useNative()
  if (!biometrics.supported) return null
  return <button onClick={async () => { if (await biometrics.authenticate({ reason: 'Open your vault' })) haptics.impact('success') }}>Unlock</button>
}
```

On the web, `biometrics` uses WebAuthn with the device's own authenticator (Touch ID, Windows Hello, the Android screen lock): the first `authenticate()` registers a credential for this site on this device, and later calls ask for it. It proves someone is at the device, not who they are to your server; for sign-in, verify a passkey assertion on the server.

`useGeolocation({ watch: true })` keeps `position` fresh while mounted. Calling an unsupported capability rejects with `UnsupportedError`, so check `supported` first or catch it once in an error boundary.

## Drivers

Platform packages register `clipboard`, `share`, `haptics`, `geolocation`, `camera` and `biometrics` separately, and `native.supported()` says what is live. Tests pass `createMemoryNativeDrivers()` through `config.drivers`.

## What each one does

| Capability | Methods | Web driver |
| --- | --- | --- |
| `clipboard` | `read()`, `write(text)` | Clipboard API |
| `share` | `share({ title, text, url, files })` | Web Share, where the browser has it |
| `haptics` | `impact(style)` | `navigator.vibrate`, on Android browsers |
| `geolocation` | `current()`, `watch(callback)` | Geolocation API |
| `camera` | `takePhoto()`, `pickPhoto()` | A file input with `capture` |
| `biometrics` | `available()`, `authenticate({ reason })` | WebAuthn, with the device's own authenticator |

On iOS, Android and desktop, the platform packages swap in native drivers, so Face ID, the native share sheet and real haptics work with the same code.
