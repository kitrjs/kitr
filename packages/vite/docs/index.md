---
title: Vite
description: Build and serve the browser side of your app with Vite, wired to kitrrc.ts by one plugin.
order: 1
---

# Vite

A browser app needs a dev server, a bundler and a build step, and every package you add wants a piece of that setup: a React transform, a Tailwind compiler, a route generator, a list of dependencies to pre-bundle. `@kitr/vite` is one plugin, `kitr()`, that reads `kitrrc.ts` and asks each installed package what it needs, so `vite.config.ts` stays a three-line file however much the app grows.

It is built on [Vite](https://vite.dev). On top it adds the `virtual:kitr/providers` and `virtual:kitr/config` modules that `app/app.ts` imports, the `#app`, `#config`, `#components`, `#server` and `#kitr` aliases from the `directories` in `kitrrc.ts`, the active platform's port and output directory, and `kitr types` on every build and on every change to a file a type generator watches.

It runs at build time only; nothing of it ships to the browser. A pure backend never installs it: the [server platform](/packages/server) runs TypeScript directly. Every browser platform (`web`, `desktop`, `tauri`, `mobile`) requires it, so `kitr add web site` brings it in.

The examples on this page build Acme's order screens at `app.acme.com`.

## Install

```sh
kitr add vite
```

What `kitr add` does:

- Adds `@kitr/vite` and `vite` to `devDependencies` and installs them. Pass `--no-install` to skip the install.
- Adds `'@kitr/vite'` to `packages` in `kitrrc.ts`. It registers no provider, because nothing runs at app startup.
- Writes `vite.config.ts` with `kitr()` as its only plugin, unless one exists.
- Adds `vite/client` and `@kitr/vite/client` to `compilerOptions.types` in `tsconfig.json`, so `import.meta.env`, asset imports and the virtual modules type-check, and `vite.config.ts` to `include`.
- Adds a `## kitr: vite` section to `AGENTS.md` saying that `vite.config.ts` holds `kitr()` and that the plugin wires everything else.

You rarely run `kitr add vite` yourself: `kitr add web site`, `kitr add desktop app`, `kitr add tauri app` and `kitr add mobile phone` require it, and every kit with a browser platform includes it.

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
| `routesDirectory` | `directories.routes` | Where the route files are, for a project that still uses them. With the route table in `app/routes.ts` nothing is here and the plugin points Start at a stub in `.kitr/`. |
| `generatedRouteTree` | `<app>/routeTree.gen.ts`, or `.kitr/routeTree.gen.ts` with the table | Where TanStack's generator writes its tree. Unused by a table project; `createKitrRouter({ routes })` builds the tree. |
| `devtools` | on, except in production builds | `false` leaves every development-only provider out of this build too. |
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

## Build the order screens

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

The browser opens `http://localhost:3000` with the pages from `app/routes.ts`. `virtual:kitr/providers` is the `providers` list from `kitrrc.ts` as static imports, so every provider is in the bundle and tree-shakable, and `virtual:kitr/config` is every file under `config/` keyed by name: `config/query.ts` becomes `config.query`. Change `kitrrc.ts` and both modules reload without a restart.

## Ask the build for something from a package

A package tells the plugin what it needs through the `vite` field of its setup module, so adding the package is the whole setup. `@kitr/tailwind` declares its plugin and the dependencies to pre-bundle; `@kitr/server` keeps `config/server.ts` out of the browser bundle; `@kitr/devtools` drops its provider from production builds; `@kitr/router` turns TanStack Start on:

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

A project with two browser platforms, say a web site and a desktop shell, builds each with its own port and output directory. `kitr dev <name>` and `kitr build <name>` set `KITR_PLATFORM`, and the plugin reads that platform's options:

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

Running `vite` directly picks the first web platform. To build for another one without the CLI, set the variable or the option: `KITR_PLATFORM=app vite build`, or `kitr({ platform: 'app' })` in a second config file.

## Import through the aliases

The `directories` block in `kitrrc.ts` names where the app lives, and the plugin turns each entry into an alias, so a move of `app/` to `src/` is one edit in `kitrrc.ts` rather than a search and replace. `tsconfig.json` carries the same paths for the editor:

```ts
// app/pages/orders.tsx
import { OrderList } from '#components/order-list'
import { ordersQuery } from '#app/features/orders/queries'
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

The platform options are the source of truth, so change them there rather than in `vite.config.ts`, where the plugin would overwrite them:

```sh
kitr config site port 4000
kitr config site base /orders/
```

`kitr dev site --port 4000` and `KITR_SITE_PORT=4000` override the option for one run. Vite's own `server.port` in `vite.config.ts` loses to the platform's, because `strictPort` is set from it; a port taken by another process fails fast instead of drifting to the next free one.

## Prerender pages

In `static` mode every route is prerendered at build time. In `ssr` mode the [seo](/packages/seo) package's `prerender` list picks the routes to prerender ahead of time while the rest render per request. The plugin reads `config/seo.ts` statically, without executing it, and passes the list to TanStack Start:

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

With `site.url` set, Start writes `sitemap.xml` from the same list. A route that reads request data at render time stays out of the list and renders on the server.

## Pass options to TanStack Start

`start` takes an object when the defaults are not enough. It is spread last, so anything here wins over what the plugin set:

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

`router` goes to `@tanstack/router-plugin`; `start` to `tanstackStart()`. With the route table, the generator only sees a stub root in `.kitr/routes/` (written by the plugin, safe to delete) and the real tree comes from `app/routes.ts`; a project with `app/routes/__root.tsx` keeps file routes and `app/routeTree.gen.ts`. See the [TanStack Start configuration](https://tanstack.com/start/latest/docs/framework/react/guide/configuration) for the full list.

## Keep generated types current

`kitr types` writes `.kitr/`: the platform types from `kitrrc.ts`, the action names from `app/actions/`, whatever each package's generator produces. The plugin runs it when a build starts, and in dev it watches the globs the generators declare and reruns only the generator whose files changed:

```sh
kitr dev site
# ✔ kitr types: 2 file(s) written (platforms, actions)
#   app/actions/orders.ts changed → actions regenerated
```

```ts
// app/features/orders/queries.ts
import { Orders } from '#kitr/actions'   // typed from app/actions/orders.ts, always current

export const ordersQuery = Orders.list
```

Pass `types: false` to leave it to a `kitr types` step of your own, for example in a CI job that builds without the CLI installed.

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

`import.meta.env.KITR_PLATFORM` is the platform name this bundle was built for, `KITR_PLATFORM_TYPE` its type and `KITR_PACKAGES` the packages from `kitrrc.ts`, all typed by `@kitr/vite/client`:

```ts
// app/components/shell.tsx
if (import.meta.env.KITR_PLATFORM_TYPE === 'desktop') {
  // the Electron window has its own title bar
}
```

For runtime questions (online, foreground, the OS) use [platform](/packages/platform) instead; these constants are fixed at build time.

## Testing

Vitest runs the same plugin, so tests import `virtual:kitr/*`, `#app/*` and route files exactly as the app does. The `vitest.config.ts` that `kitr add testing` writes leaves Tailwind out, because tests check classes, not CSS:

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

- [API reference](/packages/vite/api)
- [Vite documentation](https://vite.dev/guide/)
- [The package contract](/docs/package-contract): the `vite` field a package declares
- [Web platform](/packages/web): modes, PWA and `kitr dev site`
- [Testing](/packages/testing): `createTestApp` and `renderWithKitr`
