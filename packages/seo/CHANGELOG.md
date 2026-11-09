# @kitr/seo

## 0.3.2

### Patch Changes

- 36635b6: A page that fails to prerender no longer kills the build with a dump of the `Response`. The build prints one line, `[prerender] 404 at /llms-full.txt, linked from /docs/agents`, and leaves the page out of the sitemap. A route listed in `config/seo.ts` `prerender.routes` still fails the build; a crawled link only warns, unless `prerender.failOnError` is `true`.
- f254ddd: `seo(options, ctx)` builds the canonical URL and `og:url` from `site.url` plus the matched path when `url` is left out, instead of pointing every page at the home page. It also takes `title` and `description` from the loader's data when the options leave them out, so `head: (ctx) => seo({}, ctx)` is enough for a page whose loader returns them.
- Updated dependencies [8904b74]
  - @kitr/core@0.3.2

## 0.3.1

### Patch Changes

- @kitr/core@0.3.1

## 0.3.0

### Patch Changes

- @kitr/core@0.3.0

## 0.2.1

### Patch Changes

- @kitr/core@0.2.1

## 0.2.0

### Minor Changes

- c7e8330: Initial release: the kitr framework, CLI, component registry and example kits.

### Patch Changes

- Updated dependencies [1206461]
- Updated dependencies [c7e8330]
- Updated dependencies [3edf81d]
  - @kitr/core@0.2.0
