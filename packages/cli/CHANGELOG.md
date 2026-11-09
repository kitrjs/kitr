# @kitr/cli

## 0.4.0

### Patch Changes

- 14bba43: Add `@kitr/content` and the `docs` kit.
  
  `kitr add content` renders the markdown folders listed in `config/content.ts` at `kitr generate` time into `.kitr/content/`, read through `#kitr/content`: `loadPage(collection, slug)`, `nav`, `loadSearch()` and typed `Slug<C>`. Pages get Shiki highlighting for light and dark, file captions, callouts, numbered steps, a table of contents, `kitr` command blocks and rewritten `.md` links. `@kitr/content/react` has `DocBody`, `Toc` and `useActiveHeading`, `search()` ranks the index, and with `llms: true` the Vite plugin serves and builds `llms.txt`, `llms-full.txt` and a `.md` copy of every page.
  
  `kitr new --kit docs` starts a static docs site from markdown with a sidebar, search, package-manager commands and dark mode, using the new `doc-layout`, `search-dialog` and `command` registry components.
- dd305d9: `kitr agents` prints the project's `AGENTS.md`, so an agent can read the rules without opening the file. `--list` prints the `## kitr: <name>` section names and `--section <name>` prints one section. Outside a project it fails and names the file it looked for.
- 59e7c8d: `kitr catalog` lists the official packages, platforms and kits; `kitr catalog --json` prints each with its whole `kitr` block, platforms with their `platform` text, so a site's build step can read them. `@kitr/cli` exports `KitrCatalog`, `KitrCatalogEntry`, `KitrPlatformInfo`, `KitrCategory`, `categories`, `kitManifests`, `validateManifest` and `buildCatalog` to type and build that output.
- 611161f: A platform package's `kitr` block can carry a `platform` object: its label, tagline, targets, shell, colour, highlights, a code snippet, the commands that run it and links to upstream docs. `@kitr/web`, `@kitr/server`, `@kitr/desktop`, `@kitr/tauri` and `@kitr/mobile` ship theirs, so kitr.dev's /platforms pages read the text from the packages. `kitr package:check` validates the object and names each broken field.
- @kitr/core@0.4.0

## 0.3.2

### Patch Changes

- 8904b74: An app can hook its own step into `kitr generate`: list it under `generate` in `kitrrc.ts`, as `{ name: 'content', run: 'node scripts/content.mjs', watch: ['content/**'] }` or with `run: () => import('./scripts/content')`. App steps run after the type generators and the package steps in `kitr generate`, `kitr dev`, `kitr build` and `kitr typecheck`; `kitr generate --check` skips them like the package steps, and the new `kitr generate --quiet` shows a step's output only when it fails. `kitr doctor` lists each step.
- 8d78bbb: `kitr doctor` no longer warns "kitr packages are on different versions: 0.3.1, ^0.3.1" in a fresh pnpm project. `kitr new` writes exact versions and pnpm saves a caret range for the packages it adds; both name the same release, so the check now compares versions rather than ranges.
- c69b14f: Fix the first run from a global install. `kitr new --kit site` (and every kit with a server platform) no longer skips the client packages as "server-only" when npm hoists `@kitr/react`. `kitr ui add`, and every kit that copies components, no longer fail with `Cannot find module '@kitr/cli'` when `kitr` runs through the global bin symlink.
- 3d9ba40: Newcomer fixes. `kitr --version` (and `-v`) prints the version instead of "No version specified". `kitr doctor` no longer asks to list `@kitr/kitr` itself in kitrrc.ts. New projects' `biome.json` follows `.gitignore`. Prerendering with `crawlLinks` renders one page per path: `#anchor` links no longer re-render the same page or fill the sitemap with anchors. `kitr make:store` says in the generated file and AGENTS.md that the store needs its Provider for server rendering. `kitr --help` mentions that packages add their own commands inside a project.
- 9fffc3c: New projects no longer write `directories.routes` in `kitrrc.ts`: the route table in `app/routes.ts` is code, and a missing `routes` directory already means code routes. The scaffolded `.gitignore` ignores `*.log`.
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

- 9f0d0c4: `kitr dev`, `kitr build` and `kitr start` take `--filter=a,b` as another way to name the platforms (or workspace apps) to run.
- c7e8330: Initial release: the kitr framework, CLI, component registry and example kits.

### Patch Changes

- 3edf81d: Smaller browser bundles. A package can mark its provider `provider: { client: false }` and `@kitr/vite` leaves it out of the browser's provider list (cache, jobs, shield and uploads do); the devtools panels of every provider are dropped from production builds that do not ship `@kitr/devtools`. `kitr dev` names the generated type files it wrote with paths relative to the project.
- Updated dependencies [1206461]
- Updated dependencies [c7e8330]
- Updated dependencies [3edf81d]
  - @kitr/core@0.2.0
