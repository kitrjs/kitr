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
- Better Auth is supported through `betterAuthAdapter(client)`; kitr ships no auth server.

## Queries and mutations by name

`@kitr/actions` has `defineQuery(name, { input, handler, staleTime })` and `defineMutation(name, { input, handler, effects })`, the same two words as `@kitr/query`'s contract-based pair; the import path says which one you are holding, and a server definition is also a `@kitr/query` definition, so `.options(input)` and `useMutation(definition)` work on it unchanged.

The name is not decoration. `kitr types` scans `app/actions`, writes `.kitr/actions.ts` and augments `Operations` in `@kitr/core`, and `app/app.ts` passes the generated `operations` to `createApp`. `useQuery`, `useSuspenseQuery`, `useMutation` and `queryOptions` in `@kitr/query` take that name as their first argument, which differs from TanStack's signature: `useQuery('projects.list', input, overrides)`. Plain TanStack options pass straight through, so nothing written against upstream breaks. `call(name, input)` runs one outside React, and the generated `actions` tree gives `actions.projects.list(input)` for scripts.

Type generation is general. A package exports `defineTypes({ name, watch, generate })` from a `./types` subpath and names it in its manifest (`"kitr": { "types": "./types" }`); the CLI runs every generator the project's packages declare and writes under `.kitr/`, before `kitr dev` and `kitr build`, on change in the dev server, and on `kitr types`. The `platforms` generator is built in and types `app.platform` with the names from `kitrrc.ts`. Server queries and mutations are generated with `make:query` and `make:mutation`.
