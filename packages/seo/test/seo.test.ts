import { createApp } from '@kitr/core'
import { describe, expect, it } from 'vitest'
import { cacheHeaders, seo, ssrRoute } from '../src'

describe('seo', () => {
  const site = {
    name: 'Kitr',
    url: 'https://kitr.dev',
    image: 'https://kitr.dev/og.png',
    twitter: '@kitr',
    locale: 'en_US',
  }

  it('builds title, description, Open Graph, Twitter and canonical', () => {
    const { meta, links } = seo({
      title: 'Docs',
      description: 'Read me',
      site,
      keywords: ['a', 'b'],
    })
    expect(meta).toContainEqual({ title: 'Docs · Kitr' })
    expect(meta).toContainEqual({ property: 'og:title', content: 'Docs' })
    expect(meta).toContainEqual({ name: 'description', content: 'Read me' })
    expect(meta).toContainEqual({ property: 'og:site_name', content: 'Kitr' })
    expect(meta).toContainEqual({ property: 'og:locale', content: 'en_US' })
    expect(meta).toContainEqual({ property: 'og:image', content: 'https://kitr.dev/og.png' })
    expect(meta).toContainEqual({ name: 'twitter:card', content: 'summary_large_image' })
    expect(meta).toContainEqual({ name: 'twitter:site', content: '@kitr' })
    expect(meta).toContainEqual({ name: 'keywords', content: 'a, b' })
    expect(links).toEqual([{ rel: 'canonical', href: 'https://kitr.dev' }])
  })

  it('does not repeat the site name and falls back to it', () => {
    expect(seo({ title: 'Kitr', site }).meta).toContainEqual({ title: 'Kitr' })
    expect(seo({ site }).meta).toContainEqual({ title: 'Kitr' })
  })

  it('handles the bare minimum and noindex', () => {
    const { meta, links } = seo({ noIndex: true })
    expect(meta).toEqual([
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'robots', content: 'noindex, nofollow' },
    ])
    expect(links).toEqual([])
  })

  it('page values override site defaults', () => {
    const { meta, links } = seo({
      site,
      url: 'https://kitr.dev/x',
      image: '/x.png',
      type: 'article',
    })
    expect(meta).toContainEqual({ property: 'og:type', content: 'article' })
    expect(meta).toContainEqual({ property: 'og:image', content: '/x.png' })
    expect(links).toEqual([{ rel: 'canonical', href: 'https://kitr.dev/x' }])
  })
})

describe('route helpers', () => {
  it('ssrRoute and cacheHeaders', () => {
    expect(ssrRoute('data-only')).toEqual({ ssr: 'data-only' })
    process.env.KITR_PLATFORM = 'www'
    process.env.KITR_PLATFORM_TYPE = 'web'
    try {
      expect(ssrRoute({ www: true, default: false })).toEqual({ ssr: true })
      expect(ssrRoute({ web: 'data-only', default: false })).toEqual({ ssr: 'data-only' })
      expect(ssrRoute({ phone: false, default: true })).toEqual({ ssr: true })
    } finally {
      delete process.env.KITR_PLATFORM
      delete process.env.KITR_PLATFORM_TYPE
    }
    expect(cacheHeaders()).toEqual({ 'cache-control': 'public' })
    expect(
      cacheHeaders({ maxAge: 0, sMaxAge: 60, staleWhileRevalidate: 30, private: true }),
    ).toEqual({
      'cache-control': 'private, max-age=0, s-maxage=60, stale-while-revalidate=30',
    })
  })
})

describe('jsonLd escaping', () => {
  it('cannot be broken out of with user-supplied values, and stays valid JSON', async () => {
    const { jsonLd } = await import('../src')
    const evil = '</script><script>alert(1)</script> & <!--  '
    const script = jsonLd({ '@type': 'Article', headline: evil })
    expect(script.children).not.toMatch(/<|>|&/)
    expect(script.children).not.toContain(' ')
    expect(JSON.parse(script.children).headline).toBe(evil)
    // As it lands in the page: still exactly one closing tag.
    const html = `<script type="${script.type}">${script.children}</script>`
    expect(html.match(/<\/script>/gi)).toHaveLength(1)
  })
})

describe('seo() reads config/seo.ts from the app', () => {
  const app = createApp({ config: { seo: { site: { name: 'Acme', url: 'https://acme.dev' } } } })

  it('uses the site from the app, found through the head argument, and an explicit site wins', () => {
    expect(seo({ title: 'Pricing' }).meta).toContainEqual({ title: 'Pricing' })
    for (const context of [app, { app }, { context: { app } }, { match: { context: { app } } }]) {
      const head = seo({ title: 'Pricing' }, context)
      expect(head.meta).toContainEqual({ title: 'Pricing · Acme' })
      expect(head.links).toEqual([{ rel: 'canonical', href: 'https://acme.dev' }])
    }
    expect(seo({ title: 'Pricing', site: { name: 'Other' } }, app).meta).toContainEqual({
      title: 'Pricing · Other',
    })
  })

  it('derives the canonical URL from the matched path, and title and description from the loader', () => {
    // What TanStack passes to `head`: the match (its pathname and context) and the loader data.
    const ctx = {
      match: { pathname: '/docs/agents', context: { app } },
      loaderData: { title: 'Agents', description: 'Rules for coding agents.', words: 1200 },
    }
    const head = seo({}, ctx)
    expect(head.links).toEqual([{ rel: 'canonical', href: 'https://acme.dev/docs/agents' }])
    expect(head.meta).toContainEqual({
      property: 'og:url',
      content: 'https://acme.dev/docs/agents',
    })
    expect(head.meta).toContainEqual({ title: 'Agents · Acme' })
    expect(head.meta).toContainEqual({ name: 'description', content: 'Rules for coding agents.' })
    // Options passed to seo() win over both.
    const own = seo({ title: 'Guide', url: 'https://acme.dev/guide' }, ctx)
    expect(own.meta).toContainEqual({ title: 'Guide · Acme' })
    expect(own.links).toEqual([{ rel: 'canonical', href: 'https://acme.dev/guide' }])
    // `title: ctx.loaderData?.title` with no loader data yet still falls back, and is no error.
    expect(seo({ title: undefined }, ctx).meta).toContainEqual({ title: 'Agents · Acme' })
  })

  it('keeps each app and request fork to its own site', () => {
    const other = createApp({ config: { seo: { site: { name: 'Other' } } } })
    expect(seo({ title: 'A' }, other).meta).toContainEqual({ title: 'A · Other' })
    expect(seo({ title: 'A' }, app).meta).toContainEqual({ title: 'A · Acme' })
    expect(seo({ title: 'A' }, app.fork()).meta).toContainEqual({ title: 'A · Acme' })
    expect(seo({ title: 'A' }, createApp()).meta).toContainEqual({ title: 'A' })
  })
})
