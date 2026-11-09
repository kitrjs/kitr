# @kitr/server

## 0.9.0

### Minor Changes

- a69b7b0: Actions now work in a production build of a full-stack app. `kitr types` writes one literal `createServerFn` chain per action, `@kitr/actions/vite` empties each `handler` in the browser bundle so server code and its imports stay out, and `useRequestApp()` needs no argument inside a request (`runWithApp(app, fn)` covers tests and scripts). The registry accepts callable action definitions, the web platform always installs `srvx`, the realtime package installs `partysocket`, the db provider stays out of the browser, the app's document gets a title, the generated Biome config passes on a fresh project, and the desktop template writes `publish: null` until you configure an update feed.
  
  A single-page app renders its shell from scratch instead of hydrating it, so an unknown URL no longer logs a hydration error; `import.meta.env.KITR_RENDER` tells the client entry which of `ssr`, `static` or `spa` it is.

### Patch Changes

- Updated dependencies [a69b7b0]
  - @kitr/core@0.9.0
  - @kitr/logger@0.9.0

## 0.8.0

### Patch Changes

- @kitr/core@0.8.0
  - @kitr/logger@0.8.0

## 0.7.0

### Patch Changes

- @kitr/core@0.7.0
  - @kitr/logger@0.7.0

## 0.6.0

### Patch Changes

- @kitr/core@0.6.0
  - @kitr/logger@0.6.0

## 0.5.0

### Patch Changes

- @kitr/core@0.5.0
  - @kitr/logger@0.5.0

## 0.4.0

### Patch Changes

- 611161f: A platform package's `kitr` block can carry a `platform` object: its label, tagline, targets, shell, colour, highlights, a code snippet, the commands that run it and links to upstream docs. `@kitr/web`, `@kitr/server`, `@kitr/desktop`, `@kitr/tauri` and `@kitr/mobile` ship theirs, so kitr.dev's /platforms pages read the text from the packages. `kitr package:check` validates the object and names each broken field.
- @kitr/core@0.4.0
  - @kitr/logger@0.4.0

## 0.3.2

### Patch Changes

- Updated dependencies [8904b74]
  - @kitr/core@0.3.2
  - @kitr/logger@0.3.2

## 0.3.1

### Patch Changes

- @kitr/core@0.3.1
  - @kitr/logger@0.3.1

## 0.3.0

### Patch Changes

- @kitr/core@0.3.0
  - @kitr/logger@0.3.0

## 0.2.1

### Patch Changes

- @kitr/core@0.2.1
  - @kitr/logger@0.2.1

## 0.2.0

### Minor Changes

- c7e8330: Initial release: the kitr framework, CLI, component registry and example kits.

### Patch Changes

- Updated dependencies [1206461]
- Updated dependencies [c7e8330]
- Updated dependencies [3edf81d]
  - @kitr/core@0.2.0
  - @kitr/logger@0.2.0
