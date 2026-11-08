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

## kitr: router

- Routes are code: `app/routes.ts` is one `defineRoutes([router], (r) => r.root(...).page(...))` chain. `.page(path, { lazy })` adds a page, `.group(prefix, ...)` nests paths, `.layout(id, options, ...)` wraps pages without a path segment. `kitr make:page <path>` writes the page file and appends the link.
- Page components live in `app/pages/` and export a default component (or `definePage({ component, pendingComponent })`). Loaders, `beforeLoad` and `head` go on the route options in `app/routes.ts`; read loader data with `getRouteApi('<path>')` from `@kitr/router`.
- `app/document.tsx` renders the HTML document: TanStack Start streams it on the server (web `ssr`), prerenders it (`static`) or ships one shell (`spa`, desktop, mobile). Keep it platform-neutral.
- There is no `app/routes/` directory and no `routeTree.gen.ts`; `@kitr/vite` tells Start the tree comes from `app/routes.ts`.

## kitr: logger

- Log through `ctx.logger` (request-scoped, carries the request id) or `app.container.use('logger')`. Never `console.log` in server code.

## kitr: server

- Server code lives under `server/` and never imports React. Services come from the request-scoped container (`useRequestApp()`), logs from `ctx.logger`.
- `server/main.ts` (written by the server platform) exports `server`; providers' `ready`/`shutdown` run on `server.listen()`. Endpoints and sockets come from the route table in `server/routes.ts` (`createServer({ routes })`). A web platform in the same app answers those paths through the same object via `app/server.ts` (Start's server entry asks `server.handles(request)` first).

## kitr: query

- Import from `@kitr/query`, never from `@tanstack/react-query` directly.
- Every data source becomes `queryFrom(...)` / `mutationFrom(...)` in `app/features/<name>/queries.ts`. Components use `useSuspenseQuery(x.options(input))`.
- Route loaders call `context.queryClient.ensureQueryData(x.options(input))` so data is fetched once for server and client.
- Mutations declare `effects` (invalidate/set keys). Never call `queryClient.invalidateQueries` inline in components.

## kitr: http

- The HTTP client is `app.container.use('http')` (a ky instance). Wrap endpoints with `httpQuery`/`httpMutation` from `@kitr/http` and pass them to `queryFrom`/`mutationFrom`.
- Errors are already `KitrError`; a 422 with `fieldErrors` maps onto form fields through `<Form>`.

## kitr: forms

- Forms: `const form = useSchemaForm(schema, { defaultValues })` then `<Form form={form} onSubmit={...}>` from `@kitr/forms` (or the styled copy in `app/components/ui/form.tsx`).
- Throw or reject with a KitrError carrying `fieldErrors` and the fields show the messages; anything else lands in `useRootError()`.

## kitr: table

- Tables: `validateSearch: parseTableSearch` on the route, `useUrlTableState({ search, setSearch })` spread into `useReactTable` or the registry `<DataTable>`. Sorting/paging live in the URL, so views are shareable.

## kitr: state

- Client state only. `kitr make:store <name>` writes `app/stores/<name>.ts` using `createKitrStore`. Server data belongs in queries, not stores.

## kitr: tailwind

- Tailwind v4: utilities map to kitr tokens (`bg-background`, `text-primary`, `rounded-md`). Use `cn()` from `@kitr/tailwind` to merge classes. Dark mode is `data-theme="dark"` on <html>, toggled by `useTheme()`.

## kitr: theme

- Theme: `useTheme()` from `@kitr/theme` (`theme`, `resolved`, `setTheme`, `toggle`); `data-theme="light|dark"` on <html>. Put `<ThemeScript />` in the document head to avoid a flash.
- Colours and radii come from the `--kitr-*` variables (`@kitr/theme/styles.css`, overrides in `app/styles/tokens.css`); never hard-code them. Plain CSS helpers: `pick()`, `vars()`, `dataAttrs()` from `@kitr/theme`.
- Components live in `app/components/ui/` and are owned by the app: add more with `kitr ui add <name>` (shadcn-compatible registry); toasts via `kitr ui add sonner`.
- Icons: Hugeicons in the stroke-rounded style through `<Icon icon={Add01Icon} />` from `#components/ui/icon` (`kitr ui add icon`), icons from `@hugeicons/core-free-icons`. No other icon set, no emoji or glyphs as icons.

## kitr: auth

- Guard routes with `beforeLoad: requireAuth()` (from `@kitr/router`) on a layout route; permissions with `can('projects.update', { subject })` or `useCan()` in components.
- The session is `useSession()` / `useUser()` from `@kitr/auth`. Abilities are plain functions in `app/abilities.ts`, shared with the API middleware (`@kitr/auth/server`).

## kitr: storage

- Persisted values are declared once in `app/storage.ts` (`defineStorage` for local/session storage, `defineCookie` for cookies) and never read through `localStorage`/`document.cookie` directly.
- Components: `const [value, setValue] = useStorage(item)` / `useCookie(item)` from `@kitr/storage/react`. Both are hydration-safe: the server and first render see the default.
- Server side (actions, controllers): `cookies(event).get(item)` / `.set(item, value)` from `@kitr/storage/server`; wrap the root route in `<CookieHeader value={request.headers.get('cookie')}>` so `useCookie` renders the right value during SSR.
- Add `schema` (zod/valibot) to validate what comes back from storage, `version` + `migrate` when a shape changes, `ttl` to expire.

## kitr: testing

- `pnpm test` runs Vitest. Components: `renderWithKitr(<X />, { app, queryData })` from `@kitr/testing/react`. APIs: `createTestClient(server).get('/api/x')`. No running backend is needed.

## kitr: seo

- `head: () => seo({ title, description })` from `@kitr/seo` writes title, Open Graph, Twitter and canonical tags; `jsonLd({...})` adds structured data. Site defaults live in `config/seo.ts`.
- Use `...ssrRoute('data-only')` for heavy, non-SEO pages; `cacheHeaders({ sMaxAge })` for the CDN.

## kitr: actions

- `kitr make:query <feature>/<name>` and `kitr make:mutation <feature>/<name>` write `app/actions/<feature>/<name>.ts` with `defineQuery('<feature>.<name>', { input, staleTime, handler })` or `defineMutation('<feature>.<name>', { input, effects, handler })`.
- `kitr types` (run by `kitr dev` and `kitr build`) writes `.kitr/actions.ts`; `app/app.ts` passes its `operations` to `createApp`.
- In components use the name: `useQuery('projects.list', input)`, `useSuspenseQuery('projects.list', input)`, `useMutation('projects.update')` from `@kitr/query`. In loaders use `queryOptions('projects.list', input)`. Outside React use `call('projects.update', input)` or import the definition and call it: `await updateProject(input)`.

## kitr: api

- Endpoints: `server/routes.ts` (`defineRoutes([api], ...)` with `.get/.post/.resource` from `@kitr/api/routes`; realtime adds `.ws` to the same table), controllers in `server/controllers/<name>_controller.ts` (`kitr make:controller <name> --resource`). Validators go in `static validation = { store: { body: schema } }`.
- Actions are for this app's own UI; API routes are for anything else (mobile, partners, webhooks) or when you want REST + OpenAPI.
- The client is typed from `ServerRoutes` (`typeof routes.$types`); call `registerRoutes(api, routes.toJSON())` or use `kitr api:sync` to write the route table and openapi.json.

## kitr: realtime

- Channels are defined once in `app/channels/*.ts` with `defineChannel` and served by `.ws(path, { channels })` (or `.sse`) on the server route table (`server/routes.ts`, methods from `@kitr/realtime/routes`). The server emits with `app.container.use('realtime').use(channel, params).emit(event, data)` (`{ app }` is on every HttpContext and job); components subscribe with `useChannel(realtime(), channel, params)` from `@kitr/realtime/react` and events update the query cache via `effects`.
- Switch transports in `config/realtime.ts`: `socket.io` (rooms, adapters; client from `@kitr/realtime/socket.io`) or `sse` (plain HTTP, no upgrade; server from `@kitr/realtime/sse/server`).

## kitr: vite

- `vite.config.ts` holds `kitr()` and nothing else: the plugin wires the router, React, Tailwind, `virtual:kitr/*` and the `#app`-style aliases from kitrrc.ts and the installed packages. Add a Vite plugin of your own next to `kitr()`.

## kitr: platform site

- `kitr dev <name>` runs Vite on the platform's port; `kitr build` writes `dist/<name>`; `kitr start` serves it (the Start server bundle).
- Routes render on the server by default; `ssrRoute(false)` from @kitr/seo opts a route out.

## kitr: platform api

- `kitr dev <name>` runs server/main.ts with tsx watch; `kitr start <name>` runs the production server; tests import `server` from it and call `server.fetch(new Request(...))`, no port needed.
- Endpoints and sockets live in `server/routes.ts` (`defineRoutes([api, realtime], ...)`), passed to `createServer({ routes })`; controllers in `server/controllers/`. Config comes from `config/server.ts`; the port comes from the platform options in kitrrc.ts, `PORT` or `kitr dev <name> --port`.
- Never import React or browser APIs under `server/`; this entry must stay runnable without a DOM.
