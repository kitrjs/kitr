---
'@kitr/cli': minor
'@kitr/api': patch
'@kitr/devtools': patch
---

`kitr generate` runs every generator (the types under `.kitr/` and each package's own step, `api:sync` for `@kitr/api`) and has `--check` and `--watch`. `kitr dev` and `kitr build` run it first, so `routes.gen.ts` is kept fresh too. `kitr typecheck` generates and then runs `tsc --noEmit`, and the kits' `typecheck` script is now `kitr typecheck` instead of `kitr types && tsc --noEmit`. `kitr types` and `kitr api:sync` still work. `kitr add devtools` writes a comment above the provider in `kitrrc.ts` saying the Vite plugin strips it from production builds.
