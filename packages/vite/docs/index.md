---
title: Vite
description: Build and serve the browser side of your app with Vite, wired to kitrrc.ts by one plugin.
order: 1
---

# Vite

A browser app needs a dev server, a bundler and a build step, and every package you add wants a piece of that setup: a React transform, a Tailwind compiler, a route generator. `@kitr/vite` is one plugin, `kitr()`, that reads `kitrrc.ts` and asks each installed package what it needs, so `vite.config.ts` stays a three-line file however much the app grows.

> [!SUMMARY]
> One Vite plugin that wires the dev server and build to `kitrrc.ts`. Add it with `kitr add vite`; the overview is at [/packages/vite](/packages/vite).

It is built on [Vite](https://vite.dev) and adds the `virtual:kitr/providers` and `virtual:kitr/config` modules, the `#app`, `#config`, `#components`, `#server` and `#kitr` aliases, the active platform's port and output directory, and `kitr types` on every build. It runs at build time only. Every browser platform (`web`, `desktop`, `tauri`, `mobile`) requires it, so `kitr add web site` brings it in; a pure backend never installs it.

The examples build Acme's order screens at `app.acme.com`.

## Install

```sh
kitr add vite
```

<details>
<summary>Everything kitr add changes</summary>

- Adds `@kitr/vite` and `vite` to `devDependencies` and installs them. Pass `--no-install` to skip the install.
- Adds `'@kitr/vite'` to `packages` in `kitrrc.ts`. It registers no provider.
- Writes `vite.config.ts` with `kitr()` as its only plugin, unless one exists.
- Adds `vite/client` and `@kitr/vite/client` to `compilerOptions.types` in `tsconfig.json`, and `vite.config.ts` to `include`, so `import.meta.env`, asset imports and the virtual modules type-check.
- Adds a `## kitr: vite` section to `AGENTS.md`.

You rarely run it yourself: `kitr add web site`, `kitr add desktop app`, `kitr add tauri app` and `kitr add mobile phone` require it, and every kit with a browser platform includes it.

</details>

## Configure

`@kitr/vite` has no config file. The file it writes is the whole configuration:

```ts
// vite.config.ts
import { kitr } from '@kitr/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [kitr()],
})
```

`kitr()` takes options for the cases where the defaults are wrong:

| Option | Default | Description |
| --- | --- | --- |
| `root` | Vite's root | The project directory holding `kitrrc.ts`. |
| `platform` | `KITR_PLATFORM`, then the first web platform | Which platform from `kitrrc.ts` this build is for. `kitr dev <name>` and `kitr build <name>` set the variable. |
| `start` | what the packages ask (`router` asks for it) | `false` keeps the plain TanStack Router plugin without Start; an object passes options to `tanstackStart()`. |
| `plugins` | every declared plugin | `{ tailwind: false }` leaves out the plugin a package declares, by its short name. |
| `router` | `{}` | Extra options for `@tanstack/router-plugin`. |
| `routesDirectory` | `directories.routes` | Where route files are, in projects that use file routes. |
| `generatedRouteTree` | `<app>/routeTree.gen.ts`, or `.kitr/routeTree.gen.ts` with the table | Where TanStack's generator writes its tree. Unused by a table project; `createKitrRouter({ routes })` builds the tree. |
| `devtools` | on, except in production builds without `enabled` in `config/devtools.ts` | `false` leaves every development-only provider out of this build too. `true` keeps them in production. |
| `types` | `true` | Run `kitr types` on build start and on changes in dev. |

The platform in `kitrrc.ts` sets the rest. `web({ port: 3000 })` becomes `server.port` with `strictPort`, and `kitr build site` writes `dist/site`:

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'
import { web } from '@kitr/web'

export default defineKitrConfig({
  packages: ['@kitr/vite', '@kitr/react', '@kitr/router'],
  providers: [],
  platforms: { site: web({ mode: 'ssr', port: 3000 }) },
})
```

## Run your first dev server

With `kitr add web site` done, the app object imports its providers and config from the virtual modules and the dev server serves it:

```ts
// app/app.ts
import { createApp } from 'kitr/app'
import { config } from 'virtual:kitr/config'
import { providers } from 'virtual:kitr/providers'
import { env } from './env'

export const app = createApp({ providers, config, env })
```

```sh
kitr dev site
```

The browser opens `http://localhost:3000` with the pages from `app/routes.ts`. `virtual:kitr/providers` is the `providers` list from `kitrrc.ts` as static imports, so every provider is in the bundle and tree-shakable. `virtual:kitr/config` is every file under `config/` keyed by name (`config/query.ts` becomes `config.query`). Both reload when `kitrrc.ts` changes.

## Let a package configure the build

A package tells the plugin what it needs through the `vite` field of its setup module, so adding the package is the whole setup. `@kitr/tailwind` declares its plugin and dependencies to pre-bundle; `@kitr/server` keeps `config/server.ts` out of the browser bundle; `@kitr/devtools` drops its provider from production builds; `@kitr/router` turns TanStack Start on:

```ts
// packages/tailwind/src/kitr.ts (excerpt)
export default definePackage({
  name: 'tailwind',
  vite: {
    plugin: '@kitr/tailwind/vite',
    optimizeDeps: ['clsx', 'tailwind-merge', 'class-variance-authority'],
  },
})
```

| Need | What the plugin does |
| --- | --- |
| `plugin` | Imports the module from the project and adds its default export's result to `plugins`. |
| `optimizeDeps` | Adds the names that `package.json` installs to `optimizeDeps.include`. |
| `serverOnlyConfig` | Leaves `config/<name>.ts` out of `virtual:kitr/config` in browser bundles. |
| `start` | Renders routes through TanStack Start instead of the router plugin alone. |
| `provider: { production: false }` | Leaves the package's provider out of production builds. |

Your own package does the same: see [the package contract](/docs/package-contract).

## Pick the platform to build

A project with two browser platforms, say a web site and a desktop shell, builds each with its own port and output directory. `kitr dev <name>` and `kitr build <name>` set `KITR_PLATFORM`:

```ts
// kitrrc.ts (excerpt)
platforms: {
  site: web({ mode: 'ssr', port: 3000 }),
  app: desktop({ port: 3100 }),
},
```

```sh
kitr dev site        # Vite on :3000, dist/site
kitr dev app         # Vite on :3100 inside the Electron window, dist/app
kitr build           # both, one after the other
```

Running `vite` directly picks the first web platform. For another without the CLI, set `KITR_PLATFORM=app vite build` or `kitr({ platform: 'app' })` in a second config file.

## Import through the aliases

The `directories` block in `kitrrc.ts` names where the app lives and the plugin turns each entry into an alias, so moving `app/` to `src/` is one edit. `tsconfig.json` carries the same paths for the editor:

```ts
// app/pages/orders.tsx
import { OrderList } from '#components/order-list'
import { ordersQuery } from '#app/queries/orders'
import { Orders } from '#kitr/actions'
import type { ServerRoutes } from '#server/routes'
```

| Alias | Directory |
| --- | --- |
| `#app` | `directories.app`, default `app` |
| `#config` | `directories.config`, default `config` |
| `#components` | `directories.components`, default `app/components` |
| `#server` | `directories.server`, default `server` |
| `#kitr` | `.kitr`, the generated types |

## Change the port or the base path

Change platform options in `kitrrc.ts`, not in `vite.config.ts`, where the plugin would overwrite them:

```sh
kitr config site port 4000
kitr config site base /orders/
```

`kitr dev site --port 4000` and `KITR_SITE_PORT=4000` override the option for one run. `strictPort` is set, so a port taken by another process fails fast instead of drifting.

## Prerender pages

In `static` mode every route is prerendered at build time. In `ssr` mode the [seo](/packages/seo) package's `prerender` list picks the routes to prerender while the rest render per request. The plugin reads `config/seo.ts` statically and passes the list to TanStack Start:

```ts
// config/seo.ts
import { defineConfig } from '@kitr/seo'

export default defineConfig({
  site: { url: 'https://app.acme.com' },
  prerender: ['/', '/pricing', '/docs'],
})
```

```sh
kitr build site
# dist/site/client/index.html, pricing/index.html, docs/index.html, sitemap.xml
```

With `site.url` set, Start writes `sitemap.xml` from the same list. A route that reads request data at render time stays out of the list.

## Pass options to TanStack Start

`start` takes an object when the defaults are not enough, spread last so it wins:

```ts
// vite.config.ts
import { kitr } from '@kitr/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    kitr({
      start: { prerender: { enabled: true, crawlLinks: true } },
      router: { quoteStyle: 'single', semicolons: false },
    }),
  ],
})
```

`router` goes to `@tanstack/router-plugin`; `start` to `tanstackStart()`. See the [TanStack Start configuration](https://tanstack.com/start/latest/docs/framework/react/guide/configuration) for the full list.

<details>
<summary>Route files and the generated tree</summary>

With the route table, the generator only sees a stub root in `.kitr/routes/` (written by the plugin, safe to delete) and the real tree comes from `app/routes.ts`. A project with `app/routes/__root.tsx` keeps file routes and `app/routeTree.gen.ts`.

</details>

## Keep generated types current

`kitr types` writes `.kitr/`: platform types from `kitrrc.ts`, action names from `app/actions/`, and whatever each package's generator produces. The plugin runs it at build start, and in dev reruns only the generator whose watched files changed:

```sh
kitr dev site
# ✔ kitr types: 2 file(s) written (platforms, actions)
#   app/actions/orders.ts changed → actions regenerated
```

```ts
// app/queries/orders.ts
import { Orders } from '#kitr/actions'   // typed from app/actions/orders.ts, always current

export const ordersQuery = Orders.list
```

Pass `types: false` to run `kitr types` yourself, for example in a CI job that builds without the CLI.

## Add a Vite plugin of your own

`kitr()` returns a list, so it sits next to any other plugin:

```ts
// vite.config.ts
import { kitr } from '@kitr/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [kitr(), visualizer({ filename: 'dist/stats.html' })],
})
```

To replace a plugin a package declares, leave it out by name and add your own: `kitr({ plugins: { tailwind: false } })` with `tailwindcss()` beside it.

## Read the build target in app code

`import.meta.env.KITR_PLATFORM` is the platform this bundle was built for, `KITR_PLATFORM_TYPE` its type and `KITR_PACKAGES` the packages from `kitrrc.ts`, all typed by `@kitr/vite/client`:

```ts
// app/components/shell.tsx
if (import.meta.env.KITR_PLATFORM_TYPE === 'desktop') {
  // the Electron window has its own title bar
}
```

For runtime questions (online, foreground, the OS) use [platform](/packages/platform) instead; these constants are fixed at build time.

## Testing

Vitest runs the same plugin, so tests import `virtual:kitr/*`, `#app/*` and route files as the app does. The `vitest.config.ts` from `kitr add testing` leaves Tailwind out, because tests check classes, not CSS:

```ts
// vitest.config.ts
import { kitr } from '@kitr/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [kitr({ plugins: { tailwind: false } })],
  test: {
    environment: 'happy-dom',
    include: ['app/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
  },
})
```

```ts
// test/orders.test.ts
import { app } from '#app/app'
import { expect, it } from 'vitest'

it('wires the providers from kitrrc.ts', async () => {
  await app.boot()
  expect(app.status).toBe('booted')
})
```

## Next steps

- [API reference](/packages/vite/api): every export with its signature.
- [Web platform](/packages/web): modes, PWA and `kitr dev site`.
- [Testing](/packages/testing): `createTestApp` and `renderWithKitr`.
