# Agent guide

This app is built with kitr. Each section below is maintained by `kitr add`.

## kitr: conventions

- Import framework code from the `@kitr/*` package that `kitr add` installed (`@kitr/router`, `@kitr/query`, ...). Each re-exports the upstream library unchanged plus kitr helpers. `kitr` itself is the CLI and the `kitrrc.ts` config (`kitr/app`, `kitr/env`).
- Where the app runs is a platform in `kitrrc.ts` (`platforms: { site: web({...}), api: server({...}) }`). `kitr dev <name>` / `kitr build <name>` / `kitr start <name>` run one or all; `kitr config <name> <option> <value>` edits options; native projects live in `platforms/<name>/`.
- Wiring lives in `kitrrc.ts` and `config/*.ts`. Generated types live in `.kitr/` (`kitr types`, also run by `kitr dev` and `kitr build`); import them from `#kitr/*`. Run `kitr doctor` after changes.

## kitr: structure

- Every kind of file has one home. `kitr make` lists them with the path each `kitr make:<kind> <name>` writes; create files with those commands instead of by hand.
- `app/` is what Vite bundles: pages, layouts, components, hooks, stores, queries, actions, validators, exceptions, providers, channels. `server/` is the standalone server and never imports React: controllers, services, middleware, jobs, mail. A declaration both sides read lives in `app/`.
- File names are kebab-case. The file carries a kind suffix exactly when its export does (`UsersController` in `users-controller.ts`, `BillingService` in `billing-service.ts`); `define*()` files have none (`server/jobs/send-receipt.ts`). Pages are named by their URL path.
- Group by feature inside the kind folder: `kitr make:controller admin/users` writes `server/controllers/admin/users-controller.ts`.
- Import across folders with `#app/*`, `#components/*`, `#server/*`, `#config/*`, `#kitr/*`; relative imports only inside one folder.

## kitr: logger

- Log through `ctx.logger` (request-scoped, carries the request id) or `app.container.use('logger')`. Never `console.log` in server code.

## kitr: server

- Server code lives under `server/` and never imports React. Services come from the request-scoped container (`useRequestApp()`), logs from `ctx.logger`.
- `server/main.ts` (written by the server platform) exports `server`; providers' `ready`/`shutdown` run on `server.listen()`. Endpoints and sockets come from the route table in `server/routes.ts` (`createServer({ routes })`). A web platform in the same app answers those paths through the same object via `app/server.ts` (Start's server entry asks `server.handles(request)` first).

## kitr: api

- Endpoints: `server/routes.ts` (`defineRoutes([api], ...)` with `.get/.post/.resource` from `@kitr/api/routes`; realtime adds `.ws` to the same table), controllers in `server/controllers/<name>_controller.ts` (`kitr make:controller <name> --resource`). Validators go in `static validation = { store: { body: schema } }`.
- Actions are for this app's own UI; API routes are for anything else (mobile, partners, webhooks) or when you want REST + OpenAPI.
- The client is typed from `ServerRoutes` (`typeof routes.$types`); call `registerRoutes(api, routes.toJSON())` or use `kitr api:sync` to write the route table and openapi.json.

## kitr: db

- `config/db.ts` connects the ORM; controllers and actions read it with `useDb<AppDb>(ctx.app)` or `ctx.app.container.use('db')`. Migrations are the ORM's own tooling.

## kitr: realtime

- Channels are defined once in `app/channels/*.ts` with `defineChannel` and served by `.ws(path, { channels })` (or `.sse`) on the server route table (`server/routes.ts`, methods from `@kitr/realtime/routes`). The server emits with `app.container.use('realtime').use(channel, params).emit(event, data)` (`{ app }` is on every HttpContext and job); components subscribe with `useChannel(realtime(), channel, params)` from `@kitr/realtime/react` and events update the query cache via `effects`.
- Switch transports in `config/realtime.ts`: `socket.io` (rooms, adapters; client from `@kitr/realtime/socket.io`) or `sse` (plain HTTP, no upgrade; server from `@kitr/realtime/sse/server`).

## kitr: testing

- `pnpm test` runs Vitest. Components: `renderWithKitr(<X />, { app, queryData })` from `@kitr/testing/react`. APIs: `createTestClient(server).get('/api/x')`. No running backend is needed.

## kitr: platform api

- `kitr dev <name>` runs server/main.ts with tsx watch; `kitr start <name>` runs the production server; tests import `server` from it and call `server.fetch(new Request(...))`, no port needed.
- Endpoints and sockets live in `server/routes.ts` (`defineRoutes([api, realtime], ...)`), passed to `createServer({ routes })`; controllers in `server/controllers/`. Config comes from `config/server.ts`; the port comes from the platform options in kitrrc.ts, `PORT` or `kitr dev <name> --port`.
- Never import React or browser APIs under `server/`; this entry must stay runnable without a DOM.
