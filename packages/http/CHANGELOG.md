# @kitr/http

## 0.2.1

### Patch Changes

- @kitr/core@0.2.1

## 0.2.0

### Minor Changes

- 1206461: Devtools rebuilt: a bottom sheet on phones and a dock on desktops, light and dark themes, a draggable trigger with a long-press menu, a command palette, a three-finger gesture and a URL flag. The hub gains channels, counts, marks and burst collapse; `@kitr/devtools/ui` is a shared kit for contributed panels; `@kitr/http` logs every request and adds a Network panel; the other panels are rewritten on the kit.
- c7e8330: Initial release: the kitr framework, CLI, component registry and example kits.

### Patch Changes

- 3edf81d: Smaller browser bundles. A package can mark its provider `provider: { client: false }` and `@kitr/vite` leaves it out of the browser's provider list (cache, jobs, shield and uploads do); the devtools panels of every provider are dropped from production builds that do not ship `@kitr/devtools`. `kitr dev` names the generated type files it wrote with paths relative to the project.
- Updated dependencies [1206461]
- Updated dependencies [c7e8330]
- Updated dependencies [3edf81d]
  - @kitr/core@0.2.0
