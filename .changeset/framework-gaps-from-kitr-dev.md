---
"@kitr/theme": patch
"@kitr/animation": minor
"@kitr/content": patch
"@kitr/vite": patch
---

Gaps found rebuilding kitr.dev with kitr:

- `@kitr/theme` and `@kitr/content` stylesheets sit in cascade layers (`base` and `components`), so an app's own CSS and Tailwind utilities win over them. Before, the theme's unlayered form field styles beat an app's layered rules.
- `@kitr/animation/page-transitions.css`: mark a header or sidebar with `data-kitr-keep` and it stays put while the page changes. Nothing is kept while a modal dialog is open.
- Package live examples are styled with Tailwind utilities on the kitr tokens instead of class names only kitr.dev defined.
- The project structure has a home for build-time steps: Vite plugins in `build/`, added next to `kitr()`.
