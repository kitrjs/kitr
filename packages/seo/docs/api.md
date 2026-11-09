---
title: API reference
description: Every export of @kitr/seo, with its signature.
order: 2
---

# API reference

Every export of `@kitr/seo`, read from the published type definitions. The [guide](/packages/seo/guide) shows them in use.

## @kitr/seo

### cacheHeaders

```ts
function cacheHeaders(options?: {
  maxAge?: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  private?: boolean;
}): {
  'cache-control': string;
};
```

A `cache-control` header for TanStack Start's `headers` route option:
`headers: () => cacheHeaders({ sMaxAge: 60 })`. Public unless `private` is set.

### jsonLd

```ts
function jsonLd(data: Record<string, unknown> & {
  '@type': string;
}): {
  type: string;
  children: string;
};
```

A JSON-LD script for `head().scripts`: `scripts: [jsonLd({ '@type': 'Article', headline })]`.

### robotsTxt

```ts
function robotsTxt(config: SeoConfig): string | null;
```

`robots.txt` text from the config, or null when `robots` is false. The build writes it for web platforms.

### safeJson

```ts
function safeJson(value: unknown): string;
```

JSON for inside a `<script>`: `<`, `>` and `&` as unicode escapes so a value such as
`</script><script>…` from a user's title can't close the tag, and U+2028/U+2029 escaped too.
Still valid JSON: parsers read the escapes back as the same characters.

### seo

```ts
function seo(input: SeoInput, context?: SeoContext): {
  meta: Record<string, string>[];
  links: Record<string, string>[];
};
```

Meta tags for a route's `head()`: `head: (ctx) => seo({ title, description }, ctx)`.
Covers title, description, Open Graph, Twitter cards, canonical and robots. Pass the `head`
argument (or the app) as the second argument so the site name, image and origin from
`config/seo.ts` apply; without it only `input.site` does.

### ssrRoute

```ts
function ssrRoute(mode: SsrMode | (Partial<Record<BuildPlatformKey, SsrMode>> & {
  default: SsrMode;
})): {
  ssr: SsrMode;
};
```

Route option presets. Spread into `createFileRoute(...)({ ...ssrRoute('data-only'), ... })`.
A table picks the mode per platform at build time, by platform name from kitrrc.ts, then type,
then `default`: `ssrRoute({ www: true, web: 'data-only', default: false })` renders the marketing
build on the server, other web builds data-only, and native shells on the client.

### defineConfig

```ts
const defineConfig: <const C extends SeoConfig>(config: C) => C;
```

Types the default export of `config/seo.ts`. The config lives on the app (`app.config.get('seo')`,
set from the `config` that `app/app.ts` passes to `createApp`), not in this module, so two apps
in one process keep their own site defaults and `seo()` reads them from the app it is given.

### SeoConfig

```ts
interface SeoConfig {
  /** Site-wide defaults for `seo()`. */
  site?: SeoSite;
  /** Default rendering for routes that set no `ssr` of their own (the router's `defaultSsr`). `ssrRoute()` overrides it per route. */
  ssr?: boolean | 'data-only';
  /**
   * Routes to prerender at build time; `crawlLinks` follows links from them. A `static` web platform
   * prerenders everything. A listed route that fails to render fails the build; a crawled link only
   * warns, unless `failOnError` is `true`.
   */
  prerender?: string[] | {
    routes: string[];
    crawlLinks?: boolean;
    failOnError?: boolean;
  };
  /** Rules for `robotsTxt()`, which the build writes to `robots.txt` unless `public/robots.txt` exists. `false` writes none. */
  robots?: false | {
    allow?: string[];
    disallow?: string[];
    sitemap?: boolean;
  };
}
```

Options for `config/seo.ts`. The build reads `prerender`, `site.url` and `robots`; `seo()` reads `site`; the router reads `ssr`.

### SeoInput

```ts
interface SeoInput {
  /** The page title, without the site name. */
  title?: string;
  /** The page summary for search results and share cards. */
  description?: string;
  /** Share image for this page; replaces `site.image`. Use an absolute URL. */
  image?: string;
  /** The page's canonical URL; falls back to `site.url`, so pass it on every page. */
  url?: string;
  /** `og:type`. Default `website`. */
  type?: 'website' | 'article' | 'product';
  /** Adds `robots: noindex, nofollow`. */
  noIndex?: boolean;
  /** Joined into a `keywords` meta tag. */
  keywords?: string[];
  /** Site defaults. Default: `site` from the app's `config/seo.ts`, found through the context passed as `seo`'s second argument. */
  site?: SeoSite;
}
```

What one page passes to `seo()`. Every field is optional; `site` supplies the defaults.

### SeoSite

```ts
interface SeoSite {
  /** Appended to page titles (`Pricing · Acme`) and sent as `og:site_name`. */
  name?: string;
  /** Canonical origin (`https://example.com`). Turns on the sitemap for prerendered routes. */
  url?: string;
  /** Share image for pages that set none. Use an absolute URL. */
  image?: string;
  /** The site's X (Twitter) handle, sent as `twitter:site`. */
  twitter?: string;
  /** Sent as `og:locale`, such as `en_US`. */
  locale?: string;
}
```

Site-wide values for `seo()` and the build: name, canonical origin, default image, handle and locale.

### SeoContext

```ts
type SeoContext = object;
```

Where `seo()` finds the app for the site defaults: the argument of a route's `head` (its
`match.context.app`, which `createKitrRouter` puts in every route's context), a loader or
`beforeLoad` context, or the app itself.

### SsrMode

```ts
type SsrMode = boolean | 'data-only';
```

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
