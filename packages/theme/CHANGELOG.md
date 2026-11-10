# @kitr/theme

## 0.9.1

### Patch Changes

- 16ea92c: Theme transitions show again. `setTheme()` and `toggle()` changed React's state before the browser took the transition's first picture, so the provider's effect wrote the new theme to `<html>` early and both pictures showed it: the circle, diamond, wipe and fade ran over a page that had already changed. The state now changes inside the transition's update, after the first picture. Since 0.8.0 turned CSS transitions off during a theme change this was visible on every page; before, eased colours hid part of it.
- @kitr/cli@0.9.1
  - @kitr/core@0.9.1

## 0.9.0

### Patch Changes

- Updated dependencies [a69b7b0]
  - @kitr/core@0.9.0
  - @kitr/cli@0.9.0

## 0.8.0

### Patch Changes

- 2a735b2: `pageTransitions({ style: 'rise' })`: the old page lifts away and is gone before the new one settles in from just below, and back mirrors it. The two pictures don't blend, so on text-heavy pages, phones especially, the change reads as a move instead of a brief double exposure.
  
  A theme change turns off CSS `transition`s while it runs. The new picture is the live page, so controls with `transition: background-color` (buttons, nav links) faded from the old theme's colours on their own after the rest of the page had changed, and a header full of them looked like it animated separately.
- @kitr/cli@0.8.0
  - @kitr/core@0.8.0

## 0.7.0

### Patch Changes

- 058341d: Theme change animations run at their own speed. `@kitr/animation/page-transitions.css` cut every root view transition to 180ms, theme changes included; its fallback now skips a theme change. The default theme transition `duration` is `600`, and `circle` and `diamond` grow only as far as the viewport corner farthest from where they start (`--kitr-theme-transition-radius` and `--kitr-theme-transition-reach`), so the whole animation happens on screen.
  
  `googleAnalytics()` sends what `gtag.js` reads. It pushed arrays to `dataLayer`, which `gtag.js` ignores, so no hits reached Google; it now pushes the `arguments` object the way Google's snippet does. It also sets the Consent Mode v2 default first: `analytics_storage` granted, and the ad signals denied unless you pass `ads: true`.
- Updated dependencies [342a4a7]
- Updated dependencies [ff8f972]
  - @kitr/cli@0.7.0
  - @kitr/core@0.7.0

## 0.6.0

### Minor Changes

- 46695db: The theme reveal from 0.5.0 (`toggle({ from })`) is withdrawn, and `kitr ui add theme-toggle` switches theme without animating again. Theme change animations come back as an opt-in setting, off by default, in a later release.
- bc68dcc: Theme change animations, off by default. Set `transition` in `config/theme.ts` to one of the built-in view transitions (`'fade'`, `'circle'`, `'diamond'`, `'wipe'`, `'blur'`) with its own `duration`, `easing` and `direction`, name your own and style it in CSS, or run it in code with `animate`. `setTheme` and `toggle` take a per-call `transition`, and `false` makes one change instant. While a change runs, `<html>` carries `data-kitr-theme-transition`, `data-kitr-theme-to` and `data-kitr-theme-direction` plus `--kitr-theme-transition-*` variables. Visitors who ask for less motion get an instant change. `kitr ui add theme-toggle` passes its button as `from`, so `circle` and `diamond` start there.

### Patch Changes

- @kitr/cli@0.6.0
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

- @kitr/cli@0.5.0
  - @kitr/core@0.5.0

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
