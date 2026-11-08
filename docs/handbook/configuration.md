---
title: Configuration
description: How kitrrc.ts, config files, providers and environment variables fit together.
---

# Configuration

kitr follows one rule for setup: **everything is written down where you can read it.**

## Configure a package in three steps

To change how a package behaves, find its options and edit one file.

1. Open the package's page under [Packages](/packages) and go to its Configure section, where every option is listed with its default.
2. Open `config/<name>.ts`, or run `kitr config` to edit a value with validation.
3. Save. The dev server picks up the change.

```sh
kitr config query staleTime 60000
```

## kitrrc.ts

```ts
import { defineKitrConfig } from '@kitr/kitr/app'

export default defineKitrConfig({
  packages: ['@kitr/router', '@kitr/query', '@kitr/http', '@kitr/auth'],
  providers: [
    () => import('@kitr/query/provider'),
    () => import('@kitr/http/provider'),
    () => import('@kitr/auth/provider'),
  ],
  directories: { app: 'app', routeTable: 'app/routes.ts', config: 'config' },
})
```

- `packages` is what `kitr doctor` checks against `package.json`.
- `providers` run in order at startup. Each is a lazy import, so a provider only loads when the app boots.
- `directories` tells the CLI and the Vite plugin where things live, if you move them.

`kitr add` and `kitr remove` edit this file for you, but it's yours: reorder it, add your own providers, delete what you don't use.

## config/

Each package with options reads them from `config/<name>.ts`:

```ts
// config/query.ts
import { defineConfig } from '@kitr/query'

export default defineConfig({ staleTime: 60_000 })
```

`defineConfig` gives you autocomplete and type checks for that package's options. Every option is documented on the package's page, under Configuration.

## Providers

A provider is how a package (or your own code) plugs into startup. It has up to five steps, each optional:

| Step | When | Typical use |
| --- | --- | --- |
| `register` | First, for every provider | Put a service in the container: `app.container.singleton('http', ...)` |
| `boot` | Before the first render or request | Restore the session, warm a cache |
| `wrap` | Client apps, while rendering | Put a React context provider around the app |
| `ready` | Server apps, once listening | Start a background job |
| `shutdown` | Server apps, on stop | Close database pools, flush logs |

Write your own with `kitr make:provider analytics`:

```ts
// app/providers/analytics-provider.ts
import { defineProvider } from '@kitr/kitr/app'

export default defineProvider({
  name: 'analytics',
  register(app) {
    app.container.singleton('analytics', () => createAnalytics(app.config.get('analytics')))
  },
})
```

The command also adds `() => import('#app/providers/analytics-provider')` to `providers` in `kitrrc.ts`. Anywhere in the app, `useService('analytics')` (from `@kitr/react`) or `app.container.use('analytics')` returns it.

## Environment variables

```ts
// app/env.ts
import { createEnv, env as e } from '@kitr/kitr/env'

export const env = createEnv({
  public: {
    VITE_API_URL: e.url({ default: 'http://localhost:3333' }),
  },
  server: {
    DATABASE_URL: e.url(),
    STRIPE_KEY: e.string(),
  },
})
```

Values come from `.env` files and the process environment. The app refuses to start if a required variable is missing or invalid, and reading a server variable from browser code throws instead of silently shipping your secret.

## Checking your setup

```sh
kitr doctor
```

Compares `kitrrc.ts` with `package.json`, checks every provider resolves, finds missing config files and flags direct imports of upstream libraries where an `@kitr/*` package re-exports them. It exits with code 1 on errors, so you can run it in CI.
