---
title: What is kitr
description: The mental model for kitr in five minutes: platforms, packages, kits and providers, what it is built on and what is stable.
---

# What is kitr

kitr is a TypeScript framework for apps that run in a browser, on a server, on the desktop and on phones. You write one `app/` folder in React and TypeScript. A project file called `kitrrc.ts` says where it runs and which capabilities it has, and one CLI (`kitr add`, `kitr dev`, `kitr build`) sets everything up. Each capability is a small package that wraps a library you may already know, such as TanStack Router, TanStack Query, React Hook Form or h3. It is for teams who want one set of conventions instead of choosing and wiring twenty libraries, and for coding agents, which can read the same conventions from `AGENTS.md`.

## The four words you need

**Platform.** A platform is where the app runs: a website, an API server, a desktop window, a phone. You list platforms in `kitrrc.ts`, each with a name and options, for example `site: web({ mode: 'ssr' })`. `kitr dev site` runs one, and `kitr build` builds all of them into `dist/<name>/`. Platforms are packages too (`@kitr/web`, `@kitr/server`).

**Package.** A package is one capability: routing, data fetching, forms, auth, mail. It is published as `@kitr/<name>`, and you import from `@kitr/<name>`. The import gives you the upstream library unchanged, plus a few helpers. `kitr add forms` installs the package, wires it into the project, writes its config file and adds lines to `AGENTS.md`.

**Kit.** A kit is a starting set of platforms, packages and files for `kitr new`. `app` is a web app on an existing API, `fullstack` adds server rendering and its own backend, `server` is an API with no React. A kit is only a shortcut: afterwards you add and remove packages like any other project. [Kits](/docs/kits) lists them all.

**Provider.** A provider is how a package takes part in app startup. It is a small object with hooks that run in order: `register`, `boot`, `ready`, `shutdown`, plus `wrap` for packages that need to wrap the React tree. `kitrrc.ts` lists the providers as lazy imports, so you can read your project's startup in one file.

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

`kitr dev site api` runs both. `kitr build` writes `dist/site/` and `dist/api/`. Options live in `config/<package>.ts`, and `kitr config site port 4000` edits one with validation. The exact shape of `kitrrc.ts` is on [Configuration](/docs/configuration).

## What is built on what

kitr does not re-implement the libraries below. It re-exports them and adds a thin layer: one import path, one data contract and one startup order.

| kitr piece | Upstream library | What kitr adds |
| --- | --- | --- |
| `@kitr/router` | TanStack Router | A route table in `app/routes.ts`, `requireAuth()`, `can()` |
| `@kitr/query` | TanStack Query | Contracts and cache `effects` |
| `@kitr/forms` | React Hook Form | Schema validation, server errors mapped to fields |
| `@kitr/table` | TanStack Table | Sorting and paging kept in the URL |
| `@kitr/state` | Zustand | Stores that are safe with server rendering |
| `@kitr/http` | ky | An auth header, one refresh retry, one error shape |
| `@kitr/web` | Vite and TanStack Start | The `web()` platform: static, spa, ssr and pwa modes |
| `@kitr/server` | h3 and srvx | The `server()` platform, request context |
| `@kitr/tailwind`, `@kitr/theme` | Tailwind, `cva` | Tokens, dark mode, components you copy into your app |

## What is stable

| Part | Status |
| --- | --- |
| `web()` platform (static, spa, ssr, pwa) | Ready |
| `server()` platform (h3 on srvx) | Ready |
| Packages in the `app`, `fullstack` and `server` kits | Ready |
| `desktop()` (Electron), `tauri()`, `mobile()` (Capacitor) | Ready |
| Device packages (platform, files, notifications, native, secure-storage, updater) | Ready |

The native shells are web views around your app, not React Native. kitr has no auth server of its own: the `auth` package connects to the one you have.

## Glossary

| Term | Meaning |
| --- | --- |
| Platform | Where an app runs: web, server, desktop, mobile. Named in `kitrrc.ts` |
| Package | One capability, published as `@kitr/<name>` and added with `kitr add` |
| Kit | A starting set of platforms, packages and files for `kitr new` |
| Preset | A kit with real pages, controllers and tests: `saas`, `site`, `realtime` |
| Provider | A package's startup hooks: register, boot, ready, shutdown, wrap |
| Entry point | An import path such as `@kitr/router` that exposes a package |
| Route table | The list of pages in `app/routes.ts`, one `.page()` per URL |
| Contract | The one shape for queries, mutations and subscriptions, whatever serves them |
| Effects | Cache changes a mutation declares: invalidate, set, remove |
| `kitrrc.ts` | The project file that lists packages, providers and platforms |
| `config/` | One options file per package, typed by the package |
| `AGENTS.md` | Conventions for coding assistants, kept up to date by `kitr add` |

## Where next

- [Getting started](/docs/getting-started): create an app and run it.
- [Project structure](/docs/project-structure): what each file is for.
- [Loading and saving data](/docs/data): the contract that ties the packages together.
- [How kitr compares](/docs/compare): kitr beside Next.js, Remix, Expo, Laravel and others.
- [Extending kitr](/docs/extending): add your own state, services and drivers.
- [Browse packages](/packages): the capabilities you can add.
