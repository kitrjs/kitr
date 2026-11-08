---
title: API reference
description: Every export of @kitr/native, with its signature.
order: 2
---

# API reference

Every export of `@kitr/native`, `@kitr/native/react`, `@kitr/native/provider`, `@kitr/native/driver`, `@kitr/native/drivers/web`, `@kitr/native/drivers/electron`, `@kitr/native/drivers/tauri`, `@kitr/native/drivers/capacitor`, read from the published type definitions. The [guide](/packages/native/guide) shows them in use.

## @kitr/native

### capacitorClipboard

```ts
function capacitorClipboard(): ClipboardDriver;
```

Clipboard on `@capacitor/clipboard`: the OS pasteboard, with no permission prompt.

### capacitorGeolocation

```ts
function capacitorGeolocation(): GeolocationDriver;
```

Location on `@capacitor/geolocation` (Core Location, Fused Location). Asks for the location
permission first, as Android needs; rejects when it is refused.

### capacitorHaptics

```ts
function capacitorHaptics(): HapticsDriver;
```

Haptics on `@capacitor/haptics`: the Taptic Engine on iOS, the vibrator on Android.

### capacitorShare

```ts
function capacitorShare(): ShareDriver;
```

Share sheet on `@capacitor/share`. Resolves false when dismissed. `File` objects cannot cross the
bridge, so a payload with `files` is not shareable here: save the file with `@kitr/files` and share its `url`.

### createCapacitorNativeDrivers

```ts
function createCapacitorNativeDrivers(_options?: DriverOptions): Driver;
```

The native drivers for the Capacitor shell: clipboard, share sheet, haptics and geolocation on the
official plugins, each imported on first use. Camera and biometrics have no Capacitor driver yet
(`supported: false`); register one with `app.drivers.register()`.

### createElectronNativeDriver

```ts
function createElectronNativeDriver(_options?: DriverOptions): ElectronNativeDriver;
```

The native driver for the Electron shell, served over the `kitr:native:*` and `kitr:shell:open`
channels of `handleKitrIpc()`. Capabilities: `clipboard` (Electron's `clipboard`) and `biometrics`
(Touch ID on macOS; `available()` is false elsewhere). `share`, `haptics`, `geolocation` and
`camera` are `null`: a desktop has no share sheet or haptic motor, and the Chromium
geolocation needs a Google key, so those report `supported: false` rather than pretend.
`driver.system` has what desktop apps want beyond them: `openExternal`, `appVersion`,
`platform`, the system theme, online status and `powerMonitor` events.

Throws `E_DRIVER_UNAVAILABLE` when the preload bridge is missing (no `exposeIpc()` call).

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
registered on `app`, else the one `selectDriver()` picks for the runtime (the web drivers in a
browser; in a native shell `E_DRIVER_UNAVAILABLE` unless `fallbackToWeb` is set), else an
unsupported stand-in.

### createTauriNativeDriver

```ts
function createTauriNativeDriver(_options?: DriverOptions): TauriNativeDriver;
```

The native driver for the Tauri shell. `clipboard` is `@tauri-apps/plugin-clipboard-manager`;
`share`, `haptics`, `geolocation`, `camera` and `biometrics` are `null` (the matching Tauri
plugins are mobile-only, and a Tauri mobile build runs under Capacitor's driver set instead of
this one). `driver.system` has `openExternal` (`@tauri-apps/plugin-opener`), `platform`
(`@tauri-apps/plugin-os`), `appVersion` and the system theme (`@tauri-apps/api`) and online
status. Each plugin is imported on first use and is an optional peer: a missing one makes the
call that needs it reject with `E_DRIVER_UNAVAILABLE`.

### selectDriver

```ts
function selectDriver(runtime: Runtime, options?: DriverOptions): Driver;
```

The capability drivers for a runtime: the browser APIs on `web`, and each native shell's own
(Capacitor plugins, Electron dialogs, Tauri plugins). A shell with no drivers yet throws
`E_DRIVER_UNAVAILABLE` rather than falling back to the web ones, unless `fallbackToWeb` is set.

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

### DesktopSystem

```ts
interface DesktopSystem {
  /** The operating system: `darwin`, `win32`, `linux` (Electron) or `macos`, `windows`, `linux` (Tauri). */
  platform(): Promise<string>;
  /** The app's version from `package.json` / `tauri.conf.json`. */
  appVersion(): Promise<string>;
  /** Open a link in the default browser. Only `http:`, `https:`, `mailto:` and `tel:` are allowed. */
  openExternal(url: string): Promise<void>;
  /** Whether the system is in dark mode. */
  isDark(): Promise<boolean>;
  /** Listen for the system switching between light and dark. Returns the unsubscribe function. */
  onTheme(listener: (dark: boolean) => void): () => void;
  /** Whether the machine has a network connection. */
  isOnline(): Promise<boolean>;
}
```

What a desktop shell knows that the six capabilities do not cover.

### Driver

```ts
interface Driver {
  /** Where the drivers come from, shown as the capability's `name`: `web`, `electron`, `tauri`, `capacitor`. */
  name: string;
  clipboard: ClipboardDriver | null;
  share: ShareDriver | null;
  haptics: HapticsDriver | null;
  geolocation: GeolocationDriver | null;
  camera: CameraDriver | null;
  biometrics: BiometricsDriver | null;
}
```

What one runtime supplies for the `native` service: a driver per capability, or `null` where
the runtime has none (the capability then reports `supported: false`).

### ElectronNativeDriver

```ts
interface ElectronNativeDriver extends Driver {
  /** Desktop-only helpers; also `onPower` and `isOnBattery`, which only Electron has. */
  system: DesktopSystem & {
    /** Suspend, resume and battery/AC changes from Electron's `powerMonitor`. */
    onPower(listener: (event: PowerEvent) => void): () => void;
    /** Whether the computer runs on battery now. */
    isOnBattery(): Promise<boolean>;
  };
}
```

The Electron driver: the capabilities Electron has plus the `system` helpers.

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
  /**
   * In a native shell (Electron, Tauri, Capacitor) with no native drivers, use the web drivers
   * inside the WebView instead of throwing `E_DRIVER_UNAVAILABLE`. Default false.
   */
  fallbackToWeb?: boolean;
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

### TauriNativeDriver

```ts
interface TauriNativeDriver extends Driver {
  /** Desktop-only helpers, the same as on Electron except for power events, which Tauri has no plugin for. */
  system: DesktopSystem;
}
```

The Tauri driver: the capabilities the plugins cover plus the `system` helpers.

### DriverOptions

```ts
type DriverOptions = SelectDriverOptions;
```

Options of `selectDriver()`.

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

### PowerEvent

```ts
type PowerEvent = 'suspend' | 'resume' | 'battery' | 'ac';
```

A change in how the computer is powered, as `system.onPower` reports it.

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

## @kitr/native/driver

### selectDriver

```ts
function selectDriver(runtime: Runtime, options?: DriverOptions): Driver;
```

The capability drivers for a runtime: the browser APIs on `web`, and each native shell's own
(Capacitor plugins, Electron dialogs, Tauri plugins). A shell with no drivers yet throws
`E_DRIVER_UNAVAILABLE` rather than falling back to the web ones, unless `fallbackToWeb` is set.

### Driver

```ts
interface Driver {
  /** Where the drivers come from, shown as the capability's `name`: `web`, `electron`, `tauri`, `capacitor`. */
  name: string;
  clipboard: ClipboardDriver | null;
  share: ShareDriver | null;
  haptics: HapticsDriver | null;
  geolocation: GeolocationDriver | null;
  camera: CameraDriver | null;
  biometrics: BiometricsDriver | null;
}
```

What one runtime supplies for the `native` service: a driver per capability, or `null` where
the runtime has none (the capability then reports `supported: false`).

### DriverOptions

```ts
type DriverOptions = SelectDriverOptions;
```

Options of `selectDriver()`.

## @kitr/native/drivers/web

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

## @kitr/native/drivers/electron

### createElectronDriver

```ts
function createElectronDriver(_options?: DriverOptions): ElectronNativeDriver;
```

The native driver for the Electron shell, served over the `kitr:native:*` and `kitr:shell:open`
channels of `handleKitrIpc()`. Capabilities: `clipboard` (Electron's `clipboard`) and `biometrics`
(Touch ID on macOS; `available()` is false elsewhere). `share`, `haptics`, `geolocation` and
`camera` are `null`: a desktop has no share sheet or haptic motor, and the Chromium
geolocation needs a Google key, so those report `supported: false` rather than pretend.
`driver.system` has what desktop apps want beyond them: `openExternal`, `appVersion`,
`platform`, the system theme, online status and `powerMonitor` events.

Throws `E_DRIVER_UNAVAILABLE` when the preload bridge is missing (no `exposeIpc()` call).

### DesktopSystem

```ts
interface DesktopSystem {
  /** The operating system: `darwin`, `win32`, `linux` (Electron) or `macos`, `windows`, `linux` (Tauri). */
  platform(): Promise<string>;
  /** The app's version from `package.json` / `tauri.conf.json`. */
  appVersion(): Promise<string>;
  /** Open a link in the default browser. Only `http:`, `https:`, `mailto:` and `tel:` are allowed. */
  openExternal(url: string): Promise<void>;
  /** Whether the system is in dark mode. */
  isDark(): Promise<boolean>;
  /** Listen for the system switching between light and dark. Returns the unsubscribe function. */
  onTheme(listener: (dark: boolean) => void): () => void;
  /** Whether the machine has a network connection. */
  isOnline(): Promise<boolean>;
}
```

What a desktop shell knows that the six capabilities do not cover.

### ElectronNativeDriver

```ts
interface ElectronNativeDriver extends Driver {
  /** Desktop-only helpers; also `onPower` and `isOnBattery`, which only Electron has. */
  system: DesktopSystem & {
    /** Suspend, resume and battery/AC changes from Electron's `powerMonitor`. */
    onPower(listener: (event: PowerEvent) => void): () => void;
    /** Whether the computer runs on battery now. */
    isOnBattery(): Promise<boolean>;
  };
}
```

The Electron driver: the capabilities Electron has plus the `system` helpers.

### PowerEvent

```ts
type PowerEvent = 'suspend' | 'resume' | 'battery' | 'ac';
```

A change in how the computer is powered, as `system.onPower` reports it.

## @kitr/native/drivers/tauri

### createTauriDriver

```ts
function createTauriDriver(_options?: DriverOptions): TauriNativeDriver;
```

The native driver for the Tauri shell. `clipboard` is `@tauri-apps/plugin-clipboard-manager`;
`share`, `haptics`, `geolocation`, `camera` and `biometrics` are `null` (the matching Tauri
plugins are mobile-only, and a Tauri mobile build runs under Capacitor's driver set instead of
this one). `driver.system` has `openExternal` (`@tauri-apps/plugin-opener`), `platform`
(`@tauri-apps/plugin-os`), `appVersion` and the system theme (`@tauri-apps/api`) and online
status. Each plugin is imported on first use and is an optional peer: a missing one makes the
call that needs it reject with `E_DRIVER_UNAVAILABLE`.

### TauriNativeDriver

```ts
interface TauriNativeDriver extends Driver {
  /** Desktop-only helpers, the same as on Electron except for power events, which Tauri has no plugin for. */
  system: DesktopSystem;
}
```

The Tauri driver: the capabilities the plugins cover plus the `system` helpers.

## @kitr/native/drivers/capacitor

### capacitorClipboard

```ts
function capacitorClipboard(): ClipboardDriver;
```

Clipboard on `@capacitor/clipboard`: the OS pasteboard, with no permission prompt.

### capacitorGeolocation

```ts
function capacitorGeolocation(): GeolocationDriver;
```

Location on `@capacitor/geolocation` (Core Location, Fused Location). Asks for the location
permission first, as Android needs; rejects when it is refused.

### capacitorHaptics

```ts
function capacitorHaptics(): HapticsDriver;
```

Haptics on `@capacitor/haptics`: the Taptic Engine on iOS, the vibrator on Android.

### capacitorShare

```ts
function capacitorShare(): ShareDriver;
```

Share sheet on `@capacitor/share`. Resolves false when dismissed. `File` objects cannot cross the
bridge, so a payload with `files` is not shareable here: save the file with `@kitr/files` and share its `url`.

### createCapacitorDriver

```ts
function createCapacitorDriver(_options?: DriverOptions): Driver;
```

The native drivers for the Capacitor shell: clipboard, share sheet, haptics and geolocation on the
official plugins, each imported on first use. Camera and biometrics have no Capacitor driver yet
(`supported: false`); register one with `app.drivers.register()`.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
