---
title: Overview
description: Build and serve the browser side of your app with Vite, wired to kitrrc.ts by one plugin.
order: 0
---

# Vite

## What it is

`@kitr/vite` is the build layer. The `kitr()` plugin reads `kitrrc.ts`, picks the platform being built, adds every package's Vite settings, the `virtual:kitr/*` modules and the `#app`-style aliases, and runs `kitr types`.

Runs at build time only. Every browser platform requires it; a pure backend does not.

## Install

```sh
kitr add vite
```

Adds `@kitr/vite` and Vite, `vite.config.ts` with `kitr()` as its only plugin, and the client types in `tsconfig.json`. Every kit with a browser platform includes it. [Every change](/packages/vite/guide#install).

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
import { createApp } from '@kitr/kitr/app'
import { config } from 'virtual:kitr/config'
import { providers } from 'virtual:kitr/providers'
import { env } from './env'

export const app = createApp({ providers, config, env })
```

Run `kitr dev site`. `virtual:kitr/providers` is the provider list from `kitrrc.ts`; `virtual:kitr/config` is every file under `config/`. Change `kitrrc.ts` and both reload. Next in the guide: [Run your first dev server](/packages/vite/guide#run-your-first-dev-server).

## Built on

kitr adds the `kitr()` plugin, the virtual modules, the aliases, platform selection and type generation.

## Problems it solves

- **A growing `vite.config.ts`.** [Let a package configure the build](/packages/vite/guide#let-a-package-configure-the-build).
- **Several platforms, several configs.** [Pick the platform to build](/packages/vite/guide#pick-the-platform-to-build).
- **Relative import paths.** [Import through the aliases](/packages/vite/guide#import-through-the-aliases).
- **Generated types going stale.** [Keep generated types current](/packages/vite/guide#keep-generated-types-current).
- **Your own plugin beside kitr's.** [Add a Vite plugin of your own](/packages/vite/guide#add-a-vite-plugin-of-your-own).

## Further reading

- [Guide](/packages/vite/guide).
- [API reference](/packages/vite/api).
- [Vite documentation](https://vite.dev/guide/).
- [The package contract](/docs/package-contract).
- [Web](/packages/web).
