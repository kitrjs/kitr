---
"@kitr/actions": patch
---

`kitr types` finds actions on TypeScript 7. TypeScript 7's `typescript` package is the native compiler and no longer ships the compiler API, so the actions generator falls back to `@typescript/typescript6` (an optional peer dependency) when the project's `typescript` has none.
