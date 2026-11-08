---
'@kitr/consent': patch
'@kitr/files': patch
'@kitr/flags': patch
'@kitr/native': patch
'@kitr/notifications': patch
'@kitr/offline': patch
'@kitr/secure-storage': patch
'@kitr/updater': patch
---

Declare `@kitr/react` as a dependency of the packages whose `/react` hooks call `useApp()`. Their builds bundled a private copy of it, so `useFlag()`, `useClipboard()` and the other hooks looked for an app in a context the app's `<KitrProvider>` never filled and threw `useApp() must be used inside <KitrProvider>`.
