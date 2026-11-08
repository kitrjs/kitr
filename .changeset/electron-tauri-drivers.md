---
"@kitr/native": minor
"@kitr/notifications": minor
"@kitr/files": minor
"@kitr/secure-storage": minor
"@kitr/updater": minor
"@kitr/desktop": minor
"@kitr/tauri": minor
"@kitr/platform": minor
"@kitr/cli": minor
"@kitr/kit-desktop": minor
"@kitr/kit-tauri": minor
---

Electron and Tauri drivers for the five device packages. In Electron they run in the window and call `handleKitrIpc()` in main over `kitr:*` channels: `safeStorage` for secrets (ciphertext in `userData`, refused when the OS has no vault), `Notification` with click and close events and the badge, `dialog` plus `fs` for files (only paths a dialog returned in this session), `electron-updater` for updates (an optional peer, loaded on first use), and clipboard, Touch ID, `net.isOnline()`, `nativeTheme`, `powerMonitor` and `shell.openExternal` for native. In Tauri they use the official plugins, imported lazily: Stronghold (password kept in the OS keyring) for secrets, notification, dialog and fs, updater and process, clipboard-manager, os and opener. A missing plugin rejects with `E_DRIVER_UNAVAILABLE` and the install command. `@kitr/platform` gains `registerShellModules()` and `loadShellModule()` so a shell registers literal `import()` loaders that the bundler can see; `@kitr/tauri` registers them for every plugin it scaffolds. `@kitr/desktop` exports `handleKitrDevices()` and `KITR_CHANNELS`, and `allowChannels()` now lets through only the exact `kitr:*` names main serves, not every name that starts with `kitr:`. `openExternal` opens only `http:`, `https:`, `mailto:` and `tel:` links unless `externalProtocols` says otherwise. The Electron scaffold now builds a main bundle named `index.js` and a CommonJS preload that bundles kitr (a sandboxed preload can require only `electron`), writes a `version` into `package.json` for electron-builder, and `createMainWindow()` finds the preload and client next to the app's own main bundle instead of next to kitr. The Tauri scaffold installs, registers and permits all the plugins, and `kitr add <device package>` installs the peers it needs for the project's Electron and Tauri platforms. The kit-desktop and kit-tauri home pages gain a device card.
