---
title: Theme
description: Light, dark and system themes with no flash on load, design tokens, toasts, and the components you copy into your app.
order: 1
---

# Theme

`kitr/theme` is the visual foundation: design tokens as CSS variables, a theme provider for light, dark and system with no flash on load, toasts, and the settings `kitr ui add` uses to copy components into your app.

## Install

```sh
kitr add theme
```

This installs `@kitr/theme`, registers the provider in `kitrrc.ts`, writes `config/theme.ts` and `app/styles/tokens.css`, and imports `kitr/theme/styles.css`. Every React kit includes it.

## Themes

```tsx
import { ThemeScript, useTheme } from 'kitr/theme'

// in the document head (the Start root route does this for you)
<ThemeScript />

function Toggle() {
  const { theme, resolved, setTheme, toggle } = useTheme()
  return <button onClick={toggle}>{resolved === 'dark' ? 'Light' : 'Dark'}</button>
}
```

The choice is stored in `localStorage` and a cookie, so server-rendered pages come out in the right theme (`themeFromCookie()` from `kitr/theme/server`). `colors: { light, dark }` in `config/theme.ts` keeps `<meta name="theme-color">` and, inside a native shell, the status bar and title bar in step.

## Tokens

`app/styles/tokens.css` overrides any `--kitr-*` variable; `defineTokens()` builds your own set with typed names (`tokens.var('color.primary')`). Tailwind users get the same tokens as `@theme` through [tailwind](/packages/tailwind); plain CSS users get `pick()`, `vars()` and `dataAttrs()` helpers and `cx`/`cva` re-exported.

## Toasts

`toast('Saved')`, `toast.success()`, `toast.error()` and `toast.promise()` go through sonner when `kitr ui add sonner` has copied the component; without it they log to the console, so packages can call them freely.

## Components

`kitr ui add button form data-table` copies shadcn-compatible components into `app/components/ui`. They use the tokens above and `cva`; `config/theme.ts` points `registry` at your own registry when you have one.
