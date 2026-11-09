# Kits

A kit is the starting point for `kitr new <dir> --kit <name>`. It sets up platforms, adds packages and copies components. The preset kits also add real pages, controllers and tests for you to edit.

A kit runs once. After that the project is ordinary, and `kitr add` and `kitr remove` change it as usual. Every kit but `blank` is an npm package (`@kitr/kit-<name>`), so `--kit @acme/starter` runs a kit from any package.

```sh
kitr new my-app                      # blank
kitr new my-app --kit app
kitr new my-admin --kit dashboard
kitr new my-api --kit server
kitr new my-saas --kit saas --platform site=web,api=server --mode ssr --runtime bun
```

Every flag is listed under [Create a project](cli.md#create-a-project).

## Base kits

| Kit | Platforms | Packages | Components |
| --- | --- | --- | --- |
| `blank` | none | none | none |
| `app` | `site: web({ mode: 'spa' })` | query, tailwind, theme, testing | none |
| `dashboard` | `site: web({ mode: 'spa' })` | http, forms, table, state, tailwind, theme, toast, auth, storage, mocks, testing, devtools | icon, button, input, label, card, form, data-table, page-header, empty-state, theme-toggle, app-shell |
| `fullstack` | `site: web({ mode: 'ssr' })`, `api: server()` | the dashboard kit without mocks, plus seo, actions, api, realtime | the dashboard kit's eleven |
| `server` | `api: server()` | logger, api, db, realtime, testing. No React. | none |

### blank

Only the config files: `package.json`, `tsconfig.json`, an empty `kitrrc.ts`, `biome.json`, `.gitignore`, `.env.example` and `AGENTS.md`. No app, no React, no dev server.

The usual next step is `kitr add web site` for a UI or `kitr add server api` for a backend. Each writes the files and scripts it needs.

### app

The smallest app that runs, and the kit to start with: two pages on the route table, Query for data, Tailwind and the theme tokens, one test. Twenty-five files. Add sign-in, forms, a table or an API with `kitr add` when the app needs them; each package writes its own config and conventions.

### dashboard

A single-page app for an API you already have. Data comes through `http`, pointed at `VITE_API_URL`. Sign-in uses tokens. Set `VITE_MOCKS=true` to fake the API while you build. Eleven UI components are copied into `app/components/ui`. The [dashboard guide](/guides/dashboard) builds on this kit.

### fullstack

The dashboard kit, rendered on the server, with an API server beside it. The UI calls its server through `actions` in `app/actions/`, and `api` routes in `server/routes.ts` serve other clients. `kitr dev` runs both. The [full-stack guide](/guides/fullstack-app) walks through it.

### server

A backend with no React: routes and controllers, a database hook for any ORM, live channels and tests. The [API server guide](/guides/api-server) walks through it.

## Preset kits

The presets are a base kit plus a small working app. Each one is also in [`examples/`](https://github.com/kitrjs/kitr/tree/main/examples), unmodified.

| Kit | Platforms | Packages | What it scaffolds |
| --- | --- | --- | --- |
| `saas` | `site` (ssr), `api` | the fullstack set without actions and realtime, plus shield, mail, analytics, monitoring | sign-in, a guarded app shell, a projects page, an API test |
| `site` | `site` (ssr), `api` | query, forms, tailwind, theme, i18n, storage, analytics, seo, api, testing, devtools | a prerendered site: home, pricing, a blog, a newsletter form, a test |
| `realtime` | `site` (ssr), `api` | query, forms, tailwind, theme, toast, storage, seo, api, realtime, testing, devtools | a chat room with rooms in the URL, a test |
| `docs` | `site: web({ mode: 'static' })` | content, seo, tailwind, theme, testing | a docs site from markdown: sidebar, search, dark mode, `llms.txt`, a test |
| `desktop` | `site: web({ mode: 'spa' })`, `app: desktop()` | the dashboard kit plus platform | the dashboard kit in Electron, with native dialogs |
| `tauri` | `site: web({ mode: 'spa' })`, `app: tauri()` | the dashboard kit plus platform | the dashboard kit in Tauri, with typed Rust commands |
| `mobile` | `site: web({ mode: 'spa', pwa: true })`, `phone: mobile()` | the dashboard kit plus platform | the dashboard kit as an installable PWA and a Capacitor app |

### saas

A signed-in product on its own API. Sign in with `admin@example.com` or `member@example.com`, password `password`. The demo users live in memory; swap them for your database.

| File | What it is |
| --- | --- |
| `app/routes.ts` | `/sign-in`, and the guarded `_app` layout with the overview and projects pages. |
| `app/pages/projects.tsx` | A data table of projects with a create form. |
| `server/auth.ts` | The cookie session and the demo users. |
| `server/controllers/auth-controller.ts` | Sign-in, sign-up, email verification and password reset. |
| `server/controllers/projects-controller.ts` | The projects API. |
| `app/validators/projects.ts` | The schema the form, the controller and the test share. |
| `test/api.test.ts` | Calls the API in a test. |

Sessions are HttpOnly cookies, with CSRF protection on the auth routes. A production build needs `SESSION_SECRET` (32 or more random characters) and a mail transport. See [cookie sessions](/packages/auth/guide#cookie-sessions-with-a-server).

### site

A prerendered marketing site: home, pricing and a blog, in English and German. `config/seo.ts` lists the pages to prerender. The newsletter form posts to `server/controllers/newsletter-controller.ts`, and `test/newsletter.test.ts` covers it.

For a static marketing site, start from `kitr new my-site --kit app --mode static` and `kitr add seo`; for docs, use the `docs` kit. The `site` kit adds SSR and an API server.

### realtime

A chat room. `app/channels/chat.ts` defines the channel, `app/pages/chat.tsx` is the room, and `server/controllers/messages-controller.ts` sends new messages to everyone in it. `config/realtime.ts` picks the transport: WebSocket by default, or Socket.IO or server-sent events.

### docs

A static docs site from the markdown in `content/docs/`, rendered by [content](/packages/content). Every page is prerendered to HTML, and the build writes `llms.txt`, `llms-full.txt` and a `.md` copy of each page for coding agents. Components: icon, button, theme-toggle, command, search-dialog and doc-layout.

| File | What it is |
| --- | --- |
| `content/docs/nav.json` | The sidebar: groups and the pages in each, in order. |
| `content/docs/getting-started.md`, `writing.md` | Two starter pages: running the site, and the markdown extras. |
| `app/routes.ts` | `/` and `/docs` list the pages; `/docs/$slug` loads one with `loadPage()` and `seo()`. |
| `app/pages/docs.tsx` | The docs home: every group with its pages and descriptions. |
| `app/pages/docs/slug.tsx` | One page in `DocLayout`, and the not-found page for an unknown slug. |
| `app/document.tsx` | The header with the site name, search (Cmd+K) and the theme toggle, and the content stylesheet. |
| `config/seo.ts` | The site name for titles and share tags. |
| `test/docs.test.tsx` | Renders a page with its sidebar and next link. |

Add a page by writing `content/docs/<slug>.md` and listing its slug in `nav.json`; `kitr dev` shows it at `/docs/<slug>`.

### desktop, tauri and mobile

The dashboard kit in a native shell, with a home page that uses it. The shell's project lives in `platforms/<name>/`. The web platform stays, so `kitr dev site` still runs the app in a browser.

Pick `desktop` (Electron) unless download size matters most. Electron ships its own browser, so every user sees what you tested. Tauri is much smaller but uses the system webview, which can render differently between machines.

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

`packages` are added in order, with `answers` for their questions. `files` runs last, with the same `ctx` a package's `add()` gets ([the contract](package-contract.md#what-ctx-can-do)).

Publish it with `"kind": "kit"` in the `kitr` block of `package.json`. Then `kitr new my-app --kit @acme/kit-starter` runs it.
