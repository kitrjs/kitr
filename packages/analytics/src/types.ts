/** Props sent with an event, a page view or an identify call. Adapters pass them to the vendor as they are. */
export type EventProps = Record<string, unknown>

/** What every destination implements. Methods are best-effort and must never throw into app code. */
export interface AnalyticsAdapter {
  /** Shown in devtools and in debug warnings, such as `google-analytics` or `plausible`. */
  name: string
  /** Load scripts, create clients. Called once on the client when tracking is enabled. */
  init?(): void | Promise<void>
  /** Record a page view for `path`; `props.url` and `props.title` carry the full URL and document title. */
  page(path: string, props?: EventProps & { url?: string; title?: string }): void
  /** Record a named event with its props. */
  track(event: string, props?: EventProps): void
  /** Attach later events to a user id. Optional; services without user profiles leave it out. */
  identify?(userId: string, traits?: EventProps): void
  /** Forget the identified user, on sign-out. Optional. */
  reset?(): void
}

/** `defineEvents<{ 'project.created': { id: string } }>()` gives `track()` typed names and props. */
export type EventMap = Record<string, EventProps | undefined>

/** Options for `config/analytics.ts` and `createAnalytics()`. `E` is the app's event map. */
export interface AnalyticsConfig<E extends EventMap = EventMap> {
  /** Where calls go. Empty in the provider means the console in development and nothing in production. */
  adapters?: AnalyticsAdapter[]
  /** Start sending immediately (default). Set false to queue until `analytics.enable()` (consent banners). */
  enabled?: boolean
  /** Track route changes automatically through the router. Default true. */
  pageViews?: boolean
  /** Props merged into every event (app version, build id). */
  globalProps?: EventProps
  /** Log every call. Default: `app.environment` is development. */
  debug?: boolean
  /** Phantom for `defineEvents`. */
  readonly events?: E
}
