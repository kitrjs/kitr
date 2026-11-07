---
title: API
description: Every export of kitr/analytics, with its signature.
order: 2
---

# API

Every export of `kitr/analytics`, `kitr/analytics/provider`, `kitr/analytics/react`, read from the published type definitions. The [guide](/packages/analytics) shows them in use.

## kitr/analytics

### consoleAdapter

```ts
function consoleAdapter(options?: {
  prefix?: string;
}): AnalyticsAdapter;
```

Logs every call. The default in development when no other adapter is configured.

### createAnalytics

```ts
function createAnalytics<E extends EventMap = EventMap>(config?: AnalyticsConfig<E>): Analytics<E>;
```

One API over any number of destinations. Calls made before `enable()` queue (up to 100)
so a consent banner can gate everything, and every adapter call is wrapped so a blocked
script never breaks the app.

### defineEvents

```ts
function defineEvents<E extends EventMap>(): <C extends AnalyticsConfig<E>>(config: C) => C & {
  events?: E;
};
```

Identity helper that fixes the event map type: `const analytics = createAnalytics<AppEvents>(...)`.

### googleAnalytics

```ts
function googleAnalytics(options: {
  measurementId: string;
  debug?: boolean;
}): AnalyticsAdapter;
```

Google Analytics 4 through gtag.js. Loads the script on `init()` (client only) and
forwards page views, events and user ids. `sendPageView: false` is set on config so the
router, not the script, decides what a page view is.

### memoryAdapter

```ts
function memoryAdapter(): AnalyticsAdapter & {
  calls: Array<{
    type: string;
    args: unknown[];
  }>;
};
```

Collects calls in memory. For tests: `expect(adapter.calls).toContainEqual(...)`.

### plausible

```ts
function plausible(options: {
  domain: string;
  apiHost?: string;
}): AnalyticsAdapter;
```

Plausible: one script, `page()` becomes a pageview, `track()` a custom event with props.

### posthog

```ts
function posthog(client: PostHogLike, options: {
  apiKey: string;
  apiHost?: string;
  config?: Record<string, unknown>;
}): AnalyticsAdapter;
```

PostHog through its own client (`posthog-js`), with autocapture of page views turned off so the router drives them.

### defineConfig

```ts
const defineConfig: <const C extends AnalyticsConfig<EventMap>>(config: C) => C;
```

### Analytics

```ts
interface Analytics<E extends EventMap = EventMap> {
  page(path: string, props?: EventProps & {
    url?: string;
    title?: string;
  }): void;
  track<K extends keyof E & string>(event: K, ...props: E[K] extends undefined ? [
  ] : [
    E[K]
  ]): void;
  track(event: string, props?: EventProps): void;
  identify(userId: string, traits?: EventProps): void;
  reset(): void;
  /** Flush the queue and start sending. Call after consent. */
  enable(): Promise<void>;
  /** Stop sending; calls are dropped (not queued) once disabled after being enabled. */
  disable(): void;
  readonly enabled: boolean;
  /** Add an adapter at runtime (after a consent choice, or lazily). */
  use(adapter: AnalyticsAdapter): void;
  readonly adapters: readonly AnalyticsAdapter[];
}
```

### AnalyticsAdapter

```ts
interface AnalyticsAdapter {
  name: string;
  /** Load scripts, create clients. Called once on the client when tracking is enabled. */
  init?(): void | Promise<void>;
  page(path: string, props?: EventProps & {
    url?: string;
    title?: string;
  }): void;
  track(event: string, props?: EventProps): void;
  identify?(userId: string, traits?: EventProps): void;
  reset?(): void;
}
```

What every destination implements. Methods are best-effort and must never throw into app code.

### AnalyticsConfig

```ts
interface AnalyticsConfig<E extends EventMap = EventMap> {
  adapters?: AnalyticsAdapter[];
  /** Start sending immediately (default). Set false to queue until `analytics.enable()` (consent banners). */
  enabled?: boolean;
  /** Track route changes automatically through the router. Default true. */
  pageViews?: boolean;
  /** Props merged into every event (app version, build id). */
  globalProps?: EventProps;
  /** Log every call. Default: `app.environment` is development. */
  debug?: boolean;
  /** Phantom for `defineEvents`. */
  readonly events?: E;
}
```

### PostHogLike

```ts
interface PostHogLike {
  init(token: string, config?: Record<string, unknown>): unknown;
  capture(event: string, properties?: Record<string, unknown> | null): unknown;
  identify(id?: string, properties?: Record<string, unknown>): void;
  reset(): void;
}
```

Minimal shape of the posthog-js client; pass `posthog` from `posthog-js` or any compatible object.

### EventMap

```ts
type EventMap = Record<string, EventProps | undefined>;
```

`defineEvents<{ 'project.created': { id: string } }>()` gives `track()` typed names and props.

### EventProps

```ts
type EventProps = Record<string, unknown>;
```

## kitr/analytics/provider

### analyticsProvider

```ts
const analyticsProvider: import("@kitr/core").KitrProvider;
```

Binds `analytics` into the container from `config/analytics.ts` and, on the client,
tracks route changes. With no adapters configured, development logs to the console
and production sends nothing.

## kitr/analytics/react

### TrackPageViews

```ts
function TrackPageViews(): null;
```

Sends a `page()` on every resolved navigation. Mounted by the provider when
`pageViews` is not false; render it yourself if you build the tree by hand.

### useAnalytics

```ts
function useAnalytics<E extends EventMap = EventMap>(): Analytics<E>;
```

The analytics instance from the container.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
