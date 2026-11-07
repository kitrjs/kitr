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

## Route files import `createFileRoute` from `@tanstack/react-router`

TanStack's route generator rewrites the `createFileRoute` import in every route file and only recognises `@tanstack/react-router` as its source. Routing it through `kitr/router` produced duplicate imports on build. Route files import route creators from `@tanstack/react-router` and everything else from `kitr/router`; `kitr doctor` allows exactly that set of names.

## TanStack Table v9

The plan assumed v8's `useReactTable`. v9 is feature-sliced (`useTable({ features })`), which fits "everything is an add-on": a data table only ships sorting, pagination, filtering and visibility. `kitr/table` exports `dataTableFeatures` as the preset the registry's `data-table` and `useUrlTableState` assume.

## Registry components use native `<dialog>` and no headless library

Components are copied into the app and owned there, so they should have as few runtime dependencies as possible: Tailwind, `cva` and the platform. `Dialog` is a `<dialog>` with `showModal()`; Escape and focus trapping come from the browser.

## Config and providers reach the app as static imports

Instead of a runtime glob, the Vite plugin exposes `virtual:kitr/providers` and `virtual:kitr/config`, generated from `kitrrc.ts` and `config/*.ts`. Tree-shaking sees plain imports. Server-only projects have no Vite, so `kitr add` maintains `config/index.ts` with the same shape.

## `kitr/testing` split

`renderWithKitr` pulls Testing Library and React. It moved to `kitr/testing/react`, so `kitr/testing` stays usable in a pure backend's tests.

## Extra commands

`kitr serve` (serve a Start build with srvx and WebSocket upgrades), `kitr info`, `kitr css:types` (typed CSS Modules for the no-Tailwind path), and `kitr eject all` printing the import rewrites that remove kitr. `make:*` generators can be overridden per project via `kitr eject stub <kind>`.

## What is not in this version

- Prerendering and sitemap generation are configured (`config/ssr.ts`) but delegate to Start's own options; kitr adds no crawler.
- The Socket.IO Redis adapter is wired through `attachSocketIo(io)`; the adapter itself is yours to install.
- Better Auth is supported through `betterAuthAdapter(client)`; no auth server is shipped.
- npm publishing is prepared (changesets, lockstep versions) but nothing is published yet.
