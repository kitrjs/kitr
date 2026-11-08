# Departures from the design plan

The implementation follows the "Kitr — Framework Design Plan". These are the places where it deliberately differs, and why.

## Typed API client without codegen

The plan had `kitr api:sync` generate a typed client. Instead the router accumulates route types as you chain calls, `typeof routes.$types` is the whole contract, and `createApiClient<AppRoutes>()` is a `Proxy` that resolves names at runtime from a route table. Controllers contribute their output types through `[Controller, 'method']` tuples and their input types through `static validation`. `api:sync` still runs, but it only emits `openapi.json` and a plain route table for consumers that cannot import the server. No generated TypeScript, nothing to forget to regenerate.

## `@kitr/core` has zero React

The plan put the provider `wrap()` hook in core. Core now declares `KitrNodeTypes`, an interface `@kitr/react` augments with `ReactNode`. Core's `wrap` is typed against that, so the same core serves a pure backend without React in its graph.

## `@kitr/server` runs standalone

The plan treated the server package as the Start add-on. It is a complete h3 server on srvx, with a `fetch` handler that Start, Nitro or any runtime can mount. `kitr new --kit server` is a first-class kit. Inside a React project `kitr add server` switches the app to TanStack Start, rewrites the root route into the HTML shell, removes `index.html` and `app/main.tsx`, and adds `kitr serve` for production.

## `@kitr/http` is its own package

The plan folded the HTTP client into the data layer. Keeping ky separate means a backend-only project, or a project talking only to its own Start actions, never installs it.

## `Form` from `kitr/forms` is kitr's

The one place a re-export is shadowed. `kitr/forms` exports kitr's `<Form>` (submits through `handleSubmit`, maps server `fieldErrors` with `applyServerErrors`, exposes `useFormStatus`), and React Hook Form's own `Form` is available as `RhfForm`. Every other name from React Hook Form is unchanged.

## Pages are links on a table, not files

TanStack Router's own convention is a file per route under `app/routes`, with a generated `routeTree.gen.ts`. kitr puts pages on the core route table instead: `.root`, `.page` and `.layout` from `kitr/router/routes`, in `app/routes.ts`, compiled to a TanStack tree by `createKitrRouter({ routes })`. One table shape then serves pages, endpoints and sockets, a server-only app never sees React, and `kitr add` can maintain the list of extensions with a codemod. Everything after the table is TanStack's: `Link`, loaders, `getRouteApi`, search params. File routes still work for a project that has `app/routes/__root.tsx`; in that case route files import `createFileRoute` from `@tanstack/react-router`, because the generator only recognises that source, and `kitr doctor` allows exactly that set of names.

## TanStack Table v9

The plan assumed v8's `useReactTable`. v9 is feature-sliced (`useTable({ features })`), which fits "everything is an add-on": a data table only ships sorting, pagination, filtering and visibility. `kitr/table` exports `dataTableFeatures` as the preset the registry's `data-table` and `useUrlTableState` assume.

## Registry components use native `<dialog>` and no headless library

Components are copied into the app and owned there, so they should have as few runtime dependencies as possible: Tailwind, `cva` and the platform. `Dialog` is a `<dialog>` with `showModal()`; Escape and focus trapping come from the browser.

## Config and providers reach the app as static imports

Instead of a runtime glob, the Vite plugin exposes `virtual:kitr/providers` and `virtual:kitr/config`, generated from `kitrrc.ts` and `config/*.ts`. Tree-shaking sees plain imports. Server-only projects have no Vite, so `kitr add` maintains `config/index.ts` with the same shape.

## `kitr/testing` split

`renderWithKitr` pulls Testing Library and React. It moved to `kitr/testing/react`, so `kitr/testing` stays usable in a pure backend's tests.

## `app.mode` beside `app.environment`

The plan had `environment` (client/server/test) only. Providers also need to know development from production (console analytics in dev, nothing in prod; devtools on or off), so `createApp` detects `mode` from Vite's `import.meta.env` or `NODE_ENV` and exposes `isDevelopment`/`isProduction`.

## Platforms are packages, not add-ons

The first version shipped `pwa`, `electron`, `tauri` and `capacitor` as capability packages that each patched `vite.config.ts` and `package.json` scripts. They are now four platform packages (`@kitr/web`, `@kitr/server`, `@kitr/desktop`, `@kitr/mobile`) built on one contract, `definePlatform` in `@kitr/core`. A project lists where it runs in `kitrrc.ts` (`platforms: { site: web({...}), api: server({...}) }`), `kitr dev|build|start <name>` run them, `kitr config <name> <option> <value>` edits them with validation, `KITR_<NAME>_<OPTION>` overrides at run time, and native projects live in `platforms/<name>/`. Every UI platform renders through TanStack Start (SPA, static and SSR are modes of the same build), so the router is itself an add-on and a project starts with nothing but `@kitr/core` and the CLI. The vendor CLIs (`tauri`, `cap`, `electron-vite`, `wrangler`) are still what runs underneath; the platform packages only know how to call them.

The cross-platform helpers that used to be split by vendor are one package, `@kitr/platform`, with a driver registry the desktop and mobile packages fill (`platform()`, `isNative()`, `useBackButton`, `useDeepLink`, `useSafeArea`...), and `@kitr/storage` gained native drivers the same way. `analytics` and `monitoring` stay capability packages.

## Fewer packages with clearer names

`styling` and `ui` merged into `theme` (tokens, theme provider, toast, the registry settings for `kitr ui add`). `ssr` became `seo`, since Start owns server rendering and what the package adds is head tags, JSON-LD, prerender lists, sitemap and robots. `socket` and `socket.io` merged into `realtime` with `ws`, `socket.io` and `sse` transports behind one channel definition. Validation moved into `@kitr/core`.

## Devtools and storage

Also not in the plan. `@kitr/devtools` follows the provider model: the hub is a container binding that exists only in development on the client, providers contribute panels through an optional `devtools()` method on the provider interface (lazy-importing their React parts), and `getDevtools(app)` is `null` everywhere else so logging costs nothing. The overlay has no dependencies beyond React. `@kitr/storage` makes browser storage and cookies declarations (`defineStorage`, `defineCookie`) so the same module reads on the server, in `useSyncExternalStore`-based hooks, and in tests. `createKitrRouter` now binds `router` into the container so devtools (and services) can reach it.

## Packages ship their own setup

The CLI used to hold every package's setup as a recipe, so adding a package meant editing the CLI, and a community package could not be added at all. A package now exports a setup module (`<package>/kitr`, written with `definePackage` from `@kitr/core/package`) with its questions, codemods, commands, generators and doctor checks, and the CLI discovers it from the installed package. The questions are also flags, so the "no prompts in CI" rule survives. See [package-contract.md](package-contract.md). Every official package is on it, kits and platforms included (`@kitr/kit-saas`, `@kitr/web`), so the CLI holds no package-specific code and a community package is added exactly like an official one.

## Extra commands

`kitr dev|build|start`, `kitr platforms`, `kitr config`, `kitr info`, `kitr types` (generated types under `.kitr/`, see below), `kitr css:types` (typed CSS Modules for the no-Tailwind path), and `kitr eject all` printing the import rewrites that remove kitr. `make:*` generators can be overridden per project via `kitr eject stub <kind>`.

## What is not in this version

- Prerendering and sitemap generation are configured (`config/seo.ts`) and delegate to Start's own prerender; kitr adds no crawler.
- The Socket.IO Redis adapter is wired through `attachSocketIo(io)`; the adapter itself is yours to install.
- The Next-tier packages from the package map (`secure-storage`, `files`, `notifications`, `native`, `updater`, `offline`, `flags`, `consent`, `cache`, `shield`, `mail`, `jobs`, `uploads`) are not here yet.
- Better Auth is supported through `betterAuthAdapter(client)`; no auth server is shipped.
- npm publishing is prepared (changesets, lockstep versions) but nothing is published yet.

## Queries and mutations by name

The plan had `defineAction('projects.update', { method: 'GET' })` for reads and `.query()` / `.mutation()` adapters for TanStack Query. That is gone. `kitr/actions` has `defineQuery(name, { input, handler, staleTime })` and `defineMutation(name, { input, handler, effects })`, the same two words as `kitr/query`'s contract-based pair; the import path says which one you are holding, and a server definition is also a `kitr/query` definition, so `.options(input)` and `useMutation(definition)` work on it unchanged.

The name is not decoration. `kitr types` scans `app/actions`, writes `.kitr/actions.ts` and augments `Operations` in `@kitr/core`, and `app/app.ts` passes the generated `operations` to `createApp`. `useQuery`, `useSuspenseQuery`, `useMutation` and `queryOptions` in `kitr/query` take that name as their first argument, which is a departure from TanStack's signature: `useQuery('projects.list', input, overrides)`. Plain TanStack options still pass straight through, so nothing written against upstream breaks. `call(name, input)` runs one outside React, and the generated `actions` tree gives `actions.projects.list(input)` for scripts.

Type generation is general. A package exports `defineTypes({ name, watch, generate })` from a `./types` subpath and names it in its manifest (`"kitr": { "types": "./types" }`); the CLI runs every generator the project's packages declare and writes under `.kitr/`, before `kitr dev` and `kitr build`, on change in the dev server, and on `kitr types`. The `platforms` generator is built in and types `app.platform` with the names from `kitrrc.ts`. `make:action` is replaced by `make:query` and `make:mutation`.

## Merging route tables

`merge()` throws a `KitrError` (`CONFLICT`) when both tables register the same route name, naming the duplicate. It used to keep the first entry and drop the second without a word. The route table also stops carrying a per-step `Prettify`: `typeof routes.$types` is still one flat object, but a chain of several hundred routes no longer degrades to `any`.
## The native tier shares one shell skeleton

The desktop, tauri and mobile packages had grown three copies of the same two things: a runtime provider (detect the shell, register a `platform` driver and a storage driver) and the scaffold, dev, build and doctor sequence behind `kitr dev|build|doctor`. `@kitr/platform` now owns both. `createShellProvider()` (`kitr/platform/shell`) is the provider half and `shellPlatformHooks()` (`kitr/platform/cli`) is the CLI half; each shell package passes its paths, commands, required tools and drivers and keeps its own options, templates and `definePlatform` contract. Where the app runs is also one value, `platform.runtime` (`web`, `electron`, `tauri`, `capacitor`), from a single `detectRuntime()`, because `platform.type` says `desktop` for both Electron and Tauri and the device packages need to tell them apart. The matrix of what every environment answers is in [platforms.md](platforms.md#where-the-code-runs-runtime-platform-and-form-factor).

## A native shell without a driver is an error, not the web driver

The five device packages (`native`, `notifications`, `files`, `secure-storage`, `updater`) shipped web drivers only, and those ran in any shell: AES-GCM secrets with their key in WebView storage on a phone, a service worker "updater" in an installed desktop app, a share sheet that was the browser's. They looked supported and were not native. Each package now picks its driver by `platform.runtime` through `selectDriver()`, and in Electron, Tauri or Capacitor, with no driver registered for the package, creating the service throws a `KitrError` with code `E_DRIVER_UNAVAILABLE` that names the runtime and the package. An app that really wants the WebView behaviour says so with `fallbackToWeb: true` in the package's config; nothing falls back by itself. The browser and the server behave as before. Apps that registered their own driver, or set `driver` in the config, are unaffected.

## Electron and Tauri drivers for the device packages

`secure-storage`, `notifications`, `files`, `updater` and `native` have real Electron and Tauri drivers, and the placeholders that threw `E_DRIVER_UNAVAILABLE` are gone for those two runtimes (Capacitor still throws). A few choices differ from what you might expect:

- **Secrets in Tauri use Stronghold, not the store plugin.** The store plugin writes plain JSON, so it could not honour `secure: true`. Stronghold is an encrypted snapshot opened with a random 32-byte secret that a scaffolded `kitr_vault_key` command keeps in the operating system's keyring. The Tauri platform therefore installs and registers every plugin the device packages use, whether or not the app calls them yet, so the bundler sees a literal `import()` for each.
- **Electron refuses to store a secret when there is no vault.** `safeStorage` on Linux can fall back to a plain-text backend; the driver treats that as unavailable and the call rejects instead of writing a file anyone can read.
- **`allowChannels()` is an exact list.** It used to let any name starting with `kitr:` through the preload bridge. It now lets through the names in `KITR_CHANNELS` (the ones `handleKitrIpc()` serves and pushes). An app that sent its own `kitr:` channel through `allowChannels()` must list it.
- **`openExternal` is limited to `http:`, `https:`, `mailto:` and `tel:`.** Other schemes need `externalProtocols` in `handleKitrIpc()`'s options.
- **Files are reached only through a dialog.** The Electron driver reads and writes only paths that `files.open()`, `files.save()` or a picked folder returned in this session.
- **`electron-updater` and the Tauri plugins are optional peers**, so they are not installed until something needs them. `kitr add <package>` installs the ones a project's platforms use.

The Electron scaffold also changed to make a built app start: the main bundle is `index.js`, the preload is CommonJS with kitr bundled in, and `package.json` gets a `version`.
