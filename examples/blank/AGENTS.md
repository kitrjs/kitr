# Agent guide

This app is built with kitr. Each section below is maintained by `kitr add`.

## kitr: conventions

- Import framework code from the `@kitr/*` package that `kitr add` installed (`@kitr/router`, `@kitr/query`, ...). Each re-exports the upstream library unchanged plus kitr helpers. `@kitr/kitr` is the CLI and the `kitrrc.ts` config (`@kitr/kitr/app`, `@kitr/kitr/env`).
- Where the app runs is a platform in `kitrrc.ts` (`platforms: { site: web({...}), api: server({...}) }`). `kitr dev <name>` / `kitr build <name>` / `kitr start <name>` run one or all; `kitr config <name> <option> <value>` edits options; native projects live in `platforms/<name>/`.
- Wiring lives in `kitrrc.ts` and `config/*.ts`; server code in `server/`. Generated files are written by `kitr generate` (types under `.kitr/`, the API route table), which `kitr dev`, `kitr build` and `kitr typecheck` run first; import the types from `#kitr/*`. Run `kitr doctor` after changes.

## kitr: structure

- Every kind of file has one home. `kitr make` lists them with the path each `kitr make:<kind> <name>` writes; create files with those commands instead of by hand.
- `app/` is what Vite bundles: pages, layouts, components, hooks, stores, queries, actions, validators, exceptions, providers, channels. `server/` is the standalone server and never imports React: controllers, services, middleware, jobs, mail. A declaration both sides read lives in `app/`.
- File names are kebab-case. The file carries a kind suffix exactly when its export does (`UsersController` in `users-controller.ts`, `BillingService` in `billing-service.ts`); `define*()` files have none (`server/jobs/send-receipt.ts`). Pages are named by their URL path.
- Group by feature inside the kind folder: `kitr make:controller admin/users` writes `server/controllers/admin/users-controller.ts`.
- Import across folders with `#app/*`, `#components/*`, `#server/*`, `#config/*`, `#kitr/*`; relative imports only inside one folder.
