---
"@kitr/cli": patch
---

New projects no longer write `directories.routes` in `kitrrc.ts`: the route table in `app/routes.ts` is code, and a missing `routes` directory already means code routes. The scaffolded `.gitignore` ignores `*.log`.
