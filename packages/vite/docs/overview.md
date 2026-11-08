---
title: Overview
description: Build and serve the browser side of your app with Vite, wired to kitrrc.ts by one plugin.
order: 0
---

# Vite

A browser app needs a dev server, a bundler and a build step, and every package you add wants a piece of that setup: a React transform, a Tailwind compiler, a route generator, a list of dependencies to pre-bundle, a PWA plugin. `vite.config.ts` grows with every `kitr add`, and the order of plugins starts to matter.

`@kitr/vite` is one plugin, `kitr()`, that reads `kitrrc.ts` and asks each installed package what it needs, so the config stays three lines.

## What it is

`@kitr/vite` is the build layer for every browser platform. The `kitr()` plugin reads `kitrrc.ts`, picks the platform being built, collects the Vite plugins and options each package declares in its contract, and adds kitr's own: the `virtual:kitr/providers` and `virtual:kitr/config` modules that `app/app.ts` imports, the `#app`, `#config`, `#components`, `#server` and `#kitr` aliases from the `directories` in `kitrrc.ts`, the platform's port and output directory, and `kitr types` on every build and every change to a file a type generator watches.

It runs at build time only; nothing of it ships to the browser. A pure backend never installs it: the [server platform](/packages/server) runs TypeScript directly. Every browser platform (`web`, `desktop`, `tauri`, `mobile`) requires it.

## Install

```sh
kitr add vite
```

This installs `@kitr/vite` and Vite as dev dependencies, adds the package to `kitrrc.ts`, writes `vite.config.ts` with `kitr()` as its only plugin and adds the client types to `tsconfig.json`. There is no provider. Every kit with a browser platform includes it. The guide's [Install](/packages/vite/guide#install) section lists every change.

## Quick start

The whole Vite config is one plugin:

```ts
// vite.config.ts
import { kitr } from '@kitr/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [kitr()],
})
```

It reads `kitrrc.ts` and serves two virtual modules, which `app/app.ts` imports:

```ts
// app/app.ts
import { createApp } from 'kitr/app'
import { config } from 'virtual:kitr/config'
import { providers } from 'virtual:kitr/providers'
import { env } from './env'

export const app = createApp({ providers, config, env })
```

Run `kitr dev site` and the browser opens `http://localhost:3000` with the pages from `app/routes.ts`. `virtual:kitr/providers` is the `providers` list from `kitrrc.ts` as static imports, so every provider is in the bundle and tree-shakable, and `virtual:kitr/config` is every file under `config/` keyed by name: `config/query.ts` becomes `config.query`. Change `kitrrc.ts` and both modules reload without a restart. The guide continues from here: [Run your first dev server](/packages/vite/guide#run-your-first-dev-server).

## Built on

`@kitr/vite` is built on [Vite](https://vite.dev), with [TanStack Start](https://tanstack.com/start/latest) and the [TanStack Router plugin](https://tanstack.com/router/latest/docs/framework/react/routing/installation-with-vite) for the web platform's server rendering and route generation. kitr adds the `kitr()` plugin, the virtual modules, the aliases, the platform selection, the prerender list and the type generation hook.

## Problems it solves

- **A growing `vite.config.ts`.** Packages declare what they need; the plugin assembles it. See [Let a package configure the build](/packages/vite/guide#let-a-package-configure-the-build).
- **Several platforms, several configs.** Pick the platform with a flag; the same config builds all of them. See [Pick the platform to build](/packages/vite/guide#pick-the-platform-to-build).
- **Relative import paths.** `#app`, `#config` and friends come from `kitrrc.ts`. See [Import through the aliases](/packages/vite/guide#import-through-the-aliases).
- **Generated types going stale.** `kitr types` runs on build and on change. See [Keep generated types current](/packages/vite/guide#keep-generated-types-current).
- **Your own plugin beside kitr's.** Add it to the same array. See [Add a Vite plugin of your own](/packages/vite/guide#add-a-vite-plugin-of-your-own).

## Further reading

- [Guide](/packages/vite/guide): install, configure and every task.
- [API reference](/packages/vite/api): every export with its signature.
- [Vite documentation](https://vite.dev/guide/): config, plugins and the dev server.
- [The package contract](/docs/package-contract): the `vite` field a package declares.
- [Web](/packages/web): modes, PWA and `kitr dev site`.
