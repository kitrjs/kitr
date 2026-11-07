# Agent guide

This app is built with kitr. Each section below is maintained by `kitr add`.

## kitr: conventions

- Import framework code from `kitr/*` entry points (`kitr/router`, `kitr/query`, ...). They re-export the upstream library unchanged plus kitr helpers.
- Where the app runs is a platform in `kitrrc.ts` (`platforms: { site: web({...}), api: server({...}) }`). `kitr dev <name>` / `kitr build <name>` / `kitr start <name>` run one or all; `kitr config <name> <option> <value>` edits options; native projects live in `platforms/<name>/`.
- Wiring lives in `kitrrc.ts` and `config/*.ts`; server code in `server/`. Every package brings its own generators (`kitr make:<kind>`, see `kitr --help`). Generated types live in `.kitr/` (`kitr types`, also run by `kitr dev` and `kitr build`); import them from `#kitr/*`. Run `kitr doctor` after changes.

## kitr: router

- Routes are code: `app/routes.ts` is one `defineRoutes([router], (r) => r.root(...).page(...))` chain. `.page(path, { lazy })` adds a page, `.group(prefix, ...)` nests paths, `.layout(id, options, ...)` wraps pages without a path segment. `kitr make:page <path>` writes the page file and appends the link.
- Page components live in `app/pages/` and export a default component (or `definePage({ component, pendingComponent })`). Loaders, `beforeLoad` and `head` go on the route options in `app/routes.ts`; read loader data with `getRouteApi('<path>')` from `kitr/router`.
- `app/document.tsx` renders the HTML document: TanStack Start streams it on the server (web `ssr`), prerenders it (`static`) or ships one shell (`spa`, desktop, mobile). Keep it platform-neutral.
- There is no `app/routes/` directory and no `routeTree.gen.ts`; `kitr/vite` tells Start the tree comes from `app/routes.ts`.

## kitr: platform

- Never branch on user agents or `window.__TAURI__`: use `usePlatform()`, `useOnline()`, `useAppState()`, `useBackButton()`, `useDeepLink()`, `useSafeArea()` from `kitr/platform/react`, or `app.use('platform')` outside React. `platform.is('mobile')` / `platform.is('ios')` match the type or the OS.
- The web, desktop, tauri and mobile platform providers register the drivers; in a plain browser the defaults apply, so the same code runs everywhere.

## kitr: storage

- Persisted values are declared once in `app/storage.ts` (`defineStorage` for local/session storage, `defineCookie` for cookies) and never read through `localStorage`/`document.cookie` directly.
- Components: `const [value, setValue] = useStorage(item)` / `useCookie(item)` from `kitr/storage/react`. Both are hydration-safe: the server and first render see the default.
- Server side (actions, controllers): `cookies(event).get(item)` / `.set(item, value)` from `kitr/storage/server`; wrap the root route in `<CookieHeader value={request.headers.get('cookie')}>` so `useCookie` renders the right value during SSR.
- Add `schema` (zod/valibot) to validate what comes back from storage, `version` + `migrate` when a shape changes, `ttl` to expire.

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

## kitr: tailwind

- Tailwind v4: utilities map to kitr tokens (`bg-background`, `text-primary`, `rounded-md`). Use `cn()` from `kitr/tailwind` to merge classes. Dark mode is `data-theme="dark"` on <html>, toggled by `useTheme()`.

## kitr: theme

- Theme: `useTheme()` from `kitr/theme` (`theme`, `resolved`, `setTheme`, `toggle`); `data-theme="light|dark"` on <html>. Put `<ThemeScript />` in the document head to avoid a flash.
- Colours and radii come from the `--kitr-*` variables (`kitr/theme/styles.css`, overrides in `app/styles/tokens.css`); never hard-code them. Plain CSS helpers: `pick()`, `vars()`, `dataAttrs()` from `kitr/theme`.
- Components live in `app/components/ui/` and are owned by the app: add more with `kitr ui add <name>` (shadcn-compatible registry); toasts via `kitr ui add sonner`.
- Icons: Hugeicons in the stroke-rounded style through `<Icon icon={Add01Icon} />` from `#components/ui/icon` (`kitr ui add icon`), icons from `@hugeicons/core-free-icons`. No other icon set, no emoji or glyphs as icons.

## kitr: auth

- Guard routes with `beforeLoad: requireAuth()` (from `kitr/router`) on a layout route; permissions with `can('projects.update', { subject })` or `useCan()` in components.
- The session is `useSession()` / `useUser()` from `kitr/auth`. Abilities are plain functions in `app/abilities.ts`, shared with the API middleware (`kitr/auth/server`).

## kitr: mocks

- Mocks live in `app/mocks/handlers.ts` (MSW). `VITE_MOCKS=true` enables them in dev (run `npm run mocks:init` once if public/mockServiceWorker.js is missing); tests use `setupNodeMocks(handlers)`. Mock a kitr route table with `mockRoutes(routes.toJSON(), baseUrl, { 'projects.index': () => [...] })`.

## kitr: testing

- `pnpm test` runs Vitest. Components: `renderWithKitr(<X />, { app, queryData })` from `kitr/testing/react`. APIs: `createTestClient(server).get('/api/x')`. No running backend is needed.

## kitr: devtools

- In development a "k" button (ctrl/cmd+shift+K) opens the kitr devtools: App, Router, Query, Auth, Storage, Errors, Analytics and Log panels, plus a command palette (ctrl/cmd+shift+P) with every package's actions.
- Log from anywhere with `getDevtools(app)?.log('channel', 'label', data)` (`kitr/devtools`); it is null in production so the call costs nothing.
- A provider adds its own panel with a `devtools(app)` method returning `DevtoolsPanel[]` (lazy-import the React parts); reuse `JsonView`, `KeyValue`, `LogList` from `kitr/devtools/ui`.

## kitr: vite

- `vite.config.ts` holds `kitr()` and nothing else: the plugin wires the router, React, Tailwind, `virtual:kitr/*` and the `#app`-style aliases from kitrrc.ts and the installed packages. Add a Vite plugin of your own next to `kitr()`.

## kitr: platform site

- `kitr dev <name>` runs Vite on the platform's port; `kitr build` writes `dist/<name>`; `kitr start` serves it (static files).
- Routes render on the client; loaders run in the browser.

## kitr: platform app

- `kitr dev <name>` starts Vite and the Tauri window; `kitr build <name>` builds the client and installers. Rust lives in `platforms/<name>/src-tauri` (needs the Rust toolchain).
- Commands: add `#[tauri::command]` in src-tauri/src/lib.rs, register it in `generate_handler!`, declare it in `app/commands.ts` (`defineCommands` from `kitr/tauri/client`); call `commands.name(args)` or wrap with `commandQuery`/`commandMutation`. Guard with `isTauri()` so the web build keeps working.
- Events from Rust: `useTauriEvent('name', handler)`; to Rust: `emitTauri('name', payload)`. Permissions go in `src-tauri/capabilities/default.json`. Storage items from `kitr/storage` persist through the store plugin here.
