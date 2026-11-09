# @kitr/animation

## 0.6.0

### Patch Changes

- @kitr/core@0.6.0

## 0.5.0

### Minor Changes

- bbc4351: Gaps found rebuilding kitr.dev with kitr:
  
  - `@kitr/theme` and `@kitr/content` stylesheets sit in cascade layers (`base` and `components`), so an app's own CSS and Tailwind utilities win over them. Before, the theme's unlayered form field styles beat an app's layered rules.
  - `setTheme(theme, { from })` and `toggle({ from })` reveal the new theme as a circle growing from an element, through a view transition. The registry's `theme-toggle` uses it.
  - `@kitr/animation/page-transitions.css`: mark a header or sidebar with `data-kitr-keep` and it stays put while the page changes. Nothing is kept while a modal dialog is open.
  - Package live examples are styled with Tailwind utilities on the kitr tokens instead of class names only kitr.dev defined.
  - The project structure has a home for build-time steps: Vite plugins in `build/`, added next to `kitr()`.

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

- Updated dependencies [1206461]
- Updated dependencies [c7e8330]
- Updated dependencies [3edf81d]
  - @kitr/core@0.2.0
