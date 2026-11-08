import {
  type BuildPlatformKey,
  createDefineConfig,
  forBuildPlatform,
  type KitrApp,
} from '@kitr/core'

/** Site-wide values for `seo()` and the build: name, canonical origin, default image, handle and locale. */
export interface SeoSite {
  /** Appended to page titles (`Pricing · Acme`) and sent as `og:site_name`. */
  name?: string
  /** Canonical origin (`https://example.com`). Turns on the sitemap for prerendered routes. */
  url?: string
  /** Share image for pages that set none. Use an absolute URL. */
  image?: string
  /** The site's X (Twitter) handle, sent as `twitter:site`. */
  twitter?: string
  /** Sent as `og:locale`, such as `en_US`. */
  locale?: string
}

/** Options for `config/seo.ts`. The build reads `prerender`, `site.url` and `robots`; `seo()` reads `site`; the router reads `ssr`. */
export interface SeoConfig {
  /** Site-wide defaults for `seo()`. */
  site?: SeoSite
  /** Default rendering for routes that set no `ssr` of their own (the router's `defaultSsr`). `ssrRoute()` overrides it per route. */
  ssr?: boolean | 'data-only'
  /** Routes to prerender at build time; `crawlLinks` follows links from them. A `static` web platform prerenders everything. */
  prerender?: string[] | { routes: string[]; crawlLinks?: boolean }
  /** Rules for `robotsTxt()`, which the build writes to `robots.txt` unless `public/robots.txt` exists. `false` writes none. */
  robots?: false | { allow?: string[]; disallow?: string[]; sitemap?: boolean }
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    seo: SeoConfig
  }
}

/**
 * Types the default export of `config/seo.ts`. The config lives on the app (`app.config.get('seo')`,
 * set from the `config` that `app/app.ts` passes to `createApp`), not in this module, so two apps
 * in one process keep their own site defaults and `seo()` reads them from the app it is given.
 */
export const defineConfig = createDefineConfig<SeoConfig>()

/** What one page passes to `seo()`. Every field is optional; `site` supplies the defaults. */
export interface SeoInput {
  /** The page title, without the site name. */
  title?: string
  /** The page summary for search results and share cards. */
  description?: string
  /** Share image for this page; replaces `site.image`. Use an absolute URL. */
  image?: string
  /** The page's canonical URL; falls back to `site.url`, so pass it on every page. */
  url?: string
  /** `og:type`. Default `website`. */
  type?: 'website' | 'article' | 'product'
  /** Adds `robots: noindex, nofollow`. */
  noIndex?: boolean
  /** Joined into a `keywords` meta tag. */
  keywords?: string[]
  /** Site defaults. Default: `site` from the app's `config/seo.ts`, found through the context passed as `seo`'s second argument. */
  site?: SeoSite
}

/**
 * Where `seo()` finds the app for the site defaults: the argument of a route's `head` (its
 * `match.context.app`, which `createKitrRouter` puts in every route's context), a loader or
 * `beforeLoad` context, or the app itself.
 */
export type SeoContext = object

function appOf(context: SeoContext | undefined): KitrApp | undefined {
  const isApp = (value: unknown): value is KitrApp =>
    !!value && typeof value === 'object' && 'config' in value && 'container' in value
  const candidates = (value: unknown): unknown[] => {
    const v = value as
      | { app?: unknown; context?: unknown; match?: { context?: unknown } }
      | undefined
    return [
      value,
      v?.app,
      (v?.context as { app?: unknown } | undefined)?.app,
      (v?.match?.context as { app?: unknown } | undefined)?.app,
    ]
  }
  return candidates(context).find(isApp)
}

/**
 * Meta tags for a route's `head()`: `head: (ctx) => seo({ title, description }, ctx)`.
 * Covers title, description, Open Graph, Twitter cards, canonical and robots. Pass the `head`
 * argument (or the app) as the second argument so the site name, image and origin from
 * `config/seo.ts` apply; without it only `input.site` does.
 */
export function seo(input: SeoInput, context?: SeoContext) {
  const configured = appOf(context)?.config.get('seo', {}) as SeoConfig | undefined
  const site = input.site ?? configured?.site ?? {}
  const title = input.title
    ? site.name && input.title !== site.name
      ? `${input.title} · ${site.name}`
      : input.title
    : site.name
  const image = input.image ?? site.image
  const url = input.url ?? site.url
  const meta: Array<Record<string, string>> = []
  if (title)
    meta.push(
      { title },
      { property: 'og:title', content: input.title ?? title },
      { name: 'twitter:title', content: input.title ?? title },
    )
  if (input.description) {
    meta.push(
      { name: 'description', content: input.description },
      { property: 'og:description', content: input.description },
      { name: 'twitter:description', content: input.description },
    )
  }
  meta.push({ property: 'og:type', content: input.type ?? 'website' })
  if (site.name) meta.push({ property: 'og:site_name', content: site.name })
  if (site.locale) meta.push({ property: 'og:locale', content: site.locale })
  if (url) meta.push({ property: 'og:url', content: url })
  if (image)
    meta.push(
      { property: 'og:image', content: image },
      { name: 'twitter:image', content: image },
      { name: 'twitter:card', content: 'summary_large_image' },
    )
  else meta.push({ name: 'twitter:card', content: 'summary' })
  if (site.twitter) meta.push({ name: 'twitter:site', content: site.twitter })
  if (input.keywords?.length) meta.push({ name: 'keywords', content: input.keywords.join(', ') })
  if (input.noIndex) meta.push({ name: 'robots', content: 'noindex, nofollow' })
  const links: Array<Record<string, string>> = url ? [{ rel: 'canonical', href: url }] : []
  return { meta, links }
}

/** A JSON-LD script for `head().scripts`: `scripts: [jsonLd({ '@type': 'Article', headline })]`. */
export function jsonLd(data: Record<string, unknown> & { '@type': string }) {
  return {
    type: 'application/ld+json',
    children: safeJson({ '@context': 'https://schema.org', ...data }),
  }
}

/**
 * JSON for inside a `<script>`: `<`, `>` and `&` as unicode escapes so a value such as
 * `</script><script>…` from a user's title can't close the tag, and U+2028/U+2029 escaped too.
 * Still valid JSON: parsers read the escapes back as the same characters.
 */
export function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export type SsrMode = boolean | 'data-only'

/**
 * Route option presets. Spread into `createFileRoute(...)({ ...ssrRoute('data-only'), ... })`.
 * A table picks the mode per platform at build time, by platform name from kitrrc.ts, then type,
 * then `default`: `ssrRoute({ www: true, web: 'data-only', default: false })` renders the marketing
 * build on the server, other web builds data-only, and native shells on the client.
 */
export function ssrRoute(
  mode: SsrMode | (Partial<Record<BuildPlatformKey, SsrMode>> & { default: SsrMode }),
): { ssr: SsrMode } {
  if (typeof mode === 'object') return { ssr: forBuildPlatform(mode) }
  return { ssr: mode }
}

/**
 * A `cache-control` header for TanStack Start's `headers` route option:
 * `headers: () => cacheHeaders({ sMaxAge: 60 })`. Public unless `private` is set.
 */
export function cacheHeaders(
  options: {
    maxAge?: number
    sMaxAge?: number
    staleWhileRevalidate?: number
    private?: boolean
  } = {},
) {
  const parts = [options.private ? 'private' : 'public']
  if (options.maxAge !== undefined) parts.push(`max-age=${options.maxAge}`)
  if (options.sMaxAge !== undefined) parts.push(`s-maxage=${options.sMaxAge}`)
  if (options.staleWhileRevalidate !== undefined)
    parts.push(`stale-while-revalidate=${options.staleWhileRevalidate}`)
  return { 'cache-control': parts.join(', ') }
}

/** `robots.txt` text from the config, or null when `robots` is false. The build writes it for web platforms. */
export function robotsTxt(config: SeoConfig): string | null {
  if (config.robots === false) return null
  const rules = config.robots ?? {}
  const lines = ['User-agent: *']
  for (const p of rules.allow ?? ['/']) lines.push(`Allow: ${p}`)
  for (const p of rules.disallow ?? []) lines.push(`Disallow: ${p}`)
  if ((rules.sitemap ?? true) && config.site?.url)
    lines.push('', `Sitemap: ${config.site.url.replace(/\/$/, '')}/sitemap.xml`)
  return `${lines.join('\n')}\n`
}
