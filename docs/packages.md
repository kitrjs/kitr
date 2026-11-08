# Packages

Every app starts with `@kitr/core` and the `kitr` CLI. You add everything else with `kitr add <name>`. "Client" packages need a UI, so a server-only project refuses them.

Four packages load data: `http`, `api`, `actions` and `realtime`. [Choosing a data source](/docs/data-sources) says which to use.

## Capabilities

| Name | Package | Scope | Needs | What it does |
| --- | --- | --- | --- | --- |
| `react` | `@kitr/react` | client |  | React with the kitr app in context, so every component can reach services and config. |
| `router` | `@kitr/router` | client | react | Pages on the kitr route table, rendered by TanStack Router: typed links, loaders and guards. Web, desktop and mobile apps get it free. |
| `query` | `@kitr/query` | client |  | Load data from your API, keep it cached, and refresh it when something changes. |
| `http` | `@kitr/http` | client | query | Call a REST API with login tokens added for you and errors in one shape. |
| `forms` | `@kitr/forms` | client |  | Build forms with validation, and show server errors next to the right field. |
| `table` | `@kitr/table` | client |  | Show rows of data with sorting, paging and filters that stay in the URL. |
| `animation` | `@kitr/animation` | client | react | Animate components and page changes, and respect the visitor's reduced-motion setting. |
| `3d` | `@kitr/3d` | client | react | Render 3D scenes and models that stay smooth on phones and fall back when WebGL is missing. |
| `state` | `@kitr/state` | client |  | Keep app-wide values like a cart or settings, and optionally save them in the browser. |
| `tailwind` | `@kitr/tailwind` | client |  | Style with Tailwind CSS classes, already set up with kitr's colours. |
| `theme` | `@kitr/theme` | client |  | Light, dark and system themes with no flash on load, design tokens, and the components you copy into your app. |
| `toast` | `@kitr/toast` | client | react | Show short messages like "Saved" or "Could not send" from anywhere in your app, even outside React. |
| `auth` | `@kitr/auth` | client |  | Sign users in and out, protect pages, and check who can do what. |
| `logger` | `@kitr/logger` | any |  | Write readable logs in development and structured logs in production. |
| `server` | `@kitr/server` | any | logger | Run a Node server that starts, logs and shuts down cleanly. |
| `api` | `@kitr/api` | any | server | Build JSON API routes with validation, and call them from the browser fully typed. |
| `actions` | `@kitr/actions` | client | server, query | Call server code straight from a component, like a form submit, without writing an API route. |
| `seo` | `@kitr/seo` | client |  | Give every page a title, a share preview and a sitemap entry so search engines and chat apps show it well. |
| `realtime` | `@kitr/realtime` | any | server | Define a live channel once and push updates to every open screen, over WebSockets, Socket.IO or server events. |
| `db` | `@kitr/db` | any | server | Connect your database so every request can use it. |
| `testing` | `@kitr/testing` | any |  | Test components and API routes with everything already wired up. |
| `mocks` | `@kitr/mocks` | client |  | Fake your API while you build the frontend or run tests. |
| `i18n` | `@kitr/i18n` | client |  | Translate your app into several languages with typed keys. |
| `analytics` | `@kitr/analytics` | client |  | Count page views and button clicks, and send them to the analytics service you choose. |
| `monitoring` | `@kitr/monitoring` | any |  | Catch errors in the browser and on the server, and see which user hit them and what they did first. |
| `offline` | `@kitr/offline` | client | query, storage | Keep showing loaded data with no connection, and send queued changes when the network comes back. |
| `flags` | `@kitr/flags` | any |  | Turn features on for some users and off for others, with the same answer on the server and in the browser. |
| `consent` | `@kitr/consent` | client | storage | Ask for cookie and tracking consent once, and hold analytics and error reports until people agree. |
| `secure-storage` | `@kitr/secure-storage` | any | storage | Keep login tokens and secrets in the phone or computer's secure vault instead of plain storage. |
| `files` | `@kitr/files` | client | platform | Let people open, save and pick files on any platform, with a download fallback in older browsers. |
| `notifications` | `@kitr/notifications` | client | platform | Ask for permission and show local or scheduled notifications that open the right page when tapped. |
| `native` | `@kitr/native` | client | platform | Clipboard, share sheet, haptics, location, camera and fingerprint unlock, each with a web fallback. |
| `updater` | `@kitr/updater` | client | platform | Tell people a new version is ready and update the app in place, on the web, desktop and mobile. |
| `cache` | `@kitr/cache` | any | server | Remember slow results on the server and clear them by tag when the data changes. |
| `shield` | `@kitr/shield` | any | server | Turn on the security basics every API needs: CORS, CSRF protection, safe headers and rate limits. |
| `mail` | `@kitr/mail` | any | server | Write emails as React components, send them through your provider, and preview them in development. |
| `jobs` | `@kitr/jobs` | any | server | Run work in the background or on a schedule, with retries when it fails. |
| `uploads` | `@kitr/uploads` | any |  | Accept file uploads with size limits, store them on disk or in the cloud, and show progress in the browser. |
| `platform` | `@kitr/platform` | client |  | Know where your app is running, whether it is online or in the background, and handle the back button and deep links. |
| `storage` | `@kitr/storage` | any |  | Save small values in the browser or in cookies with types, and read the same cookies on the server. |
| `devtools` | `@kitr/devtools` | client |  | Open a panel that shows what every package is doing. On in development; turn it on in production with one flag. |

Always present: `@kitr/core` (app, container, providers, config, env, errors, contracts, validation, the `definePlatform` contract), `@kitr/vite` in projects with a UI platform, `@kitr/cli` through the `kitr` binary.

## Platforms

Platforms are packages too, added with `kitr add <type> <name>` and configured in `kitrrc.ts` under `platforms`. See [Platforms](platforms.md).

| Type | Package | Entry points | Needs |
| --- | --- | --- | --- |
| `web` | `@kitr/web` | `@kitr/web` (`web()`), `@kitr/web/client` (`useInstallPrompt`, `useServiceWorker`), `@kitr/web/vite` | router |
| `server` | `@kitr/server` | `@kitr/server` (`server()` beside `createServer`), `@kitr/server/platform` | server |
| `desktop` | `@kitr/desktop` | `@kitr/desktop` (`desktop()`, Electron), `@kitr/desktop/client`, `@kitr/desktop/main`, `@kitr/desktop/preload`, `@kitr/desktop/provider` | router, platform, storage |
| `tauri` | `@kitr/tauri` | `@kitr/tauri` (`tauri()`), `@kitr/tauri/client`, `@kitr/tauri/provider` | router, platform, storage |
| `mobile` | `@kitr/mobile` | `@kitr/mobile` (`mobile()`), `@kitr/mobile/client`, `@kitr/mobile/provider` | router, platform, storage |

## Devtools

`kitr add devtools` adds a panel at the bottom of the page in development. Ctrl/Cmd+Shift+K opens it. Each package adds its own tab, such as Router, Query or Auth. See [devtools](/packages/devtools).

## Kits

The full walkthrough of every kit is in [Kits](kits.md).

| Kit | Platforms | Packages |
| --- | --- | --- |
| `blank` | none | none. `kitr add web site` adds Vite, React and the router. |
| `app` | `site: web({ mode: 'spa' })` | router, query, http, forms, table, state, tailwind, theme, toast, auth, storage, mocks, testing |
| `fullstack` | `site: web({ mode: 'ssr' })`, `api: server()` | the app kit plus logger, server, seo, actions, api, realtime |
| `server` | `api: server()` | logger, server, api, db, realtime, testing. No React. |
| `saas` | `site` (ssr), `api` | the fullstack set with analytics and monitoring; sign-in, guarded shell, projects CRUD, tests |
| `site` | `site` (ssr), `api` | query, forms, tailwind, theme, i18n, storage, analytics, seo, api, testing; prerendered pages, blog, newsletter |
| `realtime` | `site` (ssr), `api` | query, forms, tailwind, theme, toast, storage, seo, api, realtime, testing; chat over typed channels |
| `desktop` | `site: web({ mode: 'spa' })`, `app: desktop()` | the app kit plus platform; Electron, native dialogs over typed IPC |
| `tauri` | `site: web({ mode: 'spa' })`, `app: tauri()` | the app kit plus platform; Tauri, typed Rust commands and events |
| `mobile` | `site: web({ mode: 'spa', pwa: true })`, `phone: mobile()` | the app kit plus platform; installable PWA and the Capacitor shell |

Every kit but `blank` is a package, such as `@kitr/kit-saas`. It runs once when the project is created and is not a dependency afterwards. `kitr new my-app --kit @acme/starter` runs a kit from any npm package.
