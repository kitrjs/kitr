---
title: Overview
description: Light, dark and system themes with no flash on load, design tokens, toasts, and the components you copy into your app.
order: 0
---

# Theme

Users expect dark mode, a page that does not flash white before it turns dark, and buttons that look the same on every screen. Getting there means a theme provider, a script in the document head, a set of CSS variables everyone agrees on, a toast library and a component library, all wired to each other. It is the first week of most frontend projects.

`@kitr/theme` is that week, done.

## What it is

`@kitr/theme` gives your app light, dark and system themes that follow the operating system and remember the user's choice, a set of design tokens as CSS variables, toasts, and the settings `kitr ui add` uses to copy ready-made components into your app. `ThemeProvider` and `useTheme` switch themes; `<ThemeScript />` applies the saved theme before the first paint; `defineTokens` and `vars` give you typed tokens in CSS Modules and inline styles; `toast` shows notifications; `themeFromCookie` renders the right theme on the server.

It runs in the browser, and on the server during server rendering. For utility classes on top of the same tokens, add [tailwind](/packages/tailwind) as well; for a server-only project there is nothing to theme.

## Install

```sh
kitr add theme
```

This installs `@kitr/theme`, registers the provider in `kitrrc.ts`, writes `config/theme.ts` and `app/styles/tokens.css`, and puts `<ThemeScript />` in `app/document.tsx` so the saved theme applies before first paint. It adds [react](/packages/react) first when the project does not have it. The guide's [Install](/packages/theme/guide#install) section lists every change.

## Quick start

`useTheme()` returns the current choice and the functions that change it. Any component under the app can call it:

```tsx
// app/components/theme-button.tsx
import { useTheme } from '@kitr/theme'

export function ThemeButton() {
  const { resolved, toggle } = useTheme()
  return (
    <button type="button" onClick={toggle}>
      {resolved === 'dark' ? 'Switch to light' : 'Switch to dark'}
    </button>
  )
}
```

Put `<ThemeButton />` in the nav of `app/document.tsx` and click it. The page turns dark: `<html>` gets `data-theme="dark"` and `style="color-scheme: dark"`, every `--kitr-*` variable switches to its dark value, and the choice is saved to `localStorage` and a one-year cookie, so a reload keeps it and the server renders the right theme. `theme` is the user's choice (`'light'`, `'dark'` or `'system'`) and `resolved` is what shows on screen. For a styled toggle with an icon, `kitr ui add theme-toggle` copies one into `app/components/ui/`. The guide continues from here: [Add a dark mode toggle](/packages/theme/guide#add-a-dark-mode-toggle).

## Built on

| Built on | Role |
| --- | --- |
| [CSS custom properties](https://developer.mozilla.org/docs/Web/CSS/Using_CSS_custom_properties) | The tokens: colors, radii, spacing, with a dark set under `[data-theme="dark"]`. |
| [sonner](https://sonner.emilkowal.ski) | The toasts behind `toast()` and `toastError()`. |
| [shadcn/ui](https://ui.shadcn.com)-compatible registries | The component format `kitr ui add` reads and copies into `app/components/ui/`. |
| [class-variance-authority](https://cva.style/docs) | Component variants in the copied components. |

kitr adds the theme provider, the no-flash script, the cookie for server rendering, typed token helpers, `dataAttrs` for state styling, the toast wrapper and the registry settings.

## Problems it solves

- **A white flash before dark mode.** `<ThemeScript />` sets the theme attribute before the first paint, and the server reads the cookie. See [Avoid a flash on load](/packages/theme/guide#avoid-a-flash-on-load).
- **Light, dark and system as three code paths.** One provider, one hook, one saved choice. See [Let users pick light, dark or system](/packages/theme/guide#let-users-pick-light-dark-or-system).
- **Colors copied between files.** Tokens are CSS variables, typed for CSS Modules and inline styles. See [Use the tokens in CSS](/packages/theme/guide#use-the-tokens-in-css).
- **Rebranding by search and replace.** Change the token values once. See [Brand the colors](/packages/theme/guide#brand-the-colors).
- **A different toast library in every project.** `toast()` with the app's theme, and an adapter if you already use another. See [Show toasts](/packages/theme/guide#show-toasts).
- **Component libraries that fight the design system.** `kitr ui add` copies components that use these tokens into your app, where you own them. See [Add components](/packages/theme/guide#add-components).

## Further reading

- [Guide](/packages/theme/guide): install, configure and every task.
- [API reference](/packages/theme/api): every export of `@kitr/theme`, `@kitr/theme/provider` and `@kitr/theme/server`.
- [sonner](https://sonner.emilkowal.ski) and [shadcn/ui registries](https://ui.shadcn.com/docs/registry): toast options, and the registry format.
- [Using CSS custom properties on MDN](https://developer.mozilla.org/docs/Web/CSS/Using_CSS_custom_properties): how the tokens work.
- [Tailwind](/packages/tailwind) and [Router](/packages/router): the same tokens as utility classes, and the `app/document.tsx` where the script goes.
