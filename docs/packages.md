# Packages

Add any of these with `kitr add <name>`. "Client" packages are refused in server-only projects; the rest work anywhere.

| Name | Package | Scope | Needs | Provides |
| --- | --- | --- | --- | --- |
| `query` | `@kitr/query` | client | | TanStack Query, `defineQuery`/`defineMutation`/`defineSubscription`, cache effects, `useSubscription`, a provider with sane defaults (30s stale, no retry on 4xx). |
| `http` | `@kitr/http` | client | query | ky with bearer auth, refresh-once on 401, kitr/Adonis error normalisation; `httpQuery`/`httpMutation` contracts. |
| `forms` | `@kitr/forms` | client | | React Hook Form, `useSchemaForm(schema)` for any Standard Schema library, `<Form>` that maps server `fieldErrors`, headless `<FormField>`. |
| `table` | `@kitr/table` | client | | TanStack Table v9 (feature-sliced), `dataTableFeatures`, `useUrlTableState` for shareable sort/page/filter URLs. |
| `state` | `@kitr/state` | client | | Zustand, `createKitrStore` returning `[useStore, StoreProvider, store]` with per-request stores on the server. |
| `styling` | `@kitr/styling` | client | | `clsx`, `cva`, `defineTokens` (oklch defaults, dark set), CSS Modules helpers. For apps that do not want Tailwind. |
| `tailwind` | `@kitr/tailwind` | client | | Tailwind v4 via Vite, `cn()`, the preset that exposes kitr tokens as `@theme` so `bg-background` and friends work. |
| `ui` | `@kitr/ui` | client | | Theme provider (system/light/dark, cookie for SSR), `toast` facade over sonner, registry settings. Components are copied, not imported. |
| `auth` | `@kitr/auth` | client | | `createAuth(adapter)` with token, Better Auth and custom adapters, `defineAbilities`, router guards, `useAuth`/`useCan`; `kitr/auth/server` middleware for the API. |
| `logger` | `@kitr/logger` | any | | Structured logger, levels, children, request ids, pretty in dev and JSON in production. |
| `server` | `@kitr/server` | any | logger | h3 server with the kitr app lifecycle, request-scoped container, health route, graceful shutdown. Standalone via srvx, or a `fetch` handler inside Start. React apps switch to TanStack Start when this is added. |
| `api` | `@kitr/api` | any | server | Adonis-style router (groups, resources, middleware), controllers with `static validation`, typed client with no codegen, OpenAPI. |
| `actions` | `@kitr/actions` | client | server | `defineAction` over Start server functions: input schema, middleware, one error shape, cache effects, `.query()`/`.mutation()` for TanStack Query. |
| `ssr` | `@kitr/ssr` | client | server | `seo()`, `ssrRoute()`, `cacheHeaders()`, prerender list in `config/ssr.ts`. |
| `socket` | `@kitr/socket` | any | server | Typed channels over WebSocket. Client on partysocket (reconnecting), server on crossws through h3. Events apply cache effects. |
| `socket.io` | `@kitr/socket.io` | any | server, socket | The same channel definitions over Socket.IO rooms. |
| `db` | `@kitr/db` | any | server | `defineDb({ connect, disconnect })` so any ORM joins the lifecycle and is available as `ctx.db`. |
| `testing` | `@kitr/testing` | any | | Vitest config, `createTestApp`, `createTestClient(server)`; `kitr/testing/react` for `renderWithKitr`. |
| `mocks` | `@kitr/mocks` | client | | MSW handlers from kitr route tables and contracts, for dev without a backend and for tests. |
| `i18n` | `@kitr/i18n` | client | | react-i18next, typed keys from your resource files, locale detection. |
| `analytics` | `@kitr/analytics` | client | | `page`/`track`/`identify` behind one API with Google Analytics, Plausible, PostHog and console adapters; page views from the router; queue-until-consent; typed event map. |
| `monitoring` | `@kitr/monitoring` | any | | `captureException`, breadcrumbs, user context behind one API; Sentry and console reporters; window handlers, an error boundary, `reportErrors` h3 middleware. Drops expected 4xx by default. |
| `pwa` | `@kitr/pwa` | client | | Installable app: manifest and service worker from `config/pwa.ts` via vite-plugin-pwa; `useInstallPrompt`, `useOnline`, `useServiceWorker` with an update banner component. |
| `electron` | `@kitr/electron` | client | | Desktop with Electron: electron-vite config for main/preload/renderer, a typed IPC schema shared by all three, `createMainWindow` with secure defaults, electron-builder packaging. |
| `tauri` | `@kitr/tauri` | client | | Desktop and mobile with Tauri 2: `src-tauri/` scaffold (Cargo, lib.rs, capabilities), Vite tuned for the webview, `defineCommands<Commands>()` for typed Rust commands, `commandQuery`/`commandMutation`, events. |
| `capacitor` | `@kitr/capacitor` | client | | iOS and Android with Capacitor: config in `config/capacitor.ts` mirrored to `capacitor.config.ts`, `isNative`/`platform`/`perPlatform`, `useBackButton`, `useAppUrlOpen`, `useAppState`, `nativeOnly`. |

Always present: `@kitr/core` (app, container, providers, config, env, errors, contracts), `@kitr/react` in React apps, `@kitr/router` in React apps, `@kitr/vite` for the build, `@kitr/cli` through the `kitr` binary.

## Platform add-ons

The last six rows are platform targets, not data layers. Each one wires the vendor tooling (electron-vite, the Tauri CLI, the Capacitor CLI, vite-plugin-pwa) exactly as its own docs recommend, adds scripts (`electron:dev`, `tauri:dev`, `cap:sync`...), and keeps the web build working: every helper has a browser fallback (`ipc.available`, `isTauri()`, `isNative()`), so one `app/` ships to the web, desktop and mobile. `analytics` and `monitoring` default to the console in development and to nothing in production until an adapter or reporter is configured, so they can be added on day one.

## Kits

| Kit | Packages |
| --- | --- |
| `blank` | router + query |
| `app` | http, forms, table, state, styling, tailwind, ui, auth, mocks, testing, plus ten registry components |
| `fullstack` | the app kit plus logger, server, ssr, actions, api, socket |
| `server` | logger, server, api, db, socket, testing. No React. |
