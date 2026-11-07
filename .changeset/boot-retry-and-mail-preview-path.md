---
"@kitr/core": patch
"@kitr/mail": patch
"@kitr/server": patch
"@kitr/shield": patch
"@kitr/actions": patch
"kitr": patch
"@kitr/cli": patch
---

`app.boot()` no longer caches a failed boot: when a provider throws during `register` or `boot`, the next `boot()` starts over instead of rethrowing the first error forever. `mailPreview()` now reads `previewPath` from `config/mail.ts` (and mounts nothing when it is `false`), as the option has always been documented. The CLI banner and the `kitr` package description say what kitr is today: one way to build web, mobile, desktop and backend apps. `inProduction(app?)` from `@kitr/core` is the one answer to "is this production?": the server's error masking, shield's HSTS and Secure cookie and the actions error path read it, so a Workers or Deno deployment that never sets `NODE_ENV` gets production defaults from the build mode.
