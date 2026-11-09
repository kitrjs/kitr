---
title: SEO
description: Give every page a title, a share preview and a sitemap entry so search engines and chat apps show it well.
order: 1
---

# SEO

Paste a link into Slack or search for your product, and what people see comes from a few tags: title, description, share image. `@kitr/seo` writes them from one call, `seo({ title, description })`, adds structured data, and tells the build which pages to prerender. It builds on [TanStack Router's `head`](https://tanstack.com/router/latest/docs/framework/react/guide/document-head-management) and [TanStack Start's prerendering](https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering).

> [!SUMMARY]
> Gives every page a title, a share preview and a sitemap entry so search engines and chat apps show it well. Add it with `kitr add seo`; the overview is at [/packages/seo](/packages/seo).

The helpers are plain functions that the server renders into HTML and the client keeps up to date. The examples follow Acme's marketing site at `acme.com`.

> [!WARNING] Needs ssr or static mode
> Tags only help when the HTML reaches crawlers. In an `spa` app, crawlers and link previews see the same empty shell for every URL.

## Install

```sh
kitr add seo
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add` does:

- Installs `@kitr/seo`.
- Adds `'@kitr/seo'` to `packages` in `kitrrc.ts`. It registers no provider, so nothing runs at startup.
- Writes `config/seo.ts` (shown in [Configure](#configure)) and regenerates `config/index.ts`.
- Adds a `## kitr: seo` section to `AGENTS.md` telling coding agents to set `head: (ctx) => seo({ title, description }, ctx)` on routes, to add structured data with `jsonLd()`, and to use `ssrRoute()` and `cacheHeaders()` for rendering and CDN caching.

It asks no questions and adds no env variables. The `fullstack`, `saas`, `site` and `realtime` kits include seo; the `site` kit writes its own `config/seo.ts`. In a server-only project `kitr add seo` prints a warning and skips it.

`kitr remove seo` removes the `packages` entry, the dependency and the `AGENTS.md` section, and deletes `config/seo.ts`. It leaves the `seo()` calls in your routes.

</details>

To edit `package.json` without running the package manager, pass `--no-install`:

```sh
kitr add seo --no-install
```

## Configure

`kitr add seo` writes this file, with `name` set to the `name` in your `package.json` (here `acme-site`):

```ts
// config/seo.ts
import { defineConfig } from '@kitr/seo'

export default defineConfig({
  site: { name: 'acme-site' },
  // Routes prerendered at build time by a web platform in ssr mode; a static web platform prerenders everything.
  prerender: [],
})
```

Fill in the rest of `site` before you launch:

```ts
// config/seo.ts
import { defineConfig } from '@kitr/seo'

export default defineConfig({
  site: {
    name: 'Acme',
    url: 'https://acme.com',
    image: 'https://acme.com/og/default.png',
    twitter: '@acme',
    locale: 'en_US',
  },
  prerender: { routes: ['/', '/pricing', '/blog'], crawlLinks: true },
  robots: { disallow: ['/api'] },
})
```

| Option | Default | Description |
| --- | --- | --- |
| `site.name` | none | Appended to page titles (`Pricing · Acme`) and sent as `og:site_name`. Also the title of a page that sets none. |
| `site.url` | none | The site's address, `https://acme.com`. Turns on the [sitemap](#generate-a-sitemap). |
| `site.image` | none | The share image for pages that set none. Use an absolute URL. |
| `site.twitter` | none | The site's X (Twitter) handle, sent as `twitter:site`. |
| `site.locale` | none | Sent as `og:locale`, such as `en_US`. |
| `prerender` | `[]` | Routes the build renders to HTML files. An array of paths, or `{ routes, crawlLinks }`. |
| `prerender.routes` | `[]` | The paths to prerender, such as `['/', '/pricing']`. |
| `prerender.crawlLinks` | `false` | Also prerender every page linked from those routes. |
| `prerender.failOnError` | `false` | Fail the build when a crawled page fails to render, not only a listed one. |
| `robots` | `{}` | Rules for the `robots.txt` the build writes (see [Write robots.txt](#write-robotstxt)). `false` writes none. |
| `robots.allow` | `['/']` | `Allow:` lines. |
| `robots.disallow` | `[]` | `Disallow:` lines. |
| `robots.sitemap` | `true` | Add `Sitemap: <site.url>/sitemap.xml` when `site.url` is set. |
| `ssr` | `true` | How routes without their own `ssr` render: `true`, `'data-only'` or `false`. [`ssrRoute()`](#choose-how-a-route-renders) on a route overrides it. |

> [!WARNING] Write them as literals
> The build reads `prerender` and `site.url` from the file's source text without running it, so a value from an env variable or another file is not seen.

`seo()` uses `site` as its defaults, finding the app through the `ctx` you pass it.

## Give a page its title

Set `head` on a route and return `seo()` from it, passing the `head` argument as the second argument so it can find the app's site defaults:

```ts
// app/routes.ts
import { seo } from '@kitr/seo'

r.page('/pricing', {
  head: (ctx) => seo({ title: 'Pricing', description: 'Plans for every team size.' }, ctx),
  lazy: () => import('./pages/pricing'),
})
```

```tsx
// app/pages/pricing.tsx
export default function PricingPage() {
  return <h1>Pricing</h1>
}
```

View the page source of `/pricing`. The root route's `<HeadContent />` renders the tags into `<head>`:

```html
<title>Pricing</title>
<meta property="og:title" content="Pricing">
<meta name="twitter:title" content="Pricing">
<meta name="description" content="Plans for every team size.">
<meta property="og:description" content="Plans for every team size.">
<meta name="twitter:description" content="Plans for every team size.">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary">
```

`seo()` returns `{ meta, links }`, the shape TanStack Router's `head` expects; the router swaps the tags on navigation.

## Use your site defaults on every page

`seo()` takes the site name, share image, handle and locale from `site`, so every title gets the site name once you pass `ctx`. It also builds the page's URL from `site.url` and the matched path in `ctx`, so a page needs only its title and description:

```ts
// app/routes.ts
import { seo } from '@kitr/seo'

r.page('/pricing', {
  head: (ctx) => seo({ title: 'Pricing', description: 'Plans for every team size.' }, ctx),
  lazy: () => import('./pages/pricing'),
})
// => canonical and og:url: https://acme.com/pricing
```

With the config from [Configure](#configure), the title becomes `Pricing · Acme`, and `og:site_name`, `og:locale`, `og:url`, `og:image`, `twitter:site` and a canonical link are filled in. A `site` passed to `seo()` replaces the config's, for a page that belongs to another brand. How the values combine:

| Tag | Comes from |
| --- | --- |
| `<title>` | `title · site.name`; `title` alone when it equals `site.name`; `site.name` when there is no `title`. |
| `title`, `description` | The options, else `title` and `description` from the loader's data. |
| `og:title`, `twitter:title` | `title` without the site name. |
| `description`, `og:description`, `twitter:description` | `description`, only when set. |
| `og:url`, canonical link | `url`, else `site.url` plus the matched path from `ctx`, else `site.url`. |
| `og:image`, `twitter:image` | `image`, else `site.image`. |
| `twitter:card` | `summary_large_image` when there is an image, else `summary`. |
| `og:type` | `type`, default `'website'`. |

> [!WARNING] Pass ctx on every page
> Without `ctx` (or `url`), `og:url` and the canonical link fall back to `site.url`, so the page tells search engines it is a copy of your home page and they may drop it.

When the loader returns `title` and `description`, `seo()` reads them from `ctx.loaderData`, so a page with data needs no options at all:

```ts
// app/routes.ts
import { seo } from '@kitr/seo'
import { getDoc } from '#app/content/docs'

r.page('/docs/$slug', {
  loader: ({ params }) => getDoc(params.slug), // => { title: 'Agents', description: '...', html: '...' }
  head: (ctx) => seo({}, ctx),
  lazy: () => import('./pages/docs/slug'),
})
// => <title>Agents · Acme</title>, canonical https://acme.com/docs/agents
```

Options you pass win over the loader's values and over the derived URL.

## Set defaults in the root route

Tags from the root route apply to every page; a child route's `<title>` and tags with the same `name` or `property` replace the root's. Put the site-wide description in the root:

```tsx
// app/document.tsx
import { HeadContent, Outlet, Scripts } from '@kitr/router'
import { seo } from '@kitr/seo'

/** `app/routes.ts` passes this to `.root({ head, component: RootDocument })`. */
export function head(ctx: object) {
  return {
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ...seo({ description: 'Acme keeps your team’s projects, orders and invoices in one place.' }, ctx).meta,
    ],
  }
}

export function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
```

> [!WARNING] Spread only .meta in the root
> TanStack Router merges `links` from every matched route without removing duplicates, so a canonical link in the root plus the page's gives two canonical URLs.

## Add a share image

Chat apps show `og:image` as a large card. Pass an absolute URL, since most crawlers do not resolve a relative path:

```ts
// app/routes.ts
import { seo } from '@kitr/seo'

r.page('/pricing', {
  head: (ctx) =>
    seo(
      {
        title: 'Pricing',
        description: 'Plans for every team size.',
        url: 'https://acme.com/pricing',
        image: 'https://acme.com/og/pricing.png',
      },
      ctx,
    ),
  lazy: () => import('./pages/pricing'),
})
```

```tsx
// app/pages/pricing.tsx
export default () => <h1>Pricing</h1>
```

A 1200 × 630 PNG or JPEG works everywhere. Check the result with a preview tool such as [opengraph.xyz](https://www.opengraph.xyz) after you deploy.

## Describe an article

For a blog post, build the tags from the loader's data and set `type: 'article'`:

```ts
// app/routes.ts
import { notFound } from '@kitr/router'
import { getPost } from '#app/content/posts'
import { seo } from '@kitr/seo'

r.page('/blog/$slug', {
  loader: ({ params }) => {
    const post = getPost(params.slug)
    if (!post) throw notFound()
    return post
  },
  head: (ctx) =>
    seo(
      {
        description: ctx.loaderData?.excerpt,
        type: 'article',
        keywords: ctx.loaderData?.tags,
      },
      ctx,
    ),
  lazy: () => import('./pages/blog/slug'),
})
```

```tsx
// app/pages/blog/slug.tsx
import { getRouteApi } from '@kitr/router'

const route = getRouteApi('/blog/$slug')

export default function PostPage() {
  const post = route.useLoaderData()
  return <h1>{post.title}</h1>
}
```

The title comes from the post's `title` and the URL from the path. `head` runs after the loader, on the server for the first request and on the client after each navigation. Search engines ignore `keywords`; it only helps your own site search.

## Keep a page out of search results

Sign-in pages, drafts and anything behind a login should stay out of search. Pass `noIndex: true`:

```ts
// app/routes.ts
import { seo } from '@kitr/seo'

r.page('/sign-in', {
  head: (ctx) => seo({ title: 'Sign in', url: 'https://acme.com/sign-in', noIndex: true }, ctx),
  lazy: () => import('./pages/sign-in'),
})
```

```tsx
// app/pages/sign-in.tsx
export default () => <h1>Sign in to Acme</h1>
```

To keep a whole area out, such as `/app`, set `noIndex` in its layout route's `head`.

> [!WARNING] Don't also block it in robots.txt
> Crawlers must load the page to see the `noindex` tag.

## Add structured data

Structured data tells search engines what a page is about. `jsonLd()` turns a [schema.org](https://schema.org) object into a `<script type="application/ld+json">` for `head().scripts`, and adds `@context`:

```ts
// app/routes.ts
import { jsonLd, seo } from '@kitr/seo'

r.page('/', {
  head: (ctx) => ({
    ...seo({ title: 'Acme', url: 'https://acme.com' }, ctx),
    scripts: [
      jsonLd({
        '@type': 'Organization',
        name: 'Acme',
        url: 'https://acme.com',
        logo: 'https://acme.com/logo.png',
      }),
    ],
  }),
  lazy: () => import('./pages/index'),
})
```

```tsx
// app/pages/index.tsx
export default () => <h1>Acme</h1>
```

Test the page with Google's [Rich Results Test](https://search.google.com/test/rich-results). `jsonLd()` escapes the JSON for a `<script>` tag (`<`, `>`, `&` and the line separators), so values from users are safe to pass. The same escaping is exported as `safeJson(value)` for your own inline scripts:

```ts
import { safeJson } from '@kitr/seo'

safeJson({ headline: 'Q3 </script> report' })
// => {"headline":"Q3 \u003c/script\u003e report"} (the string's characters)
```

## Prerender pages at build time

Pages that are the same for every visitor can be built once into HTML files and served from a CDN. List them in `prerender`:

```ts
// config/seo.ts
import { defineConfig } from '@kitr/seo'

export default defineConfig({
  site: { name: 'Acme', url: 'https://acme.com' },
  prerender: { routes: ['/', '/pricing', '/blog'], crawlLinks: true },
})
```

Then build the web platform:

```sh
kitr build site
```

Each route renders to `index.html` in its own folder (`/pricing/index.html`). With `crawlLinks: true` it also follows every link on those pages, so each blog post linked from `/blog` is prerendered too. Other pages keep rendering per request.

What the build does with `prerender` in each web mode:

| Web mode | Effect |
| --- | --- |
| `ssr` | Prerenders the listed routes (and the pages they link to, with `crawlLinks`). Everything else renders on the server. |
| `static` | Prerenders every page, starting from `/` and following links. |
| `spa` | Ignored. The build writes one HTML shell. |

> [!WARNING] No computed lists
> `prerender: posts.map(...)` is not seen. Write each path as a string, or list a page that links to all of them with `crawlLinks: true`.

A page that fails to render prints one line and stays out of the sitemap. A listed route fails the build; a crawled link only warns, unless `failOnError: true`:

```sh
kitr build site
# [prerender] 404 at /blog/draft, linked from /blog
```

## Generate a sitemap

Set `site.url` to a string literal, as in the config above, and the build turns on [TanStack Start's sitemap](https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering) with that host. It writes `sitemap.xml` from the pages it prerenders, so prerender (or crawl to) every page you want listed. `robotsTxt()` points crawlers at `<site.url>/sitemap.xml`.

> [!WARNING] Quoted string only
> `url: process.env.SITE_URL` does not turn the sitemap on: the build matches the source text.

## Write robots.txt

`robotsTxt(config)` returns the text of a `robots.txt` built from `robots` and `site.url`:

```ts
import { robotsTxt } from '@kitr/seo'

robotsTxt({ site: { url: 'https://acme.com' }, robots: { disallow: ['/app', '/api'] } })
// => 'User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /api\n\nSitemap: https://acme.com/sitemap.xml\n'
```

The web build writes this text to `robots.txt` from `config/seo.ts`. It writes nothing when `robots` is `false`, and leaves your own `public/robots.txt` alone.

## Choose how a route renders

In `ssr` mode every route renders on the server by default, or as `ssr` in `config/seo.ts` says. Spread `ssrRoute()` into a route to change it for that route:

```ts
// app/routes.ts
import { ssrRoute } from '@kitr/seo'

app.page('/reports', {
  ...ssrRoute('data-only'),
  loader: async () => {
    const response = await fetch('https://app.acme.com/api/reports/invoices')
    return (await response.json()) as Array<{ month: string; total: number }>
  },
  lazy: () => import('./pages/reports'),
})
```

```tsx
// app/pages/reports.tsx
import { getRouteApi } from '@kitr/router'

const route = getRouteApi('/_app/reports')

export default function ReportsPage() {
  const rows = route.useLoaderData()
  return <p>{rows.length} months of invoices</p>
}
```

| Call | Returns | The route |
| --- | --- | --- |
| `ssrRoute(true)` | `{ ssr: true }` | Renders on the server. The default unless `config/seo.ts` sets `ssr`. |
| `ssrRoute('data-only')` | `{ ssr: 'data-only' }` | Runs the loader on the server, renders in the browser. For heavy charts that crawlers don't need. |
| `ssrRoute(false)` | `{ ssr: false }` | Loads and renders in the browser only. For pages that need `window`. |

> [!WARNING] Crawlers need ssr: true
> A route that does not render on the server sends no page content to crawlers. See TanStack Start's [selective SSR](https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr) for how it combines with parent routes.

When one route table serves several platforms, the mode can differ per platform, resolved at build time by platform name, then type, then `default`:

```ts
// app/routes.ts
import { ssrRoute } from '@kitr/seo'

r.page('/', {
  // The marketing build renders on the server for crawlers; the authed web app runs the loader
  // on the server and renders in the browser; native shells have no server at all.
  ...ssrRoute({ www: true, web: 'data-only', default: false }),
  lazy: () => import('./pages/home'),
})
```

The value is a constant in each bundle, so there is no run-time check.

## Cache pages at the CDN

`cacheHeaders()` builds a `cache-control` header for TanStack Start's `headers` route option:

```ts
// app/routes.ts
import { cacheHeaders } from '@kitr/seo'
import { seo } from '@kitr/seo'

r.page('/blog/', {
  headers: () => cacheHeaders({ sMaxAge: 60, staleWhileRevalidate: 300 }),
  head: (ctx) => seo({ title: 'Blog', url: 'https://acme.com/blog' }, ctx),
  lazy: () => import('./pages/blog/index'),
})
```

```tsx
// app/pages/blog/index.tsx
export default () => <h1>Blog</h1>
```

```ts
// => { 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' }
```

| Option | Adds |
| --- | --- |
| `maxAge` | `max-age=<seconds>`: how long browsers keep it. |
| `sMaxAge` | `s-maxage=<seconds>`: how long CDNs and shared caches keep it. |
| `staleWhileRevalidate` | `stale-while-revalidate=<seconds>`: how long a cache may serve the old copy while fetching a new one. |
| `private` | Starts with `private` instead of `public`, so shared caches don't store it. |

With no options it returns `{ 'cache-control': 'public' }`.

> [!WARNING] Private pages
> For a page that shows the signed-in user, use `cacheHeaders({ private: true, maxAge: 0 })`; a `public` header could let a CDN serve one person's page to another.

## Testing

`seo()` is a plain function, so test what your pages put in `head` without rendering. Make an app from `config/seo.ts`, pass it as the second argument, and assert on the tags:

```ts
// app/seo.test.ts
import { createApp } from '@kitr/kitr/app'
import { robotsTxt, seo } from '@kitr/seo'
import { describe, expect, it } from 'vitest'
import seoConfig from '#config/seo'

const app = createApp({ config: { seo: seoConfig } })

describe('seo', () => {
  it('adds the site name and the canonical URL', () => {
    const { meta, links } = seo(
      {
        title: 'Pricing',
        description: 'Plans for every team size.',
        url: 'https://acme.com/pricing',
      },
      app,
    )
    expect(meta).toContainEqual({ title: 'Pricing · Acme' })
    expect(meta).toContainEqual({ property: 'og:title', content: 'Pricing' })
    expect(meta).toContainEqual({ name: 'twitter:card', content: 'summary_large_image' })
    expect(links).toEqual([{ rel: 'canonical', href: 'https://acme.com/pricing' }])
  })

  it('keeps the sign-in page out of search results', () => {
    const { meta } = seo({ title: 'Sign in', url: 'https://acme.com/sign-in', noIndex: true }, app)
    expect(meta).toContainEqual({ name: 'robots', content: 'noindex, nofollow' })
  })

  it('points crawlers at the sitemap', () => {
    expect(robotsTxt(seoConfig)).toContain('Sitemap: https://acme.com/sitemap.xml')
  })
})
```

To check the final HTML of a prerendered page, run `kitr build site` and read `/pricing/index.html` from the build output.

## Next steps

- [API reference](/packages/seo/api): every export and type.
- [Web](/packages/web): the `ssr`, `static` and `spa` modes that decide what crawlers see.
- [Router](/packages/router): routes, loaders and `notFound()`.
