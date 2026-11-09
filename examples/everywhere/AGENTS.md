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

## kitr: router

- Routes are code: `app/routes.ts` is one `defineRoutes([router], (r) => r.root(...).page(...))` chain. `.page(path, { lazy })` adds a page, `.group(prefix, ...)` nests paths, `.layout(id, options, ...)` wraps pages without a path segment. `kitr make:page <path>` writes the page file and appends the link.
- Page components live in `app/pages/` and export a default component (or `definePage({ component, pendingComponent })`). Loaders, `beforeLoad` and `head` go on the route options in `app/routes.ts`; read loader data with `getRouteApi('<path>')` from `@kitr/router`.
- `app/document.tsx` renders the HTML document: TanStack Start streams it on the server (web `ssr`), prerenders it (`static`) or ships one shell (`spa`, desktop, mobile). Keep it platform-neutral.
- There is no `app/routes/` directory and no `routeTree.gen.ts`; `@kitr/vite` tells Start the tree comes from `app/routes.ts`.

## kitr: query

- Import from `@kitr/query`, never from `@tanstack/react-query` directly.
- Every data source becomes `queryFrom(...)` / `mutationFrom(...)` in `app/queries/<name>.ts`. Components use `useSuspenseQuery(x.options(input))`.
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

- Client state only. `kitr make:store <name>` writes `app/stores/<name>.ts` using `createKitrStore`. On the server, wrap the components that use it in its `<NameStoreProvider>` to share one store per render; without it each component renders the initial state. Server data belongs in queries, not stores.

## kitr: tailwind

- Tailwind v4: utilities map to kitr tokens (`bg-background`, `text-primary`, `rounded-md`). Use `cn()` from `@kitr/tailwind` to merge classes. Dark mode is `data-theme="dark"` on <html>, toggled by `useTheme()`.

## kitr: theme

- Theme: `useTheme()` from `@kitr/theme` (`theme`, `resolved`, `setTheme`, `toggle`); `data-theme="light|dark"` on <html>. Put `<ThemeScript />` in the document head to avoid a flash.
- Colours and radii come from the `--kitr-*` variables (`@kitr/theme/styles.css`, overrides in `app/styles/tokens.css`); never hard-code them. Plain CSS helpers: `pick()`, `vars()`, `dataAttrs()` from `@kitr/theme`.
- Components live in `app/components/ui/` and are owned by the app: add more with `kitr ui add <name>` (shadcn-compatible registry).
- Icons: Hugeicons in the stroke-rounded style through `<Icon icon={Add01Icon} />` from `#components/ui/icon` (`kitr ui add icon`), icons from `@hugeicons/core-free-icons`. No other icon set, no emoji or glyphs as icons.

## kitr: toast

- Toasts: `toast('Saved')`, `toast.success()`, `.error()`, `.info()`, `.warning()`, `toast.promise()` and `toastError(error)` from `@kitr/toast`. Callable from any module, not only components; the provider mounts the toaster, so never render a `<Toaster />` yourself. Position and colours live in `config/toast.ts`.

## kitr: auth

- Guard routes with `beforeLoad: requireAuth()` (from `@kitr/router`) on a layout route; permissions with `can('projects.update', { subject })` or `useCan()` in components.
- The session is `useSession()` / `useUser()` from `@kitr/auth`. Abilities are plain functions in `app/abilities.ts`, shared with the API middleware (`@kitr/auth/server`).

## kitr: storage

- Persisted values are declared once in `app/storage.ts` (`defineStorage` for local/session storage, `defineCookie` for cookies) and never read through `localStorage`/`document.cookie` directly.
- Components: `const [value, setValue] = useStorage(item)` / `useCookie(item)` from `@kitr/storage/react`. Both are hydration-safe: the server and first render see the default.
- Server side (actions, controllers): `cookies(event).get(item)` / `.set(item, value)` from `@kitr/storage/server`; wrap the root route in `<CookieHeader value={request.headers.get('cookie')}>` so `useCookie` renders the right value during SSR.
- Add `schema` (zod/valibot) to validate what comes back from storage, `version` + `migrate` when a shape changes, `ttl` to expire.

## kitr: mocks

- Mocks live in `app/mocks/handlers.ts` (MSW). `VITE_MOCKS=true` enables them in dev (run `npm run mocks:init` once if public/mockServiceWorker.js is missing); tests use `setupNodeMocks(handlers)`. Mock a kitr route table with `mockRoutes(routes.toJSON(), baseUrl, { 'projects.index': () => [...] })`.

## kitr: testing

- `pnpm test` runs Vitest. Components: `renderWithKitr(<X />, { app, queryData })` from `@kitr/testing/react`. APIs: `createTestClient(server).get('/api/x')`. No running backend is needed.

## kitr: vite

- `vite.config.ts` holds `kitr()`, which wires the router, React, Tailwind, `virtual:kitr/*` and the `#app`-style aliases from kitrrc.ts and the installed packages. Build-time steps (generated data, images, copied files) are Vite plugins of your own in `build/<name>.ts`, added next to `kitr()`; not npm scripts.

## kitr: platform site

- `kitr dev <name>` runs Vite on the platform's port; `kitr build` writes `dist/<name>`; `kitr start` serves it (static files).
- Routes render on the client; loaders run in the browser.

## kitr: platform app

- `kitr dev <name>` starts Vite and Electron (main + preload rebuilt on change); `kitr build <name>` builds the client, main and preload into `dist/<name>` and packages installers with electron-builder.
- IPC is typed end to end: declare in `platforms/<name>/ipc.ts`, implement in `platforms/<name>/main.ts` (`handleIpc`), call from the app via `createIpcClient` from `@kitr/desktop/client`. Guard desktop-only UI with `isElectron()`.
- Windows keep context isolation and the sandbox on; never enable nodeIntegration. The packaged app serves the client from `app://-/`; storage items from `@kitr/storage` persist in a JSON file in userData through `handleKitrIpc`.

## kitr: platform phone

- `kitr dev <name> --target ios|android` runs the app on a simulator or device with live reload; `kitr build <name>` builds the bundle and runs `cap sync`. Native projects are in `platforms/<name>/ios|android` and are yours to edit in Xcode or Android Studio.
- Never branch on user agents: use `usePlatform()` / `platform.is('ios')` from `@kitr/platform/react`. Storage items from `@kitr/storage` persist in native Preferences here, so `localStorage` eviction on iOS never loses data.
- Other Capacitor plugins are plain dependencies; wrap their calls in `nativeOnly(fn, fallback)` from `@kitr/mobile/client` so the web build keeps working.

## kitr: secure-storage

- Tokens and secrets go through `@kitr/secure-storage` (`app/secure.ts`), never `defineStorage` or localStorage. `useSecureItem(item)` returns `[value, set, { loading, secure }]`; the value is undefined until the vault answers.

## kitr: notifications

- `useNotificationPermission()` gives `{ permission, request }`; call `request` from a click. `notifications.show({ title, url })` / `schedule({ ..., at })` resolve to an id for `cancel`. Route taps once, near the router: `useNotificationTap((tap) => tap.url && navigate({ to: tap.url }))`.
