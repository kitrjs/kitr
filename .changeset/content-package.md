---
'@kitr/content': minor
'@kitr/kit-docs': minor
'@kitr/kitr': patch
'@kitr/cli': patch
---

Add `@kitr/content` and the `docs` kit.

`kitr add content` renders the markdown folders listed in `config/content.ts` at `kitr generate` time into `.kitr/content/`, read through `#kitr/content`: `loadPage(collection, slug)`, `nav`, `loadSearch()` and typed `Slug<C>`. Pages get Shiki highlighting for light and dark, file captions, callouts, numbered steps, a table of contents, `kitr` command blocks and rewritten `.md` links. `@kitr/content/react` has `DocBody`, `Toc` and `useActiveHeading`, `search()` ranks the index, and with `llms: true` the Vite plugin serves and builds `llms.txt`, `llms-full.txt` and a `.md` copy of every page.

`kitr new --kit docs` starts a static docs site from markdown with a sidebar, search, package-manager commands and dark mode, using the new `doc-layout`, `search-dialog` and `command` registry components.
