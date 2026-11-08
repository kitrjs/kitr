# kitr

[![CI](https://github.com/kitrjs/kitr/actions/workflows/ci.yml/badge.svg)](https://github.com/kitrjs/kitr/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**One way to build everything.**

kitr gives you a React app with routing, data loading, forms, sign-in and a typed API server already wired together, from one CLI, and ships the same code to the web, a server, desktop and phones. It is for teams who want the decisions made and written down, with libraries they already know underneath.

**Status.** Pre-release: the API is settling and every package is at `0.1.0` (they release in lockstep). kitr is not on npm yet, so `npm install -g kitr` and `pnpm dlx kitr` do not work today. The web (`web()`) and server (`server()`) platforms work; desktop, Tauri and mobile (and the device packages behind them) are previews that `kitr add` and `kitr new` refuse without `--preview`.

Under the hood it is a thin layer over the libraries you would pick anyway: TanStack Router, Query, Table and Start, React Hook Form, Zustand, ky, h3, Tailwind. It gives them one import surface, one data contract, one app lifecycle and one CLI, and it never re-implements what they already do.

## Try it

kitr is not on npm yet, so a project made by `kitr new` cannot install its dependencies until the first release. To see it running today, clone the repository and start one of the [examples](examples/README.md), which are the exact output of `kitr new`:

```sh
git clone https://github.com/kitrjs/kitr && cd kitr
pnpm install && pnpm build
cd examples/dashboard && pnpm dev     # the app kit; examples/README.md lists the others
```

Once kitr is published, creating a project is one command:

```sh
pnpm dlx kitr new my-app                # the blank kit: the wiring files and nothing else; kitr add brings the rest
pnpm dlx kitr new my-app --kit app      # a logged-in app on an external API
pnpm dlx kitr new my-site --kit fullstack  # the same, plus SSR, server actions, an API and realtime channels
pnpm dlx kitr new my-api --kit server   # a pure backend. No React anywhere in the dependency graph.
pnpm dlx kitr new my-saas --kit saas    # presets: saas, site, realtime. Real pages, controllers and tests to start from.
```

Every command runs from flags alone, so coding agents and CI never hit a prompt. `kitr new` writes an `AGENTS.md` that `kitr add` keeps up to date.

For Claude Code, the kitr plugin adds skills that know the conventions, the `kitr make` generators and `kitr doctor`. Install it with `claude plugin marketplace add kitrjs/kitr && claude plugin install kitr@kitr`, or run `npx skills add kitrjs/kitr` for Cursor, Codex, Copilot and other agents that read `SKILL.md`. See [Built for agents](https://kitr.dev/docs/agents) and [tooling/claude](tooling/claude/README.md).

## The ideas

**Re-export, never re-implement. Add beside, never change.**
`@kitr/router` *is* `@tanstack/react-router`, plus `createKitrRouter`, `requireAuth()` and `can()`. `@kitr/query` *is* `@tanstack/react-query`, plus `queryFrom` and cache effects. Your TanStack knowledge transfers one to one, upstream docs stay valid, and leaving kitr is an import rewrite (`kitr eject all` prints it).

**One data contract.**
Server actions, API routes, external HTTP APIs and realtime channels all produce the same `QueryContract` / `MutationContract` / `SubscriptionContract`. Mutations declare cache `effects` (`invalidate`, `set`, `remove`) instead of components calling `queryClient.invalidateQueries` inline. A channel event is just a subscription whose events carry effects.

**Nothing you did not add.**
The core is the `kitrrc.ts` wiring, the app lifecycle, the package and platform contracts and the CLI that runs them. It has no dev server, no bundler, no runtime and no React: `kitr new` writes seven files, and `kitr add web site` is what brings Vite, React and the router, through the same `kitr add` that brings `auth` or `mail`. Each package owns its setup end to end: its dependencies, its config file, its codemods, its questions, its scripts, its generators, its `AGENTS.md` lines and what it asks of the Vite build. The umbrella `kitr` package depends on the core and the CLI only; every other `kitr/*` entry point is an optional peer that resolves once its package is added.

**Explicit wiring, the Adonis way.**
`kitrrc.ts` lists every provider as a lazy import. `config/<package>.ts` holds that package's options, typed by its `defineConfig`. Providers have `register → boot → ready → shutdown`, a typed container (`app.container.use('http')`), and a `wrap()` hook so React packages can wrap the tree without the core knowing React exists.

**Where the app runs is a platform, and platforms are packages.**
`kitrrc.ts` names them: `platforms: { site: web({ mode: 'ssr' }), api: server({ runtime: 'node' }), app: desktop(), phone: mobile() }`. `kitr dev site api` runs two of them, `kitr build` builds them all into `dist/<name>/`, `kitr config site port 4000` edits an option with validation, `KITR_SITE_PORT=4000` overrides it at run time. The core knows only the `definePlatform` contract; `@kitr/web`, `@kitr/server`, `@kitr/desktop`, `@kitr/tauri` and `@kitr/mobile` own their options, scaffold and tooling (TanStack Start, srvx and wrangler, electron-vite, Tauri, Capacitor), and native projects live in `platforms/<name>/`. One `app/` ships everywhere; `@kitr/platform` answers `usePlatform()`, `useBackButton()` and `useSafeArea()` the same way in a browser and a shell.

**Pure backend is a first-class target.**
`@kitr/core`, `server`, `api`, `logger`, `realtime`, `auth/server` and `db` have no React dependency. `kitr new --kit server` produces an h3 server with Adonis-style controllers in `server/controllers/`, a typed API client with **no codegen**, OpenAPI via `kitr api:sync`, and typed channels over WebSocket, Socket.IO or SSE. The same packages run inside TanStack Start when you want both.

**Debuggable by default.**
`kitr add devtools --preview` (a preview, not in the kits yet) adds a panel (ctrl/cmd+shift+K) with App, Router, Query, Auth, Storage, Platform, Errors, Analytics and Log tabs and a command palette. Every package contributes its own tab, so adding `realtime` or `analytics` extends the devtools too; the Vite plugin drops it from production builds. `kitr add storage` gives typed localStorage, sessionStorage and cookies that read the same on the server and swap to native stores inside a desktop or mobile shell.

**Components you own.**
`kitr ui add button form data-table` copies shadcn-compatible components into `app/components/ui`. They use Tailwind v4, `cva`, native `<dialog>` and the tokens from `@kitr/theme`; there is no component library in `node_modules` to fight.

## Compared to Next.js, Expo and others

- **Next.js:** a full-stack React framework with its own router and server model; kitr builds on TanStack Router, Query and Start instead, and adds auth, forms, an API server and a CLI that adds packages for you.
- **Remix / React Router:** loaders and actions on web standards; kitr's data layer is TanStack Query with one contract for server actions, API routes, external APIs and realtime channels.
- **TanStack Start:** kitr is TanStack Start underneath for SSR and server functions, plus conventions, a package system and `kitr add`; you can use Start directly if you want fewer opinions.
- **Expo:** React Native renders native views; kitr's mobile and desktop platforms wrap your web app in Capacitor, Electron or Tauri WebView shells, and they are previews today.
- **AdonisJS:** the model for kitr's wiring (`kitrrc.ts`, providers, controllers); kitr's server is h3 with Adonis-style controllers, and it stays TypeScript on the same stack as your React code.

See the full comparison at [kitr.dev/docs/compare](https://kitr.dev/docs/compare).

## Learn more

Start with [what kitr is](https://kitr.dev/docs/what-is-kitr), then follow the getting started guide on [kitr.dev/docs](https://kitr.dev/docs).

## Entry points

| Import | Re-exports | Adds |
| --- | --- | --- |
| `kitr/app` | `@kitr/core` | `createApp`, `defineProvider`, `defineKitrConfig`, `definePlatform`, `createKeys`, `KitrError`, `validate` |
| `kitr/env` | | `createEnv` with a public/server split, validated at startup |
| `@kitr/react` | | `<KitrProvider>`, `useApp()`, `useService()`, `useConfig()` |
| `@kitr/router` | `@tanstack/react-router` | `createKitrRouter`, `requireAuth`, `can`, default pending/error/404 |
| `@kitr/query` | `@tanstack/react-query` | `queryFrom`, `mutationFrom`, `subscriptionFrom`, `useSubscription`, `useQuery('name')`, cache effects |
| `@kitr/http` | `ky` | `createHttpClient` (auth header, refresh-once, kitr error shape), `httpQuery`, `httpMutation` |
| `@kitr/forms` | `react-hook-form` | `useSchemaForm` (Standard Schema), `<Form>`, `<FormField>`, `applyServerErrors` |
| `@kitr/table` | `@tanstack/react-table` v9 | `dataTableFeatures`, `useUrlTableState` (sort/page/filter in the URL) |
| `@kitr/animation` | `motion` | reduced-motion provider, shared `transitions` and `presets`, `<Reveal>`, `pageTransitions()` with `@kitr/animation/page-transitions.css` |
| `@kitr/3d` | `@react-three/fiber`, `@react-three/drei` | `<Scene>` (WebGL fallback, pauses off screen, adaptive resolution), `useModel` with a self-hosted Draco decoder, `useThemeColor`; `@kitr/3d/drei` |
| `@kitr/state` | `zustand` | `createKitrStore` (SSR-safe, per-request on the server) |
| `@kitr/tailwind` | | `cn()`, the preset mapping kitr tokens to `@theme`, `@kitr/tailwind/vite` |
| `@kitr/theme` | `clsx`, `cva` | `defineTokens`, `ThemeProvider`, `useTheme`, `toast`, registry config; `@kitr/theme/styles.css` |
| `@kitr/logger` | | `createLogger`, child loggers, request ids |
| `@kitr/server` | `h3` | `createServer` (standalone via srvx, or a `fetch` handler), request context, the `server()` platform |
| `@kitr/api` | | `defineRoutes`, controllers, validators, middleware, `toOpenApi`; `@kitr/api/client` is the typed client |
| `@kitr/actions` | `@tanstack/react-start` server fns | `defineQuery` and `defineMutation` with validation, middleware, one error shape, cache effects; `useQuery('projects.list')` by generated name |
| `@kitr/seo` | | `seo()`, `jsonLd()`, `ssrRoute()`, `cacheHeaders()`, `robotsTxt()`, prerender and sitemap config |
| `@kitr/realtime` | `partysocket`, `socket.io-client` | `defineChannel`, `createRealtimeClient` over `ws`, `socket.io` or `sse`; `@kitr/realtime/server`, `@kitr/realtime/react` |
| `@kitr/auth` | | `createAuth`, adapters (token, Better Auth, custom), `defineAbilities`, hooks; `@kitr/auth/server` middleware |
| `@kitr/db` | | `defineDb` binds any ORM into the lifecycle |
| `@kitr/testing` | | `createTestApp`, `createTestClient`; `@kitr/testing/react` adds `renderWithKitr` |
| `@kitr/mocks` | `msw` | handlers from route tables and contracts |
| `@kitr/i18n` | `react-i18next` | typed keys, locale detection |
| `@kitr/analytics` | | `createAnalytics`, GA/Plausible/PostHog/console adapters, `useAnalytics`, router page views |
| `@kitr/monitoring` | | `createMonitoring`, Sentry/console reporters, error boundary; `@kitr/monitoring/server` middleware |
| `@kitr/platform` | | **Preview.** `platform()`, `isNative()`, `perPlatform()`, driver registry; `@kitr/platform/react` hooks (`usePlatform`, `useOnline`, `useAppState`, `useBackButton`, `useDeepLink`, `useSafeArea`) |
| `@kitr/storage` | | `defineStorage`, `defineCookie`; `@kitr/storage/react` hooks, `@kitr/storage/server` cookies, native drivers from the platform packages |
| `@kitr/devtools` | | **Preview.** the development overlay; `getDevtools(app)?.log()`, panels via a provider's `devtools()` |
| `@kitr/cache` | | `createCache`, `remember`, tags, `cached()`; in-memory driver, Redis-shaped `CacheDriver` |
| `@kitr/shield` | | `shield(server)`: security headers, CORS, rate limit with RateLimit-* headers, double-submit CSRF |
| `@kitr/mail` | | `defineMail` React templates, log/Resend/SMTP transports, `mailPreview` at `/_kitr/mail` |
| `@kitr/jobs` | | **Preview.** `defineJob` with schema, retries, timeouts and cron/interval schedules; in-process worker over a `JobsDriver` |
| `@kitr/uploads` | | **Preview.** `upload()` with progress; `@kitr/uploads/server` parses multipart per rules into a disk or custom driver; `@kitr/uploads/react` |
| `@kitr/flags` | | `defineFlags`, env/percentage/OpenFeature providers; `@kitr/flags/server` resolves per request, `@kitr/flags/react` reads |
| `@kitr/consent` | | one consent record by category; gates analytics and monitoring; `@kitr/consent/react` for the banner |
| `@kitr/offline` | | persisted query cache and paused mutations, restored before first render; `useOffline()` |
| `@kitr/secure-storage` | | **Preview.** OS vault drivers with an AES-GCM web fallback; `defineSecureItem`, `useSecureItem` |
| `@kitr/files` | | **Preview.** `open`/`pick`/`save` with native dialogs or the browser's; `useFileDialogs`, `useDropFiles` |
| `@kitr/notifications` | | **Preview.** permission, `show`, `schedule`, `cancel`, tap routing; `useNotificationPermission`, `useNotificationTap` |
| `@kitr/native` | | **Preview.** clipboard, share, haptics, geolocation, camera, biometrics with web fallbacks; `useClipboard`, `useShare`, `useGeolocation` |
| `@kitr/updater` | | **Preview.** `check`/`apply` over the service worker or platform updaters; `useUpdate()` |
| `@kitr/web` | | the `web()` platform (static, spa, ssr, pwa); `@kitr/web/client` has `useInstallPrompt`, `useServiceWorker`; `@kitr/web/vite` |
| `@kitr/desktop` | `electron` | **Preview.** the `desktop()` platform (Electron); `@kitr/desktop/client` (typed IPC), `@kitr/desktop/main`, `@kitr/desktop/preload` |
| `@kitr/tauri` | `@tauri-apps/api` | **Preview.** the `tauri()` platform; `@kitr/tauri/client` (`defineCommands`, `commandQuery`, `useTauriEvent`) |
| `@kitr/mobile` | `@capacitor/core` | **Preview.** the `mobile()` platform (Capacitor); `@kitr/mobile/client` has `isCapacitor`, `isPluginAvailable`, `nativeOnly` |
| `@kitr/vite` | | the `kitr()` Vite plugin: platform-aware aliases, virtual modules, Start, Tailwind, PWA |

See [docs/entry-points.md](docs/entry-points.md) for the rules behind this table.

**Previews** are packages that live in this repo but are not published yet, because they don't meet the release bar: no durable driver (jobs), no auth hook or object storage (uploads), no native drivers behind their APIs (secure-storage, files, notifications, native, updater), a devtools shell still to settle (devtools), or native shells not yet built in CI (platform, desktop, tauri, mobile). They are `"private": true` in their `package.json`; `kitr add` and `kitr new` refuse them unless you pass `--preview` from a kitr checkout.

## A taste

```ts
// app/queries/projects.ts
import { createKeys } from 'kitr/app'
import { mutationFrom, queryFrom } from '@kitr/query'
import { httpMutation, httpQuery } from '@kitr/http'

export const projectKeys = createKeys('projects')

export const projectsQuery = queryFrom(
  httpQuery<void, Project[]>(http, { path: 'projects', key: () => projectKeys.list() }),
)

export const updateProject = mutationFrom(
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
// server/routes.ts
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
  core, react, router, query, http, forms, table, state, tailwind, theme,
  logger, server, api, actions, seo, realtime, auth, db, testing, mocks, i18n,
  analytics, monitoring, platform, storage, devtools,
  web, desktop, tauri, mobile  # platform packages (server's platform lives in packages/server)
  kit-app, kit-server, kit-fullstack, kit-saas, kit-site, kit-realtime, kit-desktop, kit-tauri, kit-mobile  # kits
  vite, cli, kitr            # `kitr` is the umbrella package users install
registry/                    # shadcn-compatible component registry (built to registry/dist)
examples/
  blank, dashboard, fullstack, backend,        # kitr new --kit blank | app | fullstack | server
  saas, site, realtime, desktop, tauri, mobile  # the preset kits
docs/                        # entry points, CLI, packages, platforms, pure backend, departures
```

```sh
pnpm install
pnpm build        # every package, in dependency order
pnpm typecheck    # packages, registry and examples
pnpm test         # vitest across the monorepo
pnpm lint         # biome
```

The examples are exactly what the CLI generates (with workspace links instead of published versions). Regenerate one with `node packages/kitr/bin/kitr.mjs new examples/<name> --kit <kit> --no-install --no-git --registry $PWD/registry/dist`, then see `examples/README.md` for the workspace links. Six of them are presets you can start from: `saas`, `site`, `realtime`, `desktop`, `tauri`, `mobile`. Every example runs with `pnpm dev` (`kitr dev`), builds with `pnpm build` and serves with `pnpm start`.

## Docs

- [docs/cli.md](docs/cli.md): every command and flag
- [docs/package-contract.md](docs/package-contract.md): how a package plugs into `kitr add`, the CLI and the build
- [docs/packages.md](docs/packages.md): what each package provides and when to add it
- [docs/platforms.md](docs/platforms.md): web, server, desktop, tauri and mobile platforms, their options and commands
- [docs/entry-points.md](docs/entry-points.md): the re-export rules
- [site/content/guides](site/content/guides): the step-by-step guides on [kitr.dev/guides](https://kitr.dev/guides), including [an API server without React](site/content/guides/api-server.md)
- [docs/departures.md](docs/departures.md): where the implementation improved on the design plan, and why

## Contributing

Issues and pull requests are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) covers the setup, the checks CI runs and how changes are made; everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md). Report security issues privately, as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Platon Podkopov
