---
"@kitr/native": minor
"@kitr/notifications": minor
"@kitr/files": minor
"@kitr/secure-storage": minor
"@kitr/updater": minor
---

The Capacitor placeholders are real drivers, so on a phone the five device packages use the OS instead of browser APIs inside the WebView. `native` drives the clipboard, share sheet, haptics and geolocation (`@capacitor/clipboard`, `share`, `haptics`, `geolocation`); `notifications` uses `@capacitor/local-notifications` (OS-scheduled notifications that survive the app closing, Android channels, permission flow) and exports `capacitorPush()` for `@capacitor/push-notifications` (register, token, received and action listeners); `files` opens the system picker (`@capawesome/capacitor-file-picker`), saves through `@capacitor/filesystem` plus the share sheet, and exports `capacitorFileStore()` for read, write, delete, list and stat under the app's directories; `secure-storage` uses the Keychain and Keystore (`@aparajita/capacitor-secure-storage`), never WebView storage; `updater` uses `@capawesome/capacitor-app-update` (Play in-app updates on Android, the App Store page on iOS). The plugins are optional peer dependencies, imported on first use so web bundles never load them; a missing plugin rejects with `E_DRIVER_UNAVAILABLE` naming what to install. `kitr add` installs the plugins in a project with the mobile platform.
