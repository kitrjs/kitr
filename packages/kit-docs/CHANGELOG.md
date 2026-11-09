# @kitr/kit-docs

## 0.7.0

### Patch Changes

- ff8f972: A kit's `kitr` block can carry a `kit` object: who the kit is for, three to five highlights, the preset's base kit, where its example output lives, the file to read first and the commands to run. `kitr package:check` validates it and `KitrKitInfo` types it. Every official kit now describes itself this way, and its homepage is its page on kitr.dev/kits.
- @kitr/core@0.7.0

## 0.6.0

### Patch Changes

- @kitr/core@0.6.0

## 0.5.0

### Patch Changes

- @kitr/core@0.5.0

## 0.4.0

### Minor Changes

- 14bba43: Add `@kitr/content` and the `docs` kit.
  
  `kitr add content` renders the markdown folders listed in `config/content.ts` at `kitr generate` time into `.kitr/content/`, read through `#kitr/content`: `loadPage(collection, slug)`, `nav`, `loadSearch()` and typed `Slug<C>`. Pages get Shiki highlighting for light and dark, file captions, callouts, numbered steps, a table of contents, `kitr` command blocks and rewritten `.md` links. `@kitr/content/react` has `DocBody`, `Toc` and `useActiveHeading`, `search()` ranks the index, and with `llms: true` the Vite plugin serves and builds `llms.txt`, `llms-full.txt` and a `.md` copy of every page.
  
  `kitr new --kit docs` starts a static docs site from markdown with a sidebar, search, package-manager commands and dark mode, using the new `doc-layout`, `search-dialog` and `command` registry components.

### Patch Changes

- @kitr/core@0.4.0
