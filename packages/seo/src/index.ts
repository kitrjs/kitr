import { createDefineConfig } from '@kitr/core'

export interface SeoSite {
  name?: string
  /** Canonical origin (`https://example.com`). Turns on the sitemap for prerendered routes. */
  url?: string
  image?: string
  twitter?: string
  locale?: string
}

export interface SeoConfig {
  /** Site-wide defaults for `seo()`. */
  site?: SeoSite
  /** Default per-route rendering for a web platform in `ssr` mode: true (full SSR), 'data-only' or false. */
  ssr?: boolean | 'data-only'
  /** Routes to prerender at build time; `crawlLinks` follows links from them. A `static` web platform prerenders everything. */
  prerender?: string[] | { routes: string[]; crawlLinks?: boolean }
  /** `robots.txt` rules written on build. `false` disables. */
  robots?: false | { allow?: string[]; disallow?: string[]; sitemap?: boolean }
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    seo: SeoConfig
  }
}

export const defineConfig = createDefineConfig<SeoConfig>()

export interface SeoInput {
  title?: string
  description?: string
  image?: string
  url?: string
  type?: 'website' | 'article' | 'product'
  noIndex?: boolean
  keywords?: string[]
  site?: SeoSite
}

/**
 * Meta tags for a route's `head()`: `head: () => seo({ title, description })`.
 * Covers title, description, Open Graph, Twitter cards, canonical and robots.
 */
export function seo(input: SeoInput) {
  const site = input.site ?? {}
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
    children: JSON.stringify({ '@context': 'https://schema.org', ...data }),
  }
}

/** Route option presets. Spread into `createFileRoute(...)({ ...ssrRoute('data-only'), ... })`. */
export function ssrRoute(mode: boolean | 'data-only') {
  return { ssr: mode } as const
}

/** Cache-Control helper for Start's `headers` route option. */
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

/** `robots.txt` text from the config; the web platform writes it on build. */
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
