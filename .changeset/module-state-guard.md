---
"@kitr/3d": patch
"@kitr/animation": patch
"@kitr/auth": patch
"@kitr/desktop": patch
"@kitr/devtools": patch
"@kitr/files": patch
"@kitr/jobs": patch
"@kitr/logger": patch
"@kitr/mobile": patch
"@kitr/monitoring": patch
"@kitr/native": patch
"@kitr/notifications": patch
"@kitr/storage": patch
"@kitr/tauri": patch
"@kitr/theme": patch
"@kitr/updater": patch
"@kitr/vite": patch
"@kitr/web": patch
---

Module-scope state in package sources is now checked in CI (`pnpm check:module-state`). Each remaining `let`, `Map`, `Set` or table at module scope carries a `kitr-allow-module-state` comment saying why it is process-wide by design. No behaviour change.
