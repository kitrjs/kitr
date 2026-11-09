---
"@kitr/theme": minor
---

Theme change animations, off by default. Set `transition` in `config/theme.ts` to one of the built-in view transitions (`'fade'`, `'circle'`, `'diamond'`, `'wipe'`, `'blur'`) with its own `duration`, `easing` and `direction`, name your own and style it in CSS, or run it in code with `animate`. `setTheme` and `toggle` take a per-call `transition`, and `false` makes one change instant. While a change runs, `<html>` carries `data-kitr-theme-transition`, `data-kitr-theme-to` and `data-kitr-theme-direction` plus `--kitr-theme-transition-*` variables. Visitors who ask for less motion get an instant change. `kitr ui add theme-toggle` passes its button as `from`, so `circle` and `diamond` start there.
