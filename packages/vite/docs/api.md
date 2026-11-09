---
title: API reference
description: Every export of @kitr/vite, with its signature.
order: 2
---

# API reference

Every export of `@kitr/vite`, `@kitr/vite/client`, read from the published type definitions. The [guide](/packages/vite/guide) shows them in use.

## @kitr/vite

### configEnables

```ts
function configEnables(configDir: string, name: string): boolean;
```

Static read of `config/<name>.ts`: does it set `enabled` to anything but `false`? A literal
`true` turns the package on; an expression (`process.env.DEBUG === '1'`) is decided at runtime,
so the code has to ship for it. Absent or `false`: no.

### crawlFilter

```ts
function crawlFilter(): (page: {
  path: string;
  sitemap?: {
    exclude?: boolean;
  };
}) => boolean;
```

Start's crawler treats `/docs/a#install` and `/docs/a` as two pages: it renders the same file
once per anchor and lists every anchor in the sitemap. This keeps one page per path: a hash is
dropped, and a path already taken is skipped and left out of the sitemap.

### finishPrerender

```ts
function finishPrerender(options: {
  guard?: PrerenderGuard;
  clientDir: string;
  serverEntry: string;
  notFoundPage?: boolean;
  logger: {
    warn(msg: string): void;
    error(msg: string): void;
  };
}): Promise<void>;
```

After Start's prerender: print one line per page that failed (`[prerender] 404 at /x, linked
from /y`), with the status asked again of the built server, and fail the build when a listed
route failed or `failOnError` is on. A static site also gets `404.html`: the root's
`notFoundComponent`, rendered for a path no route matches, which Cloudflare Pages, Netlify and
GitHub Pages serve for unknown paths. It is written here because Start's prerender refuses a
page that answers 404, and so it is never crawled or listed in the sitemap.

### indexable

```ts
function indexable(path: string, html: string): boolean;
```

Whether a prerendered page belongs in the sitemap: an HTML page (a path with no extension, or
`.html`) whose head does not carry `<meta name="robots" content="noindex">`. A `/docs/x.md`
"view as markdown" file, `llms.txt` or a JSON feed is written like any other page but is not a
page to list.

### kitr

```ts
function kitr(options?: KitrPluginOptions): PluginOption[];
```

The kitr() Vite plugin. It reads `kitrrc.ts` and the installed packages' `vite` declarations
at build time and:
- wires TanStack Start (or the router plugin) and every plugin a package declares (React, Tailwind),
- exposes `virtual:kitr/providers` and `virtual:kitr/config` as static imports,
- pre-declares `optimizeDeps` from the packages' lists so dev start never rediscovers,
- sets the active platform's port, outDir and the `#app`-style aliases.

### prerenderGuard

```ts
function prerenderGuard(options: {
  routes: string[];
  failOnError?: boolean;
}): PrerenderGuard;
```

Start's prerender throws on the first page that does not answer 200, and the build dies with a
dump of the `Response`. Start runs with `failOnError: false` instead, and this keeps the record:
`filter` (crawlFilter, plus a note of every page asked for) holds each page out of the sitemap,
`onSuccess` puts it back when `indexable` (an HTML page without `noindex`) and notes which page
links where, and `failures()` is the difference, for `finishPrerender` to print and fail on.

### readPrerender

```ts
function readPrerender(root: string, configDir: string): {
  pages?: Array<{
    path: string;
  }>;
  prerender?: Record<string, unknown>;
  sitemap?: Record<string, unknown>;
  failOnError?: boolean;
};
```

Static read of `config/seo.ts`: `prerender: ['/a']` or `{ routes: [...], crawlLinks }` becomes
Start's `pages` + `prerender`, and `site.url` turns on the sitemap. `failOnError: true` comes
back beside them, for `prerenderGuard`. No execution needed.

### readRc

```ts
function readRc(root: string): RcInfo;
```

Static read of kitrrc.ts: `import('...')` specs under `providers:` and the `packages` list. No execution needed.

### readRcPlatforms

```ts
function readRcPlatforms(src: string): Record<string, RcPlatform>;
```

Static read of `platforms: { site: web({ mode: 'ssr' }) }`: names, factories and literal options.

### robotsFor

```ts
function robotsFor(root: string, configDir?: string): Promise<string | null>;
```

The robots.txt for a project: `robotsTxt()` from

### KitrPluginOptions

```ts
interface KitrPluginOptions {
  /** Project root. Default: Vite's root. */
  root?: string;
  /** Use TanStack Start (SSR, prerender, server functions). Default: when an installed package asks for it (`router` does). */
  start?: boolean | Record<string, unknown>;
  /**
   * Leave out the Vite plugin a package declares, by its short name: `{ tailwind: false }` skips
   * `@kitr/tailwind/vite`, `{ react: false }` skips `@vitejs/plugin-react`. Default: every declared plugin.
   */
  plugins?: Record<string, boolean>;
  /** Route files directory. Default `app/routes`. */
  routesDirectory?: string;
  generatedRouteTree?: string;
  /** Extra options for @tanstack/router-plugin. */
  router?: Record<string, unknown>;
  /**
   * Include `@kitr/devtools/provider`. Default: always in development; in production builds only
   * when `config/devtools.ts` sets `enabled`.
   */
  devtools?: boolean;
  /** Which platform from kitrrc.ts this build is for. Default: `KITR_PLATFORM` (set by `kitr dev|build <name>`), else the first web platform. */
  platform?: string;
  /**
   * Run `kitr types` when the build starts and again in dev whenever a watched file changes, so
   * `.kitr/` is always current. Needs `@kitr/cli` installed (it is, in every kitr project).
   * Default true.
   */
  types?: boolean;
}
```

Options for `kitr()` in `vite.config.ts`. All optional: the rest comes from `kitrrc.ts`.

### PrerenderFailure

```ts
interface PrerenderFailure {
  /** The page's path, without its `#hash`. */
  path: string;
  /** The first page whose HTML linked to it; missing for a page only the config lists. */
  from?: string;
  /** Listed in `config/seo.ts` `prerender.routes` (or `/` on a static site), not crawled. */
  listed: boolean;
}
```

A page the prerender asked for and did not write.

### PrerenderGuard

```ts
interface PrerenderGuard {
  /** Start's `prerender.filter`: drops anchors and repeats, and notes every page it lets through. */
  filter(page: {
    path: string;
    sitemap?: {
      exclude?: boolean;
    };
  }): boolean;
  /** Start's `prerender.onSuccess`: notes the page as written and which pages it links to. */
  onSuccess(result: {
    page: {
      path: string;
      sitemap?: {
        exclude?: boolean;
      };
    };
    html: string;
  }): void;
  /** Pages that passed the filter and were never written. */
  failures(): PrerenderFailure[];
  /** Fail the build for crawled pages too (`prerender.failOnError` in `config/seo.ts`). */
  failOnError: boolean;
}
```

The `filter` and `onSuccess` hooks `prerenderGuard()` hands Start, and what they saw.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
