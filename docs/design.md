# Design choices

The places where kitr deliberately takes a less obvious route, and why.

## Typed API client without codegen

The router accumulates route types as you chain calls, `typeof routes.$types` is the whole contract, and `createApiClient<AppRoutes>()` is a `Proxy` that resolves names at runtime from a route table. Controllers contribute their output types through `[Controller, 'method']` tuples and their input types through `static validation`. `kitr api:sync` only emits `openapi.json` and a plain route table for consumers that cannot import the server. No generated TypeScript, nothing to forget to regenerate.

## `@kitr/core` has zero React

Core declares `KitrNodeTypes`, an interface `@kitr/react` augments with `ReactNode`. Core's `wrap` is typed against that, so the same core serves a pure backend without React in its graph.

## `@kitr/server` runs standalone

The server package is a complete h3 server on srvx, with a `fetch` handler that Start, Nitro or any runtime can mount. `kitr new --kit server` is a first-class kit. Inside a React project `kitr add server` switches the app to TanStack Start, rewrites the root route into the HTML shell, removes `index.html` and `app/main.tsx`, and adds `kitr serve` for production.

## `@kitr/http` is its own package

Keeping ky separate from the data layer means a backend-only project, or a project talking only to its own Start actions, never installs it.

## `Form` from `@kitr/forms` is kitr's

The one place a re-export is shadowed. `@kitr/forms` exports kitr's `<Form>` (submits through `handleSubmit`, maps server `fieldErrors` with `applyServerErrors`, exposes `useFormStatus`), and React Hook Form's own `Form` is available as `RhfForm`. Every other name from React Hook Form is unchanged.

## Pages are links on a table, not files

TanStack Router's own convention is a file per route under `app/routes`, with a generated `routeTree.gen.ts`. kitr puts pages on the core route table instead: `.root`, `.page` and `.layout` from `@kitr/router/routes`, in `app/routes.ts`, compiled to a TanStack tree by `createKitrRouter({ routes })`. One table shape then serves pages, endpoints and sockets, a server-only app never sees React, and `kitr add` can maintain the list of extensions with a codemod. Everything after the table is TanStack's: `Link`, loaders, `getRouteApi`, search params. File routes work too for a project that has `app/routes/__root.tsx`; route files then import `createFileRoute` from `@tanstack/react-router`, because the generator only recognises that source, and `kitr doctor` allows exactly that set of names.

## TanStack Table v9

v9 is feature-sliced (`useTable({ features })`), which fits "everything is an add-on": a data table only ships sorting, pagination, filtering and visibility. `@kitr/table` exports `dataTableFeatures` as the preset the registry's `data-table` and `useUrlTableState` assume.

## Registry components use native `<dialog>` and no headless library

Components are copied into the app and owned there, so they should have as few runtime dependencies as possible: Tailwind, `cva` and the platform. `Dialog` is a `<dialog>` with `showModal()`; Escape and focus trapping come from the browser.

## Config and providers reach the app as static imports

The Vite plugin exposes `virtual:kitr/providers` and `virtual:kitr/config`, generated from `kitrrc.ts` and `config/*.ts`, so tree-shaking sees plain imports instead of a runtime glob. Server-only projects have no Vite, so `kitr add` maintains `config/index.ts` with the same shape.

## `@kitr/testing/react`

`renderWithKitr` pulls Testing Library and React, so it lives in `@kitr/testing/react` and `@kitr/testing` stays usable in a pure backend's tests.

## `app.mode` beside `app.environment`

`environment` says where code runs (client, server, test). Providers also need to know development from production (console analytics in dev, nothing in prod; devtools on or off), so `createApp` detects `mode` from Vite's `import.meta.env` or `NODE_ENV` and exposes `isDevelopment`/`isProduction`.

## Platforms are packages

Where an app runs is a platform package (`@kitr/web`, `@kitr/server`, `@kitr/desktop`, `@kitr/tauri`, `@kitr/mobile`) built on one contract, `definePlatform` in `@kitr/core`. A project lists where it runs in `kitrrc.ts` (`platforms: { site: web({...}), api: server({...}) }`), `kitr dev|build|start <name>` run them, `kitr config <name> <option> <value>` edits them with validation, `KITR_<NAME>_<OPTION>` overrides at run time, and native projects live in `platforms/<name>/`. Every UI platform renders through TanStack Start (SPA, static and SSR are modes of the same build), so the router is itself an add-on and a project starts with nothing but `@kitr/core` and the CLI. The vendor CLIs (`tauri`, `cap`, `electron-vite`, `wrangler`) run underneath; the platform packages only know how to call them.

Cross-platform helpers are one package, `@kitr/platform`, with a driver registry the desktop and mobile packages fill (`platform()`, `isNative()`, `useBackButton`, `useDeepLink`, `useSafeArea`...), and `@kitr/storage` gets native drivers the same way.

## Few packages with clear names

`theme` holds tokens, the theme provider, toast and the registry settings for `kitr ui add`. `seo` adds head tags, JSON-LD, prerender lists, sitemap and robots, since Start owns server rendering. `realtime` has `ws`, `socket.io` and `sse` transports behind one channel definition. Validation is part of `@kitr/core`.

## Devtools and storage

`@kitr/devtools` follows the provider model: the hub is a container binding that exists only in development on the client, providers contribute panels through an optional `devtools()` method on the provider interface (lazy-importing their React parts), and `getDevtools(app)` is `null` everywhere else so logging costs nothing. The overlay has no dependencies beyond React. `createKitrRouter` binds `router` into the container so devtools and services can reach it. `@kitr/storage` makes browser storage and cookies declarations (`defineStorage`, `defineCookie`) so the same module reads on the server, in `useSyncExternalStore`-based hooks, and in tests.

## Packages ship their own setup

A package exports a setup module (`<package>/kitr`, written with `definePackage` from `@kitr/core/package`) with its questions, codemods, commands, generators and doctor checks, and the CLI discovers it from the installed package. The CLI holds no package-specific code, so a community package is added exactly like an official one. The questions are also flags, so CI never sees a prompt. Kits and platforms use the same contract (`@kitr/kit-saas`, `@kitr/web`). See [package-contract.md](package-contract.md).

## Extra commands

`kitr dev|build|start`, `kitr platforms`, `kitr config`, `kitr info`, `kitr types` (generated types under `.kitr/`, see below), `kitr css:types` (typed CSS Modules for the no-Tailwind path), and `kitr eject all` printing the import rewrites that remove kitr. `make:*` generators can be overridden per project via `kitr eject stub <kind>`.

## Scope

- Prerendering and sitemap generation are configured (`config/seo.ts`) and delegate to Start's own prerender; kitr adds no crawler.
- The Socket.IO Redis adapter is wired through `attachSocketIo(io)`; the adapter itself is yours to install.
- Better Auth is supported through `betterAuthAdapter(client)`, and `kitr add auth --provider better-auth` wires its server into the container; its guards run in the browser only (see [Cookie sessions beside bearer tokens](#cookie-sessions-beside-bearer-tokens)).

## Queries and mutations by name

`@kitr/actions` has `defineQuery(name, { input, handler, staleTime })` and `defineMutation(name, { input, handler, effects })`, the same two words as `@kitr/query`'s contract-based pair; the import path says which one you are holding, and a server definition is also a `@kitr/query` definition, so `.options(input)` and `useMutation(definition)` work on it unchanged.

The name is not decoration. `kitr types` reads `app/actions` with the TypeScript compiler (a call is `defineQuery` or `defineMutation` by symbol, so import aliases, namespace imports and re-exports count, and a name that is not a string literal is an error with `file:line`), writes `.kitr/actions.ts` and augments `Operations` in `@kitr/core`, and `app/app.ts` passes the generated `operations` to `createApp`. `useQuery`, `useSuspenseQuery`, `useMutation` and `queryOptions` in `@kitr/query` take that name as their first argument, which differs from TanStack's signature: `useQuery('projects.list', input, overrides)`. Plain TanStack options pass straight through, so nothing written against upstream breaks. The registry belongs to the app, not the process: `createApp({ operations })` fills `app.operations`, a fork reads through to it, and the hooks find it with `useApp()`. Outside React there is no context, so `queryOptions(context.app, 'projects.list', input)` and `call(app, 'projects.update', input)` take the app first. The generated `actions` tree gives `actions.projects.list(input)` for scripts.

Type generation is general. A package exports `defineTypes({ name, watch, generate })` from a `./types` subpath and names it in its manifest (`"kitr": { "types": "./types" }`); the CLI runs every generator the project's packages declare and writes under `.kitr/`, before `kitr dev` and `kitr build`, on change in the dev server, and on `kitr types`. The `platforms` generator is built in and types `app.platform` with the names from `kitrrc.ts`. Server queries and mutations are generated with `make:query` and `make:mutation`.

## Merging route tables

`merge()` throws a `KitrError` (`CONFLICT`) when both tables register the same route name, naming the duplicate. The route table carries no per-step `Prettify`: `typeof routes.$types` is one flat object, and a chain of several hundred routes keeps exact types.

## The native tier shares one shell skeleton

`@kitr/platform` owns what every shell needs: `createShellProvider()` (`@kitr/platform/shell`) detects the shell and registers a `platform` driver and a storage driver, and `shellPlatformHooks()` (`@kitr/platform/cli`) is the scaffold, dev, build and doctor sequence behind `kitr dev|build|doctor`. Each shell package passes its paths, commands, required tools and drivers and keeps its own options, templates and `definePlatform` contract. Where the app runs is one value, `platform.runtime` (`web`, `electron`, `tauri`, `capacitor`), from a single `detectRuntime()`, because `platform.type` says `desktop` for both Electron and Tauri and the device packages need to tell them apart. The matrix of what every environment answers is in [platforms.md](platforms.md#where-the-code-runs-runtime-platform-and-form-factor).

## A native shell without a driver is an error, not the web driver

The five device packages (`native`, `notifications`, `files`, `secure-storage`, `updater`) pick their driver by `platform.runtime` through `selectDriver()`. In Electron, Tauri or Capacitor with no driver registered for the package, creating the service throws a `KitrError` with code `E_DRIVER_UNAVAILABLE` that names the runtime and the package, so web code never passes for native: no AES-GCM secrets with their key in WebView storage, no service worker "updater" in an installed app. An app that wants the WebView behaviour says so with `fallbackToWeb: true` in the package's config; nothing falls back by itself.

## State lives on the app, not in modules

The lifecycle promise is one app per client, per server process and per test, and `app.fork()` per request, so nothing request-scoped lives in module scope:

- **Operations.** `createApp({ operations })` fills `app.operations`; a fork gets a child registry that reads through to its parent. The hooks in `@kitr/query` read the registry from `useApp()`. Outside React, `queryOptions` and `call` take the app first, and `registerMutationDefaults(client, app.operations)` takes the registry.
- **SEO.** The config from `config/seo.ts` is on the app (`app.config.get('seo')`), and `seo(input, ctx)` finds the app through the second argument: pass the `head` argument (`head: (ctx) => seo({ title }, ctx)`), a loader context or the app. Without it only `input.site` applies. `seo.ssr` is applied to the router instance, not written onto route objects that every request shares.
- **Controllers.** A controller is built per request by `container.make(Controller)` on the request's fork, so it can take services and hold per-request state. `static inject = ['db', 'logger']` names the bindings its constructor receives, in order; a class without `inject` is built with no arguments.
- **A guard.** `pnpm check:module-state` (`scripts/check-module-state.mjs`) fails CI on `let`, `new Map/Set/WeakMap/WeakSet`, and array or object literals at module scope in `packages/*/src`, unless the line (or the one above) carries `// kitr-allow-module-state: <reason>`. Frozen data (`as const`, `Object.freeze`) passes. What is annotated is either an immutable lookup table or page-wide browser state (the storage backend, the toaster).

`@kitr/storage` keeps its backend, key prefix and cookie defaults at module scope on purpose: items are defined at import time, before any app exists, and a browser page has one `localStorage`. The server leaves them unset.

## One way to build the app outside Vite

`app/app.ts` takes `providers` and `config` from the Vite plugin's virtual modules, which leave out what must not reach the browser; `server/main.ts` runs under tsx with no Vite and imports `kitrrc.ts` and `config/`. Both pass through `loadRc` from `kitr/app`, so the call reads the same: `createApp({ ...loadRc({ providers }, config), env })` in the app, `createServer({ ...loadRc(rc, config), routes })` on the server. `loadRc` takes the rc, its module namespace or just `{ providers }`, and says what is missing instead of failing inside `createApp`.

## `kitr dev` labels each platform

With more than one platform running, every line a platform process prints starts with its name from `kitrrc.ts` (`[site] ready in 300ms`, `[api] listening on :3001`), in a colour per platform. Standard input stays the terminal's, and a single platform prints unchanged.

## Cookie sessions beside bearer tokens

`@kitr/auth` has adapters, hooks and guards for the client, and cookie sessions for the server: `createCookieSession`, the `SessionStore` interface with memory, `@kitr/storage` and Redis stores, scrypt password hashing, a `UserProvider` contract and `createSessionController` with email verification and password reset.

- The default is bearer tokens. `kitr add auth` without `--provider` writes a token adapter, and picks `session` only when asked; the SPA kits have no server to hold a session. The `saas` kit, which renders on the server, uses `session`, so its tokens stay out of `localStorage`.
- The `auth` container binding is scoped, not a singleton. On the server the router forks the app per request, and the session service in the fork loads the request's own session (`ensureSession` in `beforeLoad`, inside `runWithSession`). The route context's `session` is a stand-in object that reads the fork's session when a guard asks, because contexts are copied before `beforeLoad` runs. A guard's return value (it holds `can`) must not be returned from a server-rendered `beforeLoad`.
- The storage-driver session store is typed structurally (`get`, `set`, `remove`, `keys`), as are the Redis client and the mail seam, so `@kitr/auth` depends on neither `@kitr/storage` nor `ioredis` nor `@kitr/mail`.
- Better Auth stays a client of its own server: `--provider better-auth` wires its server into the container and its routes under `/api/auth/*`, but the guards run in the browser only. The session controller checks CSRF itself (double submit, the same cookie and header as Shield), so it is safe without Shield, and the typed `api` client has a `csrf` option that copies the cookie into a header on writes.

## Capacitor drivers: plugins are optional peers, loaded on first use

The Capacitor driver of each device package imports its plugins with `await import()` when a method first runs, and the plugins are optional peer dependencies, so a web bundle never loads or installs them. A missing plugin does not fall back to the WebView: the call rejects with `E_DRIVER_UNAVAILABLE` and `install @capacitor/…`. `kitr add native|notifications|files|secure-storage|updater` adds the plugins when the project has the mobile platform (or `@capacitor/core`); `kitr new --kit mobile` installs all of them.

`native` has six capabilities (clipboard, share, haptics, geolocation, camera, biometrics); the Capacitor driver covers the first four and leaves camera and biometrics `supported: false`. Mobile has no "save as" dialog, so `files.save()` writes to the app cache and opens the share sheet (Save to Files, Drive, Mail), and resolves to the cached file's URI, or `null` when the sheet is dismissed. For the mobile platform kitr writes `platforms/<name>/package.json`, generated from the app's dependencies, because the Capacitor CLI finds plugins in the `package.json` of the folder it runs in.

## Electron and Tauri drivers for the device packages

`secure-storage`, `notifications`, `files`, `updater` and `native` have Electron and Tauri drivers. A few choices differ from what you might expect:

- **Secrets in Tauri use Stronghold, not the store plugin.** The store plugin writes plain JSON, so it could not honour `secure: true`. Stronghold is an encrypted snapshot opened with a random 32-byte secret that a scaffolded `kitr_vault_key` command keeps in the operating system's keyring. The Tauri platform installs and registers every plugin the device packages use, so the bundler sees a literal `import()` for each.
- **Electron refuses to store a secret when there is no vault.** `safeStorage` on Linux can fall back to a plain-text backend; the driver treats that as unavailable and the call rejects instead of writing a file anyone can read.
- **`allowChannels()` is an exact list.** It lets through the names in `KITR_CHANNELS` (the ones `handleKitrIpc()` serves and pushes). An app's own `kitr:` channel must be listed.
- **`openExternal` is limited to `http:`, `https:`, `mailto:` and `tel:`.** Other schemes need `externalProtocols` in `handleKitrIpc()`'s options.
- **Files are reached only through a dialog.** The Electron driver reads and writes only paths that `files.open()`, `files.save()` or a picked folder returned in this session.
- **`electron-updater` and the Tauri plugins are optional peers**, installed by `kitr add <package>` for the platforms a project has.

## The default CSP has no `'unsafe-inline'` for scripts

The shield's default policy allows inline scripts and styles only with a per-request nonce: `securityHeaders()` makes one for every response, keeps it in the server's request context and puts `'nonce-<value>'` in `script-src` and `style-src`. TanStack Start reads it from `router.options.ssr.nonce`, which `createKitrRouter` fills from the request, so Start's hydration scripts, `<HeadContent />`, `<Scripts />` and `<ThemeScript />` carry it with no code in the app.

- Pages are rendered inside the server's middleware, because a nonce is per request and the header is the shield's. The server entry written by the server platform is `server.fetch(request, { pages })`: the server answers its own routes, and everything else goes to Start inside the same middleware stack. Page requests skip the shield's rate limit and CSRF check, and the server's body limit.
- `style="..."` attributes stay allowed (`style-src-attr 'unsafe-inline'`); React writes one for every `style` prop on the server, and an attribute cannot run script. Outside production `style-src` also allows `'unsafe-inline'`, because Vite's dev server injects style tags without a nonce. Sonner's stylesheet, injected at load, gets the page's nonce through a short-lived hook in the theme provider.
- `strictDynamic: true` adds `'strict-dynamic'`, for apps whose own scripts load others. `unsafeInline: true` allows inline tags for pages that embed a widget which writes them; it is an escape hatch, not a recommendation.
- `DEFAULT_CSP` is a template containing `{nonce}`, and a custom `contentSecurityPolicy` string may contain it too.

## One `cors()` for the shield and the API

The CORS rules live in `corsPolicy()` in `@kitr/shield`. The shield's and the API's `cors()` both wrap it and take the same `CorsOptions`, so a policy written for one works in the other. `origin: '*'` with credentials throws, no `origin` allows no cross-origin caller, and the default allowed request headers are `Content-Type, Authorization, X-CSRF-Token, X-Requested-With`. `origin` may be a single string.

## One signal handler per process

`SIGINT` and `SIGTERM` handlers are process-wide: a registry (annotated for the module-state guard, because signals belong to the process) that every listening server joins and `close()` leaves. One handler drains all of them and exits once, so two servers in one process never kill each other mid-drain. When the last server leaves, the handler is removed.

## Uploads are served by their bytes, and can be signed

`mountUploads` sniffs the first bytes of a file (images, PDF, audio, video, archives, fonts) and serves what they show, uses the declared type only for a list the app allows (`allowTypes`, default plain text, CSV and JSON), and sends everything else as `application/octet-stream` with `Content-Disposition: attachment`. A declared `image/png` over HTML is never shown as a page. Public files are the default; for private ones `config/uploads.ts` takes `secret` and `requireSigned` for HMAC-signed, expiring links (`uploads.signedUrl(key, { expiresIn })`, Web Crypto only) and an `authorize(access, file)` hook for unsigned requests. A signed link skips `authorize`, and files served through either are `Cache-Control: private`. The signature covers the path and the expiry, not the viewer, so a link is a bearer token: keep it short-lived.

## The queue counts running jobs

`size()` of the memory and Redis jobs drivers includes reserved jobs, so a worker that crashed mid-job never leaves the queue reading empty. Both drivers return a reserved job to the queue after `visibilityTimeout` (30 seconds for memory, five minutes for Redis). Keep the timeout above your longest job's `timeout`, or a slow job runs twice.

## Realtime authorises when a connection opens and subscribes

A realtime connection is checked when it opens (`authorize(request)`) and each time it subscribes (the channel's `authorize`). Re-checking every message would put a session lookup on the hot path of every emit, so revocation has a hook instead: `closeSessions(userId)` on the realtime server closes that user's connections on the instance (WebSocket code 4401), and the cookie session controller calls `onSessionsRevoked(userId)` after sign-out-everywhere and password reset. The reconnect that follows goes through `authorize(request)` again and is refused. Reaching other instances is left to the app, since the memory adapter has no one to tell and an eager Redis subscription per server would be a cost every deployment pays.

## One `kitr generate`, and `typecheck` goes through the CLI

`kitr generate` runs every generator: the type generators, then each package's declared `generate` step (`@kitr/api` declares `api:sync`; the CLI knows no package by name). `kitr dev` and `kitr build` run it before starting, `kitr generate --watch` keeps it running, and the kits' `typecheck` script is `kitr typecheck`, which generates and then runs `tsc --noEmit`. The script is not a bare `tsc --noEmit` because `.kitr/` is ignored by git, and a plain `tsc` in a fresh clone or in CI would fail on the missing `#kitr/*` files. `kitr types` and `kitr api:sync` run their half on their own.

## One request module under `http`, `api`, `actions` and `realtime`

The four data clients share `@kitr/core/request`: the error envelope, the query key factory, abort plumbing and header injection, so a bearer token or CSRF echo works the same in each. Apps may import it too. `api` reads `{ error: { message } }` and `{ errors: [...] }` bodies from other backends the way `http` does. [Choosing a data source](data.md) says which client to use when.

## The devtools provider says it is development only

`kitr add devtools` writes a comment above the provider in `kitrrc.ts`: the Vite plugin strips it from production builds. The line stays in the file because the plugin, not the config, decides what ships.
