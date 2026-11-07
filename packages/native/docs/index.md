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

`useGeolocation({ watch: true })` keeps `position` fresh while mounted. Calling an unsupported capability rejects with `UnsupportedError`, so check `supported` first or catch it once in an error boundary.

## Drivers

Platform packages register `clipboard`, `share`, `haptics`, `geolocation`, `camera` and `biometrics` separately, and `native.supported()` says what is live. Tests pass `createMemoryNativeDrivers()` through `config.drivers`.
