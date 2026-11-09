---
"@kitr/cli": patch
"@kitr/core": patch
---

An app can hook its own step into `kitr generate`: list it under `generate` in `kitrrc.ts`, as `{ name: 'content', run: 'node scripts/content.mjs', watch: ['content/**'] }` or with `run: () => import('./scripts/content')`. App steps run after the type generators and the package steps in `kitr generate`, `kitr dev`, `kitr build` and `kitr typecheck`; `kitr generate --check` skips them like the package steps, and the new `kitr generate --quiet` shows a step's output only when it fails. `kitr doctor` lists each step.
