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
    expect(cacheHeaders()).toEqual({ 'cache-control': 'public' })
    expect(
      cacheHeaders({ maxAge: 0, sMaxAge: 60, staleWhileRevalidate: 30, private: true }),
    ).toEqual({
      'cache-control': 'private, max-age=0, s-maxage=60, stale-while-revalidate=30',
    })
  })
})
