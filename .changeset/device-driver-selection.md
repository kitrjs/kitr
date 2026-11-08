---
"@kitr/native": minor
"@kitr/notifications": minor
"@kitr/files": minor
"@kitr/secure-storage": minor
"@kitr/updater": minor
---

The five device packages choose their driver by `platform.runtime`. Each moves its web implementation to `src/drivers/web.ts` (memory drivers to `src/drivers/memory.ts`), adds a `Driver` type and `selectDriver(runtime)` in `src/driver.ts`, and ships placeholder `electron`, `tauri` and `capacitor` driver modules for the native drivers to fill in. The public API is unchanged and the sub-paths `./driver` and `./drivers/{web,electron,tauri,capacitor}` are new. In an Electron, Tauri or Capacitor shell with no driver registered, the service now throws a `KitrError` with code `E_DRIVER_UNAVAILABLE` naming the runtime and the package, instead of silently running the web driver in the WebView (for secure-storage, instead of encrypting secrets into WebView storage). Set `fallbackToWeb: true` in the package's config to keep the WebView behaviour on purpose.
