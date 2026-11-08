---
"@kitr/platform": minor
"@kitr/desktop": patch
"@kitr/tauri": patch
"@kitr/mobile": patch
---

`@kitr/platform` gains one runtime vocabulary and the shared halves of the native platforms. `detectRuntime()` answers `web`, `electron`, `tauri` or `capacitor` from globals alone, `platform.runtime` and `useRuntime()` report it, and `runtimeOf(app)`, `selectRuntimeDriver()` and `driverUnavailable()` are the helpers device packages pick drivers with. `kitr/platform/shell` exports `createShellProvider()`, which holds what the desktop, tauri and mobile runtime providers shared (shell detection, `platform` driver registration, the app-state default, the IPC bridge guard, the devtools line), and `kitr/platform/cli` exports `shellPlatformHooks()`, the scaffold, dev, build and doctor skeleton the three platform packages parameterise. The three providers and platform factories are now thin configurations of them; their options, scaffolds and commands are unchanged. `isElectron()`, `isTauri()` and `isCapacitor()` are `detectRuntime()` comparisons.
