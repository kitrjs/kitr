---
title: Web
description: Ship to the browser as a static site, a single-page app or a server-rendered app, installable if you want.
order: 1
---

# Web

A marketing page that must load fast from a CDN, a dashboard behind a login, a store that needs every product page indexed: each one ships to the browser in a different way. `@kitr/web` is the web platform. One line in `kitrrc.ts` says whether your `app/` builds to prerendered HTML, a single-page app or a server-rendered app, and whether people can install it to their home screen.

It is built on [Vite](https://vite.dev) and [TanStack Start](https://tanstack.com/start/latest), with [vite-plugin-pwa](https://vite-pwa-org.netlify.app) for installable apps. kitr adds the platform contract on top: `kitr dev`, `kitr build` and `kitr start` know how to run each mode, `kitr config` edits the options, and `kitr doctor` checks the setup.

The platform options run in the CLI and the Vite plugin; the hooks in `@kitr/web/client` run in the browser. To ship the same app as a native iOS or Android app, add the [Mobile](/packages/mobile) platform next to this one. For a desktop window, use [Desktop](/packages/desktop), which ships the app in Electron; [Tauri](/packages/tauri) is the lighter alternative that uses the operating system's webview. For an API with no UI, use the [Server](/packages/server) platform.

The examples on this page build the Acme orders app at `app.acme.com`: Ada's team lists orders and invoices in the browser, and later makes the app installable.

## Install

Add a web platform named `site`:

```sh
kitr add web site
```

`web` is the platform type and `site` is the name you address it by (`kitr dev site`). `kitr add web` with no name uses the usual name for the type and prints `No name given: calling the web platform "site".`

What `kitr add web site` does, in order:

- Adds `@kitr/web` to `packages` in `kitrrc.ts` and installs it. The web package requires [Router](/packages/router), which requires [React](/packages/react), so `kitr add` runs their setup first when they are missing. Together they write `app/app.ts`, `app/client.tsx`, `app/router.tsx` and the starter routes.
- Installs `@tanstack/react-start`, and `vite`, `@vitejs/plugin-react` and `@tanstack/router-plugin` as dev dependencies. With `--pwa` it adds `vite-plugin-pwa` (dev). With `--mode ssr` it adds `srvx`.
- Adds `() => import('@kitr/web/provider')` to `providers` in `kitrrc.ts`.
- Writes `site: web({...})` into `platforms` in `kitrrc.ts`, with the flags you passed as options, and adds `import { web } from '@kitr/web'`.
- Sets the `dev`, `build` and `start` scripts in `package.json` to `kitr dev`, `kitr build` and `kitr start`.
- With `--pwa`, writes `public/icons/README.md`, a note naming the two icons the manifest points at. `--no-scaffold` skips this step.
- Adds a `## kitr: platform site` section to `AGENTS.md`. It tells agents how `kitr dev`, `kitr build` and `kitr start` behave for the chosen mode, and with `pwa` to render an update banner once.

`@kitr/web` writes no `config/*.ts` file and adds no env variables.

Platform options are flags on the same command. A flag without a value means `true`:

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

An unknown flag stops the command: `web has no option "ssr" (options: mode, port, host, pwa, base, open)`.

Every kit except `server` already has a web platform named `site`. `blank`, `app` and `desktop` use `spa`; `fullstack`, `saas`, `site` and `realtime` use `ssr`; `mobile` uses `spa` with `pwa: true`. `kitr new` takes the same options for it:

```sh
kitr new acme-orders --kit app --mode ssr --pwa --port 3000
```

`kitr platforms remove site` takes the platform out of `kitrrc.ts`. It leaves `@kitr/web`, its provider and the files under `app/` in place, because other platforms may still use them.

## Configure

`@kitr/web` has no config file. Its options live on the `web()` call in `kitrrc.ts`:

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'
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
| `pwa.name` | the app name | Full name in the install dialog. The app name comes from `package.json` (`acme-orders` becomes `Acme Orders`). |
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

Write options as literals. The `kitr()` Vite plugin reads `kitrrc.ts` as text without running it, so `web({ mode: siteMode })` with a variable reaches the CLI but not the build.

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
| `KITR_PLATFORM` | Set by `kitr dev`, `kitr build` and `kitr start` to the platform name. The Vite plugin uses it to pick the platform it builds. |

The other platform types each have their own guide and options table: [Server](/packages/server), [Desktop](/packages/desktop) (Electron), [Tauri](/packages/tauri) and [Mobile](/packages/mobile). [Platforms](/docs/platforms) lists them side by side.

## Ship your first page

Start from a project with a web platform (`kitr new acme-orders`, or `kitr add web site`). Replace the home page with the order list:

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

Vite starts on `http://localhost:3000/` and you see the two orders. Edits to the file reload the page. The page is on the route table in `app/routes.ts` as `.page('/', { lazy: () => import('./pages/home') })`; see [Router](/packages/router) for links, loaders and layouts. `kitr dev` with no name starts every platform in `kitrrc.ts` at once.

When it looks right, build it and serve the build:

```sh
kitr build site
kitr start site
# ✔ site: serving dist/site on http://localhost:3000/
```

## Choose a rendering mode

All three modes are the same `app/` built through TanStack Start. Switching is a one-word change, so pick by where you host and what search engines need to see.

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

`kitr config` validates the value against the platform's options before it writes `kitrrc.ts`. Run `kitr add web site --mode ssr` again, or install `srvx` yourself, when you move to `ssr`: `kitr start` needs it to serve the server bundle.

Loaders run where the page renders. In `spa` mode they run in the browser. In `static` mode they run once at build time, so data must exist when you build or be fetched on the client. In `ssr` mode they run on the server for the first request and in the browser after that.

## Render on the server

In `ssr` mode every page renders on the server by default. To keep one page client-only, spread `ssrRoute(false)` from [SEO](/packages/seo) into its link:

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

`ssrRoute('data-only')` runs the loader on the server and renders the component in the browser. With the [Server](/packages/server) platform in the same project, an `ssr` web platform also answers the server's routes through `app/server.ts`, so one process serves pages and the API.

## Prerender pages

A `static` platform prerenders `/` and every page linked from it. To add pages that nothing links to, or to prerender a few pages of an `ssr` app, list them in `config/seo.ts` (written by `kitr add seo`):

```ts
// config/seo.ts
import { defineConfig } from '@kitr/seo'

export default defineConfig({
  site: { name: 'Acme', url: 'https://app.acme.com' },
  prerender: { routes: ['/pricing', '/changelog'], crawlLinks: true },
})
```

`kitr build site` writes one HTML file per page under `dist/site/client`. `site.url` also turns on `sitemap.xml`.

Keep `crawlLinks: true` in a `static` platform. The array form, `prerender: ['/pricing']`, turns link crawling off, so only `/` and the listed pages are written.

## Run more than one web platform

Names are yours, so one project can hold several web platforms. Each one gets its own port, its own mode and its own `dist/<name>` folder:

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'
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

Both platforms build the same `app/`. To render something only in one of them, read the platform name at build time (see "Branch on the platform at build time").

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

Use run-time overrides for `port`, `host` and `open`. The Vite plugin reads `mode` and `pwa` from `kitrrc.ts` itself, so an override of those changes what the CLI does but not what Vite builds. Change them in the file.

## Open the dev server to your network

To try the app on a phone on the same Wi-Fi, bind every interface:

```sh
kitr dev site --host 0.0.0.0
```

Vite prints a `Network:` URL such as `http://192.168.1.20:3000/`. Open it on the phone. Set `host: '0.0.0.0'` in `kitrrc.ts` to make it the default.

The dev server uses Vite's `--strictPort`, so if port 3000 is taken, `kitr dev` fails instead of moving to 3001. Pick another port with `--port`.

## Serve the app under a sub-path

When the app lives at `acme.com/orders/` instead of its own domain, set `base`:

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'
import { web } from '@kitr/web'

export default defineKitrConfig({
  packages: ['@kitr/react', '@kitr/router', '@kitr/web'],
  providers: [() => import('@kitr/web/provider')],
  platforms: {
    site: web({ mode: 'spa', base: '/orders/' }),
  },
})
```

The `kitr()` Vite plugin passes it to Vite, so asset URLs start with `/orders/`, and `kitr start` serves the build under that path. A `base` set in `vite.config.ts` wins over the platform's.

## Make the app installable

Turn on `pwa` and the build writes a web manifest and a service worker:

```sh
kitr config site pwa true
pnpm add -D vite-plugin-pwa
```

`kitr config` only edits `kitrrc.ts`, so install `vite-plugin-pwa` yourself when you turn `pwa` on after `kitr add` (`kitr add web site --pwa` installs it for you). `kitr doctor` reports it when it is missing.

The manifest uses the app name from `package.json`. To set it yourself, pass an object:

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'
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

Put the two icons the manifest points at in `public/icons/`: `icon-192.png` (192x192) and `icon-512.png` (512x512, with the logo inside the maskable safe zone). `kitr add web site --pwa` leaves a `README.md` there as a reminder.

`pwaManifest()` shows the manifest a set of options produces, which helps when you check icons or colors:

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

The service worker is emitted by `kitr build` only. It precaches the client build and serves the app shell for navigations, except under `/api/`, `/ws` and `/_serverFn/`, so API calls, sockets and server functions always reach the network.

## Show your own install button

Browsers that support installation fire `beforeinstallprompt` once. `useInstallPrompt()` from `@kitr/web/client` keeps that event so you can show the dialog from your own button:

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

The hook returns three things:

| Field | Description |
| --- | --- |
| `canInstall` | `true` once the browser offered installation. `false` in Safari, which never fires the event, and after install. |
| `installed` | `true` after the browser fires `appinstalled`. |
| `install()` | Shows the browser dialog. Resolves to `'accepted'`, `'dismissed'`, or `'unavailable'` when there is nothing to show. |

```ts
const outcome = await install()
// => 'accepted'
```

After `'accepted'`, `canInstall` turns `false`. On iOS, people install from Safari's Share menu, so show a short hint there instead of the button.

## Offer an update when a new version ships

With the default `registerType: 'prompt'`, a new service worker waits until you tell it to take over. Render one banner near the root of the app:

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

kitr registers the worker itself, so vite-plugin-pwa injects no script and no tags of its own. TanStack Start renders the HTML from the root route, so the `manifest` link goes in its `head()`, as above. Render `PwaUpdate` once: two copies register twice.

To run code when an update arrives, pass `onNeedRefresh`. Wrap it in `useCallback`, because a new function on every render registers the worker again:

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

To skip the banner, set `registerType: 'autoUpdate'` in the `pwa` object. The new worker then activates as soon as it installs, without waiting for `update()`.

## Test the service worker in development

The worker is off under `kitr dev` so stale caches never hide your edits. To debug install and offline behaviour, turn it on:

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'
import { web } from '@kitr/web'

export default defineKitrConfig({
  packages: ['@kitr/react', '@kitr/router', '@kitr/web'],
  providers: [() => import('@kitr/web/provider')],
  platforms: {
    site: web({ mode: 'spa', pwa: { devEnabled: true } }),
  },
})
```

For a run closer to production, use `kitr build site && kitr start site` and test against that. Turn `devEnabled` off again when you are done.

## Pass options to vite-plugin-pwa

Anything kitr does not expose goes in `pwa.plugin`. It is merged last into the [vite-plugin-pwa options](https://vite-pwa-org.netlify.app/guide/), so it wins over kitr's defaults:

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'
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

`plugin.workbox` replaces kitr's whole `workbox` block, including the `/api/` denylist. Copy `navigateFallbackDenylist: [/^\/api\//, /^\/ws/, /^\/_serverFn\//]` into it when you override it.

## Use the PWA plugin in a custom Vite setup

The `kitr()` Vite plugin adds the PWA plugin when the platform it builds has `pwa` on. If you build without `kitr()`, add it yourself with `kitrPwa()` from `@kitr/web/vite`:

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

`kitrPwa()` resolves to the vite-plugin-pwa plugins with the manifest from `pwaManifest()`, the `/api/` denylist and the update behaviour from `registerType`. It skips the server build of TanStack Start, so the worker is generated for the client only.

## Branch on the platform at build time

The `kitr()` Vite plugin defines two constants for the platform it builds. Use them to drop code from one platform's bundle:

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

Without `KITR_PLATFORM` (a plain `vite` run), the plugin builds the first web platform in `kitrrc.ts`.

## Detect the browser at run time

`@kitr/web/provider` registers the `platform` driver for the browser: type `web`, not native, the OS read from the user agent, and `standalone` when the app runs installed. Read it through [Platform](/packages/platform):

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

During server rendering the driver reports the OS as `'server'`. The web driver has the lowest priority, so inside a native shell the [Mobile](/packages/mobile), [Desktop](/packages/desktop) or [Tauri](/packages/tauri) driver wins.

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
- Hashed files under `assets/` are sent with `Cache-Control: max-age=31536000, immutable`. Everything else (HTML, `sw.js`, the manifest, files from `public/`) gets `no-cache`, so a deploy reaches returning visitors on their next load.
- `SIGINT` and `SIGTERM` close the server cleanly.

On a host that sets `PORT` (Render, Fly.io, Railway), run `kitr start site` and the env variable picks the port.

## Deploy a static site or SPA to a CDN

A `static` or `spa` build needs no server. Upload `dist/site/client` to any static host:

```sh
kitr build site
npx wrangler pages deploy dist/site/client --project-name acme-orders
```

For `spa`, tell the host to answer unknown paths with `index.html` (on Netlify, a `_redirects` line `/* /index.html 200`). Without it, reloading `/orders/ord_1042` returns a 404.

## Commands

`@kitr/web` adds no generators. The web platform answers these commands:

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

Platform options are plain values, so a test can load `kitrrc.ts` and check them. Run it in CI to catch a mode or port change nobody meant to make:

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

The hooks in `@kitr/web/client` read browser events, so a test fires those events itself. This test renders the install button from "Show your own install button" with a fake `beforeinstallprompt` event, in Vitest's `happy-dom` environment:

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

`useServiceWorker()` does nothing when `navigator.serviceWorker` is missing, which is the case in `happy-dom`, so components that use it render without a stub. Test the real worker against `kitr build site && kitr start site` in a browser, for example with Playwright.

## Next steps

- [API reference](/packages/web/api)
- [Platform](/packages/platform): where the app runs, online state and safe areas, the same way on every platform
- [SEO](/packages/seo): head tags, prerender lists, the sitemap and `robots.txt`
- [Mobile](/packages/mobile): the same app on iOS and Android
- [Platforms](/docs/platforms): every platform type and the commands they share
- [TanStack Start documentation](https://tanstack.com/start/latest)
