---
title: SEO
description: Give every page a title, a share preview and a sitemap entry so search engines and chat apps show it well.
order: 1
---

# SEO

Paste a link into Slack or search for your product, and what people see comes from a few tags: title, description, share image. `@kitr/seo` writes them from one call, `seo({ title, description })`, adds structured data, and tells the build which pages to prerender. It builds on [TanStack Router's `head`](https://tanstack.com/router/latest/docs/framework/react/guide/document-head-management) and [TanStack Start's prerendering](https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering).

The examples on this page follow one scenario: Acme's marketing site at `acme.com` has a pricing page, a blog with posts by Ada and Grace, and a sign-in link to the app at `app.acme.com`, which search engines should not index.

`@kitr/seo` runs on both sides: `seo()` and the other helpers are plain functions that the server renders into HTML and the client keeps up to date while people navigate. Tags only help when the HTML reaches crawlers, so use a web platform in `ssr` or `static` mode for pages you want found. In an `spa` app, crawlers and link previews see the same empty shell for every URL.

## Install

```sh
kitr add seo
```

What `kitr add` does:

- Installs `@kitr/seo`.
- Adds `'@kitr/seo'` to `packages` in `kitrrc.ts`. There is no provider: nothing runs at startup.
- Writes `config/seo.ts` (shown in [Configure](#configure)) and regenerates `config/index.ts`.
- Adds a `## kitr: seo` section to `AGENTS.md` telling coding agents to set `head: (ctx) => seo({ title, description }, ctx)` on routes, to add structured data with `jsonLd()`, and to use `ssrRoute()` and `cacheHeaders()` for rendering and CDN caching.

`kitr add seo` asks no questions and adds no env variables. To edit `package.json` without running the package manager, pass the global flag:

```sh
kitr add seo --no-install
```

The `fullstack`, `saas`, `site` and `realtime` kits include seo. The `site` kit writes its own `config/seo.ts` with a prerender list and a site URL, and sets `head` on every page. It is a client package, so in a server-only project `kitr add seo` prints a warning and skips it.

`kitr remove seo` removes the `packages` entry, the dependency and the `AGENTS.md` section, and deletes `config/seo.ts`. It leaves the `seo()` calls in your routes, which you delete by hand.

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
| `robots` | `{}` | Rules for the `robots.txt` the build writes (see [Write robots.txt](#write-robotstxt)). `false` writes none. |
| `robots.allow` | `['/']` | `Allow:` lines. |
| `robots.disallow` | `[]` | `Disallow:` lines. |
| `robots.sitemap` | `true` | Add `Sitemap: <site.url>/sitemap.xml` when `site.url` is set. |
| `ssr` | `true` | How routes without their own `ssr` render: `true`, `'data-only'` or `false`. [`ssrRoute()`](#choose-how-a-route-renders) on a route overrides it. |

`seo()` uses `site` from this file as its defaults: the config lives on the app (`app.config.get('seo')`), and `seo()` finds the app through the `ctx` you pass it, so two apps in one process, or two tests, keep their own site. The build reads `prerender` and `site.url` from the file's source text, without running it, so both must be written out as literals.

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

Open `/pricing` and view the page source. The root route's `<HeadContent />` renders the tags into `<head>`:

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

`seo()` returns `{ meta, links }`, the shape TanStack Router's `head` expects. When the visitor navigates to another page, the router swaps the tags for that page's.

## Use your site defaults on every page

`seo()` takes the site name, default share image, handle and locale from `site` in `config/seo.ts`, so every title gets the site name once you pass `ctx`. Give each page its own URL:

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
      },
      ctx,
    ),
  lazy: () => import('./pages/pricing'),
})
```

```tsx
// app/pages/pricing.tsx
export default function PricingPage() {
  return <h1>Pricing</h1>
}
```

With the config from [Configure](#configure), the call returns:

```ts
// => meta:
// { title: 'Pricing · Acme' }
// { property: 'og:title', content: 'Pricing' }
// { name: 'twitter:title', content: 'Pricing' }
// { name: 'description', content: 'Plans for every team size.' }
// { property: 'og:description', content: 'Plans for every team size.' }
// { name: 'twitter:description', content: 'Plans for every team size.' }
// { property: 'og:type', content: 'website' }
// { property: 'og:site_name', content: 'Acme' }
// { property: 'og:locale', content: 'en_US' }
// { property: 'og:url', content: 'https://acme.com/pricing' }
// { property: 'og:image', content: 'https://acme.com/og/default.png' }
// { name: 'twitter:image', content: 'https://acme.com/og/default.png' }
// { name: 'twitter:card', content: 'summary_large_image' }
// { name: 'twitter:site', content: '@acme' }
// => links:
// { rel: 'canonical', href: 'https://acme.com/pricing' }
```

A `site` passed to `seo()` replaces the one from the config, for a page that belongs to another brand. How the values combine:

| Tag | Comes from |
| --- | --- |
| `<title>` | `title · site.name`; `title` alone when it equals `site.name`; `site.name` when there is no `title`. |
| `og:title`, `twitter:title` | `title` without the site name. |
| `description`, `og:description`, `twitter:description` | `description`, only when set. |
| `og:url`, canonical link | `url`, else `site.url`. |
| `og:image`, `twitter:image` | `image`, else `site.image`. |
| `twitter:card` | `summary_large_image` when there is an image, else `summary`. |
| `og:type` | `type`, default `'website'`. |

Always pass `url` for a page when `site` has a `url`. Without it, `og:url` and the canonical link fall back to `site.url`, so the page tells search engines it is a copy of your home page and they may drop it from results.

## Set defaults in the root route

Tags from the root route apply to every page. A child route's `<title>` and its tags with the same `name` or `property` replace the root's, so put the site-wide description in the root and let pages override it:

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

Spread only `.meta` in the root. TanStack Router merges `links` from every matched route without removing duplicates, so a canonical link in the root plus one in the page gives the page two canonical URLs.

## Add a share image

Chat apps and social networks show `og:image` as a large card. Pass an absolute URL; most crawlers do not resolve `/og/pricing.png` against your domain:

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

The page image replaces `site.image` in `og:image` and `twitter:image`, and `twitter:card` becomes `summary_large_image`. A 1200 × 630 PNG or JPEG works everywhere. Check the result with a preview tool such as [opengraph.xyz](https://www.opengraph.xyz) after you deploy.

## Describe an article

For a blog post, read the post in the loader and build the tags from `loaderData`. Set `type: 'article'`:

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
        title: ctx.loaderData?.title,
        description: ctx.loaderData?.excerpt,
        url: `https://acme.com/blog/${ctx.params.slug}`,
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

For Grace's post "Invoices in one click", the page gets `<title>Invoices in one click · Acme</title>`, `og:type` `article`, and a `keywords` tag joined with commas (`invoices, billing`). Search engines ignore `keywords`; it only helps your own site search. `head` runs after the loader, on the server for the first request and on the client after each navigation.

## Keep a page out of search results

Sign-in pages, drafts and anything behind a login should not show up in search. Pass `noIndex: true`:

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

The page gets `<meta name="robots" content="noindex, nofollow">`. Crawlers must be able to load the page to see that tag, so don't also block it in `robots.txt`. To keep a whole area out, such as `/app`, set `noIndex` in its layout route's `head`; its pages inherit the tag unless they set their own `robots` meta.

## Add structured data

Structured data tells search engines what a page is about: an organization, an article, a product with a price. `jsonLd()` turns a [schema.org](https://schema.org) object into a `<script type="application/ld+json">` for `head().scripts`, and adds `@context` for you:

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

`jsonLd()` returns:

```ts
// => {
//   type: 'application/ld+json',
//   children: '{"@context":"https://schema.org","@type":"Organization","name":"Acme","url":"https://acme.com","logo":"https://acme.com/logo.png"}',
// }
```

Test the page with Google's [Rich Results Test](https://search.google.com/test/rich-results) to see which result types it qualifies for.

`jsonLd()` escapes the JSON for a `<script>` tag: `<`, `>` and `&` become `\u003c`, `\u003e` and `\u0026`, and the line separators U+2028 and U+2029 are escaped too. A review titled `</script><script>alert(1)</script>` stays inside the tag, and search engines read the escapes back as the same characters, so values from users are safe to pass. The same escaping is exported as `safeJson(value)` for your own inline scripts:

```ts
import { safeJson } from '@kitr/seo'

safeJson({ headline: 'Q3 </script> report' })
// => {"headline":"Q3 \u003c/script\u003e report"} (the string's characters)
```

## Prerender pages at build time

Pages that are the same for every visitor, such as the home page, pricing and the blog, can be built once into HTML files and served from a CDN. List them in `prerender`:

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

The `kitr()` Vite plugin reads the list and passes it to TanStack Start, which renders each route to `index.html` in its own folder (`/pricing/index.html`). With `crawlLinks: true` it also follows every link on those pages, so each blog post linked from `/blog` is prerendered too. Pages not reached this way keep rendering on the server per request.

What the build does with `prerender` in each web mode:

| Web mode | Effect |
| --- | --- |
| `ssr` | Prerenders the listed routes (and the pages they link to, with `crawlLinks`). Everything else renders on the server. |
| `static` | Prerenders every page, starting from `/` and following links. |
| `spa` | Ignored. The build writes one HTML shell. |

The build reads `config/seo.ts` as text, without running it. A list built in code (`prerender: posts.map(...)`) or imported from another file is not seen. Write each path as a string, or list a page that links to all of them and set `crawlLinks: true`.

## Generate a sitemap

Set `site.url` to a string literal and the build turns on [TanStack Start's sitemap](https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering), with `https://acme.com` as its host:

```ts
// config/seo.ts
import { defineConfig } from '@kitr/seo'

export default defineConfig({
  site: { name: 'Acme', url: 'https://acme.com' },
  prerender: { routes: ['/', '/pricing', '/blog'], crawlLinks: true },
})
```

Start writes `sitemap.xml` into the build output from the pages it knows about at build time, which are the ones it prerenders. Pages that only render on the server per request are not in it, so prerender (or crawl to) every page you want listed. `robotsTxt()` points crawlers at `<site.url>/sitemap.xml`.

Don't read the URL from an env variable here (`url: process.env.SITE_URL`). The build finds `site.url` by matching the source text, so only a quoted string turns the sitemap on.

## Write robots.txt

`robotsTxt(config)` returns the text of a `robots.txt` built from `robots` and `site.url`:

```ts
import { robotsTxt } from '@kitr/seo'

robotsTxt({ site: { url: 'https://acme.com' }, robots: { disallow: ['/app', '/api'] } })
// => 'User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /api\n\nSitemap: https://acme.com/sitemap.xml\n'
```

The build of a web platform writes this text to `robots.txt` in the client output, from `config/seo.ts`. It writes nothing when `robots` is `false`, and leaves the file alone when you keep your own `public/robots.txt`, which Vite copies as it is.

## Choose how a route renders

In a web platform in `ssr` mode, every route renders on the server by default, or as `ssr` in `config/seo.ts` says. `ssrRoute()` returns the route option that changes it for one route. Spread it into the route:

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

A route that does not render on the server sends no page content to crawlers. Keep `ssr: true` on anything you want found. See TanStack Start's [selective SSR](https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr) for how it combines with parent routes.

When one route table serves several platforms, the mode can differ per platform. A table resolves at build time by platform name from `kitrrc.ts`, then platform type, then `default`:

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

The `www` build gets `{ ssr: true }`, every other web build `{ ssr: 'data-only' }`, and the phone and desktop builds `{ ssr: false }`. The value is a constant in each bundle, so there is no run-time check.

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

With no options it returns `{ 'cache-control': 'public' }`. For a page that shows the signed-in user, such as Ada's orders, use `cacheHeaders({ private: true, maxAge: 0 })` (`private, max-age=0`); a `public` header there could let a CDN serve Ada's page to Linus. See [MDN on Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control).

## Testing

`seo()` is a plain function, so test what your pages put in `head` without rendering anything. Make an app from `config/seo.ts` and pass it as the second argument, so `seo()` has the site defaults, and assert on the tags your pages depend on:

```ts
// app/seo.test.ts
import { createApp } from 'kitr/app'
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

The test runs in Node; the app is never booted and nothing is faked. The `#config` alias comes from the `kitr()` Vite plugin, which your `vitest.config.ts` uses. To check the final HTML of a prerendered page, run `kitr build site` and read `/pricing/index.html` from the build output in an end-to-end test.

## Next steps

- [API reference](/packages/seo/api) for every export and type.
- [Web](/packages/web) for the `ssr`, `static` and `spa` modes that decide what crawlers see.
- [Router](/packages/router) for routes, loaders and `notFound()`.
- [TanStack Router document head management](https://tanstack.com/router/latest/docs/framework/react/guide/document-head-management) for how `head` tags merge.
- [Google Search Central](https://developers.google.com/search/docs) for how search engines use these tags.
