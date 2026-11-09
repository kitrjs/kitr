# @kitr/state

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

- 3d9ba40: Newcomer fixes. `kitr --version` (and `-v`) prints the version instead of "No version specified". `kitr doctor` no longer asks to list `@kitr/kitr` itself in kitrrc.ts. New projects' `biome.json` follows `.gitignore`. Prerendering with `crawlLinks` renders one page per path: `#anchor` links no longer re-render the same page or fill the sitemap with anchors. `kitr make:store` says in the generated file and AGENTS.md that the store needs its Provider for server rendering. `kitr --help` mentions that packages add their own commands inside a project.
- cc6bd58: `kitr make:store` removes the `app/stores/.gitkeep` placeholder that `kitr add state` wrote, once the folder has its first store.
- 4b74c40: A store read on the server outside its `StoreProvider` no longer throws "Store has no instance on the server". Each component that reads it gets a fresh store built from the initial state, dropped with the render, so a static build or an SSR page works without the provider and nothing leaks between requests. Wrap the tree in the provider to share one store per render, or pass `strict: true` to keep the error.
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
