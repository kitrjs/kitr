# Agent guide

This is a server-only kitr app (no React). Each section below is maintained by `kitr add`.

## kitr: conventions

- Routes in `server/routes.ts`, controllers in `server/controllers/*_controller.ts`, config in `config/*.ts`, wiring in `kitrrc.ts` (the `server` platform under `platforms`).
- Start with `kitr dev`; the entry is `server/main.ts`. Run `kitr doctor` after changes.

## kitr: logger

- Log through `ctx.logger` (request-scoped, carries the request id) or `app.container.use('logger')`. Never `console.log` in server code.

## kitr: server

- Server code lives under `server/` and never imports React. Services come from the request-scoped container (`useRequestApp()`), logs from `ctx.logger`.
- `server/main.ts` (written by the server platform) exports `server`; providers' `ready`/`shutdown` run on `server.listen()`. A web platform in `ssr` mode answers `/api/*` through the same object via `app/routes/api.$.ts`.

## kitr: api

- Routes: `server/routes.ts` (`defineRoutes`), controllers in `server/controllers/<name>_controller.ts` (`kitr make:controller <name> --resource`). Validators go in `static validation = { store: { body: schema } }`.
- Actions are for this app's own UI; API routes are for anything else (mobile, partners, webhooks) or when you want REST + OpenAPI.
- The client is typed from `typeof routes.$types`; call `registerRoutes(api, routes.toJSON())` or use `kitr api:sync` to write the route table and openapi.json.

## kitr: db

- `config/db.ts` connects the ORM; controllers and actions read it with `useDb<AppDb>(ctx.app)` or `ctx.app.container.use('db')`. Migrations are the ORM's own tooling.

## kitr: realtime

- Channels are defined once in `app/channels/*.ts` with `defineChannel`. The server emits with `realtime.use(channel, params).emit(event, data)` (server/realtime.ts); components subscribe with `useChannel(realtime(), channel, params)` from `kitr/realtime/react` and events update the query cache via `effects`.
- Switch transports in `config/realtime.ts`: `socket.io` (rooms, adapters; client from `kitr/realtime/socket.io`) or `sse` (plain HTTP, no upgrade; server from `kitr/realtime/sse/server`).

## kitr: testing

- `pnpm test` runs Vitest. Components: `renderWithKitr(<X />, { app, queryData })` from `kitr/testing/react`. APIs: `createTestClient(server).get('/api/x')`. No running backend is needed.

## kitr: platform api

- `kitr dev <name>` runs server/main.ts with tsx watch; `kitr start <name>` runs the production server; tests import `server` from it and call `server.fetch(new Request(...))`, no port needed.
- Routes live in `server/routes.ts` (`defineRoutes`), controllers in `server/controllers/`. Config comes from `config/server.ts`; the port comes from the platform options in kitrrc.ts, `PORT` or `kitr dev <name> --port`.
- Never import React or browser APIs under `server/`; this entry must stay runnable without a DOM.
