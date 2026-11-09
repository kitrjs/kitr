# @kitr/vite

## 0.4.0

### Patch Changes

- d2c4a4c: The sitemap lists only indexable HTML pages. A crawled `.md`, `.txt` or `.json` file (a "view as markdown" copy, `llms.txt`) and a page whose head says `<meta name="robots" content="noindex">` are still written, but no longer appear in `sitemap.xml`.
- Updated dependencies [14bba43]
- Updated dependencies [dd305d9]
- Updated dependencies [59e7c8d]
- Updated dependencies [611161f]
  - @kitr/cli@0.4.0
  - @kitr/web@0.4.0
  - @kitr/core@0.4.0

## 0.3.2

### Patch Changes

- 3d9ba40: Newcomer fixes. `kitr --version` (and `-v`) prints the version instead of "No version specified". `kitr doctor` no longer asks to list `@kitr/kitr` itself in kitrrc.ts. New projects' `biome.json` follows `.gitignore`. Prerendering with `crawlLinks` renders one page per path: `#anchor` links no longer re-render the same page or fill the sitemap with anchors. `kitr make:store` says in the generated file and AGENTS.md that the store needs its Provider for server rendering. `kitr --help` mentions that packages add their own commands inside a project.
- 36635b6: A page that fails to prerender no longer kills the build with a dump of the `Response`. The build prints one line, `[prerender] 404 at /llms-full.txt, linked from /docs/agents`, and leaves the page out of the sitemap. A route listed in `config/seo.ts` `prerender.routes` still fails the build; a crawled link only warns, unless `prerender.failOnError` is `true`.
- d0d6285: A `static` web build writes `404.html` from the root route's `notFoundComponent`, which Netlify, Cloudflare Pages and GitHub Pages serve for unknown paths. `kitr start` serves it with status 404 in `static` mode; `spa` mode keeps answering unknown paths with the shell and status 200.
- Updated dependencies [8904b74]
- Updated dependencies [8d78bbb]
- Updated dependencies [c69b14f]
- Updated dependencies [3d9ba40]
- Updated dependencies [9fffc3c]
- Updated dependencies [d0d6285]
  - @kitr/cli@0.3.2
  - @kitr/core@0.3.2
  - @kitr/web@0.3.2

## 0.3.1

### Patch Changes

- @kitr/cli@0.3.1
  - @kitr/core@0.3.1
  - @kitr/web@0.3.1

## 0.3.0

### Patch Changes

- @kitr/cli@0.3.0
  - @kitr/core@0.3.0
  - @kitr/web@0.3.0

## 0.2.1

### Patch Changes

- @kitr/cli@0.2.1
  - @kitr/core@0.2.1
  - @kitr/web@0.2.1

## 0.2.0

### Minor Changes

- c7e8330: Initial release: the kitr framework, CLI, component registry and example kits.
- 3edf81d: Smaller browser bundles. A package can mark its provider `provider: { client: false }` and `@kitr/vite` leaves it out of the browser's provider list (cache, jobs, shield and uploads do); the devtools panels of every provider are dropped from production builds that do not ship `@kitr/devtools`. `kitr dev` names the generated type files it wrote with paths relative to the project.

### Patch Changes

- Updated dependencies [9f0d0c4]
- Updated dependencies [1206461]
- Updated dependencies [c7e8330]
- Updated dependencies [3edf81d]
  - @kitr/cli@0.2.0
  - @kitr/core@0.2.0
  - @kitr/web@0.2.0
