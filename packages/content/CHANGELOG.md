# @kitr/content

## 0.7.0

### Patch Changes

- 342a4a7: Hardening from a CodeQL pass. `@kitr/mail` parses recipients and builds the text body by scanning instead of backtracking regexes, so long or malformed input no longer stalls a send, and `htmlToText` now drops `<SCRIPT>` and `</script >` too. `kitr add` refuses a package name that is not a plain npm name before running the installer. Frontmatter, `seo` canonical URLs and the prerender link crawl no longer use regexes that slow down on long input. The generated `capacitor.config.ts` escapes backslashes in the app name.
- @kitr/core@0.7.0
  - @kitr/router@0.7.0

## 0.6.0

### Patch Changes

- @kitr/core@0.6.0
  - @kitr/router@0.6.0

## 0.5.0

### Patch Changes

- bbc4351: Gaps found rebuilding kitr.dev with kitr:
  
  - `@kitr/theme` and `@kitr/content` stylesheets sit in cascade layers (`base` and `components`), so an app's own CSS and Tailwind utilities win over them. Before, the theme's unlayered form field styles beat an app's layered rules.
  - `setTheme(theme, { from })` and `toggle({ from })` reveal the new theme as a circle growing from an element, through a view transition. The registry's `theme-toggle` uses it.
  - `@kitr/animation/page-transitions.css`: mark a header or sidebar with `data-kitr-keep` and it stays put while the page changes. Nothing is kept while a modal dialog is open.
  - Package live examples are styled with Tailwind utilities on the kitr tokens instead of class names only kitr.dev defined.
  - The project structure has a home for build-time steps: Vite plugins in `build/`, added next to `kitr()`.
- @kitr/core@0.5.0
  - @kitr/router@0.5.0

## 0.4.0

### Minor Changes

- 14bba43: Add `@kitr/content` and the `docs` kit.
  
  `kitr add content` renders the markdown folders listed in `config/content.ts` at `kitr generate` time into `.kitr/content/`, read through `#kitr/content`: `loadPage(collection, slug)`, `nav`, `loadSearch()` and typed `Slug<C>`. Pages get Shiki highlighting for light and dark, file captions, callouts, numbered steps, a table of contents, `kitr` command blocks and rewritten `.md` links. `@kitr/content/react` has `DocBody`, `Toc` and `useActiveHeading`, `search()` ranks the index, and with `llms: true` the Vite plugin serves and builds `llms.txt`, `llms-full.txt` and a `.md` copy of every page.
  
  `kitr new --kit docs` starts a static docs site from markdown with a sidebar, search, package-manager commands and dark mode, using the new `doc-layout`, `search-dialog` and `command` registry components.

### Patch Changes

- @kitr/core@0.4.0
  - @kitr/router@0.4.0
