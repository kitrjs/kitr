---
'@kitr/toast': minor
'@kitr/theme': minor
---

Toasts move out of `@kitr/theme` into their own package, `@kitr/toast`: `toast`, `toastError` and `setToastImplementation`, plus a provider that mounts sonner's toaster from `config/toast.ts` and follows the theme. `@kitr/theme` no longer exports toasts or reads `toaster` from `config/theme.ts`.
