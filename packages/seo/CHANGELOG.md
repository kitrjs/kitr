# @kitr/seo

## 0.9.0

### Patch Changes

- Updated dependencies [a69b7b0]
  - @kitr/core@0.9.0

## 0.8.0

### Patch Changes

- @kitr/core@0.8.0

## 0.7.0

### Patch Changes

- 342a4a7: Hardening from a CodeQL pass. `@kitr/mail` parses recipients and builds the text body by scanning instead of backtracking regexes, so long or malformed input no longer stalls a send, and `htmlToText` now drops `<SCRIPT>` and `</script >` too. `kitr add` refuses a package name that is not a plain npm name before running the installer. Frontmatter, `seo` canonical URLs and the prerender link crawl no longer use regexes that slow down on long input. The generated `capacitor.config.ts` escapes backslashes in the app name.
- @kitr/core@0.7.0

## 0.6.0

### Patch Changes

- @kitr/core@0.6.0

## 0.5.0

### Patch Changes

- @kitr/core@0.5.0

## 0.4.0

### Patch Changes

- @kitr/core@0.4.0

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
