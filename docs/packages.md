# Packages

Every app starts with `@kitr/core` and the `kitr` CLI. Everything else, the router included, is added with `kitr add <name>`. "Client" packages are refused in server-only projects; the rest work anywhere.

## Capabilities

Packages marked **Preview** are not published yet: they don't meet the release bar (see the README). They are `"private": true`, and `kitr add` refuses them unless you pass `--preview` from a kitr checkout.

| Name | Package | Scope | Needs | Provides |
| --- | --- | --- | --- | --- |
| `react` | `@kitr/react` | client | | `<KitrProvider>`, `useApp()`, `useService()`, `useConfig()`. Added by `router`. |
| `router` | `@kitr/router` | client | react | TanStack Router, `createKitrRouter`, `requireAuth()`, `can()`, default pending/error/404 routes, `app/router.tsx` and `app/client.tsx`. Every UI platform needs it. |
| `query` | `@kitr/query` | client | | TanStack Query, `queryFrom`/`mutationFrom`/`subscriptionFrom`, cache effects, `useSubscription`, a provider with sane defaults (30s stale, no retry on 4xx). |
| `http` | `@kitr/http` | client | query | ky with bearer auth, refresh-once on 401, kitr/Adonis error normalisation; `httpQuery`/`httpMutation` contracts. |
| `forms` | `@kitr/forms` | client | | React Hook Form, `useSchemaForm(schema)` for any Standard Schema library, `<Form>` that maps server `fieldErrors`, headless `<FormField>`. |
| `table` | `@kitr/table` | client | | TanStack Table v9 (feature-sliced), `dataTableFeatures`, `useUrlTableState` for shareable sort/page/filter URLs. |
| `state` | `@kitr/state` | client | | Zustand, `createKitrStore` returning `[useStore, StoreProvider, store]` with per-request stores on the server. |
| `tailwind` | `@kitr/tailwind` | client | | Tailwind v4 via Vite, `cn()`, the preset that exposes kitr tokens as `@theme` so `bg-background` and friends work. |
| `theme` | `@kitr/theme` | client | | Design tokens (`defineTokens`, oklch defaults with a dark set, `app/styles/tokens.css`), `ThemeProvider`/`useTheme` (system/light/dark, cookie for SSR, `meta[name=theme-color]`), `toast` over sonner, `cva`/`clsx`, and the registry settings `kitr ui add` reads from `config/theme.ts`. |
| `auth` | `@kitr/auth` | client | | `createAuth(adapter)` with token, Better Auth and custom adapters, `defineAbilities`, router guards, `useAuth`/`useCan`; `kitr/auth/server` middleware for the API. |
| `logger` | `@kitr/logger` | any | | Structured logger, levels, children, request ids, pretty in dev and JSON in production. |
| `server` | `@kitr/server` | any | logger | h3 server with the kitr app lifecycle, request-scoped container, health route, graceful shutdown. Standalone via srvx, or a `fetch` handler inside Start. `kitr/server/platform` is the `server()` platform factory. |
| `api` | `@kitr/api` | any | server | Adonis-style router (groups, resources, middleware) in `server/routes.ts`, controllers in `server/controllers/` with `static validation`, typed client with no codegen, OpenAPI. |
| `actions` | `@kitr/actions` | client | server, query | `defineQuery` and `defineMutation` over Start server functions: input schema, middleware, one error shape, cache effects. `kitr types` registers every name, so `useQuery('projects.list')` is typed. |
| `seo` | `@kitr/seo` | client | | `seo()` head tags, `jsonLd()`, `ssrRoute()`, `cacheHeaders()`, `robotsTxt()`; `config/seo.ts` drives the web platform's prerender list and sitemap. |
| `realtime` | `@kitr/realtime` | any | server | Typed channels over one of three transports chosen in `config/realtime.ts`: `ws` (partysocket client, crossws server), `socket.io` (rooms), `sse` (EventSource plus a POST control channel). Events apply cache effects; `kitr/realtime/react` has `useChannel`. |
| `db` | `@kitr/db` | any | server | `defineDb({ connect, disconnect })` so any ORM joins the lifecycle and is available as `ctx.db`. |
| `testing` | `@kitr/testing` | any | | Vitest config, `createTestApp`, `createTestClient(server)`; `kitr/testing/react` for `renderWithKitr`. |
| `mocks` | `@kitr/mocks` | client | | MSW handlers from kitr route tables and contracts, for dev without a backend and for tests. |
| `i18n` | `@kitr/i18n` | client | | react-i18next, typed keys from your resource files, locale detection. |
| `analytics` | `@kitr/analytics` | client | | `page`/`track`/`identify` behind one API with Google Analytics, Plausible, PostHog and console adapters; page views from the router; queue-until-consent; typed event map. |
| `monitoring` | `@kitr/monitoring` | any | | `captureException`, breadcrumbs, user context behind one API; Sentry and console reporters; window handlers, an error boundary, `reportErrors` h3 middleware. Drops expected 4xx by default. |
| `offline` | `@kitr/offline` | client | query, storage | Persists successful queries and paused mutations to the app's storage driver, restores them before the first render and replays mutations on reconnect; `useOffline()` for `{ online, pending, restored }`. |
| `flags` | `@kitr/flags` | any | | `defineFlags` with typed defaults, ordered providers (env, percentage rollout, OpenFeature for any vendor), per-request `resolveFlags` on the server embedded with `<FlagsScript />`, `useFlag()` in components. |
| `consent` | `@kitr/consent` | client | storage | One consent record by category in a cookie the server can read; analytics and (optionally) monitoring wait for their category; `useConsent()` drives the banner. |
| `secure-storage` | `@kitr/secure-storage` | any | storage | **Preview.** Secrets in the OS vault (Keychain, Keystore, safeStorage) with an AES-GCM web fallback; `defineSecureItem` for typed, validated items; `useSecureItem()`. |
| `files` | `@kitr/files` | client | platform | **Preview.** `open`/`pick`/`save` with native dialogs on desktop and mobile, the File System Access API in the browser and a download fallback; `useFileDialogs()`, `useDropFiles()`. |
| `notifications` | `@kitr/notifications` | client | platform | **Preview.** Permission, `show`, `schedule`, `cancel` and a tap listener that carries the page to open; web Notification API or the platform's driver. |
| `native` | `@kitr/native` | client | platform | **Preview.** Clipboard, share sheet, haptics, geolocation, camera and biometrics, each a separate capability with a web driver and a `supported` flag; `useClipboard()`, `useShare()`, `useGeolocation()`. |
| `updater` | `@kitr/updater` | client | platform | **Preview.** One `check`/`apply` state machine over the service worker on the web and the platform updaters on desktop and mobile; `useUpdate()` for the banner. |
| `cache` | `@kitr/cache` | any | server | `remember`, tags and `cached()` over a `CacheDriver` (in-memory shipped, Redis-shaped interface), with in-flight de-duplication. |
| `shield` | `@kitr/shield` | any | server | Security headers, CORS, per-IP rate limiting with RateLimit-* headers and double-submit CSRF as h3 middlewares; `shield(server)` reads `config/shield.ts`. |
| `mail` | `@kitr/mail` | any | server | React email templates (`defineMail`), log, Resend and SMTP transports, text alternatives, and `/_kitr/mail` previews in development. |
| `jobs` | `@kitr/jobs` | any | server | **Preview.** `defineJob` with a payload schema, retries with backoff, timeouts and cron or interval schedules; an in-process worker over a `JobsDriver` (in-memory shipped). |
| `uploads` | `@kitr/uploads` | any | | **Preview.** Client `upload()` with progress and typed errors plus `useUpload()`; server `receive()`/`mount()` that parses multipart per size and type rules into a disk or custom driver. |
| `platform` | `@kitr/platform` | client | | **Preview.** One API for where the app runs: `platform()`, `isNative()`, `perPlatform()`, and the hooks `usePlatform`, `useOnline`, `useAppState`, `useBackButton`, `useDeepLink`, `useSafeArea`. A driver registry the desktop and mobile packages fill; the browser is the default driver. |
| `storage` | `@kitr/storage` | any | | `defineStorage` (typed local/session items with schema, version+migrate, ttl, cross-tab sync) and `defineCookie` readable on both sides; `useStorage`/`useCookie` hydration-safe hooks; `cookies(event)` on the server. Native drivers (Tauri store, Electron IPC, Capacitor Preferences) come from the platform packages. |
| `devtools` | `@kitr/devtools` | client | | **Preview.** The development overlay: App, Router, Query, Auth, Storage, Platform, Errors, Analytics and Log panels, a command palette, and a hub any package logs to. Providers add panels with a `devtools()` method. Dropped from production builds by the Vite plugin. |

Always present: `@kitr/core` (app, container, providers, config, env, errors, contracts, validation, the `definePlatform` contract), `@kitr/vite` in projects with a UI platform, `@kitr/cli` through the `kitr` binary.

## Platforms

Platforms are packages too, added with `kitr add <type> <name>` and configured in `kitrrc.ts` under `platforms`. See [platforms.md](platforms.md).

| Type | Package | Entry points | Needs |
| --- | --- | --- | --- |
| `web` | `@kitr/web` | `kitr/web` (`web()`), `kitr/web/client` (`useInstallPrompt`, `useServiceWorker`), `kitr/web/vite` | router |
| `server` | `@kitr/server` | `kitr/server` (`server()` beside `createServer`), `kitr/server/platform` | server |
| `desktop` | `@kitr/desktop` | **Preview.** `kitr/desktop` (`desktop()`, Electron), `kitr/desktop/client`, `kitr/desktop/main`, `kitr/desktop/preload`, `kitr/desktop/provider` | router, platform, storage |
| `tauri` | `@kitr/tauri` | **Preview.** `kitr/tauri` (`tauri()`), `kitr/tauri/client`, `kitr/tauri/provider` | router, platform, storage |
| `mobile` | `@kitr/mobile` | **Preview.** `kitr/mobile` (`mobile()`), `kitr/mobile/client`, `kitr/mobile/provider` | router, platform, storage |

## Devtools

`kitr add devtools --preview` (a preview: not published, not in the kits) mounts a bottom panel in development: ctrl/cmd+shift+K toggles it, ctrl/cmd+shift+P opens a command palette with every package's actions. Each package contributes its own panel through the provider's `devtools(app)` method, and logs through `getDevtools(app)?.log(channel, label, data)`, which is `null` in production. Out of the box: App (mode, providers, container, config, env), Router (location, matches, loader data, navigation log), Query (cache with invalidate/refetch/remove), Auth (session, sign out), Storage (local/session/cookies with remove), Platform (type, OS, drivers, app state), Errors (captured exceptions and breadcrumbs), Analytics (events, enable/disable) and Log (http requests, logger records, every channel). The kitr Vite plugin leaves the provider out of production builds, so nothing of it ships.

## Kits

The full walkthrough of every kit is in [kits.md](kits.md).

| Kit | Platforms | Packages |
| --- | --- | --- |
| `blank` | none | none: `package.json`, `tsconfig.json`, `kitrrc.ts`, `biome.json`, `.gitignore`, `.env.example`, `AGENTS.md`. `kitr add web site` (or any platform) brings Vite, React and the router. |
| `app` | `site: web({ mode: 'spa' })` | router, query, http, forms, table, state, tailwind, theme, auth, storage, mocks, testing, plus eleven registry components (including `icon`, Hugeicons stroke-rounded) |
| `fullstack` | `site: web({ mode: 'ssr' })`, `api: server()` | the app kit plus logger, server, seo, actions, api, realtime |
| `server` | `api: server()` | logger, server, api, db, realtime, testing. No React. |
| `saas` | `site` (ssr), `api` | the fullstack set with analytics and monitoring; sign-in, guarded shell, projects CRUD, tests |
| `site` | `site` (ssr), `api` | query, forms, tailwind, theme, i18n, storage, analytics, seo, api, testing; prerendered pages, blog, newsletter |
| `realtime` | `site` (ssr), `api` | query, forms, tailwind, theme, storage, seo, api, realtime, testing; chat over typed channels |
| `desktop` (preview) | `site: web({ mode: 'spa' })`, `app: desktop()` | the app kit plus platform; Electron, native dialogs over typed IPC |
| `tauri` (preview) | `site: web({ mode: 'spa' })`, `app: tauri()` | the app kit plus platform; Tauri, typed Rust commands and events |
| `mobile` (preview) | `site: web({ mode: 'spa', pwa: true })`, `phone: mobile()` | the app kit plus platform; installable PWA and the Capacitor shell |

`kitr new <dir> --platform admin=web,api=server --mode spa --runtime bun` replaces a kit's platforms; `--targets`, `--pwa` and `--port` set the first platform's options.

Every kit but `blank` is a package of its own (`@kitr/kit-saas`, `@kitr/kit-server`), a setup module with `kind: 'kit'` that names the platforms, the packages with their answers, the registry components and the files to write. The CLI loads it the way it loads any setup module, runs it once and never lists it in the project: a kit is a template, not a dependency. `kitr new my-app --kit @acme/starter` runs a kit from any npm package the same way.

## Roadmap

Later: local-db, payments, better-auth, ai, push, sync, search, media, admin, workflow, audit, tenancy, cms, graphql, commerce. Each lands as a package with its own setup module, docs and a `make:*` command where one fits.
