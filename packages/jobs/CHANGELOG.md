# @kitr/jobs

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

- 3edf81d: Smaller browser bundles. A package can mark its provider `provider: { client: false }` and `@kitr/vite` leaves it out of the browser's provider list (cache, jobs, shield and uploads do); the devtools panels of every provider are dropped from production builds that do not ship `@kitr/devtools`. `kitr dev` names the generated type files it wrote with paths relative to the project.
- Updated dependencies [1206461]
- Updated dependencies [c7e8330]
- Updated dependencies [3edf81d]
  - @kitr/core@0.2.0
