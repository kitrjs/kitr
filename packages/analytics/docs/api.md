---
title: API reference
description: Every export of @kitr/analytics, with its signature.
order: 2
---

# API reference

Every export of `@kitr/analytics`, `@kitr/analytics/provider`, `@kitr/analytics/react`, read from the published type definitions. The [guide](/packages/analytics/guide) shows them in use.

## @kitr/analytics

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
  ads?: boolean;
}): AnalyticsAdapter;
```

Google Analytics 4 through gtag.js. Loads the script on `init()` (client only), which runs once
tracking is enabled (after consent with `@kitr/consent`), and forwards page views, events and
user ids. `send_page_view: false` is set on config so the router, not the script, decides what
a page view is.

Consent Mode v2 is set before the first config: `analytics_storage` is granted, because the
adapter only starts once the visitor agreed to analytics, and the three ad signals stay denied
unless `ads: true`.

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

Types the default export of `config/analytics.ts`: adapters, consent queueing, page views and global props.

### Analytics

```ts
interface Analytics<E extends EventMap = EventMap> {
  /** Record a page view. The provider calls it on every route change unless `pageViews` is false. */
  page(path: string, props?: EventProps & {
    url?: string;
    title?: string;
  }): void;
  /**
   * Record an event. With an event map (`useAnalytics<AppEvents>()`), only its names are accepted,
   * each with its own props; without one, any name and props.
   */
  track: Track<E>;
  /** Attach later events to a user id, after sign-in. `globalProps` are not added. */
  identify(userId: string, traits?: EventProps): void;
  /** Forget the identified user, on sign-out. */
  reset(): void;
  /** Load each adapter's script, then send the queued calls and start sending. Call after consent. */
  enable(): Promise<void>;
  /** Stop sending and empty the queue. Later calls queue again (up to 100) until the next `enable()`. */
  disable(): void;
  /** True once `enable()` has finished and until `disable()`. */
  readonly enabled: boolean;
  /** Add an adapter at runtime (after a consent choice, or lazily). */
  use(adapter: AnalyticsAdapter): void;
  /** Every adapter in use, in the order calls reach them. */
  readonly adapters: readonly AnalyticsAdapter[];
}
```

The analytics service bound as `analytics` in the container and returned by `useAnalytics()`.
Every call goes to each adapter, or waits in a queue until `enable()`.

### AnalyticsAdapter

```ts
interface AnalyticsAdapter {
  /** Shown in devtools and in debug warnings, such as `google-analytics` or `plausible`. */
  name: string;
  /** Load scripts, create clients. Called once on the client when tracking is enabled. */
  init?(): void | Promise<void>;
  /** Record a page view for `path`; `props.url` and `props.title` carry the full URL and document title. */
  page(path: string, props?: EventProps & {
    url?: string;
    title?: string;
  }): void;
  /** Record a named event with its props. */
  track(event: string, props?: EventProps): void;
  /** Attach later events to a user id. Optional; services without user profiles leave it out. */
  identify?(userId: string, traits?: EventProps): void;
  /** Forget the identified user, on sign-out. Optional. */
  reset?(): void;
}
```

What every destination implements. Methods are best-effort and must never throw into app code.

### AnalyticsConfig

```ts
interface AnalyticsConfig<E extends EventMap = EventMap> {
  /** Where calls go. Empty in the provider means the console in development and nothing in production. */
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

Options for `config/analytics.ts` and `createAnalytics()`. `E` is the app's event map.

### PostHogLike

```ts
interface PostHogLike {
  /** Start the client with a project API key and options. */
  init(token: string, config?: Record<string, unknown>): unknown;
  /** Send one event, `$pageview` included. */
  capture(event: string, properties?: Record<string, unknown> | null): unknown;
  /** Attach later events to a user id. */
  identify(id?: string, properties?: Record<string, unknown>): void;
  /** Forget the identified user. */
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

Props sent with an event, a page view or an identify call. Adapters pass them to the vendor as they are.

### Track

```ts
type Track<E extends EventMap> = string extends keyof E ? (event: string, props?: EventProps) => void : <K extends keyof E & string>(event: K, ...props: E[K] extends undefined ? [
] : [
  E[K]
]) => void;
```

`track()`'s signature: checked against the event map when there is one.

## @kitr/analytics/provider

### analyticsProvider

```ts
const analyticsProvider: import("@kitr/core").KitrProvider;
```

Binds `analytics` into the container from `config/analytics.ts` and, on the client,
tracks route changes. With no adapters configured, development logs to the console
and production sends nothing.

## @kitr/analytics/react

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
