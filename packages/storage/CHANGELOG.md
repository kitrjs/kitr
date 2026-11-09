# @kitr/storage

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

- 7b49b7f: `kitr add` no longer writes demo values into real files. `kitr add storage` writes `app/storage.ts` with only `localeCookie` and a commented `defineStorage` example. `kitr add analytics` writes an empty `AppEvents` in `app/analytics.ts` with two events as a comment, and `config/analytics.ts` now templates the cookieless Plausible adapter first (`VITE_PLAUSIBLE_DOMAIN`, optional `VITE_PLAUSIBLE_HOST`) and Google Analytics second (`VITE_GA_MEASUREMENT_ID`), all three declared in `app/env.ts`. With the consent package installed, the config says analytics is held until the visitor accepts. The `saas` kit declares the events its pages track.
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

- 1206461: Devtools rebuilt: a bottom sheet on phones and a dock on desktops, light and dark themes, a draggable trigger with a long-press menu, a command palette, a three-finger gesture and a URL flag. The hub gains channels, counts, marks and burst collapse; `@kitr/devtools/ui` is a shared kit for contributed panels; `@kitr/http` logs every request and adds a Network panel; the other panels are rewritten on the kit.
- 3edf81d: Smaller browser bundles. A package can mark its provider `provider: { client: false }` and `@kitr/vite` leaves it out of the browser's provider list (cache, jobs, shield and uploads do); the devtools panels of every provider are dropped from production builds that do not ship `@kitr/devtools`. `kitr dev` names the generated type files it wrote with paths relative to the project.
- Updated dependencies [1206461]
- Updated dependencies [c7e8330]
- Updated dependencies [3edf81d]
  - @kitr/core@0.2.0
