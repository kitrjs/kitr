---
title: API
description: Every export of kitr/native, with its signature.
order: 2
---

# API

Every export of `kitr/native`, `kitr/native/react`, `kitr/native/provider`, read from the published type definitions. The [guide](/packages/native) shows them in use.

## kitr/native

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

### createNative

```ts
function createNative(config?: NativeConfig, app?: KitrApp): Native;
```

### useNative

```ts
function useNative(app: KitrApp): Native;
```

### webBiometrics

```ts
function webBiometrics(): BiometricsDriver | null;
```

WebAuthn user verification with a platform authenticator (Touch ID, Windows Hello).

### webCamera

```ts
function webCamera(): CameraDriver | null;
```

### webClipboard

```ts
function webClipboard(): ClipboardDriver | null;
```

### webGeolocation

```ts
function webGeolocation(): GeolocationDriver | null;
```

### webHaptics

```ts
function webHaptics(): HapticsDriver | null;
```

### webShare

```ts
function webShare(): ShareDriver | null;
```

### UnsupportedError

```ts
class UnsupportedError extends Error {
  capability: NativeCapability;
  constructor(capability: NativeCapability);
}
```

### defineConfig

```ts
const defineConfig: <const C extends NativeConfig>(config: C) => C;
```

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

### Capability

```ts
interface Capability<T> {
  supported: boolean;
  driver: T;
  name: string;
}
```

### ClipboardDriver

```ts
interface ClipboardDriver {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
}
```

Device capabilities behind one API: clipboard, share sheet, haptics, geolocation, camera and
biometrics. Each is its own capability, so a platform package can replace one without touching
the others; the web drivers use the matching browser API and report `supported: false` elsewhere.

### GeolocationDriver

```ts
interface GeolocationDriver {
  current(options?: {
    highAccuracy?: boolean;
    timeout?: number;
  }): Promise<Position>;
  watch(listener: (position: Position) => void, options?: {
    highAccuracy?: boolean;
  }): () => void;
}
```

### HapticsDriver

```ts
interface HapticsDriver {
  impact(kind: HapticKind): Promise<void>;
}
```

### Native

```ts
interface Native {
  clipboard: Capability<ClipboardDriver> & ClipboardDriver;
  share: Capability<ShareDriver> & ShareDriver;
  haptics: Capability<HapticsDriver> & HapticsDriver;
  geolocation: Capability<GeolocationDriver> & GeolocationDriver;
  camera: Capability<CameraDriver> & CameraDriver;
  biometrics: Capability<BiometricsDriver> & BiometricsDriver;
  /** Which capabilities have a working driver, for devtools and feature gating. */
  supported(): Record<NativeCapability, boolean>;
}
```

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

### Photo

```ts
interface Photo {
  blob: Blob;
  type: string;
  /** Where the image came from. */
  source: 'camera' | 'library';
}
```

### Position

```ts
interface Position {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}
```

### ShareDriver

```ts
interface ShareDriver {
  canShare(payload: SharePayload): boolean;
  /** Resolves to true when shared, false when dismissed. */
  share(payload: SharePayload): Promise<boolean>;
}
```

### SharePayload

```ts
interface SharePayload {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}
```

### HapticKind

```ts
type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';
```

### NativeCapability

```ts
type NativeCapability = 'clipboard' | 'share' | 'haptics' | 'geolocation' | 'camera' | 'biometrics';
```

## kitr/native/react

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

Current position, updated while mounted when `watch` is true.

### useNative

```ts
function useNative(): Native;
```

### useShare

```ts
function useShare(): {
  supported: boolean;
  canShare: (payload: SharePayload) => boolean;
  share: (payload: SharePayload) => Promise<boolean>;
};
```

`const { share, canShare } = useShare()`: the share sheet, with a flag to hide the button where there is none.

## kitr/native/provider

### nativeProvider

```ts
const nativeProvider: import("@kitr/core").KitrProvider;
```

Binds `native` from the drivers platform packages registered (`clipboard`, `share`, `haptics`,
`geolocation`, `camera`, `biometrics`) with web drivers for the rest.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
