---
"@kitr/core": patch
"@kitr/kit-saas": patch
"@kitr/kit-site": patch
"@kitr/kit-realtime": patch
"@kitr/kit-desktop": patch
"@kitr/kit-tauri": patch
"@kitr/kit-mobile": patch
---

`@kitr/core/package` exports `startRoot()` and `displayName()`, the template helpers the official kits used to carry as byte-identical copies (the Start root layout in three kits, the app display name in three). The kits import them instead, so a fix to the generated `app/routes/__root.tsx` lands once. Scaffolded output is unchanged.
