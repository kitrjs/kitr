export type EventProps = Record<string, unknown>

/** What every destination implements. Methods are best-effort and must never throw into app code. */
export interface AnalyticsAdapter {
  name: string
  /** Load scripts, create clients. Called once on the client when tracking is enabled. */
  init?(): void | Promise<void>
  page(path: string, props?: EventProps & { url?: string; title?: string }): void
  track(event: string, props?: EventProps): void
  identify?(userId: string, traits?: EventProps): void
  reset?(): void
}

/** `defineEvents<{ 'project.created': { id: string } }>()` gives `track()` typed names and props. */
export type EventMap = Record<string, EventProps | undefined>

export interface AnalyticsConfig<E extends EventMap = EventMap> {
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
