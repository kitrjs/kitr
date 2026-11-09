# @kitr/cli

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
