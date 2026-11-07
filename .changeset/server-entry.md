---
"kitr": patch
"@kitr/core": patch
"@kitr/cli": patch
"@kitr/server": patch
"@kitr/vite": patch
"@kitr/jobs": patch
"@kitr/mail": patch
"@kitr/uploads": patch
---

The standalone server in React kits now boots the providers from `kitrrc.ts` with the config from `config/` (a generated `config/index.ts`), the same way the server kit does, so server packages such as db, jobs, mail and uploads run under `kitr dev api`. Server-only config files stay out of the browser bundle. `app.ready()` is idempotent and runs when serving through `fetch()` too. Jobs are listed in `config/jobs.ts`, uploads mount with `mountUploads(server)`, and `createSmtpTransport` takes the nodemailer module.
