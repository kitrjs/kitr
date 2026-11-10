# @kitr/animation

## 0.9.2

### Patch Changes

- @kitr/core@0.9.2

## 0.9.1

### Patch Changes

- @kitr/core@0.9.1

## 0.9.0

### Patch Changes

- Updated dependencies [a69b7b0]
  - @kitr/core@0.9.0

## 0.8.0

### Minor Changes

- 2a735b2: `pageTransitions({ style: 'rise' })`: the old page lifts away and is gone before the new one settles in from just below, and back mirrors it. The two pictures don't blend, so on text-heavy pages, phones especially, the change reads as a move instead of a brief double exposure.
  
  A theme change turns off CSS `transition`s while it runs. The new picture is the live page, so controls with `transition: background-color` (buttons, nav links) faded from the old theme's colours on their own after the rest of the page had changed, and a header full of them looked like it animated separately.

### Patch Changes

- @kitr/core@0.8.0

## 0.7.0

### Patch Changes

- 058341d: Theme change animations run at their own speed. `@kitr/animation/page-transitions.css` cut every root view transition to 180ms, theme changes included; its fallback now skips a theme change. The default theme transition `duration` is `600`, and `circle` and `diamond` grow only as far as the viewport corner farthest from where they start (`--kitr-theme-transition-radius` and `--kitr-theme-transition-reach`), so the whole animation happens on screen.
  
  `googleAnalytics()` sends what `gtag.js` reads. It pushed arrays to `dataLayer`, which `gtag.js` ignores, so no hits reached Google; it now pushes the `arguments` object the way Google's snippet does. It also sets the Consent Mode v2 default first: `analytics_storage` granted, and the ad signals denied unless you pass `ads: true`.
- @kitr/core@0.7.0

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
