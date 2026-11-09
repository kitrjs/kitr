---
title: Theme
description: Light, dark and system themes with no flash on load, design tokens, and the components you copy into your app.
order: 1
---

# Theme

Users expect dark mode without a white flash on load. `@kitr/theme` gives you light, dark and system themes that remember the user's choice, design tokens as CSS variables, and the settings `kitr ui add` uses to copy components into your app. Components come from [shadcn/ui](https://ui.shadcn.com)-compatible registries.

> [!SUMMARY]
> Light, dark and system themes with no flash on load, design tokens and copy-in components. Add it with `kitr add theme`; the overview is at [/packages/theme](/packages/theme).

This guide follows Acme's dashboard at `app.acme.com`: Ada adds a dark mode toggle, brands the colours and copies in a few components. Toasts have their own package, [toast](/packages/toast). For utility classes on the same tokens, add [tailwind](/packages/tailwind).

## Install

```sh
kitr add theme
```

<details>
<summary>Everything kitr add changes</summary>

- Adds [react](/packages/react) first if the project does not have it, because theme requires it.
- Installs `@kitr/theme`, adds it to `packages` and its provider to `providers` in `kitrrc.ts`.
- Writes `config/theme.ts` (see Configure) and `app/styles/tokens.css`, an empty `:root` block for your token overrides.
- Loads `tokens.css` after kitr's tokens, so your values win: with [tailwind](/packages/tailwind) through `@import './tokens.css';` in `app/styles/app.css`, otherwise by linking it from `head()` in `app/document.tsx`.
- Edits `app/document.tsx` (or `app/routes/__root.tsx`) to apply the saved theme before first paint: puts `<ThemeScript />` above `<HeadContent />` and adds `suppressHydrationWarning` to `<html lang="en">`. A document that already has `<ThemeScript` or no `<HeadContent />` is left alone ([Avoid a flash on load](#avoid-a-flash-on-load)).
- Adds a `theme` section to `AGENTS.md`.

It adds no environment variables or scripts, skips `config/theme.ts` and `tokens.css` when they exist, and asks no questions. `--no-install` skips the package manager and `--dry-run` prints the plan.

The `app`, `fullstack`, `saas`, `site`, `realtime`, `desktop` and `mobile` kits include theme, with a starter set of components (`icon`, `button`, `input`, `card`, `theme-toggle` and more).

`kitr remove theme` removes `<ThemeScript />`, its import and `suppressHydrationWarning`, the provider, the `packages` entry, the dependency, `config/theme.ts` and the `AGENTS.md` section. `app/styles/tokens.css`, its import and `app/components/ui/` stay, because they are yours.

</details>

The base stylesheet `@kitr/theme/styles.css` is linked from the `app/document.tsx` that [router](/packages/router) writes (or imported by `app/styles/app.css` with tailwind), so it is in place before you add theme.

## Configure

`kitr add theme` writes this file:

```ts
// config/theme.ts
import { defineConfig } from '@kitr/theme'

export default defineConfig({
  default: 'system',
  // Window chrome / <meta name="theme-color"> per theme.
  colors: { light: '#ffffff', dark: '#0a0a0a' },
  // Any shadcn-compatible registry for `kitr ui add`. Default: kitr's.
  // registry: 'https://raw.githubusercontent.com/kitrjs/kitr/main/registry/dist',
  componentsDir: 'app/components/ui',
})
```

| Option | Default | Description |
| --- | --- | --- |
| `default` | `'system'` | The theme before the user picks one: `'light'`, `'dark'` or `'system'`. |
| `storageKey` | `'kitr-theme'` | The `localStorage` key and cookie name that hold the user's choice. Pass the same value to `<ThemeScript>`. |
| `attribute` | `'data-theme'` | The attribute set on `<html>` to `light` or `dark`. Pass the same value to `<ThemeScript>`. |
| `colors.light` | none | `<meta name="theme-color">` while the light theme shows. Browsers and installed PWAs tint their chrome with it. |
| `colors.dark` | none | The same, for the dark theme. |
| `transition` | none | How a theme change animates: a built-in name, your own, or `{ name, duration, easing, direction, animate }`. See [Animate the theme change](#animate-the-theme-change). |
| `registry` | kitr's registry | Where `kitr ui add` and `kitr ui list` fetch components: a URL or a local directory. |
| `componentsDir` | `app/components/ui` | Where `kitr ui add` writes components. |
| `tokens.light`, `tokens.dark` | none | Reserved slot for token overrides; override tokens in `app/styles/tokens.css` (see [Brand the colors](#brand-the-colors)). |

| Variable | Used for |
| --- | --- |
| `KITR_REGISTRY` | Overrides `registry` for one `kitr ui add` or `kitr ui list` run, such as in CI. |

The config is read once, when the app is created. `useConfig('theme')` from [react](/packages/react) returns it in a component.

## Add a dark mode toggle

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

Put it in the document:

```tsx
// app/document.tsx
// ...
import { ThemeButton } from '#app/components/theme-button'

export function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <HeadContent />
      </head>
      <body>
        <nav style={{ display: 'flex', gap: 12, padding: 12 }}>
          <Link to="/">Home</Link>
          <ThemeButton />
        </nav>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
```

Click it and the page turns dark: `<html>` gets `data-theme="dark"`, every `--kitr-*` variable switches to its dark value, and the choice is saved, so a reload keeps it.

| Field | What it is |
| --- | --- |
| `theme` | The user's choice: `'light'`, `'dark'` or `'system'`. |
| `resolved` | What shows on screen: `'light'` or `'dark'`. With `'system'`, it follows the operating system and updates when the OS setting changes. |
| `setTheme(theme, options?)` | Sets the choice and saves it to `localStorage` and a one-year cookie. `options` takes `from` and `transition`. |
| `toggle(options?)` | Switches to the opposite of `resolved` and saves that, which leaves `'system'`. |

For a styled toggle with an icon, `kitr ui add theme-toggle` writes `app/components/ui/theme-toggle.tsx` (plus `button` and `icon`); render `<ThemeToggle />`.

## Animate the theme change

A theme change is instant by default. Set `transition` in `config/theme.ts` and every `setTheme` and `toggle` animates through a [view transition](https://developer.mozilla.org/docs/Web/API/View_Transition_API):

```ts
// config/theme.ts
import { defineConfig } from '@kitr/theme'

export default defineConfig({
  default: 'system',
  colors: { light: '#ffffff', dark: '#0a0a0a' },
  transition: 'circle',
  componentsDir: 'app/components/ui',
})
```

Pass the button as `from` and the circle grows out of it. The registry's `theme-toggle` already does:

```tsx
// app/components/theme-button.tsx
<button type="button" onClick={(e) => toggle({ from: e.currentTarget })}>
```

`from` also takes a point, `{ x, y }` in viewport pixels. Without it, a transition that needs an origin starts at the top centre. Visitors who ask for less motion, browsers without view transitions, and a change that leaves the same theme on screen all get an instant change.

### Built-in transitions

The animations live in `@kitr/theme/styles.css`, which the router's `app/document.tsx` already links.

| Name | What it looks like |
| --- | --- |
| `'fade'` | The old theme fades out as the new one fades in. |
| `'circle'` | The new theme grows as a circle from `from`. |
| `'diamond'` | The same, as a diamond. |
| `'wipe'` | The new theme sweeps across the page; `direction` picks the way. |
| `'blur'` | The old theme blurs and fades away over the new one. |

### Set the timing

Pass an object for the timing. Every field is optional:

```ts
// config/theme.ts
import { defineConfig } from '@kitr/theme'

export default defineConfig({
  default: 'system',
  transition: { name: 'wipe', duration: 600, easing: 'ease-in-out', direction: 'right' },
})
```

| Field | Default | Description |
| --- | --- | --- |
| `name` | `'fade'` | A built-in name or your own (see [Add your own transition](#add-your-own-transition)). |
| `duration` | `400` | Milliseconds. |
| `easing` | `'cubic-bezier(0.65, 0, 0.35, 1)'` | Any CSS easing function. |
| `direction` | `'down'` | For `wipe`: `'down'`, `'up'`, `'left'` or `'right'`. |
| `animate` | none | A function that runs the animation itself (see [Animate it in code](#animate-it-in-code)). |

### Pick a transition for one change

In a component, pass `transition` to `setTheme` or `toggle` and it wins over the config for that call. `false` makes that one change instant:

```tsx
// app/components/settings/appearance.tsx
import { useTheme } from '@kitr/theme'

export function ResetAppearance() {
  const { setTheme } = useTheme()
  return (
    <button type="button" onClick={() => setTheme('system', { transition: false })}>
      Match my system
    </button>
  )
}
```

The same works the other way: leave `transition` out of the config and pass one only where you want motion, such as `toggle({ from: e.currentTarget, transition: 'circle' })` on the header button.

### Add your own transition

Any name that is not built in is yours to style. While the change runs, `<html>` carries the name and the timing, and you animate the browser's two pictures of the page, `::view-transition-old(root)` and `::view-transition-new(root)`:

```css
/* app/styles/app.css */
html[data-kitr-theme-transition="curtain"]::view-transition-new(root) {
  animation: acme-curtain var(--kitr-theme-transition-duration)
    var(--kitr-theme-transition-easing) both;
}

@keyframes acme-curtain {
  from {
    clip-path: inset(0 50%);
  }
  to {
    clip-path: inset(0 0);
  }
}
```

Then name it: `transition: 'curtain'`, or `{ name: 'curtain', duration: 700 }`. kitr turns off the browser's default cross-fade for every theme transition, so only your animation runs.

| On `<html>` while it runs | Value |
| --- | --- |
| `data-kitr-theme-transition` | The transition's name, or `custom` for an `animate` with no name. |
| `data-kitr-theme-to` | `light` or `dark`: the theme coming in. Style each way differently with it. |
| `data-kitr-theme-direction` | The `direction` option. |
| `--kitr-theme-transition-duration` | The duration, such as `400ms`. |
| `--kitr-theme-transition-easing` | The easing. |
| `--kitr-theme-transition-x`, `--kitr-theme-transition-y` | The origin from `from`, in pixels. Unset without `from`. |

The same attributes style anything else during the change, such as an icon that turns in with the new theme: `in-data-[kitr-theme-transition]:animate-spin`. To animate the old picture over the new one, give `::view-transition-old(root)` a `z-index: 1`.

### Animate it in code

For an animation CSS cannot express, pass `animate`. It runs once the browser has both pictures, and gets the transition, the themes, the origin and the timing:

```ts
// config/theme.ts
import { defineConfig } from '@kitr/theme'

export default defineConfig({
  default: 'system',
  transition: {
    duration: 500,
    animate({ origin, duration, easing }) {
      const radius = Math.hypot(window.innerWidth, window.innerHeight)
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0 at ${origin.x}px ${origin.y}px)`,
            `circle(${radius}px at ${origin.x}px ${origin.y}px)`,
          ],
        },
        { duration, easing, pseudoElement: '::view-transition-new(root)' },
      )
    },
  },
})
```

| `animate` gets | What it is |
| --- | --- |
| `transition` | The browser's [`ViewTransition`](https://developer.mozilla.org/docs/Web/API/ViewTransition); `finished` settles when the change is over. |
| `from`, `to` | The theme before and after: `'light'` or `'dark'`. |
| `origin` | `{ x, y }`: the centre of `from`, or the top centre without one. |
| `duration`, `easing` | From the options, or the defaults. |

`animate` is not called for visitors who ask for less motion or in browsers without view transitions. A second change while one runs skips the first to its end, so a fast double click never stacks animations.

## Let users pick light, dark or system

`toggle()` is a two-way switch. To offer "match my system" as well, call `setTheme` from a select:

```tsx
// app/components/settings/appearance.tsx
import { type Theme, useTheme } from '@kitr/theme'

export function AppearanceSetting() {
  const { theme, setTheme } = useTheme()
  return (
    <label>
      Appearance
      <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
        <option value="system">Match system</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  )
}
```

With `system` saved, `resolved` follows the OS without a reload, so the dashboard goes dark when Linus's laptop does at sunset. A stored value other than `light`, `dark` or `system` is ignored and `default` applies.

## Avoid a flash on load

React applies the theme after it hydrates, a moment after first paint, so a dark-mode user would see a white flash. `<ThemeScript />` is a tiny inline script that reads the saved choice and sets `data-theme` before anything paints. Put it first in the document head:

```tsx
// app/document.tsx
import { HeadContent, Outlet, Scripts } from '@kitr/router'
import { ThemeScript } from '@kitr/theme'
import css0 from '@kitr/theme/styles.css?url'

export function head() {
  return {
    meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    links: [{ rel: 'stylesheet', href: css0 }],
  }
}

export function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
```

`suppressHydrationWarning` on `<html>` tells React that the script's change to the attribute is expected. `kitr add theme` and the kits add both for you. The script only reads `localStorage`, so it works in `ssr`, `static` and `spa` modes and in desktop and mobile shells.

If you changed `storageKey` or `attribute` in `config/theme.ts`, pass the same values, because the script reads its props, not the config: `<ThemeScript storageKey="acme-theme" attribute="data-mode" />`.

## Render the saved theme on the server

In `ssr` mode the server can send the right theme in the HTML. `setTheme` writes a cookie as well as `localStorage`, and `themeFromCookie` reads it from the request:

```ts
// app/lib/theme/read-theme.ts
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { themeFromCookie } from '@kitr/theme/server'

/** Runs on the server only: the visitor's theme, straight from the request cookie. */
export const readTheme = createServerFn({ method: 'GET' }).handler(
  () => themeFromCookie(getRequest().headers.get('cookie')) ?? null,
)
```

```ts
// app/routes.ts
import { head, RootDocument } from './document'
import { readTheme } from '#app/lib/theme/read-theme'

r.root({ head, loader: () => readTheme(), component: RootDocument })
```

```tsx
// app/document.tsx
// ...
import { getRouteApi } from '@kitr/router'

const root = getRouteApi('__root__')

export function RootDocument() {
  const theme = root.useLoaderData()
  return (
    <html lang="en" data-theme={theme ?? undefined} suppressHydrationWarning>
      <head>
        <ThemeScript />
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
```

`themeFromCookie` returns only `'light'` or `'dark'`:

```ts
import { themeFromCookie } from '@kitr/theme/server'

themeFromCookie('session=abc; kitr-theme=dark') // => 'dark'
themeFromCookie('kitr-theme=system') // => undefined (the server cannot know the OS setting)
themeFromCookie(null) // => undefined
themeFromCookie('acme-theme=light', 'acme-theme') // => 'light', with a custom storageKey
```

When it returns `undefined`, `<ThemeScript />` resolves `system` in the browser. Keep it in any case: it covers static pages and the shells, where there is no request.

## Color the window chrome and status bar

`colors` in `config/theme.ts` keeps `<meta name="theme-color">` in step with the theme. Browsers tint their toolbar, and installed PWAs their title bar, with it:

```ts
// config/theme.ts
import { defineConfig } from '@kitr/theme'

export default defineConfig({
  default: 'system',
  colors: { light: '#ffffff', dark: '#0b1020' },
  componentsDir: 'app/components/ui',
})
```

On every change of `resolved`, the provider sets the tag's `content` (creating the tag if needed). Pick the same colour as `--kitr-color-background` so the chrome blends in. Inside the [desktop](/packages/desktop) and [mobile](/packages/mobile) shells, whether the window or status bar follows it depends on the shell's web view.

## Use the tokens in CSS

`@kitr/theme/styles.css` defines every token as a `--kitr-*` variable on `:root`, with dark values under `[data-theme="dark"]`. Use them in any stylesheet and the component follows the theme:

```css
/* app/components/invoices/invoice-card.module.css */
.card {
  background: var(--kitr-color-background);
  color: var(--kitr-color-foreground);
  border: 1px solid var(--kitr-color-border);
  border-radius: var(--kitr-radius-md);
  box-shadow: var(--kitr-shadow-sm);
  font-family: var(--kitr-font-sans);
}
.overdue {
  border-color: var(--kitr-color-destructive);
}
```

| Token | Light | Dark |
| --- | --- | --- |
| `--kitr-color-background` | `oklch(99% 0 0)` | `oklch(16% 0.01 260)` |
| `--kitr-color-foreground` | `oklch(20% 0.01 260)` | `oklch(95% 0.005 260)` |
| `--kitr-color-muted` | `oklch(96% 0.005 260)` | `oklch(24% 0.01 260)` |
| `--kitr-color-mutedForeground` | `oklch(50% 0.02 260)` | `oklch(70% 0.02 260)` |
| `--kitr-color-border` | `oklch(90% 0.01 260)` | `oklch(30% 0.01 260)` |
| `--kitr-color-primary` | `oklch(55% 0.2 262)` | `oklch(70% 0.17 262)` |
| `--kitr-color-primaryForeground` | `oklch(99% 0 0)` | `oklch(16% 0.01 260)` |
| `--kitr-color-destructive` | `oklch(55% 0.22 27)` | `oklch(65% 0.2 27)` |
| `--kitr-color-destructiveForeground` | `oklch(99% 0 0)` | `oklch(16% 0 0)` |
| `--kitr-color-ring` | `oklch(55% 0.2 262)` | `oklch(70% 0.17 262)` |
| `--kitr-radius-sm`, `-md`, `-lg` | `0.25rem`, `0.5rem`, `0.75rem` | same |
| `--kitr-font-sans`, `--kitr-font-mono` | the system UI and monospace stacks | same |
| `--kitr-shadow-sm`, `--kitr-shadow-md` | soft shadows at 6% and 8% black | same |

> [!WARNING] No hard-coded colours
> Don't hard-code `#fff` or `rgb(...)` in a component: it won't change with the theme or when Acme rebrands.

The same tokens exist in JavaScript:

```ts
import { darkTokens, defaultTokens } from '@kitr/theme'

defaultTokens.var('color.primary') // => 'var(--kitr-color-primary)'
defaultTokens.name('radius.md') // => '--kitr-radius-md'
defaultTokens.tokens.radius.md // => '0.5rem'
darkTokens.tokens.color.background // => 'oklch(16% 0.01 260)'
```

## Brand the colors

To change a token for the whole app, override its variable in `app/styles/tokens.css`. Acme's brand is a teal primary:

```css
/* app/styles/tokens.css */
:root {
  --kitr-color-primary: oklch(60% 0.12 190);
  --kitr-color-ring: oklch(60% 0.12 190);
  --kitr-radius-md: 0.375rem;
}
[data-theme="dark"] {
  --kitr-color-primary: oklch(72% 0.11 190);
  --kitr-color-ring: oklch(72% 0.11 190);
}
```

`kitr add theme` loads this file for you. If you move it, keep it after `@kitr/theme/styles.css` so your values win the cascade. Without tailwind, link it from the document:

```tsx
// app/document.tsx
import css0 from '@kitr/theme/styles.css?url'
import tokens from '#app/styles/tokens.css?url'

export function head() {
  return {
    links: [
      { rel: 'stylesheet', href: css0 },
      { rel: 'stylesheet', href: tokens },
    ],
  }
}
```

With [tailwind](/packages/tailwind), use `@import './tokens.css';` in `app/styles/app.css` after the theme import instead.

## Define your own tokens

`defineTokens` turns a nested object into CSS variables with typed names, for values kitr has no token for, such as Acme's invoice status colours:

```ts
// app/styles/acme-tokens.ts
import { defineTokens } from '@kitr/theme'

export const acme = defineTokens(
  {
    status: { paid: 'oklch(65% 0.15 150)', overdue: 'oklch(60% 0.2 27)' },
    space: { card: 16 },
  },
  { prefix: 'acme' },
)

acme.name('status.paid') // => '--acme-status-paid'
acme.var('status.overdue') // => 'var(--acme-status-overdue)'
acme.flat()
// => { '--acme-status-paid': 'oklch(65% 0.15 150)', '--acme-status-overdue': 'oklch(60% 0.2 27)', '--acme-space-card': '16' }
acme.css()
// => ':root {\n  --acme-status-paid: oklch(65% 0.15 150);\n  --acme-status-overdue: oklch(60% 0.2 27);\n  --acme-space-card: 16;\n}\n'
```

`acme.var('status.unpaid')` is a type error, because paths are checked against the object. Numbers are written without a unit; write `'16px'` when CSS needs one. The prefix defaults to `kitr`.

Emit the variables once from the root layout, or spread `flat()` into a `style` to scope them to one element:

```tsx
// app/components/invoices/invoice-status.tsx
import { acme } from '#app/styles/acme-tokens'

export function InvoiceStatus({ status }: { status: 'paid' | 'overdue' }) {
  return (
    <span style={{ ...acme.flat(), color: acme.var(`status.${status}`) }}>
      {status === 'paid' ? 'Paid' : 'Overdue'}
    </span>
  )
}
```

```tsx
// app/document.tsx
import { acme } from '#app/styles/acme-tokens'

// inside <head>, after <HeadContent />:
<style>{acme.css()}</style>
```

## Style with CSS Modules

Without Tailwind, CSS Modules plus three small helpers cover most styling. `kitr css:types` writes a `.d.ts` next to each `*.module.css` so class names are checked:

```sh
kitr css:types
```

```ts
// app/components/invoices/invoice-card.module.css.d.ts
// Generated by `kitr css:types`. Do not edit.
declare const classes: {
  readonly card: string
  readonly overdue: string
}
export default classes
```

`pick(styles, ...parts)` joins class names, with conditions in an object:

```tsx
// app/components/invoices/invoice-card.tsx
import { pick } from '@kitr/theme'
import styles from './invoice-card.module.css'

export function InvoiceCard({ id, total, overdue }: { id: string; total: number; overdue: boolean }) {
  return (
    <article className={pick(styles, 'card', { overdue })}>
      {id}: ${total}
    </article>
  )
}
// overdue → class="card_x1 overdue_x2" (the hashed names from the module)
```

`pick` skips `false`, `null` and `undefined`, so `pick(styles, 'card', isOpen && 'overdue')` works. `pick(styles, 'crad')` is a type error. To type a module by hand, use `CssModule<'card' | 'overdue'>`.

## Pass values to CSS

`vars()` builds a `style` object of CSS variables, so a component passes a value to its stylesheet:

```tsx
// app/components/projects/progress-bar.tsx
import { vars } from '@kitr/theme'
import styles from './progress-bar.module.css'

export function ProgressBar({ done }: { done: number }) {
  return <div className={styles.track} style={vars({ '--progress': `${done}%` })} />
}
// vars({ '--progress': '40%', '--gap': 8 }) => { '--progress': '40%', '--gap': '8' }
```

```css
/* app/components/projects/progress-bar.module.css */
.track {
  height: 0.5rem;
  border-radius: var(--kitr-radius-sm);
  background: linear-gradient(
    to right,
    var(--kitr-color-primary) var(--progress),
    var(--kitr-color-muted) var(--progress)
  );
}
```

## Style states with data attributes

`dataAttrs()` turns an object into `data-*` attributes, so plain CSS can target a component's state:

```tsx
// app/components/orders/order-row.tsx
import { dataAttrs } from '@kitr/theme'

export function OrderRow({ status, selected }: { status: 'open' | 'shipped'; selected: boolean }) {
  return <tr className="order-row" {...dataAttrs({ status, isSelected: selected })} />
}
// dataAttrs({ status: 'open', isSelected: true }) => { 'data-status': 'open', 'data-is-selected': '' }
// dataAttrs({ status: 'shipped', isSelected: false }) => { 'data-status': 'shipped' }
```

```css
/* app/styles/orders.css */
.order-row[data-status="shipped"] {
  color: var(--kitr-color-mutedForeground);
}
.order-row[data-is-selected] {
  background: var(--kitr-color-muted);
}
```

Keys become kebab-case. `true` gives an empty attribute; `false`, `null` and `undefined` leave it out.

## Build component variants

`@kitr/theme` re-exports [class-variance-authority](https://cva.style) as `cva` (with `VariantProps`) and [clsx](https://github.com/lukeed/clsx) as `clsx` and `cx`, which the registry components use:

```tsx
// app/components/ui/badge.tsx
import { cva, cx, type VariantProps } from '@kitr/theme'

const badge = cva('badge', {
  variants: {
    tone: { neutral: 'badge-neutral', success: 'badge-success', danger: 'badge-danger' },
  },
  defaultVariants: { tone: 'neutral' },
})

export function Badge({
  tone,
  className,
  children,
}: VariantProps<typeof badge> & { className?: string; children: string }) {
  return <span className={cx(badge({ tone }), className)}>{children}</span>
}
// badge({ tone: 'success' }) => 'badge badge-success'
// cx('badge', { active: true, muted: false }) => 'badge active'
```

With [tailwind](/packages/tailwind), use its `cn()` instead of `cx`: it also merges conflicting utility classes.

## Add components

`kitr ui add` copies components from a shadcn-compatible registry into `app/components/ui/`. The files are yours to edit.

```sh
kitr ui add button input card dialog
```

```tsx
// app/components/projects/new-project-card.tsx
import { Button } from '#components/ui/button'
import { Card } from '#components/ui/card'

export function NewProjectCard() {
  return (
    <Card>
      <h2>New project</h2>
      <Button onClick={() => console.info('create project')}>Create</Button>
    </Card>
  )
}
```

The components use the `--kitr-*` tokens and `cva`, so they follow the theme and your overrides. `kitr ui add` also copies registry dependencies (`theme-toggle` brings `button` and `icon`) and installs the npm packages they need.

| Component | What it is |
| --- | --- |
| `app-shell` | Sidebar and top bar layout with navigation links, a user menu slot and the theme toggle. |
| `badge` | Status badge. |
| `button` | Button with variants and sizes, built on `cva`. |
| `card` | Card with header, content and footer. |
| `checkbox` | Native checkbox with kitr styling. |
| `data-table` | TanStack Table with sorting, pagination and URL-bound state via [table](/packages/table). |
| `dialog` | Modal dialog on the native `<dialog>` element. |
| `empty-state` | Centered empty state with title, description and action. |
| `form` | Styled `FormField`, `FormMessage` and `SubmitButton` over [forms](/packages/forms). |
| `icon` | Hugeicons in the stroke-rounded style. |
| `input`, `label`, `select`, `textarea` | Form controls. |
| `page-header` | Title, description and actions row for a page. |
| `skeleton` | Loading placeholder. |
| `theme-toggle` | Light and dark toggle using `useTheme`. |
| `list-page` | A list route: page header, data table bound to search params, empty state. Writes a page, not a component. |
| `sign-in-page` | A sign-in route using [forms](/packages/forms). Writes a page, not a component. |

For your company's registry, set `registry` in `config/theme.ts`, pass `--registry`, or set `KITR_REGISTRY`. A registry is any URL or directory serving `registry.json` and one `<name>.json` per component in the shadcn format.

## Use icons

Icons are [Hugeicons](https://hugeicons.com) in the stroke-rounded style, drawn in `currentColor`. `kitr ui add icon` gives you `<Icon>`:

```tsx
// app/components/projects/add-project-button.tsx
import { Add01Icon } from '@hugeicons/core-free-icons'
import { Button } from '#components/ui/button'
import { Icon } from '#components/ui/icon'

export function AddProjectButton() {
  return (
    <Button>
      <Icon icon={Add01Icon} size={18} /> New project
    </Button>
  )
}
```

The registry components, kit pages and devtools overlay all use this set. Use one icon set across the app, not emoji or text glyphs.

## Change the storage key or attribute

Two apps on one domain, such as `app.acme.com` and `admin.acme.com` sharing cookies, need different keys. Set them in config and pass the same values to the script:

```ts
// config/theme.ts
import { defineConfig } from '@kitr/theme'

export default defineConfig({
  default: 'system',
  storageKey: 'acme-admin-theme',
  attribute: 'data-mode',
  colors: { light: '#ffffff', dark: '#0a0a0a' },
  componentsDir: 'app/components/ui',
})
```

```tsx
// app/document.tsx (inside <head>)
<ThemeScript storageKey="acme-admin-theme" attribute="data-mode" />
```

> [!WARNING] Custom attribute
> With a different `attribute`, `@kitr/theme/styles.css` no longer switches to dark, because its dark block targets `[data-theme="dark"]`. Copy the dark values into your own `[data-mode="dark"]` block in `app/styles/tokens.css`, or keep the default.

## Use ThemeProvider on its own

The provider in `kitrrc.ts` renders `ThemeProvider` with your config. Outside a kitr app, such as Storybook or an embedded widget, render it yourself:

```tsx
// app/widget/main.tsx
import { ThemeProvider } from '@kitr/theme'
import { createRoot } from 'react-dom/client'
import { InvoiceStatus } from '../components/invoices/invoice-status'

createRoot(document.getElementById('acme-widget')!).render(
  <ThemeProvider defaultTheme="dark" storageKey="acme-widget-theme" colors={{ dark: '#0b1020' }}>
    <InvoiceStatus status="paid" />
  </ThemeProvider>,
)
```

| Prop | Default | Description |
| --- | --- | --- |
| `defaultTheme` | `'system'` | The theme before the user picks one. |
| `storageKey` | `'kitr-theme'` | The `localStorage` key and cookie name. |
| `attribute` | `'data-theme'` | The attribute set on `<html>`. |
| `initialResolved` | `'light'` | `resolved` before the first effect runs, for example from `themeFromCookie`, so the first render matches the server. |
| `colors` | none | `<meta name="theme-color">` per resolved theme. |

> [!WARNING] One ThemeProvider
> Don't render a second `ThemeProvider` inside a kitr app: a nested one keeps its own state, so its `toggle` would not change what the rest of the app reads.

## Commands

| Command | What it does |
| --- | --- |
| `kitr ui add <names...>` | Copy components into your app: `kitr ui add button`. |
| `kitr ui list` | Lists the components in the registry with a one-line description. Flag: `--registry`. |
| `kitr css:types` | Type CSS Module class names. Comes from [web](/packages/web). |

```sh
kitr ui add theme-toggle
```

This writes `theme-toggle.tsx`, `button.tsx` and `icon.tsx` into `app/components/ui/` and installs `class-variance-authority`, `@hugeicons/react` and `@hugeicons/core-free-icons`:

```tsx
// app/components/ui/theme-toggle.tsx
import { Moon02Icon, Sun03Icon } from '@hugeicons/core-free-icons'
import { useTheme } from '@kitr/theme'
import { Button } from '#components/ui/button'
import { Icon } from '#components/ui/icon'

export function ThemeToggle() {
  const { resolved, toggle } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`}
    >
      <Icon icon={resolved === 'dark' ? Sun03Icon : Moon02Icon} size={18} />
    </Button>
  )
}
```

```sh
kitr ui list
```

```
  app-shell        Sidebar + top bar layout with navigation links, user menu slot and theme toggle.
  badge            Status badge.
  button           Button with variants and sizes, built on cva.
  ...
  list-page        A list route: page header, data table bound to URL search params, empty state.  (page)
```

## Errors

| Error | When | What to do |
| --- | --- | --- |
| `[@kitr/theme] useTheme() must be used inside <ThemeProvider>.` | A component called `useTheme` with no theme provider above it. | Add the theme provider with `kitr add theme`, or render inside `ThemeProvider`. In tests, boot an app with `themeProvider`. |
| `Component "<name>" not found at <registry> (404)` | `kitr ui add` asked the registry for a component it does not have. | Check the name with `kitr ui list`, or the `registry` setting. |
| `Component "<name>" not found in <dir>` | The same, for a registry that is a local directory. | Check the directory has `<name>.json`. |
| No error: the file is kept | `kitr ui add` found the component file already there. It keeps yours and still reports the component as added. | Pass `--overwrite` to replace it with the registry's version. |

## Testing

Boot an app with the theme provider and render with `renderWithKitr` from [testing](/packages/testing). Config goes in through `createTestApp`:

```tsx
// app/components/theme-button.test.tsx
import themeProvider from '@kitr/theme/provider'
import { createTestApp, renderWithKitr } from '@kitr/testing/react'
import { act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ThemeButton } from './theme-button'

describe('ThemeButton', () => {
  it('switches Ada to dark mode and remembers it', async () => {
    const app = await createTestApp({
      providers: [themeProvider],
      config: { theme: { default: 'light' } },
    })
    const screen = renderWithKitr(<ThemeButton />, { app })

    const button = screen.getByRole('button', { name: 'Switch to dark' })
    await act(async () => button.click())

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('kitr-theme')).toBe('dark')
    expect(document.cookie).toContain('kitr-theme=dark')
    expect(screen.getByRole('button', { name: 'Switch to light' })).toBeTruthy()
  })
})
```

The theme is saved to `localStorage` and a cookie, which the test DOM keeps between tests. Clear them in `afterEach`:

```ts
// test/setup.ts
import { afterEach } from 'vitest'

afterEach(() => {
  localStorage.clear()
  document.cookie = 'kitr-theme=; max-age=0; path=/'
  document.documentElement.removeAttribute('data-theme')
})
```

To test dark mode without clicking, save the choice first: `localStorage.setItem('kitr-theme', 'dark')`. For `system`, the provider asks `window.matchMedia('(prefers-color-scheme: dark)')`; replace it to control the OS setting:

```ts
// test/dark-system.ts
import { vi } from 'vitest'

export function prefersDark(dark: boolean) {
  window.matchMedia = vi.fn(() => ({
    matches: dark,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}
```

## Next steps

- [API reference](/packages/theme/api): every export of `@kitr/theme`, `@kitr/theme/provider` and `@kitr/theme/server`.
- [Tailwind](/packages/tailwind): the same tokens as utility classes, and `cn()`.
- [Toast](/packages/toast): short messages like "Saved", which follow the theme.
