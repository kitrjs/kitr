# Agent guide

This app is built with kitr. Each section below is maintained by `kitr add`.

## kitr: conventions

- Import framework code from `kitr/*` entry points (`kitr/router`, `kitr/query`, ...). They re-export the upstream library unchanged plus kitr helpers.
- Routes are files in `app/routes` (TanStack Router file routes). `app/routeTree.gen.ts` is generated; never edit it.
- In route files, import `createFileRoute` / `createLazyFileRoute` from `@tanstack/react-router` (the route generator owns that import). Everything else comes from `kitr/router`.
- Wiring lives in `kitrrc.ts` and `config/*.ts`. Generators: `kitr make:route|action|controller|channel|store|form|queries`. Run `kitr doctor` after changes.

## kitr: forms

- Forms: `const form = useSchemaForm(schema, { defaultValues })` then `<Form form={form} onSubmit={...}>` from `kitr/forms` (or the styled copy in `app/components/ui/form.tsx`).
- Throw or reject with a KitrError carrying `fieldErrors` and the fields show the messages; anything else lands in `useRootError()`.

## kitr: styling

- Plain CSS and CSS Modules are first-class: `import styles from './x.module.css'`, run `kitr css:types` for typed class names, compose with `pick()` from `kitr/styling`.
- Colours and radii come from the `--kitr-*` variables; never hard-code them.

## kitr: tailwind

- Tailwind v4: utilities map to kitr tokens (`bg-background`, `text-primary`, `rounded-md`). Use `cn()` from `kitr/tailwind` to merge classes. Dark mode is `data-theme="dark"` on <html>, toggled by `useTheme()`.

## kitr: ui

- Components live in `app/components/ui/` and are owned by the app: edit them freely. Add more with `kitr ui add <name>` (shadcn-compatible registry).
- Toasts: `toast.success('Saved')` from `kitr/ui`. Theme: `useTheme()`. Import `kitr/ui/styles.css` once (done in app/styles/app.css).

## kitr: i18n

- Strings live in `app/locales/<lang>.ts`. Components: `const { t } = useTranslation()` from `kitr/i18n`; keys are typed from the English bundle.

## kitr: storage

- Persisted values are declared once in `app/storage.ts` (`defineStorage` for local/session storage, `defineCookie` for cookies) and never read through `localStorage`/`document.cookie` directly.
- Components: `const [value, setValue] = useStorage(item)` / `useCookie(item)` from `kitr/storage/react`. Both are hydration-safe: the server and first render see the default.
- Server side (actions, controllers): `cookies(event).get(item)` / `.set(item, value)` from `kitr/storage/server`; wrap the root route in `<CookieHeader value={request.headers.get('cookie')}>` so `useCookie` renders the right value during SSR.
- Add `schema` (zod/valibot) to validate what comes back from storage, `version` + `migrate` when a shape changes, `ttl` to expire.

## kitr: analytics

- Track from components with `const analytics = useAnalytics<AppEvents>()` (`kitr/analytics/react`) then `analytics.track('project.created', { id })`; declare new events in `app/analytics.ts` first.
- Page views are sent automatically on every route change. `analytics.identify(user.id, traits)` after sign-in, `analytics.reset()` on sign-out.
- Adapters live in `config/analytics.ts`; never call gtag/posthog directly.

## kitr: testing

- `pnpm test` runs Vitest. Components: `renderWithKitr(<X />, { app, queryData })` from `kitr/testing/react`. APIs: `createTestClient(server).get('/api/x')`. No running backend is needed.

## kitr: devtools

- In development a "k" button (ctrl/cmd+shift+K) opens the kitr devtools: App, Router, Query, Auth, Storage, Errors, Analytics and Log panels, plus a command palette (ctrl/cmd+shift+P) with every package's actions.
- Log from anywhere with `getDevtools(app)?.log('channel', 'label', data)` (`kitr/devtools`); it is null in production so the call costs nothing.
- A provider adds its own panel with a `devtools(app)` method returning `DevtoolsPanel[]` (lazy-import the React parts); reuse `JsonView`, `KeyValue`, `LogList` from `kitr/devtools/ui`.

## kitr: logger

- Log through `ctx.logger` (request-scoped, carries the request id) or `app.container.use('logger')`. Never `console.log` in server code.

## kitr: server

- Server code never imports React. Services come from the request-scoped container (`useRequestApp()`), logs from `ctx.logger`.
- Providers' `ready`/`shutdown` run on `server.listen()`; in TanStack Start the server is a fetch handler (`server.fetch`).

## kitr: ssr

- Routes render on the server by default; use `...ssrRoute('data-only')` for heavy, non-SEO pages. `head: () => seo({ title, description })` from `kitr/ssr` writes meta tags.

## kitr: api

- Routes: `app/api/routes.ts` (`defineRoutes`), controllers in `app/controllers/<name>_controller.ts` (`kitr make:controller <name> --resource`). Validators go in `static validation = { store: { body: schema } }`.
- Actions are for this app's own UI; API routes are for anything else (mobile, partners, webhooks) or when you want REST + OpenAPI.
- The client is typed from `typeof routes.$types`; call `registerRoutes(api, routes.toJSON())` or use `kitr api:sync` to write the route table and openapi.json.
