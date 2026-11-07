---
title: Tailwind
description: Style with Tailwind CSS classes, already set up with kitr's colours.
order: 1
---

# Tailwind

`kitr add tailwind` sets up [Tailwind CSS v4](https://tailwindcss.com) and connects it to your [theme](/packages/theme). `bg-background`, `text-primary` and `rounded-md` use the same colours and radii as the rest of the app, and dark mode follows the theme toggle.

## Install

```sh
kitr add tailwind
```

This installs `@kitr/tailwind`, `tailwindcss`, `@tailwindcss/vite` and `tailwind-merge`. It writes `config/tailwind.ts` and this stylesheet:

```css
/* app/styles/app.css */
@import 'tailwindcss';
@import 'kitr/tailwind/preset.css';
@import 'kitr/theme/styles.css';

@source '../';
```

The `kitr()` Vite plugin adds Tailwind for you when the package is installed. There is no `tailwind.config.js`: Tailwind v4 is configured in CSS.

## Theme classes

The preset maps kitr's design tokens onto Tailwind's theme:

| Class | Token |
| --- | --- |
| `bg-background`, `text-foreground` | Page background and text |
| `bg-muted`, `text-muted-foreground` | Quiet surfaces and secondary text |
| `bg-primary`, `text-primary-foreground` | Buttons and links |
| `bg-destructive`, `text-destructive-foreground` | Delete buttons and errors |
| `border-border`, `ring-ring` | Borders and focus rings |
| `rounded-sm`, `rounded-md`, `rounded-lg` | Corner radii |
| `font-sans`, `font-mono` | Fonts |
| `shadow-sm`, `shadow-md` | Shadows |

Change a token in your theme and every class that uses it follows.

## Dark mode

`dark:` classes apply when `<html data-theme="dark">` is set, which is what `useTheme()` from [theme](/packages/theme) toggles:

```tsx
<div className="bg-white text-black dark:bg-black dark:text-white" />
```

## Merging classes

`cn()` joins class names and lets later ones win, so a component can take a `className` that overrides its defaults:

```tsx
import { cn } from 'kitr/tailwind'

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('rounded-lg border p-4', className)} {...props} />
}

<Card className="p-8" /> // p-8 replaces p-4
```

## Config

| Option | Default | Description |
| --- | --- | --- |
| `entry` | `app/styles/app.css` | The stylesheet Tailwind starts from. |
| `preset` | `true` | Import kitr's preset. Set false to use plain Tailwind colours. |
