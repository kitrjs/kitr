---
title: Overview
description: Style with Tailwind CSS classes, already set up with kitr's colours.
order: 0
---

# Tailwind

Most React apps style with utility classes now, and most of them spend their first afternoon wiring Tailwind to the design system: which blue is "primary", what dark mode keys off, how a component lets callers override its padding without two conflicting classes fighting. Every project solves it again, slightly differently.

`kitr add tailwind` does that wiring, so `bg-background` and `text-primary` mean the same thing as the rest of the app.

## What it is

`@kitr/tailwind` is Tailwind CSS v4 with a preset stylesheet that maps kitr's design tokens onto Tailwind's theme, and `cn()`, which merges class names so the last one wins. Dark mode follows the [theme](/packages/theme) toggle. `defineConfig` in `config/tailwind.ts` adds your own colors and sizes, and `kitrTailwind` is the Vite plugin that the `kitr()` plugin already registers.

It runs at build time and in the browser; there is nothing to call on the server. If you prefer plain CSS or CSS Modules, skip this package and use the helpers in [theme](/packages/theme) instead.

## Install

```sh
kitr add tailwind
```

This installs `@kitr/tailwind` with Tailwind CSS 4, its Vite plugin, clsx, tailwind-merge and class-variance-authority, adds the package to `kitrrc.ts`, writes `config/tailwind.ts` and `app/styles/app.css`, and points `app/document.tsx` at the new stylesheet. It adds [react](/packages/react) first when the project does not have it. The guide's [Install](/packages/tailwind/guide#install) section lists every change.

## Quick start

A styled component is a component with `className`. The utilities map to the theme's tokens, so `bg-muted` and `border-border` are the theme's colours, not Tailwind's defaults:

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

Run `kitr dev` and open `/orders`. The heading uses the theme's foreground colour, the badge sits on the muted surface with the theme's border and radius. Switch the theme to dark and both follow without a `dark:` class, because the tokens change under them. The guide continues from here: [Style your first component](/packages/tailwind/guide#style-your-first-component).

## Built on

| Built on | Role |
| --- | --- |
| [Tailwind CSS v4](https://tailwindcss.com/docs) and `@tailwindcss/vite` | The utilities, variants and the `@theme` syntax, unchanged. |
| [clsx](https://github.com/lukeed/clsx) | Conditional class names inside `cn()`. |
| [tailwind-merge](https://github.com/dcastil/tailwind-merge) | Conflict resolution inside `cn()`, so `p-2 p-4` becomes `p-4`. |

kitr adds the preset that maps the theme tokens, the `cn()` helper taught about your own tokens, the config file and the Vite wiring.

## Problems it solves

- **Design tokens and Tailwind colors out of step.** The preset maps every token to a class, so changing a token changes the classes. See [Use the theme's colors](/packages/tailwind/guide#use-the-themes-colors).
- **Dark mode wired twice.** Tailwind's dark variant follows the theme attribute. See [Support dark mode](/packages/tailwind/guide#support-dark-mode).
- **Conflicting classes from a `className` prop.** `cn()` lets the caller's class win. See [Merge classes with cn()](/packages/tailwind/guide#merge-classes-with-cn).
- **Variants by string concatenation.** Build them with `cva` on top of `cn()`. See [Build variants with cva](/packages/tailwind/guide#build-variants-with-cva).
- **Styles that do not apply.** The guide covers content paths, purge and ordering. See [Fix styles that do not apply](/packages/tailwind/guide#fix-styles-that-do-not-apply).

## Further reading

- [Guide](/packages/tailwind/guide): install, configure and every task.
- [API reference](/packages/tailwind/api): `cn`, `defineConfig`, `TailwindConfig` and `kitrTailwind`.
- [Tailwind CSS docs](https://tailwindcss.com/docs): every utility, variant and the `@theme` syntax.
- [tailwind-merge](https://github.com/dcastil/tailwind-merge) and [clsx](https://github.com/lukeed/clsx): what `cn()` is made of.
- [Theme](/packages/theme) and [Forms](/packages/forms): the tokens behind the classes, and fields styled with `data-kitr` attributes.
