---
title: API
description: Every export of @kitr/flags, with its signature.
order: 2
---

# API

Every export of `@kitr/flags`, `@kitr/flags/react`, `@kitr/flags/provider`, `@kitr/flags/server`, read from the published type definitions. The [guide](/packages/flags) shows them in use.

## @kitr/flags

### createFlags

```ts
function createFlags<D extends FlagDefinitions>(definitions: D, config?: FlagsConfig, app?: KitrApp, options?: CreateFlagsOptions): Flags<D>;
```

Build a flags service from definitions and a config: what the provider binds, and what tests call directly.

### defineFlags

```ts
function defineFlags<const D extends FlagDefinitions>(definitions: D): D;
```

Declare every flag once, in `app/flags.ts`, with its default and a sentence on what it gates.

### envFlagsProvider

```ts
function envFlagsProvider(env?: Record<string, string | undefined>, prefix?: string): FlagsProvider;
```

Answer from environment variables: `FLAG_NEW_DASHBOARD=true` answers `newDashboard` and `new-dashboard`. Reads `process.env` unless given a map.

### openFeatureFlagsProvider

```ts
function openFeatureFlagsProvider(client: {
  getBooleanValue(key: string, def: boolean, ctx?: any): boolean | Promise<boolean>;
  getStringValue(key: string, def: string, ctx?: any): string | Promise<string>;
  getNumberValue(key: string, def: number, ctx?: any): number | Promise<number>;
}, definitions: FlagDefinitions): FlagsProvider;
```

An OpenFeature client (`@openfeature/web-sdk` or `server-sdk`) as a kitr provider; the typed
defaults in `app/flags.ts` pick which `get*Value` to call.

### percentageFlagsProvider

```ts
function percentageFlagsProvider(shares: Record<string, number>, salt?: string): FlagsProvider;
```

Turn a flag on for a share of users, stable per user id. `percentageFlagsProvider({ beta: 10 })`.

### readEmbeddedFlags

```ts
function readEmbeddedFlags(): FlagMap | undefined;
```

Read the snapshot a server page embedded, if any. `undefined` on the server, without the tag, or when its JSON is broken.

### staticFlagsProvider

```ts
function staticFlagsProvider(values: Partial<FlagMap> | ((context: FlagContext) => Partial<FlagMap>)): FlagsProvider;
```

A fixed map, or a function of the context: `{ newDashboard: true }` or `(ctx) => ...`.

### useFlags

```ts
function useFlags<D extends FlagDefinitions = FlagDefinitions>(app: KitrApp): Flags<D>;
```

The app's flags service, from the container, outside React.

### defineConfig

```ts
const defineConfig: <const C extends FlagsConfig>(config: C) => C;
```

Type the default export of `config/flags.ts`. Returns its argument unchanged.

### FLAGS_SCRIPT_ID

```ts
const FLAGS_SCRIPT_ID = "__kitr_flags__";
```

The id of the JSON script tag that carries the server's snapshot to the browser.

### CreateFlagsOptions

```ts
interface CreateFlagsOptions {
  /**
   * Whether `resolve()` updates the snapshot that `value()`, `isEnabled()` and the React hooks
   * read. Default: everywhere but the server's root app, which serves every user at once (the
   * provider binds one instance per request there, and those keep their snapshot).
   */
  keepSnapshot?: boolean;
}
```

Options for `createFlags()` beyond the config.

### FlagContext

```ts
interface FlagContext {
  /** Stable id of the user; percentage rollouts and OpenFeature's `targetingKey` use it. */
  userId?: string;
  [key: string]: unknown;
}
```

Who is asking: the user, their plan, the request. Providers target on it.

### FlagDefinition

```ts
interface FlagDefinition<T extends FlagValue = FlagValue> {
  /** The value when no provider answers. */
  default: T;
  /** A sentence on what the flag gates, for the people who flip it. */
  description?: string;
}
```

One flag in `defineFlags()`: its default, whose type fixes the flag's type, and what it gates.

### Flags

```ts
interface Flags<D extends FlagDefinitions = FlagDefinitions> {
  /** The current answer. Synchronous: works from a resolved snapshot (and the defaults before one). */
  value<K extends keyof D & string>(key: K): D[K]['default'];
  /** True only when the flag's current value is exactly `true`. */
  isEnabled(key: keyof D & string): boolean;
  /** Every flag, resolved for `context`. Server: once per request. Client: once per session, then cached. */
  resolve(context?: FlagContext): Promise<FlagValues<D>>;
  /** Load a snapshot the server resolved (what `<FlagsScript>` carries), skipping any resolution. */
  hydrate(values: Partial<FlagValues<D>>): void;
  /** Every current value, as one frozen object that stays the same until the next change. */
  snapshot(): FlagValues<D>;
  /** Call `listener` after each resolve or hydrate that updates the snapshot; returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** The definitions passed in. */
  readonly definitions: D;
  /** Whether the snapshot came from a resolve or hydrate rather than the defaults. */
  readonly resolved: boolean;
}
```

The flags service bound as `flags`: a typed snapshot of every flag, and the means to resolve it.

### FlagsConfig

```ts
interface FlagsConfig {
  /** The flags from `app/flags.ts`. */
  definitions?: FlagDefinitions;
  /** First provider with an answer wins. */
  providers?: FlagsProvider[];
  /**
   * Seconds a resolved snapshot stays fresh in the browser. After that the client resolves again,
   * with the context of its last `resolve()`, so a flag turned off reaches open tabs. Default: never.
   */
  ttl?: number;
}
```

The options in `config/flags.ts`.

### FlagsProvider

```ts
interface FlagsProvider {
  /** Shown in warnings when the provider fails. */
  name: string;
  /** Runs once per `resolve()`, before any key. A throw skips this provider for that resolve. */
  init?(context: FlagContext): Promise<void> | void;
  /** `undefined` means "no opinion": the next provider, then the default, answer. */
  resolve(key: string, context: FlagContext): Promise<FlagValue | undefined> | FlagValue | undefined;
}
```

Where answers come from. Mirrors OpenFeature's provider shape, so an OpenFeature client is a
one-line adapter, but a plain object or `envFlagsProvider()` also work.

### FlagDefinitions

```ts
type FlagDefinitions = Record<string, FlagDefinition>;
```

Every flag by key, as `defineFlags()` takes and returns them.

### FlagMap

```ts
type FlagMap = Record<string, FlagValue>;
```

Flag values by key, untyped: what providers and embedded snapshots carry.

### FlagValue

```ts
type FlagValue = boolean | string | number;
```

A flag's value: on/off, a number such as a limit, or a string such as a variant name.

### FlagValues

```ts
type FlagValues<D extends FlagDefinitions> = {
  [K in keyof D]: D[K]['default'];
};
```

The resolved value of every flag in `D`, typed by each default.

## @kitr/flags/react

### FlagsScript

```ts
function FlagsScript({ values }: {
  values: Record<string, unknown>;
}): import("react").DetailedReactHTMLElement<{
  type: string;
  id: string;
  dangerouslySetInnerHTML: {
    __html: string;
  };
}, HTMLElement>;
```

Put in the document head of the root route with the values `resolveFlags()` returned in the loader.

### useFlag

```ts
function useFlag<D extends FlagDefinitions, K extends keyof D & string>(key: K): D[K]['default'];
```

One flag's value; re-renders when a resolve or hydrate changes it.

### useFlags

```ts
function useFlags<D extends FlagDefinitions = FlagDefinitions>(): FlagValues<D>;
```

Every flag, as a plain object.

## @kitr/flags/provider

### flagsProvider

```ts
const flagsProvider: import("@kitr/core").KitrProvider;
```

Binds `flags` from `config/flags.ts` (`definitions` from `app/flags.ts`, `providers`). In the
browser a snapshot embedded by `<FlagsScript>` loads before the first render; otherwise
`resolve()` runs at boot. On the server, `resolveFlags(app, event)` answers per request.

## @kitr/flags/server

### flagsScript

```ts
function flagsScript(values: Record<string, unknown>): string;
```

The server-resolved snapshot as a script tag the client provider reads before hydration.

### resolveFlags

```ts
function resolveFlags<D extends FlagDefinitions>(app: KitrApp, event: H3Event | {
  context: Record<string, any>;
}, context?: FlagContext): Promise<FlagValues<D>>;
```

Resolve every flag for this request (user from `event.context.kitr.locals.user` when auth ran),
cached on the event so loaders, controllers and the page share one answer.

### Flags

```ts
interface Flags<D extends FlagDefinitions = FlagDefinitions> {
  /** The current answer. Synchronous: works from a resolved snapshot (and the defaults before one). */
  value<K extends keyof D & string>(key: K): D[K]['default'];
  /** True only when the flag's current value is exactly `true`. */
  isEnabled(key: keyof D & string): boolean;
  /** Every flag, resolved for `context`. Server: once per request. Client: once per session, then cached. */
  resolve(context?: FlagContext): Promise<FlagValues<D>>;
  /** Load a snapshot the server resolved (what `<FlagsScript>` carries), skipping any resolution. */
  hydrate(values: Partial<FlagValues<D>>): void;
  /** Every current value, as one frozen object that stays the same until the next change. */
  snapshot(): FlagValues<D>;
  /** Call `listener` after each resolve or hydrate that updates the snapshot; returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** The definitions passed in. */
  readonly definitions: D;
  /** Whether the snapshot came from a resolve or hydrate rather than the defaults. */
  readonly resolved: boolean;
}
```

The flags service bound as `flags`: a typed snapshot of every flag, and the means to resolve it.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
