---
title: API
description: Every export of @kitr/react, with its signature.
order: 2
---

# API

Every export of `@kitr/react`, read from the published type definitions. The [guide](/packages/react) shows them in use.

## @kitr/react

### createApp

```ts
function createApp(options?: CreateAppOptions): KitrApp;
```

Creates the app object that owns the container, config and providers. Call `boot()` on it
before reading services; one app per client, per server process and per test.

### KitrBoot

```ts
function KitrBoot({ app, children, fallback }: KitrProviderProps & {
  fallback?: ReactNode;
}): import("react").JSX.Element;
```

Boot an app inside React. Renders `fallback` until boot completes.
Use in client-only apps; server-rendered apps boot before rendering.

### KitrProvider

```ts
function KitrProvider({ app, children }: KitrProviderProps): import("react").JSX.Element;
```

Puts the app in context and renders every provider's `wrap()` around children.
Boot the app first (`await app.boot()`) when you can; otherwise it suspends until boot completes.

### useApp

```ts
function useApp(): KitrApp;
```

The app in context: its container, config, env, mode, environment and platform.
Throws when the component is not rendered inside `KitrProvider` (or `KitrBoot`, or the router).

### useConfig

```ts
function useConfig<K extends Parameters<KitrApp['config']['get']>[0]>(key: K): import("@kitr/core").ConfigOf<K>;
```

Read one package's config, as exported by `config/<name>.ts`, typed from `ConfigRegistry`.
Throws when that config does not exist; use `useApp().config.get(key, fallback)` for optional config.

### useService

```ts
function useService<K extends Parameters<KitrApp['container']['use']>[0]>(key: K): import("@kitr/core").Binding<K>;
```

Read a container binding from a component, typed from `ContainerBindings` (`useService('http')`).
The binding must be resolved, which it is after boot; an unknown key throws.

### KitrApp

```ts
class KitrApp {
  readonly container: Container;
  readonly config: ConfigStore;
  readonly environment: AppEnvironment;
  readonly mode: AppMode;
  readonly env: Record<string, unknown>;
  readonly providers: KitrProvider[];
  /** Native drivers registered by platform providers, resolved by capability packages. */
  readonly drivers: DriverRegistry;
  /** The platform name from kitrrc.ts this bundle runs as, when known. */
  readonly platform: PlatformName | undefined;
  /** The process-wide operation registry (see `operations` in `@kitr/core`). */
  readonly operations: OperationRegistry;
  private inputs;
  private phase;
  private readying;
  private booting?;
  constructor(options?: CreateAppOptions);
  get isClient(): boolean;
  get isServer(): boolean;
  get isDevelopment(): boolean;
  get isProduction(): boolean;
  /** Add a provider before boot. */
  use(provider: ProviderInput): this;
  /** register → boot. Idempotent: concurrent callers share one boot. */
  boot(): Promise<this>;
  /** Server only: tell providers the server is serving. Idempotent: runs each `ready` once. */
  ready(): Promise<this>;
  /** Server only: run providers' `shutdown` in reverse order. */
  shutdown(): Promise<void>;
  /** Compose every provider's `wrap`, outermost first. */
  wrap(children: KitrNode): KitrNode;
  /** A request- or test-scoped app that shares providers and config but has its own instances. */
  fork(): KitrApp;
  get status(): Phase;
}
```

The app object every provider sees. One per client, one per server process,
one per test. It owns the container, the config and the provider list.

### CreateAppOptions

```ts
interface CreateAppOptions {
  /** Providers to register, in order. Usually the list from `kitrrc.ts`. */
  providers?: ProviderInput[];
  /** Per-package config, keyed the way `config/<name>.ts` files are. */
  config?: Record<string, unknown>;
  /** client | server | test. Default: `test` under Vitest, `client` when `window` exists, otherwise `server`. */
  environment?: AppEnvironment;
  /** development | production | test. Default: from Vite's `import.meta.env.MODE` or `NODE_ENV`. */
  mode?: AppMode;
  /** Validated env object (from `createEnv`). Exposed as `app.env`. */
  env?: Record<string, unknown>;
  /** The platform name this bundle was built for (`kitr dev site` → `site`). Default: from `import.meta.env.KITR_PLATFORM`. */
  platform?: PlatformName;
  /**
   * Every named query and mutation, by name: the `operations` map `kitr types` writes to
   * `.kitr/actions.ts`. Registered process-wide, so `useQuery('projects.list')` and
   * `call('projects.update', input)` resolve anywhere.
   */
  operations?: Record<string, OperationLike>;
}
```

Options for `createApp()`: the providers to register, their config and the runtime details.

### KitrProviderProps

```ts
interface KitrProviderProps {
  /** The app from `app/app.ts`. Every provider's `wrap()` is rendered around `children`. */
  app: KitrApp;
  /** The tree that can call `useApp`, `useService` and `useConfig`. */
  children: ReactNode;
}
```

Props of `KitrProvider` and `KitrBoot`: the app to put in context and the tree that reads it.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
