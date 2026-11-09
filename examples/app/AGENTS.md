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

## kitr: tailwind

- Tailwind v4: utilities map to kitr tokens (`bg-background`, `text-primary`, `rounded-md`). Use `cn()` from `@kitr/tailwind` to merge classes. Dark mode is `data-theme="dark"` on <html>, toggled by `useTheme()`.

## kitr: theme

- Theme: `useTheme()` from `@kitr/theme` (`theme`, `resolved`, `setTheme`, `toggle`); `data-theme="light|dark"` on <html>. Put `<ThemeScript />` in the document head to avoid a flash.
- Colours and radii come from the `--kitr-*` variables (`@kitr/theme/styles.css`, overrides in `app/styles/tokens.css`); never hard-code them. Plain CSS helpers: `pick()`, `vars()`, `dataAttrs()` from `@kitr/theme`.
- Components live in `app/components/ui/` and are owned by the app: add more with `kitr ui add <name>` (shadcn-compatible registry).
- Icons: Hugeicons in the stroke-rounded style through `<Icon icon={Add01Icon} />` from `#components/ui/icon` (`kitr ui add icon`), icons from `@hugeicons/core-free-icons`. No other icon set, no emoji or glyphs as icons.

## kitr: testing

- `pnpm test` runs Vitest. Components: `renderWithKitr(<X />, { app, queryData })` from `@kitr/testing/react`. APIs: `createTestClient(server).get('/api/x')`. No running backend is needed.

## kitr: vite

- `vite.config.ts` holds `kitr()`, which wires the router, React, Tailwind, `virtual:kitr/*` and the `#app`-style aliases from kitrrc.ts and the installed packages. Build-time steps (generated data, images, copied files) are Vite plugins of your own in `build/<name>.ts`, added next to `kitr()`; not npm scripts.

## kitr: platform site

- `kitr dev <name>` runs Vite on the platform's port; `kitr build` writes `dist/<name>`; `kitr start` serves it (static files).
- Routes render on the client; loaders run in the browser.
