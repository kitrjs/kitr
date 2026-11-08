---
'@kitr/vite': minor
'@kitr/core': patch
---

Devtools can run in production. `enabled: true` in `config/devtools.ts` keeps `@kitr/devtools/provider` in production builds (an expression is decided at runtime); without it, production builds still leave it out. `kitr({ devtools: true })` forces it in. The devtools overview now opens with a live demo of the panel.
