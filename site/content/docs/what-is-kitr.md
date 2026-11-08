---
title: What is kitr
description: The mental model for kitr in five minutes: platforms, packages, kits and providers, and what it is built on.
---

# What is kitr

kitr is an opinionated TypeScript and React framework for apps on every platform, with the tools already chosen and wired. You write one `app/` folder, and one CLI (`kitr add`, `kitr dev`, `kitr build`) sets everything up.

> [!SUMMARY]
> Four words cover the whole model.
> - **Platform**: where your app runs, such as a website or an API server.
> - **Package**: one capability, such as forms or sign-in, added with `kitr add`.
> - **Kit**: a starting set of platforms and packages for `kitr new`.
> - **Provider**: a package's startup code, listed in `kitrrc.ts`.

Each package wraps a library you may already know, such as TanStack Router, React Hook Form or h3. The [glossary](/docs/glossary) defines every other word.

## The four words in detail

**Platform.** A platform is where the app runs: a website, an API server, a desktop window, a phone. You list platforms in `kitrrc.ts`, and `kitr build` builds each into `dist/<name>/`.

**Package.** A package is published as `@kitr/<name>`, and you import from it. The import gives you the upstream library unchanged, plus a few helpers.

**Kit.** A kit is only a shortcut: afterwards you add and remove packages like any other project. [Kits](/docs/kits) lists them all.

**Provider.** A provider is a small object with hooks that run in order at startup. `kitrrc.ts` lists them, so you can read your project's startup in one file.

## One app, several platforms

The same `app/` can run in more than one place. This `kitrrc.ts` has a website and an API:

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'
import { server } from '@kitr/server'
import { web } from '@kitr/web'

export default defineKitrConfig({
  packages: ['@kitr/router', '@kitr/query'],
  providers: [
    () => import('@kitr/router/provider'),
    () => import('@kitr/query/provider'),
  ],
  platforms: {
    site: web({ mode: 'ssr' }),
    api: server({ runtime: 'node' }),
  },
})
```

`kitr dev site api` runs both, and `kitr build` writes `dist/site/` and `dist/api/`. The shape of the file is on [Configuration](/docs/configuration).

## Built on libraries you know

kitr re-exports these libraries and adds a thin layer: one import path, one data contract and one startup order.

| kitr piece | Upstream library | What kitr adds |
| --- | --- | --- |
| `@kitr/router` | TanStack Router | A route table in `app/routes.ts`, `requireAuth()`, `can()` |
| `@kitr/query` | TanStack Query | Contracts and cache `effects` |
| `@kitr/forms` | React Hook Form | Schema validation, server errors mapped to fields |
| `@kitr/state` | Zustand | Stores that are safe with server rendering |
| `@kitr/web` | Vite and TanStack Start | Static, spa, ssr and pwa modes |
| `@kitr/server` | h3 and srvx | An API server with request context |

The native shells are web views around your app, not React Native. kitr has no auth server of its own: the `auth` package connects to the one you have.

## Next steps

- [Getting started](/docs/getting-started): create an app and run it.
- [Project structure](/docs/project-structure): what each file is for.
- [Loading and saving data](/docs/data): the contract that ties the packages together.
