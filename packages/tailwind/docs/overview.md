---
title: Overview
description: Style with Tailwind CSS classes, already set up with kitr's colours.
order: 0
---

# Tailwind

## What it is

`@kitr/tailwind` is Tailwind CSS v4 with a preset that maps kitr's design tokens onto Tailwind's theme, and `cn()` to merge class names. Dark mode follows the [theme](/packages/theme) toggle.

Runs at build time and in the browser. If you prefer plain CSS, use the helpers in [theme](/packages/theme) instead.

## Install

```sh
kitr add tailwind
```

Adds `@kitr/tailwind` with Tailwind CSS 4, `config/tailwind.ts` and `app/styles/app.css`. Adds [react](/packages/react) first if missing. [Every change](/packages/tailwind/guide#install).

## Quick start

A styled component is a component with `className`. `bg-muted` and `border-border` are the theme's colours:

```tsx
// app/features/orders/order-status-badge.tsx
export function OrderStatusBadge({ status }: { status: 'paid' | 'pending' | 'refunded' }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {status}
    </span>
  )
}
```

Use it on a page:

```tsx
// app/pages/orders/index.tsx
import { OrderStatusBadge } from '#app/features/orders/order-status-badge'

export default () => (
  <main className="mx-auto max-w-3xl p-6">
    <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
    <p className="mt-2 text-muted-foreground">
      Order ACME-1042 from Grace <OrderStatusBadge status="paid" />
    </p>
  </main>
)
```

Open `/orders`. Switch the theme to dark and the badge follows with no `dark:` class, because the tokens change under it. Next in the guide: [Style your first component](/packages/tailwind/guide#style-your-first-component).

## Built on

| Built on | Role |
| --- | --- |
| [Tailwind CSS v4](https://tailwindcss.com/docs) and `@tailwindcss/vite` | The utilities, variants and the `@theme` syntax, unchanged. |
| [clsx](https://github.com/lukeed/clsx) | Conditional class names inside `cn()`. |
| [tailwind-merge](https://github.com/dcastil/tailwind-merge) | Conflict resolution inside `cn()`, so `p-2 p-4` becomes `p-4`. |

kitr adds the preset, `cn()`, the config file and the Vite wiring.

## Problems it solves

- **Design tokens and Tailwind colors out of step.** [Use the theme's colors](/packages/tailwind/guide#use-the-themes-colors).
- **Dark mode wired twice.** [Support dark mode](/packages/tailwind/guide#support-dark-mode).
- **Conflicting classes from a `className` prop.** [Merge classes with cn()](/packages/tailwind/guide#merge-classes-with-cn).
- **Variants by string concatenation.** [Build variants with cva](/packages/tailwind/guide#build-variants-with-cva).
- **Styles that do not apply.** [Fix styles that do not apply](/packages/tailwind/guide#fix-styles-that-do-not-apply).

## Further reading

- [Guide](/packages/tailwind/guide).
- [API reference](/packages/tailwind/api).
- [Tailwind CSS docs](https://tailwindcss.com/docs).
- [tailwind-merge](https://github.com/dcastil/tailwind-merge) and [clsx](https://github.com/lukeed/clsx).
- [Theme](/packages/theme) and [Forms](/packages/forms).
