---
title: API
description: Every export of @kitr/native, with its signature.
order: 2
---

# API

Every export of `@kitr/native`, `@kitr/native/react`, `@kitr/native/provider`, read from the published type definitions. The [guide](/packages/native) shows them in use.

## @kitr/native

### createMemoryNativeDrivers

```ts
function createMemoryNativeDrivers(overrides?: NativeConfig['drivers']): {
  clipboard: ClipboardDriver;
  share: ShareDriver;
  haptics: HapticsDriver;
  geolocation: GeolocationDriver;
  camera: CameraDriver;
  biometrics: BiometricsDriver;
  shared: SharePayload[];
  haptics_log: HapticKind[];
};
```

In-memory drivers for all six capabilities, for tests and the server. `shared` and `haptics_log`
record what was shared and played; pass overrides to replace any driver.

### createNative

```ts
function createNative(config?: NativeConfig, app?: KitrApp): Native;
```

Build the `native` service. Per capability it uses `config.drivers`, else the driver a platform
registered on `app`, else the web driver, else an unsupported stand-in.

### useNative

```ts
function useNative(app: KitrApp): Native;
```

The app's `native` service, outside React. Same as `app.container.use('native')`.

### webBiometrics

```ts
function webBiometrics(options?: {
  storageKey?: string;
}): BiometricsDriver | null;
```

WebAuthn user verification with a platform authenticator (Touch ID, Windows Hello, Android
screen lock). The first call registers a device-only credential for this site (that prompt is
itself the check); later calls ask for that credential by id, so people without a passkey get
the fingerprint or PIN prompt rather than an empty passkey picker. A local presence check, like
the native ones: to prove identity to your server, verify a WebAuthn assertion there.

### webCamera

```ts
function webCamera(): CameraDriver | null;
```

Camera driver that opens a hidden image file input, with `capture` for the camera source.
Resolves null when cancelled; null itself only where there is no `document`.

### webClipboard

```ts
function webClipboard(): ClipboardDriver | null;
```

Clipboard driver on the Clipboard API. Null where `navigator.clipboard` is missing (no HTTPS, no browser).

### webGeolocation

```ts
function webGeolocation(): GeolocationDriver | null;
```

Geolocation driver on the browser Geolocation API. Null where `navigator.geolocation` is missing.

### webHaptics

```ts
function webHaptics(): HapticsDriver | null;
```

Haptics driver that maps each kind to a `navigator.vibrate` pattern. Null where vibration is missing.

### webShare

```ts
function webShare(): ShareDriver | null;
```

Share driver on Web Share. Resolves false when dismissed; null where `navigator.share` is missing.

### UnsupportedError

```ts
class UnsupportedError extends Error {
  capability: NativeCapability;
  constructor(capability: NativeCapability);
}
```

Thrown when a method is called on a capability that has no driver here. `capability` names it.

### defineConfig

```ts
const defineConfig: <const C extends NativeConfig>(config: C) => C;
```

Types `config/native.ts`. Returns the object unchanged.

### BiometricsDriver

```ts
interface BiometricsDriver {
  /** Whether the device has an enrolled biometric or device credential. */
  available(): Promise<boolean>;
  /** Prompt; resolves to true on success, false when cancelled or failed. */
  authenticate(options?: {
    reason?: string;
  }): Promise<boolean>;
}
```

Asks for a fingerprint, face or device PIN to confirm someone is at the device.

### CameraDriver

```ts
interface CameraDriver {
  /** Take a photo (or, on the web, open the capture-enabled file input). */
  capture(options?: {
    source?: 'camera' | 'library';
    quality?: number;
  }): Promise<Photo | null>;
}
```

Takes or picks a photo.

### Capability

```ts
interface Capability<T> {
  /** True when a driver exists for this capability here. */
  supported: boolean;
  /** The active driver (a stand-in that rejects with `UnsupportedError` when unsupported). */
  driver: T;
  /** Where the driver came from: `configured`, the registering platform, `native`, `web` or `unsupported`. */
  name: string;
}
```

What every capability on the `native` service carries next to its driver's methods.

### ClipboardDriver

```ts
/** Reads and writes plain text on the system clipboard. */
interface ClipboardDriver {
  /** Resolves to the clipboard's text. Browsers ask permission first and reject when refused. */
  readText(): Promise<string>;
  /** Puts `text` on the clipboard. On the web, call it from a click or key press. */
  writeText(text: string): Promise<void>;
}
```

Reads and writes plain text on the system clipboard.

### GeolocationDriver

```ts
interface GeolocationDriver {
  /** Resolve the current position. `highAccuracy` asks for GPS; `timeout` is in milliseconds. */
  current(options?: {
    highAccuracy?: boolean;
    timeout?: number;
  }): Promise<Position>;
  /** Call `listener` with each new position until the returned function is called. */
  watch(listener: (position: Position) => void, options?: {
    highAccuracy?: boolean;
  }): () => void;
}
```

Reads the device's location once or continuously.

### HapticsDriver

```ts
interface HapticsDriver {
  /** Play the feedback for `kind`. */
  impact(kind: HapticKind): Promise<void>;
}
```

Plays haptic feedback (a vibration pattern on the web).

### Native

```ts
interface Native {
  /** Read and write the clipboard. */
  clipboard: Capability<ClipboardDriver> & ClipboardDriver;
  /** Open the share sheet. */
  share: Capability<ShareDriver> & ShareDriver;
  /** Play haptic feedback. */
  haptics: Capability<HapticsDriver> & HapticsDriver;
  /** Read or follow the device's location. */
  geolocation: Capability<GeolocationDriver> & GeolocationDriver;
  /** Take or pick a photo. */
  camera: Capability<CameraDriver> & CameraDriver;
  /** Confirm presence with a fingerprint, face or device PIN. */
  biometrics: Capability<BiometricsDriver> & BiometricsDriver;
  /** Which capabilities have a working driver, for devtools and feature gating. */
  supported(): Record<NativeCapability, boolean>;
}
```

The `native` service: six device capabilities, each with its methods and its `supported` flag.

### NativeConfig

```ts
interface NativeConfig {
  /** Replace individual drivers (tests, custom hardware). */
  drivers?: Partial<{
    clipboard: ClipboardDriver;
    share: ShareDriver;
    haptics: HapticsDriver;
    geolocation: GeolocationDriver;
    camera: CameraDriver;
    biometrics: BiometricsDriver;
  }>;
}
```

Options for `config/native.ts` and `createNative()`.

### Photo

```ts
interface Photo {
  /** The image data (a `File` on the web). */
  blob: Blob;
  /** Its MIME type, such as `image/jpeg`. */
  type: string;
  /** Where the image came from. */
  source: 'camera' | 'library';
}
```

A photo taken with the camera or picked from the library.

### Position

```ts
interface Position {
  /** Degrees north of the equator. */
  latitude: number;
  /** Degrees east of Greenwich. */
  longitude: number;
  /** Radius of uncertainty, in metres. */
  accuracy: number;
  /** Metres above sea level, or null when unknown. */
  altitude?: number | null;
  /** Direction of travel in degrees from north, or null when unknown. */
  heading?: number | null;
  /** Metres per second, or null when unknown. */
  speed?: number | null;
  /** When the fix was taken, in milliseconds since the epoch. */
  timestamp: number;
}
```

A location fix, in the shape of the browser's `GeolocationCoordinates` plus its time.

### ShareDriver

```ts
interface ShareDriver {
  /** Whether this payload can be shared here, so a share button can hide itself. */
  canShare(payload: SharePayload): boolean;
  /** Resolves to true when shared, false when dismissed. */
  share(payload: SharePayload): Promise<boolean>;
}
```

Opens the system share sheet.

### SharePayload

```ts
interface SharePayload {
  /** Title shown by targets that have one, such as an email subject. */
  title?: string;
  /** Body text. */
  text?: string;
  /** A link to share. */
  url?: string;
  /** Files to share. Check `canShare({ files })` first: not every device shares files. */
  files?: File[];
}
```

What to hand to the share sheet. Every field is optional; most targets use `url` or `text`.

### HapticKind

```ts
type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';
```

The feel of a haptic: three impact strengths, three outcomes and a selection tick.

### NativeCapability

```ts
type NativeCapability = 'clipboard' | 'share' | 'haptics' | 'geolocation' | 'camera' | 'biometrics';
```

The name of one of the six capabilities, as used in `supported()` and `app.drivers.register()`.

## @kitr/native/react

### useClipboard

```ts
function useClipboard(timeout?: number): {
  copy: (text: string) => Promise<void>;
  copied: boolean;
  supported: boolean;
};
```

`const { copy, copied } = useClipboard()`: copy text and show a confirmation for `timeout` ms.

### useGeolocation

```ts
function useGeolocation(options?: {
  watch?: boolean;
  highAccuracy?: boolean;
}): {
  position: Position | null;
  error: Error | null;
  supported: boolean;
};
```

`{ position, error, supported }`: the current position, read on mount and updated while mounted
when `watch` is true. `error` holds a failure of the first read.

### useNative

```ts
function useNative(): Native;
```

The app's `native` service in a component.

### useShare

```ts
function useShare(): {
  supported: boolean;
  canShare: (payload: SharePayload) => boolean;
  share: (payload: SharePayload) => Promise<boolean>;
};
```

`const { share, canShare } = useShare()`: the share sheet, with a flag to hide the button where there is none.

## @kitr/native/provider

### nativeProvider

```ts
const nativeProvider: import("@kitr/core").KitrProvider;
```

Binds `native` from the drivers platform packages registered (`clipboard`, `share`, `haptics`,
`geolocation`, `camera`, `biometrics`) with web drivers for the rest.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
