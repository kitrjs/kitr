# @kitr/theme

## 0.4.0

### Patch Changes

- Updated dependencies [14bba43]
- Updated dependencies [dd305d9]
- Updated dependencies [59e7c8d]
- Updated dependencies [611161f]
  - @kitr/cli@0.4.0
  - @kitr/core@0.4.0

## 0.3.2

### Patch Changes

- c69b14f: Fix the first run from a global install. `kitr new --kit site` (and every kit with a server platform) no longer skips the client packages as "server-only" when npm hoists `@kitr/react`. `kitr ui add`, and every kit that copies components, no longer fail with `Cannot find module '@kitr/cli'` when `kitr` runs through the global bin symlink.
- a29e11e: `kitr ui add button --registry ./registry/dist` no longer treats the registry path as a second component name and fails with `Component "./registry/dist" not found`.
- Updated dependencies [8904b74]
- Updated dependencies [8d78bbb]
- Updated dependencies [c69b14f]
- Updated dependencies [3d9ba40]
- Updated dependencies [9fffc3c]
  - @kitr/cli@0.3.2
  - @kitr/core@0.3.2

## 0.3.1

### Patch Changes

- @kitr/cli@0.3.1
  - @kitr/core@0.3.1

## 0.3.0

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

### Patch Changes

- Updated dependencies [9f0d0c4]
- Updated dependencies [1206461]
- Updated dependencies [c7e8330]
- Updated dependencies [3edf81d]
  - @kitr/cli@0.2.0
  - @kitr/core@0.2.0
