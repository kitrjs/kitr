---
"@kitr/actions": patch
---

`kitr types` no longer fails in a project on TypeScript 7. `@kitr/actions` reads `app/actions` with the TypeScript compiler API, which TypeScript 7 no longer ships, so it now brings its own TypeScript 6 instead of using the project's.
