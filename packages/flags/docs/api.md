---
title: API
description: Every export of kitr/flags, with its signature.
order: 2
---

# API

Every export of `kitr/flags`, `kitr/flags/react`, `kitr/flags/provider`, `kitr/flags/server`, read from the published type definitions. The [guide](/packages/flags) shows them in use.

## kitr/flags

### createFlags

```ts
function createFlags<D extends FlagDefinitions>(definitions: D, config?: FlagsConfig, app?: KitrApp, options?: CreateFlagsOptions): Flags<D>;
```

### defineFlags

```ts
function defineFlags<const D extends FlagDefinitions>(definitions: D): D;
```

Declare every flag once, in `app/flags.ts`, with its default and a sentence on what it gates.

### envFlagsProvider

```ts
function envFlagsProvider(env?: Record<string, string | undefined>, prefix?: string): FlagsProvider;
```

`FLAG_NEW_DASHBOARD=true` answers `newDashboard`.

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

Read the snapshot a server page embedded, if any.

### staticFlagsProvider

```ts
function staticFlagsProvider(values: Partial<FlagMap> | ((context: FlagContext) => Partial<FlagMap>)): FlagsProvider;
```

A fixed map, or a function of the context: `{ newDashboard: true }` or `(ctx) => ...`.

### useFlags

```ts
function useFlags<D extends FlagDefinitions = FlagDefinitions>(app: KitrApp): Flags<D>;
```

### defineConfig

```ts
const defineConfig: <const C extends FlagsConfig>(config: C) => C;
```

### FLAGS_SCRIPT_ID

```ts
const FLAGS_SCRIPT_ID = "__kitr_flags__";
```

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

### FlagContext

```ts
interface FlagContext {
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
  description?: string;
}
```

### Flags

```ts
interface Flags<D extends FlagDefinitions = FlagDefinitions> {
  /** The current answer. Synchronous: works from a resolved snapshot (and the defaults before one). */
  value<K extends keyof D & string>(key: K): D[K]['default'];
  isEnabled(key: keyof D & string): boolean;
  /** Every flag, resolved for `context`. Server: once per request. Client: once per session, then cached. */
  resolve(context?: FlagContext): Promise<FlagValues<D>>;
  /** Load a snapshot the server resolved (what `<FlagsScript>` carries), skipping any resolution. */
  hydrate(values: Partial<FlagValues<D>>): void;
  snapshot(): FlagValues<D>;
  subscribe(listener: () => void): () => void;
  readonly definitions: D;
  readonly resolved: boolean;
}
```

### FlagsConfig

```ts
interface FlagsConfig {
  /** The flags from `app/flags.ts`. */
  definitions?: FlagDefinitions;
  /** First provider with an answer wins. */
  providers?: FlagsProvider[];
  /** Seconds a resolved snapshot stays fresh in the browser before `refresh()`. Default 300. */
  ttl?: number;
}
```

### FlagsProvider

```ts
interface FlagsProvider {
  name: string;
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

### FlagMap

```ts
type FlagMap = Record<string, FlagValue>;
```

### FlagValue

```ts
type FlagValue = boolean | string | number;
```

### FlagValues

```ts
type FlagValues<D extends FlagDefinitions> = {
  [K in keyof D]: D[K]['default'];
};
```

## kitr/flags/react

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

## kitr/flags/provider

### flagsProvider

```ts
const flagsProvider: import("@kitr/core").KitrProvider;
```

Binds `flags` from `config/flags.ts` (`definitions` from `app/flags.ts`, `providers`). In the
browser a snapshot embedded by `<FlagsScript>` loads before the first render; otherwise
`resolve()` runs at boot. On the server, `resolveFlags(app, event)` answers per request.

## kitr/flags/server

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
  isEnabled(key: keyof D & string): boolean;
  /** Every flag, resolved for `context`. Server: once per request. Client: once per session, then cached. */
  resolve(context?: FlagContext): Promise<FlagValues<D>>;
  /** Load a snapshot the server resolved (what `<FlagsScript>` carries), skipping any resolution. */
  hydrate(values: Partial<FlagValues<D>>): void;
  snapshot(): FlagValues<D>;
  subscribe(listener: () => void): () => void;
  readonly definitions: D;
  readonly resolved: boolean;
}
```

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
