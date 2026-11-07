---
"kitr": minor
"@kitr/core": patch
"@kitr/cli": minor
"@kitr/http": patch
"@kitr/cache": minor
"@kitr/shield": minor
"@kitr/jobs": minor
"@kitr/mail": minor
"@kitr/uploads": minor
"@kitr/flags": minor
"@kitr/consent": minor
"@kitr/offline": minor
"@kitr/secure-storage": minor
"@kitr/files": minor
"@kitr/notifications": minor
"@kitr/native": minor
"@kitr/updater": minor
---

Thirteen new packages: `cache`, `shield`, `jobs`, `mail`, `uploads`, `flags`, `consent`, `offline`, `secure-storage`, `files`, `notifications`, `native` and `updater`, each with a recipe, docs and a `kitr/<name>` entry. The CLI gains `make:job`, `make:mail`, `make:service`, `make:validator`, `make:test`, `make:component`, `make:hook` and `make:exception`. The container builds a synchronous binding once when `boot()` resolves dependants in parallel, and `kitr/http` sends the CSRF token the shield expects.
