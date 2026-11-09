---
title: Web
description: Ship to the browser as a static site, a single-page app or a server-rendered app, installable if you want.
order: 1
---

# Web

A marketing page on a CDN, a dashboard behind a login and a store with indexed product pages ship to the browser in different ways. `@kitr/web` is the web platform: one line in `kitrrc.ts` says whether your `app/` builds to prerendered HTML, a single-page app or a server-rendered app, and whether it is installable.

> [!SUMMARY]
> The web platform: static, single-page or server-rendered, installable if you want. Add it with `kitr add web site`; the overview is at [/packages/web](/packages/web).

It is built on [Vite](https://vite.dev) and [TanStack Start](https://tanstack.com/start/latest), with [vite-plugin-pwa](https://vite-pwa-org.netlify.app) for installable apps. On top, `kitr dev`, `kitr build` and `kitr start` run each mode, `kitr config` edits the options and `kitr doctor` checks the setup. The hooks in `@kitr/web/client` run in the browser.

The same app can also ship as [Mobile](/packages/mobile), [Desktop](/packages/desktop) (Electron) or [Tauri](/packages/tauri); for an API with no UI use [Server](/packages/server).

The examples build the Acme orders app at `app.acme.com`.

## Install

Add a web platform named `site`:

```sh
kitr add web site
```

`web` is the platform type and `site` the name you address it by (`kitr dev site`). Without a name, `kitr add web` calls it `site`.

<details>
<summary>Everything kitr add changes</summary>

What `kitr add web site` does, in order:

- Adds `@kitr/web` to `packages` in `kitrrc.ts` and installs it, running [Router](/packages/router) and [React](/packages/react) setup first when missing. Together they write `app/app.ts`, `app/client.tsx`, `app/router.tsx` and the starter routes.
- Installs `@tanstack/react-start`, and `vite`, `@vitejs/plugin-react` and `@tanstack/router-plugin` as dev dependencies. With `--pwa` it adds `vite-plugin-pwa` (dev). With `--mode ssr` it adds `srvx`.
- Adds `() => import('@kitr/web/provider')` to `providers` in `kitrrc.ts`.
- Writes `site: web({...})` into `platforms` in `kitrrc.ts`, with the flags you passed as options, and adds `import { web } from '@kitr/web'`.
- Sets the `dev`, `build` and `start` scripts in `package.json` to `kitr dev`, `kitr build` and `kitr start`.
- With `--pwa`, writes `public/icons/README.md`, a note naming the two icons the manifest points at. `--no-scaffold` skips this step.
- Adds a `## kitr: platform site` section to `AGENTS.md`. It tells agents how `kitr dev`, `kitr build` and `kitr start` behave for the chosen mode, and with `pwa` to render an update banner once.

</details>

Platform options are flags on the same command; a flag without a value means `true`:

```sh
kitr add web site --mode ssr --pwa --port 3000
```

| Flag | Default | Effect |
| --- | --- | --- |
| `--mode` | `spa` | `static`, `spa` or `ssr`. |
| `--port` | `3000` | Port for `kitr dev site` and `kitr start site`. |
| `--host` | | Interface to bind. |
| `--pwa` | `false` | Make the app installable. Installs `vite-plugin-pwa`. |
| `--base` | `/` | Public base path. |
| `--open` | `false` | Open the browser on `kitr dev`. |
| `--no-scaffold` | | Register the platform without writing files. |
| `--no-install` | | Edit `package.json` without running the package manager. |
| `--dry-run` | | Print what would change. |

Every kit except `server` already has a web platform named `site`: `blank`, `app` and `desktop` use `spa`; `fullstack`, `saas`, `site` and `realtime` use `ssr`; `mobile` uses `spa` with `pwa: true`. `kitr new` takes the same options:

```sh
kitr new acme-orders --kit app --mode ssr --pwa --port 3000
```

`kitr platforms remove site` takes the platform out of `kitrrc.ts` and leaves `@kitr/web` and the files under `app/` in place.

## Configure

`@kitr/web` has no config file. Its options live on the `web()` call in `kitrrc.ts`:

```ts
// kitrrc.ts
import { defineKitrConfig } from '@kitr/kitr/app'
import { web } from '@kitr/web'

export default defineKitrConfig({
  packages: ['@kitr/react', '@kitr/router', '@kitr/web'],
  providers: [() => import('@kitr/web/provider')],
  platforms: {
    site: web({ mode: 'ssr', port: 3000, pwa: true }),
  },
})
```

| Option | Default | Description |
| --- | --- | --- |
| `mode` | `'spa'` | `static` prerenders pages, `spa` renders in the browser, `ssr` renders on the server per request. |
| `port` | `3000` | Dev and production port. Must be a number between 0 and 65535. |
| `host` | | Interface to bind. Vite's default (`localhost`) in dev, `0.0.0.0` for `kitr start`. |
| `pwa` | `false` | `true` makes the app installable: a web manifest and a service worker. An object sets the manifest (see below). |
| `base` | `'/'` | Public base path, for apps served under a sub-path. |
| `open` | `false` | Open the browser on `kitr dev`. |

When `pwa` is an object, it takes these options:

| Option | Default | Description |
| --- | --- | --- |
| `pwa.name` | the app name | Full name in the install dialog; the app name comes from `package.json` (`acme-orders` becomes `Acme Orders`). |
| `pwa.shortName` | `pwa.name`, then the app name | Name under the home-screen icon. |
| `pwa.description` | | Manifest description. |
| `pwa.themeColor` | `'#0f172a'` | Browser UI color. |
| `pwa.backgroundColor` | `'#ffffff'` | Splash screen background. |
| `pwa.display` | `'standalone'` | `standalone`, `fullscreen`, `minimal-ui` or `browser`. |
| `pwa.startUrl` | `'/'` | Page the installed app opens. |
| `pwa.icons` | `/icons/icon-192.png` and `/icons/icon-512.png` | Manifest icons, `{ src, sizes, type?, purpose? }`. The 512 icon is `any maskable`. |
| `pwa.registerType` | `'prompt'` | `prompt` waits for you to call `update()` from `useServiceWorker()`. `autoUpdate` activates a new worker as soon as it installs. |
| `pwa.devEnabled` | `false` | Run the service worker under `kitr dev` too. |
| `pwa.plugin` | | Raw [vite-plugin-pwa options](https://vite-pwa-org.netlify.app/guide/), merged last. |

> [!WARNING]
> Write options as literals. The `kitr()` Vite plugin reads `kitrrc.ts` as text, so `web({ mode: siteMode })` reaches the CLI but not the build.

An unknown mode fails when `kitrrc.ts` loads:

```
[kitr] Invalid options for web platform:
  mode: mode must be one of static, spa, ssr
```

A bad port fails the same way with `port: port must be a number between 0 and 65535`.

| Variable | Used for |
| --- | --- |
| `KITR_SITE_<OPTION>` | Override one option for one run: `KITR_SITE_PORT=4000 kitr dev site`. |
| `PORT` | The port `kitr start` listens on when no `--port` flag is given. Wins over the `port` option. |
| `HOST` | The interface `kitr start` binds when no `--host` flag is given. |
| `KITR_PLATFORM` | Set by the CLI to the platform name; the Vite plugin uses it to pick the platform to build. |



## Ship your first page

In a project with a web platform (`kitr new acme-orders`), replace the home page with the order list:

```tsx
// app/pages/home.tsx
const orders = [
  { id: 'ord_1042', customer: 'Ada', total: 129 },
  { id: 'ord_1043', customer: 'Grace', total: 84 },
]

export default function OrdersPage() {
  return (
    <main>
      <h1>Acme orders</h1>
      <ul>
        {orders.map((order) => (
          <li key={order.id}>
            {order.id}: {order.customer}, ${order.total}
          </li>
        ))}
      </ul>
    </main>
  )
}
```

Run it:

```sh
kitr dev site
```

Vite starts on `http://localhost:3000/` and you see the two orders; edits reload the page. The page sits on the route table in `app/routes.ts`; see [Router](/packages/router) for links, loaders and layouts. `kitr dev` with no name starts every platform at once.

When it looks right, build it and serve the build:

```sh
kitr build site
kitr start site
# ✔ site: serving dist/site on http://localhost:3000/
```

## Choose a rendering mode

All three modes build the same `app/`; switching is a one-word change. Pick by where you host and what search engines need to see.

| `mode` | What you get | Host on | Use it for |
| --- | --- | --- | --- |
| `static` | Every route prerendered to an HTML file at build time. | Any static host or CDN. | Marketing pages, docs, a blog. |
| `spa` | One HTML shell; routes render in the browser. | Any static host. | Apps behind a login, where pages need no indexing. |
| `ssr` | Each request rendered on the server, then hydrated. | A Node-like host that runs `kitr start`. | Stores and apps whose pages must be indexed with live data. |

Change the mode in place:

```sh
kitr config site mode ssr
# ✔ site.mode = "ssr"
```

`kitr config` validates the value before it writes `kitrrc.ts`. When you move to `ssr`, run `kitr add web site --mode ssr` again or install `srvx` yourself: `kitr start` needs it.

Loaders run where the page renders: in the browser for `spa`, once at build time for `static` (so data must exist when you build or be fetched on the client), and on the server for the first request, then in the browser, for `ssr`.

## Render on the server

In `ssr` mode every page renders on the server. To keep one page client-only, spread `ssrRoute(false)` from [SEO](/packages/seo) into its link:

```ts
// app/routes.ts
import { ssrRoute } from '@kitr/seo'

r.page('/orders/$orderId/edit', { ...ssrRoute(false), lazy: () => import('./pages/edit-order') })
```

```tsx
// app/pages/edit-order.tsx
import { getRouteApi } from '@kitr/router'

const route = getRouteApi('/orders/$orderId/edit')

export default function EditOrder() {
  const { orderId } = route.useParams()
  return <h1>Edit {orderId}</h1>
}
```

`ssrRoute('data-only')` runs the loader on the server and renders the component in the browser. With a [Server](/packages/server) platform in the project, an `ssr` web platform also answers its routes through `app/server.ts`, so one process serves pages and the API.

## Prerender pages

A `static` platform prerenders `/` and every page linked from it. To add unlinked pages, or prerender a few pages of an `ssr` app, list them in `config/seo.ts` (written by `kitr add seo`):

```ts
// config/seo.ts
import { defineConfig } from '@kitr/seo'

export default defineConfig({
  site: { name: 'Acme', url: 'https://app.acme.com' },
  prerender: { routes: ['/pricing', '/changelog'], crawlLinks: true },
})
```

`kitr build site` writes one HTML file per page under `dist/site/client`, and `site.url` turns on `sitemap.xml`.

> [!WARNING]
> Keep `crawlLinks: true` in a `static` platform. The array form, `prerender: ['/pricing']`, turns link crawling off, so only `/` and the listed pages are written.

A page that does not render is reported in one line and left out of the sitemap. A crawled link only warns; a route listed in `routes` (and `/` on a `static` platform) fails the build:

```sh
kitr build site
# [prerender] 404 at /llms-full.txt, linked from /docs/agents
# [prerender] 404 at /changelog
# error during build: prerender failed for /changelog: routes listed in config/seo.ts must render; crawled links only warn.
```

Set `prerender: { routes, crawlLinks: true, failOnError: true }` to fail the build on broken crawled links too, for example in CI.

## Run more than one web platform

One project can hold several web platforms, each with its own port, mode and `dist/<name>` folder:

```ts
// kitrrc.ts
import { defineKitrConfig } from '@kitr/kitr/app'
import { web } from '@kitr/web'

export default defineKitrConfig({
  packages: ['@kitr/react', '@kitr/router', '@kitr/web'],
  providers: [() => import('@kitr/web/provider')],
  platforms: {
    www: web({ mode: 'static', port: 3000 }),
    admin: web({ mode: 'spa', port: 3002 }),
  },
})
```

Add the second one from the command line:

```sh
kitr add web admin --mode spa --port 3002
kitr dev www admin
```

Both build the same `app/`; to render something in one only, see "Branch on the platform at build time".

## Change options from the command line

`kitr config` reads and writes platform options in `kitrrc.ts`:

```sh
kitr config site
# site (web)
#   mode         ssr            static (prerendered HTML), spa (client-rendered shell) or ssr (server-rendered) [static|spa|ssr]
#   port         3000           Dev and production port
#   host         unset          Host to bind (default: localhost in dev, 0.0.0.0 in production)
#   pwa          true           Installable app with a manifest and service worker
#   base         /              Public base path
#   open         false          Open the browser on dev
#
#   Override at runtime with KITR_SITE_<OPTION>=... or `kitr dev site --<option> value`.
kitr config site port 4000
kitr config site pwa --unset
```

To change an option for one run only, pass it as a flag or an env variable:

```sh
kitr dev site --port 4000 --open
KITR_SITE_PORT=4000 kitr dev site
```

> [!WARNING]
> Use run-time overrides only for `port`, `host` and `open`. The Vite plugin reads `mode` and `pwa` from `kitrrc.ts` itself, so change those in the file.

## Open the dev server to your network

To try the app on a phone on the same Wi-Fi, bind every interface:

```sh
kitr dev site --host 0.0.0.0
```

Vite prints a `Network:` URL such as `http://192.168.1.20:3000/`; open it on the phone. Set `host: '0.0.0.0'` in `kitrrc.ts` to make it the default. If port 3000 is taken, `kitr dev` fails rather than moving on; pick another with `--port`.

## Serve the app under a sub-path

When the app lives at `acme.com/orders/` instead of its own domain, set `base`:

```ts
// kitrrc.ts
import { defineKitrConfig } from '@kitr/kitr/app'
import { web } from '@kitr/web'

export default defineKitrConfig({
  packages: ['@kitr/react', '@kitr/router', '@kitr/web'],
  providers: [() => import('@kitr/web/provider')],
  platforms: {
    site: web({ mode: 'spa', base: '/orders/' }),
  },
})
```

Asset URLs then start with `/orders/`, and `kitr start` serves the build under that path. A `base` in `vite.config.ts` wins over the platform's.

## Make the app installable

Turn on `pwa` and the build writes a web manifest and a service worker:

```sh
kitr config site pwa true
pnpm add -D vite-plugin-pwa
```

`kitr add web site --pwa` installs `vite-plugin-pwa`; if you turn `pwa` on later with `kitr config`, install it yourself (`kitr doctor` reports it when missing). The manifest uses the app name from `package.json`; to set it yourself, pass an object:

```ts
// kitrrc.ts
import { defineKitrConfig } from '@kitr/kitr/app'
import { web } from '@kitr/web'

export default defineKitrConfig({
  packages: ['@kitr/react', '@kitr/router', '@kitr/web'],
  providers: [() => import('@kitr/web/provider')],
  platforms: {
    site: web({
      mode: 'spa',
      pwa: { name: 'Acme Orders', shortName: 'Orders', themeColor: '#0b5fff' },
    }),
  },
})
```

Put the two icons the manifest points at in `public/icons/`: `icon-192.png` (192x192) and `icon-512.png` (512x512, logo inside the maskable safe zone). `pwaManifest()` shows the manifest a set of options produces:

```ts
// scripts/print-manifest.ts
import { pwaManifest, web } from '@kitr/web'

const site = web({ pwa: { name: 'Acme Orders', shortName: 'Orders', themeColor: '#0b5fff' } })
console.log(pwaManifest(site.options, 'Acme'))
// => {
//   name: 'Acme Orders',
//   short_name: 'Orders',
//   description: undefined,
//   theme_color: '#0b5fff',
//   background_color: '#ffffff',
//   display: 'standalone',
//   start_url: '/',
//   icons: [
//     { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
//     { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
//   ],
// }
```

`kitr build` emits the service worker. It precaches the client build and serves the app shell for navigations, except under `/api/`, `/ws` and `/_serverFn/`, which always reach the network.

## Show your own install button

Browsers fire `beforeinstallprompt` once. `useInstallPrompt()` from `@kitr/web/client` keeps that event so your own button can show the dialog:

```tsx
// app/components/install-button.tsx
import { useInstallPrompt } from '@kitr/web/client'

export function InstallButton() {
  const { canInstall, installed, install } = useInstallPrompt()
  if (installed) return <p>Acme Orders is on your home screen.</p>
  if (!canInstall) return null
  return (
    <button type="button" onClick={() => install()}>
      Install Acme Orders
    </button>
  )
}
```



`useInstallPrompt()` returns:

| Field | Description |
| --- | --- |
| `canInstall` | `true` once the browser offered installation. `false` in Safari, which never fires the event, and after install. |
| `installed` | `true` after the browser fires `appinstalled`. |
| `install()` | Shows the browser dialog. Resolves to `'accepted'`, `'dismissed'`, or `'unavailable'` when there is nothing to show. |

```ts
const outcome = await install()
// => 'accepted'
```

On iOS, people install from Safari's Share menu, so show a short hint there instead of the button.

## Offer an update when a new version ships

With the default `registerType: 'prompt'`, a new service worker waits until you tell it to take over. Render one banner near the app root:

```tsx
// app/components/pwa-update.tsx
import { useServiceWorker } from '@kitr/web/client'

export function PwaUpdate() {
  const { needRefresh, update } = useServiceWorker()
  if (!needRefresh) return null
  return (
    <div role="status">
      A new version of Acme Orders is ready.{' '}
      <button type="button" onClick={() => update()}>
        Reload
      </button>
    </div>
  )
}
```

```tsx
// app/document.tsx
import { HeadContent, Outlet, Scripts } from '@kitr/router'
import { PwaUpdate } from '#app/components/pwa-update'

export function head() {
  return {
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
    ],
    links: [{ rel: 'manifest', href: '/manifest.webmanifest' }],
  }
}

export function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <PwaUpdate />
        <Scripts />
      </body>
    </html>
  )
}
```

`useServiceWorker()` registers `/sw.js` and returns:

| Field | Description |
| --- | --- |
| `needRefresh` | `true` when a new worker is installed and waiting. |
| `offlineReady` | `true` when the first worker is active and the app works offline. |
| `update()` | Tells the waiting worker to activate, then reloads the page once it takes control. |
| `registration` | The `ServiceWorkerRegistration`, or `null` before registration finishes. |

> [!WARNING]
> Render `PwaUpdate` once: two copies register the worker twice. The `manifest` link goes in the root route's `head()`, as above.

To run code when an update arrives, pass `onNeedRefresh`, wrapped in `useCallback` so the worker is not registered again on every render:

```tsx
// app/components/pwa-update-toast.tsx
import { useCallback } from 'react'
import { useServiceWorker } from '@kitr/web/client'

export function PwaUpdateToast({ notify }: { notify: (message: string) => void }) {
  const onNeedRefresh = useCallback(() => notify('Acme Orders has an update.'), [notify])
  useServiceWorker({ onNeedRefresh })
  return null
}
```

To skip the banner, set `registerType: 'autoUpdate'`: the new worker activates as soon as it installs.

## Test the service worker in development

The worker is off under `kitr dev` so stale caches never hide your edits. To debug install and offline behaviour, turn it on, and off again afterwards:

```ts
// kitrrc.ts
import { defineKitrConfig } from '@kitr/kitr/app'
import { web } from '@kitr/web'

export default defineKitrConfig({
  packages: ['@kitr/react', '@kitr/router', '@kitr/web'],
  providers: [() => import('@kitr/web/provider')],
  platforms: {
    site: web({ mode: 'spa', pwa: { devEnabled: true } }),
  },
})
```

For a run closer to production, use `kitr build site && kitr start site`.

## Pass options to vite-plugin-pwa

Anything kitr does not expose goes in `pwa.plugin`, merged last into the [vite-plugin-pwa options](https://vite-pwa-org.netlify.app/guide/):

```ts
// kitrrc.ts
import { defineKitrConfig } from '@kitr/kitr/app'
import { web } from '@kitr/web'

export default defineKitrConfig({
  packages: ['@kitr/react', '@kitr/router', '@kitr/web'],
  providers: [() => import('@kitr/web/provider')],
  platforms: {
    site: web({
      mode: 'spa',
      pwa: {
        name: 'Acme Orders',
        plugin: { includeAssets: ['favicon.svg'], workbox: { maximumFileSizeToCacheInBytes: 5000000 } },
      },
    }),
  },
})
```

> [!WARNING]
> `plugin.workbox` replaces kitr's whole `workbox` block, including the `/api/` denylist. Copy `navigateFallbackDenylist: [/^\/api\//, /^\/ws/, /^\/_serverFn\//]` into it.

## Use the PWA plugin in a custom Vite setup

The `kitr()` Vite plugin adds the PWA plugin when `pwa` is on. If you build without `kitr()`, add `kitrPwa()` from `@kitr/web/vite` yourself:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { web } from '@kitr/web'
import { kitrPwa } from '@kitr/web/vite'

const site = web({ pwa: { name: 'Acme Orders' } })

export default defineConfig(async () => ({
  plugins: [await kitrPwa(site.options, 'Acme Orders')],
}))
```

`kitrPwa()` returns the vite-plugin-pwa plugins with the manifest, the `/api/` denylist and the `registerType` behaviour, for the client build only.

## Branch on the platform at build time

The `kitr()` Vite plugin defines two constants; use them to drop code from one platform's bundle:

```tsx
// app/components/footer.tsx
export function Footer() {
  if (import.meta.env.KITR_PLATFORM === 'admin') return <footer>Acme admin</footer>
  return <footer>Acme · app.acme.com</footer>
}
```

| Constant | Value |
| --- | --- |
| `import.meta.env.KITR_PLATFORM` | The platform name from `kitrrc.ts`, such as `'site'` or `'admin'`. |
| `import.meta.env.KITR_PLATFORM_TYPE` | The platform type: `'web'`, `'mobile'`, `'desktop'` or `'tauri'`. |



## Detect the browser at run time

`@kitr/web/provider` registers the browser's `platform` driver: type `web`, the OS from the user agent, and `standalone` when installed. Read it through [Platform](/packages/platform):

```tsx
// app/components/install-hint.tsx
import { usePlatform } from '@kitr/platform/react'

export function InstallHint() {
  const platform = usePlatform()
  if (platform.standalone) return null
  if (platform.is('ios')) return <p>Tap Share, then Add to Home Screen.</p>
  return null
}
```

During server rendering the OS is `'server'`. Inside a native shell the [Mobile](/packages/mobile), [Desktop](/packages/desktop) or [Tauri](/packages/tauri) driver wins.

## Build for production

`kitr build site` runs `vite build` with `KITR_PLATFORM=site` and writes everything under `dist/site`:

| Path | Mode | Contents |
| --- | --- | --- |
| `dist/site/client/` | all | JavaScript, CSS and assets. |
| `dist/site/client/index.html` | `spa` | The app shell. |
| `dist/site/client/**/index.html` | `static` | One HTML file per prerendered page. |
| `dist/site/server/server.js` | `ssr` | The TanStack Start server bundle. |
| `dist/site/client/sw.js`, `manifest.webmanifest` | `pwa` | The service worker and the manifest. |

`kitr build` with no name builds every platform, one after another.

## Serve the build

`kitr start site` serves the build with [srvx](https://srvx.h3.dev) on the platform's port, bound to `0.0.0.0`:

```sh
kitr start site --port 8080
# ✔ site: serving dist/site on http://localhost:8080/
```

- In `static` and `spa` mode it serves `dist/site/client` and answers unknown paths with the shell (`index.html`, `_shell.html` or `200.html`), so client routes survive a reload.
- In `ssr` mode it serves static files first and hands every other request to the `fetch` export of `dist/site/server/server.js`. When `crossws` is installed, WebSocket upgrades work too.
- Hashed files under `assets/` are cached for a year (`immutable`); everything else gets `no-cache`, so a deploy reaches returning visitors on their next load.

On a host that sets `PORT` (Render, Fly.io, Railway), `kitr start site` uses it.

## Deploy a static site or SPA to a CDN

A `static` or `spa` build needs no server. Upload `dist/site/client` to any static host:

```sh
kitr build site
npx wrangler pages deploy dist/site/client --project-name acme-orders
```

> [!WARNING] SPA hosting
> Tell the host to answer unknown paths with `index.html` (on Netlify, a `_redirects` line `/* /index.html 200`), or reloading `/orders/ord_1042` returns a 404.

## Commands

The web platform answers these commands:

| Command | What it does |
| --- | --- |
| `kitr add web [name]` | Add a web platform, named `site` by default. |
| `kitr css:types` | Type CSS Module class names. `--check` fails when stale. |
| `kitr dev [names...]` | Runs `vite dev --port <port> --strictPort`, plus `--host` and `--open` when set. |
| `kitr build [names...]` | Runs `vite build` into `dist/<name>`. |
| `kitr start [names...]` | Serves `dist/<name>` with srvx: static files, the SPA fallback, or the `ssr` server bundle. |
| `kitr config <name> [option] [value]` | Reads or sets an option in `kitrrc.ts`, validated first. `--unset` removes one. |
| `kitr platforms` | Lists every platform with its options. |
| `kitr platforms types` | Lists the platform types (`web`, `desktop`, `tauri`, `mobile`, `server`). |
| `kitr platforms scaffold <name>` | Writes the platform's files that are missing (`public/icons/README.md` with `pwa`). Existing files are kept. |
| `kitr platforms remove <name>` | Takes the platform out of `kitrrc.ts`. |

`kitr doctor` checks each web platform and reports:

- an error when `vite` is not installed. Fix: `pnpm add -D vite`.
- an error when `@tanstack/react-start` is not installed.
- an error when `pwa` is on but `vite-plugin-pwa` is not installed.
- a warning when `app/routes.ts` is missing (no pages to render). Fix: `kitr add router`.
- a warning when React is installed but `kitrrc.ts` lists no UI platform. Fix: `kitr add web site`.

## Errors

| Message | When | What to do |
| --- | --- | --- |
| `[kitr] Invalid options for web platform: mode: mode must be one of static, spa, ssr` | `kitrrc.ts` sets an unknown mode. | Use `static`, `spa` or `ssr`. |
| `[kitr] Invalid options for web platform: port: port must be a number between 0 and 65535` | The port is out of range or a string. | Pass a number. |
| `web has no option "<flag>" (options: mode, port, host, pwa, base, open)` | `kitr add web` got an unknown flag. | Use one of the listed options. |
| `Platform name "<name>" must be a short identifier (site, api, app, phone...)` | The name has spaces or starts with a digit. | Use letters, digits, `-` and `_`. |
| `No platform named "<name>" in kitrrc.ts (have: site, api)` | `kitr dev`, `build`, `start` or `config` got an unknown name. | Use a name from `kitr platforms`. |
| `dist/site/client not found. Run `kitr build site` first.` | `kitr start` ran before a build. | Run `kitr build site`. |
| `dist/site/server/server.js not found. Run `kitr build site` first.` | `ssr` mode, but the last build was `spa` or `static`. | Build again after changing the mode. |
| `dist/site/server/server.js does not export a fetch handler` | The server bundle is not a TanStack Start build. | Rebuild with the `kitr()` Vite plugin. |
| `[@kitr/vite] KITR_PLATFORM=<name> is not a platform in kitrrc.ts (have: ...)` | Vite ran with a platform name that `kitrrc.ts` does not have. | Run through `kitr dev <name>`, or fix the variable. |
| `[@kitr/vite] site: pwa is on but vite-plugin-pwa could not load (...)` | A warning: the build continues without a service worker. | `pnpm add -D vite-plugin-pwa`. |
| `Port 3000 is already in use` | Another process has the port, and `--strictPort` refuses to move. | Stop it or pass `--port`. |

## Testing

Platform options are plain values, so a test can load `kitrrc.ts` and catch a mode or port change nobody meant to make:

```ts
// test/platforms.test.ts
import { pwaManifest } from '@kitr/web'
import { describe, expect, it } from 'vitest'
import rc from '../kitrrc'

describe('the site platform', () => {
  it('is server-rendered and installable', () => {
    const site = rc.platforms!.site!
    expect(site.type).toBe('web')
    expect(site.options).toMatchObject({ mode: 'ssr', port: 3000 })
    expect(pwaManifest(site.options, 'Acme Orders')).toMatchObject({
      name: 'Acme Orders',
      display: 'standalone',
    })
  })
})
```

The hooks in `@kitr/web/client` read browser events, so a test fires them itself. This one renders the install button from above with a fake `beforeinstallprompt` event in `happy-dom`:

```tsx
// test/install-button.test.tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { InstallButton } from '#app/components/install-button'

function installEvent(outcome: 'accepted' | 'dismissed') {
  return Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome }),
  })
}

describe('InstallButton', () => {
  it('stays hidden until the browser offers installation', () => {
    const { container } = render(<InstallButton />)
    expect(container.innerHTML).toBe('')
  })

  it('shows the browser dialog and confirms the install', async () => {
    render(<InstallButton />)
    const event = installEvent('accepted')
    act(() => void window.dispatchEvent(event))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Install Acme Orders' }))
    })
    expect(event.prompt).toHaveBeenCalled()

    act(() => void window.dispatchEvent(new Event('appinstalled')))
    expect(screen.getByText('Acme Orders is on your home screen.')).toBeTruthy()
  })
})
```

`useServiceWorker()` does nothing without `navigator.serviceWorker` (as in `happy-dom`), so components render without a stub. Test the real worker against `kitr build site && kitr start site` in a browser.

## Next steps

- [API reference](/packages/web/api): options, hooks and Vite helpers.
- [SEO](/packages/seo): head tags, prerender lists and the sitemap.
- [Platforms](/docs/platforms): every platform type side by side.
