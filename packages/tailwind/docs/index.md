---
title: Tailwind
description: Style with Tailwind CSS classes, already set up with kitr's colours.
order: 1
---

# Tailwind

Tailwind v4 through Vite, with a preset that exposes kitr's design tokens as `@theme` values, so `bg-background`, `text-muted-foreground` and `border-border` work out of the box and follow the active theme, light or dark.

## Install

```sh
kitr add tailwind
```

The recipe adds the Vite plugin, writes `app/styles/app.css` and `config/tailwind.ts`:

```ts
import { defineConfig } from 'kitr/tailwind'

export default defineConfig({
  entry: 'app/styles/app.css',
  preset: true, // kitr tokens as Tailwind colours
})
```

```css
/* app/styles/app.css */
@import 'tailwindcss';
@import '@kitr/tailwind/preset.css';
@import './tokens.css';
```

## Classes

```tsx
import { cn } from 'kitr/tailwind'

<button className={cn('rounded-md bg-primary px-3 py-1 text-primary-foreground', disabled && 'opacity-50')} />
```

`cn()` merges class lists and resolves conflicts (`clsx` plus `tailwind-merge`). Registry components from `kitr ui add` use the same tokens, so they match whatever `config/theme.ts` defines.
