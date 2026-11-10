# kitr

## 0.9.1

### Patch Changes

- @kitr/cli@0.9.1
  - @kitr/core@0.9.1

## 0.9.0

### Patch Changes

- Updated dependencies [a69b7b0]
  - @kitr/core@0.9.0
  - @kitr/cli@0.9.0

## 0.8.0

### Patch Changes

- @kitr/cli@0.8.0
  - @kitr/core@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [342a4a7]
- Updated dependencies [ff8f972]
  - @kitr/cli@0.7.0
  - @kitr/core@0.7.0

## 0.6.0

### Patch Changes

- @kitr/cli@0.6.0
  - @kitr/core@0.6.0

## 0.5.0

### Patch Changes

- @kitr/cli@0.5.0
  - @kitr/core@0.5.0

## 0.4.0

### Patch Changes

- 14bba43: Add `@kitr/content` and the `docs` kit.
  
  `kitr add content` renders the markdown folders listed in `config/content.ts` at `kitr generate` time into `.kitr/content/`, read through `#kitr/content`: `loadPage(collection, slug)`, `nav`, `loadSearch()` and typed `Slug<C>`. Pages get Shiki highlighting for light and dark, file captions, callouts, numbered steps, a table of contents, `kitr` command blocks and rewritten `.md` links. `@kitr/content/react` has `DocBody`, `Toc` and `useActiveHeading`, `search()` ranks the index, and with `llms: true` the Vite plugin serves and builds `llms.txt`, `llms-full.txt` and a `.md` copy of every page.
  
  `kitr new --kit docs` starts a static docs site from markdown with a sidebar, search, package-manager commands and dark mode, using the new `doc-layout`, `search-dialog` and `command` registry components.
- Updated dependencies [14bba43]
- Updated dependencies [dd305d9]
- Updated dependencies [59e7c8d]
- Updated dependencies [611161f]
  - @kitr/cli@0.4.0
  - @kitr/core@0.4.0

## 0.3.2

### Patch Changes

- Updated dependencies [8904b74]
- Updated dependencies [8d78bbb]
- Updated dependencies [c69b14f]
- Updated dependencies [3d9ba40]
- Updated dependencies [9fffc3c]
  - @kitr/cli@0.3.2
  - @kitr/core@0.3.2

## 0.3.1

### Patch Changes

- ff932f1: The package READMEs now show `pnpm dlx @kitr/kitr new my-app`, since the CLI is published as `@kitr/kitr`. The command you run is still `kitr`.
- @kitr/cli@0.3.1
  - @kitr/core@0.3.1

## 0.3.0

### Minor Changes

- f8b20ec: The CLI and the `kitrrc.ts` config are published as `@kitr/kitr`: npm refuses the unscoped name `kitr`. Install it with `npm install -g @kitr/kitr` (the command is still `kitr`) and import from `@kitr/kitr/app` and `@kitr/kitr/env`.

### Patch Changes

- @kitr/cli@0.3.0
  - @kitr/core@0.3.0

## 0.2.1

### Patch Changes

- @kitr/cli@0.2.1
  - @kitr/core@0.2.1

## 0.2.0

### Minor Changes

- c7e8330: Initial release: the kitr framework, CLI, component registry and example kits.
- 3edf81d: `kitr new --kit app` is now the smallest app that runs: the web platform, Query, Tailwind, the theme and testing, in 25 files. The logged-in app on an external API (http, forms, table, state, auth, storage, mocks and eleven UI components) is `kitr new --kit dashboard`.

### Patch Changes

- Updated dependencies [9f0d0c4]
- Updated dependencies [1206461]
- Updated dependencies [c7e8330]
- Updated dependencies [3edf81d]
  - @kitr/cli@0.2.0
  - @kitr/core@0.2.0
