# @kitr/kit-site

## 0.5.0

### Patch Changes

- @kitr/core@0.5.0

## 0.4.0

### Patch Changes

- @kitr/core@0.4.0

## 0.3.2

### Patch Changes

- 3b07461: `kitr add testing` writes a real first test. With the starter home page, `test/home.test.tsx` renders it with `renderWithKitr` inside the app's providers and checks its heading. A React project without that page gets a test that boots the app, and a server-only project keeps the `/api/health` test. The `saas` and `site` kits, which replace the starter page, drop the starter's test with it.
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
