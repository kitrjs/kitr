import { createDefineConfig } from '@kitr/core'

export interface SsrConfig {
  /** Default per-route rendering: true (full SSR), 'data-only' (loaders on server, render on client) or false. */
  ssr?: boolean | 'data-only'
  /** Paths to prerender at build time (passed to TanStack Start's `prerender`). */
  prerender?: string[] | { routes: string[]; crawlLinks?: boolean }
  /** Site-wide defaults for `seo()`. */
  site?: { name?: string; url?: string; image?: string; twitter?: string; locale?: string }
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    ssr: SsrConfig
  }
}

export const defineConfig = createDefineConfig<SsrConfig>()

export interface SeoInput {
  title?: string
  description?: string
  image?: string
  url?: string
  type?: 'website' | 'article' | 'product'
  noIndex?: boolean
  keywords?: string[]
  site?: SsrConfig['site']
}

/**
 * Meta tags for a route's `head()`: `head: () => seo({ title, description })`.
 * Covers title, description, Open Graph, Twitter cards and robots.
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
