# kitr

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
