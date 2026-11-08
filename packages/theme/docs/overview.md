---
title: Overview
description: Light, dark and system themes with no flash on load, design tokens, toasts, and the components you copy into your app.
order: 0
---

# Theme

## What it is

`@kitr/theme` gives your app light, dark and system themes with no flash on load, design tokens as CSS variables, toasts, and `kitr ui add` to copy components into your app.

Runs in the browser and during server rendering. For utility classes on the same tokens, add [tailwind](/packages/tailwind).

## Install

```sh
kitr add theme
```

Adds `@kitr/theme`, its provider, `config/theme.ts`, `app/styles/tokens.css` and `<ThemeScript />` in `app/document.tsx`. Adds [react](/packages/react) first if missing. [Every change](/packages/theme/guide#install).

## Quick start

`useTheme()` returns the current choice and the functions that change it:

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

Click it and the page turns dark: `<html>` gets `data-theme="dark"` and every token switches. The choice is saved, so a reload keeps it. `kitr ui add theme-toggle` gives you a styled one. Next in the guide: [Add a dark mode toggle](/packages/theme/guide#add-a-dark-mode-toggle).

## Built on

| Built on | Role |
| --- | --- |
| [CSS custom properties](https://developer.mozilla.org/docs/Web/CSS/Using_CSS_custom_properties) | The tokens: colors, radii, spacing, with a dark set under `[data-theme="dark"]`. |
| [sonner](https://sonner.emilkowal.ski) | The toasts behind `toast()` and `toastError()`. |
| [shadcn/ui](https://ui.shadcn.com)-compatible registries | The component format `kitr ui add` reads and copies into `app/components/ui/`. |
| [class-variance-authority](https://cva.style/docs) | Component variants in the copied components. |

kitr adds the provider, the no-flash script, the cookie for server rendering, typed tokens, the toast wrapper and the component registry.

## Problems it solves

- **A white flash before dark mode.** [Avoid a flash on load](/packages/theme/guide#avoid-a-flash-on-load).
- **Light, dark and system as three code paths.** [Let users pick light, dark or system](/packages/theme/guide#let-users-pick-light-dark-or-system).
- **Colors copied between files.** [Use the tokens in CSS](/packages/theme/guide#use-the-tokens-in-css).
- **Rebranding by search and replace.** [Brand the colors](/packages/theme/guide#brand-the-colors).
- **A different toast library in every project.** [Show toasts](/packages/theme/guide#show-toasts).
- **Component libraries that fight the design system.** [Add components](/packages/theme/guide#add-components).

## Further reading

- [Guide](/packages/theme/guide).
- [API reference](/packages/theme/api).
- [sonner](https://sonner.emilkowal.ski) and [shadcn/ui registries](https://ui.shadcn.com/docs/registry).
- [Using CSS custom properties on MDN](https://developer.mozilla.org/docs/Web/CSS/Using_CSS_custom_properties).
- [Tailwind](/packages/tailwind) and [Router](/packages/router).
