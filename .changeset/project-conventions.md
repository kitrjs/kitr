---
"@kitr/core": minor
"@kitr/cli": minor
"@kitr/api": minor
"@kitr/http": minor
"@kitr/router": minor
"@kitr/actions": patch
"@kitr/forms": patch
"@kitr/jobs": patch
"@kitr/mail": patch
"@kitr/query": patch
"@kitr/react": patch
"@kitr/realtime": patch
"@kitr/state": patch
"@kitr/testing": patch
"@kitr/kit-saas": patch
"@kitr/kit-site": patch
"@kitr/kit-realtime": patch
---

One home per kind of file, and generators that follow it. `kitr make` lists every generator with the path it writes; `--dry-run` works on every `make:*`; nested names (`make:controller admin/users`) put the file in a feature folder inside the kind's home; a mistyped kind names the one you meant. New `make:layout` writes `app/layouts/<name>.tsx` and adds the `.layout()` link to `app/routes.ts`, and `make:provider` now lists the provider in `kitrrc.ts`.

New default locations: generated files are kebab-case (`users-controller.ts`, `billing-service.ts`), `make:middleware` writes to `server/middleware/`, and `make:queries` to `app/queries/<resource>.ts`. The kits follow suit (`app/validators/`, `app/queries/`, `app/layouts/`, kebab controller names). Existing projects keep working: nothing resolves files by name.

`@kitr/core/package` exports `generatorFile` and `naming.split`, so a package's generators get the same naming and nesting; `Generator` gains `definition` and `usage` for the listing.
