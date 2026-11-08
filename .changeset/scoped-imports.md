---
"kitr": minor
"@kitr/cli": minor
"@kitr/core": patch
"@kitr/vite": patch
"@kitr/tailwind": patch
---

Apps import each package by its own name: `@kitr/query`, `@kitr/router/routes`, `@kitr/theme/styles.css`. The `kitr` package is now the CLI plus `kitr`, `kitr/app` and `kitr/env` from `@kitr/core`, and no longer re-exports other packages through `kitr/<name>` subpaths or lists them as optional peers. A package you have not installed is now a plain "Cannot find module '@kitr/<name>'" in the editor, `tsc` and the build, instead of an import that looked valid. Generated code, `AGENTS.md`, docs and examples use `@kitr/*`. `@kitr/tailwind` exports `preset.css`, which `kitr` used to serve.
