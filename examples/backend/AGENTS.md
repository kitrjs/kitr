# Agent guide

This is a server-only kitr app (no React). Each section below is maintained by `kitr add`.

## kitr: conventions

- Routes in `start/routes.ts`, controllers in `app/controllers/*_controller.ts`, config in `config/*.ts`, wiring in `kitrrc.ts`.
- Start with `pnpm dev`; the server is `server.ts`. Run `kitr doctor` after changes.

## kitr: logger

- Log through `ctx.logger` (request-scoped, carries the request id) or `app.container.use('logger')`. Never `console.log` in server code.

## kitr: server

- Server code never imports React. Services come from the request-scoped container (`useRequestApp()`), logs from `ctx.logger`.
- Providers' `ready`/`shutdown` run on `server.listen()`; in TanStack Start the server is a fetch handler (`server.fetch`).

## kitr: api

- Routes: `start/routes.ts` (`defineRoutes`), controllers in `app/controllers/<name>_controller.ts` (`kitr make:controller <name> --resource`). Validators go in `static validation = { store: { body: schema } }`.
- Actions are for this app's own UI; API routes are for anything else (mobile, partners, webhooks) or when you want REST + OpenAPI.
- The client is typed from `typeof routes.$types`; call `registerRoutes(api, routes.toJSON())` or use `kitr api:sync` to write the route table and openapi.json.

## kitr: db

- `config/db.ts` connects the ORM; controllers and actions read it with `useDb<AppDb>(ctx.app)` or `ctx.app.container.use('db')`. Migrations are the ORM's own tooling.

## kitr: socket

- Channels are defined once in `app/channels/*.ts` with `defineChannel`. Server emits with `sockets.use(channel, params).emit(event, data)`; the client subscribes with `useSubscription(channel(socket, def).subscription(), params)` and events update the query cache via `effects`.

## kitr: testing

- `pnpm test` runs Vitest. Components: `renderWithKitr(<X />, { app, queryData })` from `kitr/testing/react`. APIs: `createTestClient(server).get('/api/x')`. No running backend is needed.
