# Agent guide

This app is built with kitr. Each section below is maintained by `kitr add`.

## kitr: conventions

- Import framework code from `kitr/*` entry points (`kitr/router`, `kitr/query`, ...). They re-export the upstream library unchanged plus kitr helpers.
- Routes are files in `app/routes` (TanStack Router file routes). `app/routeTree.gen.ts` is generated; never edit it.
- In route files, import `createFileRoute` / `createLazyFileRoute` from `@tanstack/react-router` (the route generator owns that import). Everything else comes from `kitr/router`.
- Wiring lives in `kitrrc.ts` and `config/*.ts`. Generators: `kitr make:route|action|controller|channel|store|form|queries`. Run `kitr doctor` after changes.

## kitr: query

- Import from `kitr/query`, never from `@tanstack/react-query` directly.
- Every data source becomes `defineQuery(...)` / `defineMutation(...)` in `app/features/<name>/queries.ts`. Components use `useSuspenseQuery(x.options(input))`.
- Route loaders call `context.queryClient.ensureQueryData(x.options(input))` so data is fetched once for server and client.
- Mutations declare `effects` (invalidate/set keys). Never call `queryClient.invalidateQueries` inline in components.

## kitr: http

- The HTTP client is `app.container.use('http')` (a ky instance). Wrap endpoints with `httpQuery`/`httpMutation` from `kitr/http` and pass them to `defineQuery`/`defineMutation`.
- Errors are already `KitrError`; a 422 with `fieldErrors` maps onto form fields through `<Form>`.

## kitr: forms

- Forms: `const form = useSchemaForm(schema, { defaultValues })` then `<Form form={form} onSubmit={...}>` from `kitr/forms` (or the styled copy in `app/components/ui/form.tsx`).
- Throw or reject with a KitrError carrying `fieldErrors` and the fields show the messages; anything else lands in `useRootError()`.

## kitr: table

- Tables: `validateSearch: parseTableSearch` on the route, `useUrlTableState({ search, setSearch })` spread into `useReactTable` or the registry `<DataTable>`. Sorting/paging live in the URL, so views are shareable.

## kitr: state

- Client state only. `kitr make:store <name>` writes `app/stores/<name>.ts` using `createKitrStore`. Server data belongs in queries, not stores.

## kitr: styling

- Plain CSS and CSS Modules are first-class: `import styles from './x.module.css'`, run `kitr css:types` for typed class names, compose with `pick()` from `kitr/styling`.
- Colours and radii come from the `--kitr-*` variables; never hard-code them.

## kitr: tailwind

- Tailwind v4: utilities map to kitr tokens (`bg-background`, `text-primary`, `rounded-md`). Use `cn()` from `kitr/tailwind` to merge classes. Dark mode is `data-theme="dark"` on <html>, toggled by `useTheme()`.

## kitr: ui

- Components live in `app/components/ui/` and are owned by the app: edit them freely. Add more with `kitr ui add <name>` (shadcn-compatible registry).
- Toasts: `toast.success('Saved')` from `kitr/ui`. Theme: `useTheme()`. Import `kitr/ui/styles.css` once (done in app/styles/app.css).

## kitr: auth

- Guard routes with `beforeLoad: requireAuth()` (from `kitr/router`) on a layout route; permissions with `can('projects.update', { subject })` or `useCan()` in components.
- The session is `useSession()` / `useUser()` from `kitr/auth`. Abilities are plain functions in `app/abilities.ts`, shared with the API middleware (`kitr/auth/server`).

## kitr: testing

- `pnpm test` runs Vitest. Components: `renderWithKitr(<X />, { app, queryData })` from `kitr/testing/react`. APIs: `createTestClient(server).get('/api/x')`. No running backend is needed.

## kitr: logger

- Log through `ctx.logger` (request-scoped, carries the request id) or `app.container.use('logger')`. Never `console.log` in server code.

## kitr: server

- Server code never imports React. Services come from the request-scoped container (`useRequestApp()`), logs from `ctx.logger`.
- Providers' `ready`/`shutdown` run on `server.listen()`; in TanStack Start the server is a fetch handler (`server.fetch`).

## kitr: ssr

- Routes render on the server by default; use `...ssrRoute('data-only')` for heavy, non-SEO pages. `head: () => seo({ title, description })` from `kitr/ssr` writes meta tags.

## kitr: actions

- `kitr make:action <feature>/<name>` writes `app/actions/<feature>/<name>.ts` with `defineAction('<feature>.<name>', { input, effects, handler })`.
- Call actions from anywhere: `await updateProject(input)`; in components use `useKitrMutation(defineMutation(updateProject.mutation()))`. GET actions expose `.query()` for loaders.

## kitr: api

- Routes: `app/api/routes.ts` (`defineRoutes`), controllers in `app/controllers/<name>_controller.ts` (`kitr make:controller <name> --resource`). Validators go in `static validation = { store: { body: schema } }`.
- Actions are for this app's own UI; API routes are for anything else (mobile, partners, webhooks) or when you want REST + OpenAPI.
- The client is typed from `typeof routes.$types`; call `registerRoutes(api, routes.toJSON())` or use `kitr api:sync` to write the route table and openapi.json.

## kitr: socket

- Channels are defined once in `app/channels/*.ts` with `defineChannel`. Server emits with `sockets.use(channel, params).emit(event, data)`; the client subscribes with `useSubscription(channel(socket, def).subscription(), params)` and events update the query cache via `effects`.
