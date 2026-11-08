---
title: Add your own code
description: Add your own state, services and drivers in three steps: a provider in your project, a swapped driver, a package of your own.
---

# Add your own code

You add your own code in three levels, and you start at the first.

> [!SUMMARY]
> 1. **Your project**: write a provider and a config file for a store, a client or a feature flag service.
> 2. **A driver**: swap the storage, vault or notifications on one shell with one `register` call.
> 3. **A package**: turn the same thing into a package with `definePackage` for many projects.

| Level | You want | You write |
| --- | --- | --- |
| 1. Your project | A store, a client, a feature flag service | A provider and a config file |
| 2. A driver | Different storage, vault or notifications on one shell | A driver and one `register` call |
| 3. A package | The same thing in many projects | A package with `definePackage` |

The code in levels 1 and 2 is from [`examples/everywhere`](https://github.com/kitrjs/kitr/tree/main/examples/everywhere).

## 1. Your own code in one project

A provider puts a service in the app. Pages read it with `useService()`.

### Generate the provider

```sh
kitr make:provider flags
```

This writes `app/providers/flags-provider.ts` and lists it in `kitrrc.ts`.

### Fill it in

```ts
// app/providers/flags-provider.ts
import { defineProvider } from 'kitr/app'

export interface FlagsConfig {
  flags: Record<string, boolean>
}

export class Flags {
  constructor(private readonly values: Record<string, boolean>) {}

  isOn(name: string): boolean {
    return this.values[name] ?? false
  }
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    flags: FlagsConfig
  }
  interface ContainerBindings {
    flags: Flags
  }
}

export default defineProvider({
  name: 'flags',
  register(app) {
    const config = app.config.get('flags', { flags: {} })
    app.container.singleton('flags', () => new Flags(config.flags))
  },
})
```

<details>
<summary>What the declare module block does</summary>

The `declare module` block types `app.config.get('flags')` and `useService('flags')`. Without it both still work, but return untyped values.

</details>

### Add its options

```ts
// config/flags.ts
import type { FlagsConfig } from '#app/providers/flags-provider'

export default {
  flags: { beta: true },
} satisfies FlagsConfig
```

`config/index.ts` lists every file in `config/`. `kitr add` rewrites it. Add the line by hand when you create a file yourself.

### Read it in a page

```tsx
import { useService } from '@kitr/react'

export default function HomePage() {
  const flags = useService('flags')
  return flags.isOn('beta') ? <p>Beta features are on.</p> : null
}
```

### Use a state library

Same steps. Create the store in `register()` and bind it:

```ts
import { createStore } from 'zustand/vanilla'

app.container.singleton('cart', () => createStore<CartState>(() => ({ items: [] })))
```

Pages read it with `useService('cart')`. Tests create their own app, so state never leaks between them.

## 2. Swap a driver

Device packages (`@kitr/secure-storage`, `@kitr/notifications`, `@kitr/files`, `@kitr/native`, `@kitr/updater`) ask the app for a driver. The best match wins, and priority decides.

<details>
<summary>Driver priority table</summary>

| Source | Priority |
| --- | --- |
| Web fallback | 0 |
| Shell drivers (Electron, Tauri, Capacitor) | 10 |
| Yours | any number above |

</details>

### Register your own

A secure-storage driver is four functions.

```ts
// app/vault.ts
import type { SecureStorageDriver } from '@kitr/secure-storage'
import { defineProvider } from 'kitr/app'

export function createMapVault(): SecureStorageDriver {
  const values = new Map<string, string>()
  return {
    name: 'map-vault',
    secure: false,
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => {
      values.set(key, value)
    },
    remove: async (key) => {
      values.delete(key)
    },
    keys: async () => [...values.keys()],
  }
}

export default defineProvider({
  name: 'map-vault',
  register(app) {
    app.drivers.register('secure-storage', createMapVault(), { platform: 'test', priority: 20 })
  },
})
```

List the provider in `kitrrc.ts`. The package picks it up. Pass `platform: 'desktop'` or `'mobile'` to label it for devtools and `kitr doctor`.

Test it by booting an app with only that provider:

```ts
const app = createApp({ providers: [vaultProvider] })
await app.boot()
const storage = createSecureStorage({}, app)
expect(storage.driver.name).toBe('map-vault')
```

### Skip the registry

Pass the driver in the package's config:

```ts
// config/secure-storage.ts
import { defineConfig } from '@kitr/secure-storage'
import { createMapVault } from '#app/vault'

export default defineConfig({ driver: createMapVault() })
```

### Fall back to the web driver

In a native shell with no driver for a package, the service throws `E_DRIVER_UNAVAILABLE`. Opt in to the web driver per package:

```ts
// config/notifications.ts
import { defineConfig } from '@kitr/notifications'

export default defineConfig({ fallbackToWeb: true })
```

The web driver then runs inside the WebView.

### Write a Tauri, Electron or Capacitor driver

Each device package exports its driver interface and the built-in drivers as examples. Copy the closest one.

| Shell | Built-in driver to copy |
| --- | --- |
| Electron | `createElectronSecureStorageDriver` (talks to the main process over the `kitrIpc` bridge) |
| Tauri | `createTauriNotificationsDriver` (calls Tauri plugins) |
| Capacitor | `createCapacitorSecureStorageDriver` (calls Capacitor plugins) |

Register the new driver with `platform` set to the shell. Add native plugins with `ctx.deps.add()` in your package's `kitr.ts` when you ship it (level 3).

## 3. Your own package

When the same provider belongs in many projects, make it a package. A package adds:

- a `kitr add` step: questions, config file, provider, dependencies
- docs and an example for this site
- generators (`kitr make:<kind>`)

```ts
// src/kitr.ts
import { definePackage } from '@kitr/core/package'

export default definePackage({
  name: 'flags',
  add(ctx) {
    ctx.provider.add('@acme/flags/provider')
    ctx.config('flags', "export default { flags: {} }\n")
  },
  remove(ctx) {
    ctx.provider.remove('@acme/flags/provider')
  },
})
```

The full contract is in [Building a package](/docs/building-packages) and [Package contract](/docs/package-contract).

## Next steps

- [Platforms](/docs/platforms): runtimes, shells and the `everywhere` example.
- [Building a package](/docs/building-packages): publish level 3.
- [Package contract](/docs/package-contract): every hook a package can use.
