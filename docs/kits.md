# Kits

A kit is what `kitr new <dir> --kit <name>` starts from: the platforms written to `kitrrc.ts`, the packages added (each through its own `kitr add`, with the kit's answers to its questions), the registry components copied into `app/components/ui`, and for the preset kits, real pages, controllers and tests to edit rather than delete. A kit runs once. Afterwards the project is ordinary: `kitrrc.ts` lists what was added, and `kitr add` or `kitr remove` changes it the same way as in a project that started blank.

Every kit but `blank` is a package of its own, `@kitr/kit-<name>`, built on the [package contract](package-contract.md) with `kind: 'kit'`. The CLI resolves it like any setup module, so `kitr new my-app --kit @acme/starter` runs a kit from any npm package, and a kit never ends up in the project's dependencies: it is a template, not a runtime.

```sh
kitr new my-app                      # blank
kitr new my-app --kit app
kitr new my-api --kit server
kitr new my-saas --kit saas --platform site=web,api=server --mode ssr --runtime bun
```

`--platform name=type,...` replaces the kit's platforms; `--mode`, `--pwa`, `--runtime`, `--targets` and `--port` set their options. `--no-install`, `--no-git`, `--pm`, `--registry` and `--force` are described in [cli.md](cli.md).

## Base kits

| Kit | Platforms | Packages | Components |
| --- | --- | --- | --- |
| `blank` | none | none | none |
| `app` | `site: web({ mode: 'spa' })` | http, forms, table, state, tailwind, theme, auth, storage, mocks, testing, devtools (and what they require: vite, react, router, query) | icon, button, input, label, card, form, data-table, page-header, empty-state, theme-toggle, app-shell |
| `fullstack` | `site: web({ mode: 'ssr' })`, `api: server()` | the app kit without mocks, plus seo, actions, api, realtime (and logger, server) | the app kit's eleven |
| `server` | `api: server()` | logger, api, db, realtime, testing (and server). No React, no Vite. | none |

### blank

Seven files: `package.json` (`typecheck`, `lint` and `kitr` scripts; `kitr` and `@kitr/core`; TypeScript, `@types/node` and Biome as dev dependencies), a Node-only `tsconfig.json`, `kitrrc.ts` with empty `packages`, `providers` and `platforms`, `biome.json`, `.gitignore`, `.env.example` and `AGENTS.md`. There is no `app/`, no `vite.config.ts`, no dev server and no React. `kitr add web site` is the usual next step: the web platform requires `vite`, `react` and `router`, so that one command writes `vite.config.ts`, `app/app.ts`, `app/env.ts`, `app/router.tsx`, `app/client.tsx`, the root, home and about routes, and the `dev`, `build` and `start` scripts. `kitr add server api` does the same for a backend.

### app

A single-page app against an API you already have. `app/document.tsx` renders the theme and the app shell, `app/routes.ts` lists the pages and `app/pages/home.tsx` is the home page, `config/http.ts` points at `VITE_API_URL`, `config/auth.ts` uses the token adapter, and `mocks` answers requests in development when `VITE_MOCKS=true`. The components come from kitr's registry and live in `app/components/ui`, yours to edit. The [dashboard guide](https://kitr.dev/guides/dashboard) builds on this kit.

### fullstack

The app kit rendered through TanStack Start, with an API server beside it: `server/main.ts`, `server/routes.ts` and a health controller from `api`, `app/actions/` from `actions`, `app/channels/` from `realtime`, and `config/seo.ts` for heads and the prerender list. `kitr dev` runs both platforms; `kitr dev site` runs the UI alone. The [full-stack guide](https://kitr.dev/guides/fullstack-app) walks through it.

### server

A backend with no React anywhere in the dependency graph: an h3 server with the kitr lifecycle, Adonis-style routes and controllers, `config/db.ts` for whichever ORM you connect, typed channels and a Vitest setup with `createTestClient`. The [API server guide](https://kitr.dev/guides/api-server) walks through it.

## Preset kits

The presets are the base kits plus a small, real application. `examples/` in the repository is generated from them unmodified, so each example is also the kit's documentation.

| Kit | Platforms | Packages | What it scaffolds |
| --- | --- | --- | --- |
| `saas` | `site` (ssr), `api` | the fullstack set without actions and realtime, plus analytics, monitoring | sign-in on `/`, a guarded `_app` layout, a projects CRUD with a data table, `auth` and `projects` controllers, an API test |
| `site` | `site` (ssr), `api` | query, forms, tailwind, theme, i18n, storage, analytics, seo, api, testing, devtools | a prerendered marketing site: home, pricing, a blog from `app/content/posts.ts`, en/de locales, a newsletter form on a controller, a test |
| `realtime` | `site` (ssr), `api` | query, forms, tailwind, theme, storage, seo, api, realtime, testing, devtools | a chat room: a typed `chat` channel that feeds the query cache, a messages controller, rooms in the URL, a test |
| `desktop` | `site: web({ mode: 'spa' })`, `app: desktop()` | the app kit plus platform | the app kit in an Electron shell: `platforms/app/` with the main process, a typed IPC contract and native dialogs from the home page |
| `tauri` | `site: web({ mode: 'spa' })`, `app: tauri()` | the app kit plus platform | the same React app in a Tauri shell: `platforms/app/src-tauri/` with typed Rust commands and events called from the home page |
| `mobile` | `site: web({ mode: 'spa', pwa: true })`, `phone: mobile()` | the app kit plus platform | an installable PWA and a Capacitor shell: online state, the install prompt and native lifecycle hooks on the home page |

### saas

`app/document.tsx` carries the theme script and the providers; `app/routes.ts` declares `/sign-in` and the `_app` layout `requireAuth()` guards, with `app/pages/overview.tsx` (the dashboard) and `app/pages/projects.tsx` (a `DataTable` over `projects.list`, a create form over `projects.create`). `server/routes.ts` is the server table (`defineRoutes([api], ...)`). `server/controllers/auth-controller.ts` signs users in and out against an in-memory session store; `server/controllers/projects-controller.ts` is a resource controller with `static validation`. `app/validators/projects.ts` is the one zod schema the form, the controller and the test share. `app/api/client.ts` is the typed client with its route table; `kitr api:sync` rewrites the table and `openapi.json`. `test/api.test.ts` boots the server and calls it through `createTestClient`.

### site

`config/seo.ts` lists the prerendered paths and the sitemap; `app/routes.ts` declares `/`, `/pricing` and the `/blog` group with `seo()` heads, and `app/pages/` holds their components. `app/locales/en.ts` and `de.ts` hold the strings, `app/locale.tsx` switches them and stores the choice through `app/storage.ts`. `server/controllers/newsletter-controller.ts` takes the sign-up form, validated by `app/validators/newsletter.ts`, and `test/newsletter.test.ts` covers it.

### realtime

`app/channels/chat.ts` defines the channel and its events with cache effects; `server/routes.ts` serves it with `.ws('/ws', { channels: [chatChannel] })` beside the endpoints, and `server/controllers/messages-controller.ts` emits through `app.container.use('realtime')`. `app/queries/chat.ts` lists and sends messages; `app/pages/chat.tsx` is the room, with the room name in the URL and the display name kept in `app/storage.ts`. `config/realtime.ts` picks the transport (`ws` by default; `socket.io` and `sse` are one option away). `test/messages.test.ts` posts a message through the API and reads it back.

### desktop, tauri and mobile

These three add a native shell to the app kit and replace the home page with one that exercises it: `usePlatform()`, native dialogs over typed IPC (Electron), typed Rust commands and events (Tauri), or the install prompt, online state and lifecycle hooks (PWA and Capacitor). The shell's own project lives in `platforms/<name>/` and is yours to edit; `kitr platforms scaffold <name>` rewrites it. The web platform stays, so `kitr dev site` runs the same app in a browser.

Electron and Tauri are separate kits (and separate platform packages) on purpose: Electron ships its own browser, so what you test is what users run, which is why `desktop` is the recommended default; Tauri uses the system webview for a much smaller download at the cost of per-platform rendering differences. Both kits produce the same `app/`, so moving between them is `kitr add tauri app` or `kitr add desktop app` plus the shell-specific calls on the home page.

## Writing a kit

A kit is a package with `kind: 'kit'`:

```ts
// src/kitr.ts, published as the "./kitr" export of @acme/kit-starter
import { definePackage } from '@kitr/core/package'

export default definePackage({
  name: 'starter',
  kind: 'kit',
  kit: {
    description: 'Our standard app: SSR, auth, Stripe and the house components.',
    platforms: { site: { type: 'web', options: { mode: 'ssr' } }, api: { type: 'server' } },
    packages: ['http', 'forms', 'tailwind', 'theme', 'auth', { name: '@acme/stripe', answers: { mode: 'hosted' } }],
    components: ['button', 'form', 'app-shell'],
    files(ctx, projectName) {
      ctx.write('app/pages/home.tsx', `export default () => <h1>${projectName}</h1>\n`, { overwrite: true })
      ctx.scripts.add('deploy', 'acme deploy')
    },
  },
})
```

`packages` are added in order after the platforms' own requirements, each with its questions answered from `answers` (or its defaults). `files` runs after the components with the same `ctx` a package's `add()` gets ([the contract](package-contract.md#what-ctx-can-do)), so a kit edits `package.json` scripts, `.env.example` or `AGENTS.md` through the same codemods, and `--dry-run` prints what it would do. The `kitr` block in `package.json` carries `"kind": "kit"` and `"category": "kits"`, and the package keeps the `kitr-package` keyword so the site can list it. `kitr new my-app --kit @acme/kit-starter` is all a user needs; the CLI installs the kit for the run when it cannot resolve it, and leaves no trace of it in the project.
