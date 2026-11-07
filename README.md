# kitr

**The React framework where everything is an add-on.**

kitr is a thin, opinionated layer over the libraries you would pick anyway: TanStack Router, Query, Table and Start, React Hook Form, Zustand, ky, h3, Tailwind. It gives them one import surface, one data contract, one app lifecycle and one CLI, and it never re-implements what they already do.

```sh
pnpm dlx kitr new my-app --kit app      # a logged-in app on an external API
pnpm dlx kitr new my-site --kit fullstack  # the same, plus SSR, server actions, an API and sockets
pnpm dlx kitr new my-api --kit server   # a pure backend. No React anywhere in the dependency graph.
pnpm dlx kitr new my-saas --kit saas    # presets: saas, site, realtime, desktop, mobile. Real pages, controllers and tests to start from.
```

Every command runs from flags alone, so coding agents and CI never hit a prompt. `kitr new` writes an `AGENTS.md` that `kitr add` keeps up to date.

## The ideas

**Re-export, never re-implement. Add beside, never change.**
`kitr/router` *is* `@tanstack/react-router`, plus `createKitrRouter`, `requireAuth()` and `can()`. `kitr/query` *is* `@tanstack/react-query`, plus `defineQuery` and cache effects. Your TanStack knowledge transfers one to one, upstream docs stay valid, and leaving kitr is an import rewrite (`kitr eject all` prints it).

**One data contract.**
Server actions, API routes, external HTTP APIs and socket channels all produce the same `QueryContract` / `MutationContract` / `SubscriptionContract`. Mutations declare cache `effects` (`invalidate`, `set`, `remove`) instead of components calling `queryClient.invalidateQueries` inline. A socket event is just a subscription whose events carry effects.

**Explicit wiring, the Adonis way.**
`kitrrc.ts` lists every provider as a lazy import. `config/<package>.ts` holds that package's options, typed by its `defineConfig`. Providers have `register → boot → ready → shutdown`, a typed container (`app.container.use('http')`), and a `wrap()` hook so React packages can wrap the tree without the core knowing React exists.

**Pure backend is a first-class target.**
`@kitr/core`, `server`, `api`, `logger`, `socket`, `auth/server` and `db` have no React dependency. `kitr new --kit server` produces an h3 + srvx server with Adonis-style controllers, a typed API client with **no codegen**, OpenAPI via `kitr api:sync`, and WebSocket channels. The same packages run inside TanStack Start when you want both.

**One app, every platform.**
`kitr add pwa electron tauri capacitor` are one-command add-ons like the rest: each wires the vendor tooling the way its docs recommend (electron-vite, the Tauri and Capacitor CLIs, vite-plugin-pwa), adds the scripts, and gives you typed helpers with browser fallbacks, so the same `app/` ships to the web, desktop and mobile. `kitr add analytics monitoring` do the same for Google Analytics, Plausible, PostHog and Sentry.

**Debuggable by default.**
`kitr add devtools` is in every React kit: a panel (ctrl/cmd+shift+K) with App, Router, Query, Auth, Storage, Errors, Analytics and Log tabs and a command palette. Every package contributes its own tab, so adding `socket` or `analytics` extends the devtools too; the Vite plugin drops it from production builds. `kitr add storage` gives typed localStorage, sessionStorage and cookies that read the same on the server.

**Components you own.**
`kitr ui add button form data-table` copies shadcn-compatible components into `app/components/ui`. They use Tailwind v4, `cva`, native `<dialog>` and kitr's tokens; there is no component library in `node_modules` to fight.

## Entry points

| Import | Re-exports | Adds |
| --- | --- | --- |
| `kitr/app` | `@kitr/core` | `createApp`, `defineProvider`, `defineKitrConfig`, `createKeys`, `KitrError`, `validate` |
| `kitr/env` | | `createEnv` with a public/server split, validated at startup |
| `kitr/react` | | `<KitrProvider>`, `useApp()`, `useService()`, `useConfig()` |
| `kitr/router` | `@tanstack/react-router` | `createKitrRouter`, `requireAuth`, `can`, default pending/error/404 |
| `kitr/query` | `@tanstack/react-query` | `defineQuery`, `defineMutation`, `defineSubscription`, `useSubscription`, cache effects |
| `kitr/http` | `ky` | `createHttpClient` (auth header, refresh-once, kitr error shape), `httpQuery`, `httpMutation` |
| `kitr/forms` | `react-hook-form` | `useSchemaForm` (Standard Schema), `<Form>`, `<FormField>`, `applyServerErrors` |
| `kitr/table` | `@tanstack/react-table` v9 | `dataTableFeatures`, `useUrlTableState` (sort/page/filter in the URL) |
| `kitr/state` | `zustand` | `createKitrStore` (SSR-safe, per-request on the server) |
| `kitr/styling` | `clsx`, `cva` | `defineTokens`, CSS Modules helpers |
| `kitr/tailwind` | | `cn()`, the preset mapping kitr tokens to `@theme`, `kitr/tailwind/vite` |
| `kitr/ui` | | `ThemeProvider`, `useTheme`, `toast`, registry config |
| `kitr/logger` | | `createLogger`, child loggers, request ids |
| `kitr/server` | `h3` | `createServer` (standalone via srvx, or a `fetch` handler), request context |
| `kitr/api` | | `defineRoutes`, controllers, validators, middleware, `toOpenApi`; `kitr/api/client` is the typed client |
| `kitr/actions` | `@tanstack/react-start` server fns | `defineAction` with validation, middleware, one error shape, cache effects |
| `kitr/ssr` | | `seo()`, `ssrRoute()`, `cacheHeaders()` |
| `kitr/socket` | `partysocket` | `defineChannel`, `createSocketClient`; `kitr/socket/server` on crossws |
| `kitr/socket.io` | `socket.io-client` | the same channels over Socket.IO |
| `kitr/auth` | | `createAuth`, adapters (token, Better Auth, custom), `defineAbilities`, hooks; `kitr/auth/server` middleware |
| `kitr/db` | | `defineDb` binds any ORM into the lifecycle |
| `kitr/testing` | | `createTestApp`, `createTestClient`; `kitr/testing/react` adds `renderWithKitr` |
| `kitr/mocks` | `msw` | handlers from route tables and contracts |
| `kitr/i18n` | `react-i18next` | typed keys, locale detection |
| `kitr/analytics` | | `createAnalytics`, GA/Plausible/PostHog/console adapters, `useAnalytics`, router page views |
| `kitr/monitoring` | | `createMonitoring`, Sentry/console reporters, error boundary; `kitr/monitoring/server` middleware |
| `kitr/pwa` | | `useInstallPrompt`, `useOnline`, `useServiceWorker`; `kitr/pwa/vite` wraps vite-plugin-pwa |
| `kitr/electron` | | typed IPC client; `kitr/electron/main` (`createMainWindow`, `handleIpc`), `kitr/electron/preload` (`exposeIpc`) |
| `kitr/tauri` | `@tauri-apps/api` | `defineCommands`, `commandQuery`, `commandMutation`, `isTauri`, `useTauriEvent` |
| `kitr/storage` | | `defineStorage`, `defineCookie`; `kitr/storage/react` hooks, `kitr/storage/server` cookies |
| `kitr/devtools` | | the development overlay; `getDevtools(app)?.log()`, panels via a provider's `devtools()` |
| `kitr/capacitor` | `@capacitor/core` | `isNative`, `platform`, `perPlatform`, `useBackButton`, `useAppUrlOpen`, `useAppState` |
| `kitr/vite` | | the `kitr()` Vite plugin: aliases, virtual modules, router/Start plugin, Tailwind |

See [docs/entry-points.md](docs/entry-points.md) for the rules behind this table.

## A taste

```ts
// app/features/projects/queries.ts
import { createKeys } from 'kitr/app'
import { defineMutation, defineQuery } from 'kitr/query'
import { httpMutation, httpQuery } from 'kitr/http'

export const projectKeys = createKeys('projects')

export const projectsQuery = defineQuery(
  httpQuery<void, Project[]>(http, { path: 'projects', key: () => projectKeys.list() }),
)

export const updateProject = defineMutation(
  httpMutation<Partial<Project> & { id: string }, Project>(http, {
    method: 'patch',
    path: (input) => `projects/${input.id}`,
    effects: (result) => ({
      set: [{ key: projectKeys.detail(result.id), data: result }],
      invalidate: [projectKeys.lists()],
    }),
  }),
)
```

```ts
// app/api/routes.ts (Start) or start/routes.ts (pure backend)
export const routes = defineRoutes((router) =>
  router.group({ prefix: '/api', middleware: [cors()] }, (api) =>
    api.resource('projects', ProjectsController).get('/me', [UsersController, 'me'], { name: 'me' }),
  ),
)
export type AppRoutes = typeof routes.$types

// anywhere on the client: fully typed, no codegen
const api = createApiClient<AppRoutes>({ baseUrl: '/' })
const project = await api.projects.show({ params: { id: '1' } })
useSuspenseQuery(api.projects.index.query())
```

```ts
// app/channels/chat.ts: one definition for both ends
export const chatChannel = defineChannel<{ room: string }>({
  name: 'chat',
  events: { message: { effects: ({ room }) => ({ invalidate: [['messages', room]] }) } },
  authorize: (session) => !!session,
})
```

## Repository layout

```
packages/
  core, react, query, http, router, forms, table, state, styling, tailwind, ui,
  logger, server, api, actions, ssr, socket, socket.io, auth, db, testing, mocks, i18n,
  analytics, monitoring, pwa, electron, tauri, capacitor, storage, devtools,
  vite, cli, kitr            # `kitr` is the umbrella package users install
registry/                    # shadcn-compatible component registry (built to registry/dist)
examples/
  backend/                   # kitr new --kit server
  dashboard/                 # kitr new --kit app
  fullstack/                 # kitr new --kit fullstack
docs/                        # entry points, CLI, packages, pure backend, departures from the plan
```

```sh
pnpm install
pnpm build        # every package, in dependency order
pnpm typecheck    # packages, registry and examples
pnpm test         # vitest across the monorepo
pnpm lint         # biome
```

The examples are exactly what the CLI generates (with workspace links instead of published versions). Regenerate one with `node packages/kitr/bin/kitr.mjs new examples/<name> --kit <kit> --no-install --no-git --registry $PWD/registry/dist`, then see `examples/README.md` for the workspace links. Five of them are presets you can start from: `saas`, `site`, `realtime`, `desktop`, `mobile`.

## Docs

- [docs/cli.md](docs/cli.md): every command and flag
- [docs/packages.md](docs/packages.md): what each package provides and when to add it
- [docs/entry-points.md](docs/entry-points.md): the re-export rules
- [docs/pure-backend.md](docs/pure-backend.md): kitr without React
- [docs/departures.md](docs/departures.md): where the implementation improved on the design plan, and why

## Status

Pre-release. The API is settling and the version is `0.1.0` across every package (they release in lockstep). Not yet published to npm.

MIT.
