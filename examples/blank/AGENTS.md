# Agent guide

This app is built with kitr. Each section below is maintained by `kitr add`.

## kitr: conventions

- Import framework code from `kitr/*` entry points (`kitr/router`, `kitr/query`, ...). They re-export the upstream library unchanged plus kitr helpers.
- Where the app runs is a platform in `kitrrc.ts` (`platforms: { site: web({...}), api: server({...}) }`). `kitr dev <name>` / `kitr build <name>` / `kitr start <name>` run one or all; `kitr config <name> <option> <value>` edits options; native projects live in `platforms/<name>/`.
- Wiring lives in `kitrrc.ts` and `config/*.ts`; server code in `server/`. Generators: `kitr make:route|action|controller|channel|store|form|queries`. Run `kitr doctor` after changes.

## kitr: router

- Routes are files in `app/routes` (TanStack Router file routes). `app/routeTree.gen.ts` is generated; never edit it.
- In route files, import `createFileRoute` / `createLazyFileRoute` from `@tanstack/react-router` (the route generator owns that import). Everything else comes from `kitr/router`.
- The root route (`app/routes/__root.tsx`) renders the HTML document: TanStack Start streams it on the server (web `ssr`), prerenders it (`static`) or ships one shell (`spa`, desktop, mobile). Keep it platform-neutral.

## kitr: query

- Import from `kitr/query`, never from `@tanstack/react-query` directly.
- Every data source becomes `defineQuery(...)` / `defineMutation(...)` in `app/features/<name>/queries.ts`. Components use `useSuspenseQuery(x.options(input))`.
- Route loaders call `context.queryClient.ensureQueryData(x.options(input))` so data is fetched once for server and client.
- Mutations declare `effects` (invalidate/set keys). Never call `queryClient.invalidateQueries` inline in components.

## kitr: platform site

- `kitr dev <name>` runs Vite on the platform's port; `kitr build` writes `dist/<name>`; `kitr start` serves it (static files).
- Routes render on the client; loaders run in the browser.
