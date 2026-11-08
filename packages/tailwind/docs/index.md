---
title: Tailwind
description: Style with Tailwind CSS classes, already set up with kitr's colours.
order: 1
---

# Tailwind

Most React apps style with utility classes, and most spend their first afternoon wiring Tailwind to the design system: which blue is "primary", what dark mode keys off, how a component lets callers override its padding. `kitr add tailwind` does that wiring. `bg-background`, `text-primary` and `rounded-md` use the app's colours and radii, dark mode follows the [theme](/packages/theme) toggle, and `cn()` merges class names so the last one wins.

> [!SUMMARY]
> Tailwind CSS v4 with kitr's colours, dark mode and a class-merging `cn()` already wired. Add it with `kitr add tailwind`; the overview is at [/packages/tailwind](/packages/tailwind).

It is [Tailwind CSS v4](https://tailwindcss.com/docs) and its Vite plugin, plus a preset stylesheet that maps kitr's design tokens onto Tailwind's theme, and `cn()` built on [clsx](https://github.com/lukeed/clsx) and [tailwind-merge](https://github.com/dcastil/tailwind-merge). For plain CSS or CSS Modules, skip this package and use the helpers in [theme](/packages/theme).

The examples style the orders list in Acme's dashboard at `app.acme.com`: a status badge, an order card and a dark mode.

## Install

```sh
kitr add tailwind
```

<details>
<summary>Everything kitr add changes</summary>

- Adds [react](/packages/react) first if the project does not have it, because tailwind requires it.
- Installs `@kitr/tailwind`, `tailwindcss`, `@tailwindcss/vite`, `clsx`, `tailwind-merge` and `class-variance-authority`.
- Adds `@kitr/tailwind` to `packages` in `kitrrc.ts`. The `kitr()` Vite plugin sees it there and loads `@tailwindcss/vite`.
- Writes `config/tailwind.ts` (see [Configure](#configure)).
- Writes `app/styles/app.css`, the stylesheet Tailwind starts from. When `app/styles/tokens.css` exists (the [theme](/packages/theme) package writes it), it is imported last, so your token values win.
- In `app/document.tsx` (or `app/routes/__root.tsx`), swaps the linked `@kitr/theme/styles.css` for `app/styles/app.css`, so the theme stylesheet loads once, through `app.css`. A document with neither gets the new sheet added.
- Adds a `## kitr: tailwind` section to `AGENTS.md`.

It registers no provider, adds no env variables and asks no questions. Files that already exist are left alone. The `app` and `fullstack` kits, and presets built on them, include tailwind.

`kitr remove tailwind` takes `@kitr/tailwind` out of `kitrrc.ts`, uninstalls `@kitr/tailwind`, `tailwindcss`, `@tailwindcss/vite` and `tailwind-merge`, deletes `config/tailwind.ts` and the `AGENTS.md` section. It leaves `app/styles/app.css`, the import in `app/document.tsx`, `clsx` and `class-variance-authority`, because your components may still use them.

</details>

## Configure

`kitr add` writes this file:

```ts
// config/tailwind.ts
import { defineConfig } from '@kitr/tailwind'

export default defineConfig({
  entry: 'app/styles/app.css',
  preset: true,
})
```

| Option | Default | Description |
| --- | --- | --- |
| `entry` | `'app/styles/app.css'` | The stylesheet Tailwind starts from, relative to the project root. |
| `preset` | `true` | Whether the app uses kitr's preset (`@kitr/tailwind/preset.css`). |

Tailwind v4 is configured in CSS; these two options describe that file so `kitr doctor` can check it. To change the entry, link another file from `app/document.tsx` and set `entry`. To drop the preset, see [Use plain Tailwind colors](#use-plain-tailwind-colors).

The stylesheet `kitr add` writes is the real configuration:

```css
/* app/styles/app.css */
@import 'tailwindcss';
@import '@kitr/tailwind/preset.css';
@import '@kitr/theme/styles.css';

@source '../';
```

With `app/styles/tokens.css` present, `@import './tokens.css';` follows the theme import.

- `tailwindcss` loads Tailwind's base styles and utilities.
- `preset.css` maps kitr's tokens onto Tailwind's theme, makes `dark:` follow `data-theme="dark"` and sets the page's base colours and font.
- `@kitr/theme/styles.css` defines the token values as `--kitr-*` CSS variables, for light and dark.
- `@source '../'` tells Tailwind to scan `app/` for class names.

The Vite side is one option on the `kitr()` plugin in `vite.config.ts`:

| Option | Default | Description |
| --- | --- | --- |
| `tailwind` | `true` when `@kitr/tailwind` is in `kitrrc.ts` | Load `@tailwindcss/vite`. Set `false` to leave it out, as the generated `vitest.config.ts` does. |

There are no env variables and no `tailwind.config.js`: Tailwind v4 reads its theme from CSS.

## Style your first component

Class names are plain strings, so a styled component is a component with `className`. Here is the badge for an order's status:

```tsx
// app/components/orders/order-status-badge.tsx
export function OrderStatusBadge({ status }: { status: 'paid' | 'pending' | 'refunded' }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {status}
    </span>
  )
}
```

Use it anywhere:

```tsx
// app/pages/orders/index.tsx
import { OrderStatusBadge } from '#app/components/orders/order-status-badge'

export default function OrdersPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
      <p className="mt-2 text-muted-foreground">
        Order ACME-1042 from Grace <OrderStatusBadge status="paid" />
      </p>
    </main>
  )
}
```

Run `npm run dev` and open `/orders`. The heading uses the theme's foreground colour and the badge the muted surface, border and radius. Switch to dark and both follow without a `dark:` class.

## Use the theme's colors

The preset maps every kitr token to a Tailwind theme variable. Each colour works with every colour utility (`bg-`, `text-`, `border-`, `ring-`...) and with opacity modifiers like `bg-primary/90`.

| Class | Token | Use it for |
| --- | --- | --- |
| `bg-background`, `text-foreground` | `--kitr-color-background`, `--kitr-color-foreground` | The page and its text. |
| `bg-muted`, `text-muted-foreground` | `--kitr-color-muted`, `--kitr-color-mutedForeground` | Quiet surfaces and secondary text. |
| `bg-primary`, `text-primary-foreground` | `--kitr-color-primary`, `--kitr-color-primaryForeground` | Main buttons and links. |
| `bg-destructive`, `text-destructive-foreground` | `--kitr-color-destructive`, `--kitr-color-destructiveForeground` | Delete buttons and errors. |
| `border-border` | `--kitr-color-border` | Borders and dividers. |
| `ring-ring` | `--kitr-color-ring` | Focus rings. |
| `rounded-sm`, `rounded-md`, `rounded-lg` | `--kitr-radius-sm`, `-md`, `-lg` | Corner radii (0.25, 0.5 and 0.75 rem by default). |
| `font-sans`, `font-mono` | `--kitr-font-sans`, `--kitr-font-mono` | The system font stacks. |
| `shadow-sm`, `shadow-md` | `--kitr-shadow-sm`, `--kitr-shadow-md` | Soft elevation. |

The preset also defaults every border to `border-border` and gives `<body>` the background, text colour and sans font, so a plain `border` class draws a themed line.

```tsx
// app/components/orders/order-card.tsx
export function OrderCard({ number, customer, total }: { number: string; customer: string; total: string }) {
  return (
    <article className="rounded-lg border bg-background p-4 shadow-sm">
      <h2 className="font-mono text-sm text-muted-foreground">{number}</h2>
      <p className="mt-1 text-lg text-foreground">{customer}</p>
      <p className="mt-3 font-semibold text-primary">{total}</p>
      <button type="button" className="mt-4 rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground hover:bg-destructive/90">
        Refund
      </button>
    </article>
  )
}
```

Tailwind's own palette (`bg-sky-500`) is still there for one-off colours such as chart series; use theme classes for anything that should change with the theme.

## Change a color

Token values live in CSS variables, so set one after the imports. Acme's primary colour is orange:

```css
/* app/styles/app.css */
@import 'tailwindcss';
@import '@kitr/tailwind/preset.css';
@import '@kitr/theme/styles.css';

@source '../';

:root {
  --kitr-color-primary: oklch(68% 0.19 45);
  --kitr-color-ring: oklch(68% 0.19 45);
  --kitr-radius-md: 0.375rem;
}

[data-theme="dark"] {
  --kitr-color-primary: oklch(75% 0.16 45);
  --kitr-color-ring: oklch(75% 0.16 45);
}
```

Every `bg-primary`, `text-primary` and `ring-ring` in the app, and every component from `kitr ui add`, turns orange. Set the dark values under `[data-theme="dark"]`, or the light ones are used in both themes.

> [!WARNING] Change the variable, not the theme
> Don't edit the values in `@theme` (`--color-primary`) to change a colour. They reference the `--kitr-*` variables, and replacing them breaks dark mode.

## Add your own colors and sizes

For a token kitr does not have, add it to Tailwind's theme with an `@theme` block. Each `--color-*` variable becomes a colour utility, `--text-*` a font size, and so on:

```css
/* app/styles/app.css */
@import 'tailwindcss';
@import '@kitr/tailwind/preset.css';
@import '@kitr/theme/styles.css';

@source '../';

@theme {
  --color-success: oklch(62% 0.17 150);
  --color-success-foreground: oklch(99% 0 0);
  --text-display: 2.5rem;
}
```

```tsx
// app/components/orders/paid-banner.tsx
export function PaidBanner() {
  return (
    <div className="rounded-md bg-success p-3 text-success-foreground">
      <p className="text-display">Paid</p>
    </div>
  )
}
```

A colour that should differ in dark mode goes through a variable of your own, the way the preset does it:

```css
/* app/styles/app.css */
:root { --acme-success: oklch(62% 0.17 150); }
[data-theme="dark"] { --acme-success: oklch(72% 0.15 150); }

@theme inline {
  --color-success: var(--acme-success);
}
```

`@theme inline` makes the utility use the variable itself, so it changes with `data-theme`. The [Tailwind theme docs](https://tailwindcss.com/docs/theme) list every namespace.

## Support dark mode

The preset redefines the `dark:` variant to match `data-theme="dark"` on any ancestor, which `useTheme()` from [theme](/packages/theme) sets on `<html>`:

```css
/* from @kitr/tailwind/preset.css */
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```

Theme classes switch by themselves. Use `dark:` only for colours outside the theme:

```tsx
// app/components/orders/order-chart-legend.tsx
export function OrderChartLegend() {
  return (
    <ul className="flex gap-4 text-sm">
      <li className="text-sky-700 dark:text-sky-300">Online</li>
      <li className="text-amber-700 dark:text-amber-300">In store</li>
    </ul>
  )
}
```

A toggle button calls `useTheme()`:

```tsx
// app/components/theme-button.tsx
import { useTheme } from '@kitr/theme'

export function ThemeButton() {
  const { resolved, toggle } = useTheme()
  return (
    <button type="button" onClick={toggle} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
      {resolved === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  )
}
```

Tailwind's default `dark:` follows the operating system. With the preset it follows the attribute, so the user's choice in the app wins; the theme's `'system'` setting still follows the OS by setting the attribute for you.

## Merge classes with cn()

`cn()` takes any mix of strings, objects, arrays and falsy values, joins them with clsx, then removes Tailwind classes that a later class overrides:

```ts
import { cn } from '@kitr/tailwind'

cn('rounded-md border p-4', 'p-8')
// => 'rounded-md border p-8'

cn('px-3 py-1', { 'opacity-50': true, hidden: false }, ['text-sm', undefined])
// => 'px-3 py-1 opacity-50 text-sm'

cn('bg-primary hover:bg-primary/90', 'bg-destructive')
// => 'hover:bg-primary/90 bg-destructive'

cn('text-sm text-muted-foreground', 'text-destructive')
// => 'text-sm text-destructive'
```

Without merging, `'p-4 p-8'` leaves both classes on the element and stylesheet order, not your order, decides. tailwind-merge knows which conflict: `text-sm` (size) and `text-destructive` (colour) both stay; `px-2` then `p-4` leaves only `p-4`.

## Accept a className prop

Components take `className` and put it last in `cn()`, so callers can adjust them without a new prop per change:

```tsx
// app/components/orders/order-card.tsx
import { cn } from '@kitr/tailwind'
import type { ComponentProps } from 'react'

export function OrderCard({ className, ...props }: ComponentProps<'article'>) {
  return <article className={cn('rounded-lg border bg-background p-4 shadow-sm', className)} {...props} />
}
```

```tsx
<OrderCard className="p-8 shadow-md" />
// renders class="rounded-lg border bg-background p-8 shadow-md"
```

> [!WARNING] No template strings
> Don't join with a template string (`` `p-4 ${className}` ``): both padding classes reach the browser and stylesheet order decides.

## Build variants with cva

For a component with variants (a status, a size), [class-variance-authority](https://cva.style/docs) maps each to classes. `kitr add tailwind` installs it and the `kitr ui add` components use it:

```tsx
// app/components/orders/order-status-badge.tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@kitr/tailwind'
import type { ReactNode } from 'react'

export const orderStatusBadge = cva('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', {
  variants: {
    status: {
      paid: 'bg-primary text-primary-foreground',
      pending: 'bg-muted text-muted-foreground',
      refunded: 'bg-destructive text-destructive-foreground',
    },
    size: {
      sm: 'text-xs',
      md: 'px-3 py-1 text-sm',
    },
  },
  defaultVariants: { status: 'pending', size: 'sm' },
})

type Props = VariantProps<typeof orderStatusBadge> & { className?: string; children: ReactNode }

export function OrderStatusBadge({ status, size, className, children }: Props) {
  return <span className={cn(orderStatusBadge({ status, size }), className)}>{children}</span>
}
```

```tsx
<OrderStatusBadge status="refunded" size="md">Refunded</OrderStatusBadge>
// class="inline-flex items-center rounded-md font-medium bg-destructive text-destructive-foreground px-3 py-1 text-sm"
```

`cn()` around the `cva` call lets `size: 'md'` replace the base `px-2 py-0.5 text-xs` instead of adding to it. `cva` is also re-exported from `@kitr/theme`.

## Teach cn() about your own tokens

tailwind-merge only knows Tailwind's built-in scales, so it takes a custom size such as `text-display` for a colour and `cn('text-display', 'text-primary')` drops it. Build your own `cn` with `extendTailwindMerge`:

```ts
// app/lib/cn.ts
import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const merge = extendTailwindMerge({
  extend: { theme: { text: ['display'] } },
})

export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs))
}

cn('text-display', 'text-primary')
// => 'text-display text-primary'
```

Custom colours need nothing: `cn('bg-success', 'bg-primary')` already returns `'bg-primary'`. `clsx` and `twMerge` are also exported from `@kitr/tailwind`.

## Tell Tailwind where your classes are

Tailwind generates only the classes it finds in your source files. `@source '../'` points it at `app/`; classes written elsewhere need their own line:

```css
/* app/styles/app.css */
@import 'tailwindcss';
@import '@kitr/tailwind/preset.css';
@import '@kitr/theme/styles.css';

@source '../';
@source '../../server/mail';
@source '../../node_modules/@acme/ui/dist';
```

Tailwind finds classes by reading the files as text, so a class has to appear whole:

```tsx
// Don't: Tailwind never sees "bg-primary" or "bg-destructive"
<span className={`bg-${order.paid ? 'primary' : 'destructive'}`} />

// Do: both full class names are in the source
<span className={order.paid ? 'bg-primary' : 'bg-destructive'} />
```

A class that appears in the HTML but has no style is almost always built from pieces or in a folder no `@source` covers.

## Style kitr's own components

Headless kitr components mark their parts with `data-kitr` attributes, so Tailwind's arbitrary variants can reach them. The field wrapper from [forms](/packages/forms) is one:

```tsx
// app/components/orders/refund-reason-field.tsx
import { FieldInput, FormField } from '@kitr/forms'

export function RefundReasonField() {
  return (
    <FormField
      name="reason"
      label="Reason for the refund"
      className="grid gap-1.5 [&_[data-kitr=label]]:text-sm [&_[data-kitr=label]]:font-medium [&_[data-kitr=field-error]]:text-sm [&_[data-kitr=field-error]]:text-destructive"
    >
      <FieldInput className="rounded-md border bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
    </FormField>
  )
}
```

For a finished look, `kitr ui add form` copies a styled version into `app/components/ui/form.tsx`. Every component `kitr ui add` copies is plain Tailwind on theme classes and `cn()`, and the code is yours to change.

## Use plain Tailwind colors

To use Tailwind without kitr's tokens, remove the preset import, and the theme stylesheet if nothing else needs it:

```css
/* app/styles/app.css */
@import 'tailwindcss';

@source '../';
```

Then set `preset: false` in `config/tailwind.ts`. Without the preset, `bg-primary` and the other theme classes stop existing, `dark:` follows `prefers-color-scheme` again, and `kitr ui add` components lose their colours.

## Wire Tailwind into a custom Vite config

The `kitr()` plugin loads `@tailwindcss/vite` for you. If you build a Vite config without `kitr()`, or want to control plugin order, turn it off there and add `kitrTailwind()` from `@kitr/tailwind/vite`:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { kitr } from '@kitr/vite'
import { kitrTailwind } from '@kitr/tailwind/vite'

export default defineConfig({
  plugins: [kitrTailwind(), kitr({ plugins: { tailwind: false } })],
})
```

> [!WARNING] One Tailwind plugin
> Don't add Tailwind's plugin while `kitr()` also loads it: the CSS is processed twice.

## Fix styles that do not apply

Check these causes in order:

| Symptom | Cause | Fix |
| --- | --- | --- |
| No Tailwind styles at all | `app/styles/app.css` is not imported, or `@kitr/tailwind` is missing from `packages` in `kitrrc.ts` so the Vite plugin is not loaded. | Import `#app/styles/app.css` in `app/document.tsx`; run `kitr doctor`. |
| `bg-primary` and other theme classes do nothing | The preset import is missing from `app/styles/app.css`. | Add `@import '@kitr/tailwind/preset.css';` after `@import 'tailwindcss';`. |
| Theme classes resolve but have no colour | `@kitr/theme/styles.css` is not imported, so the `--kitr-*` variables are undefined. | Add `@import '@kitr/theme/styles.css';`. |
| `dark:` classes never apply | Nothing sets `data-theme="dark"` on `<html>`. | Mount the [theme](/packages/theme) provider and switch with `useTheme()`. |
| One class works in one file but not another | The file is outside every `@source` folder, or the class is built from pieces. | Add an `@source` line, or write the whole class name. |
| A caller's `className` does not win | The component joins classes with a template string. | Use `cn(base, className)`. |
| A custom class disappears when merged | tailwind-merge treats it as a conflicting class. | Extend it ([Teach cn() about your own tokens](#teach-cn-about-your-own-tokens)). |

`kitr doctor` warns when `vite.config.ts` does not use the `kitr()` plugin. In devtools, a class on the element with no matching rule was not generated; one with a rule crossed out was overridden.

## Testing

Tests do not build CSS: the generated `vitest.config.ts` runs `kitr({ plugins: { tailwind: false } })`. A test checks which classes a component renders, so test `cn()` merges and variant classes directly:

```tsx
// app/components/orders/order-status-badge.test.tsx
import { render, screen } from '@testing-library/react'
import { cn } from '@kitr/tailwind'
import { describe, expect, it } from 'vitest'
import { OrderStatusBadge, orderStatusBadge } from './order-status-badge'

describe('OrderStatusBadge', () => {
  it('uses the theme colours for each status', () => {
    expect(orderStatusBadge({ status: 'paid' })).toContain('bg-primary text-primary-foreground')
    expect(orderStatusBadge()).toContain('bg-muted text-muted-foreground')
  })

  it('lets a size replace the base padding', () => {
    render(
      <OrderStatusBadge status="refunded" size="md">
        Refunded
      </OrderStatusBadge>,
    )
    const badge = screen.getByText('Refunded')
    expect(badge.className).toContain('px-3 py-1 text-sm')
    expect(badge.className).not.toContain('px-2')
  })

  it('lets callers override classes', () => {
    render(
      <OrderStatusBadge status="paid" className="rounded-lg">
        Paid
      </OrderStatusBadge>,
    )
    expect(screen.getByText('Paid').className.split(' ')).toContain('rounded-lg')
    expect(screen.getByText('Paid').className.split(' ')).not.toContain('rounded-md')
  })

  it('merges with cn the way the component does', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
    expect(cn('text-sm', { 'text-lg': true }, false, undefined)).toBe('text-lg')
  })
})
```

To check how a page looks, light and dark, use a browser test with [Playwright](https://playwright.dev/docs/screenshots) against `npm run dev`.

## Next steps

- [API reference](/packages/tailwind/api): `cn`, `defineConfig`, `TailwindConfig` and `kitrTailwind`.
- [Theme](/packages/theme): the tokens behind the classes and `useTheme()`.
- [Forms](/packages/forms): headless fields you style with the `data-kitr` attributes.
