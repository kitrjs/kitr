---
title: Theme
description: Light, dark and system themes with no flash on load, design tokens, toasts, and the components you copy into your app.
order: 1
---

# Theme

Users expect dark mode, a page that does not flash white before it turns dark, and buttons that look the same on every screen. `kitr/theme` gives your app light, dark and system themes that follow the operating system and remember the user's choice, a set of design tokens as CSS variables, toasts, and the settings `kitr ui add` uses to copy ready-made components into your app. It is built on [CSS custom properties](https://developer.mozilla.org/docs/Web/CSS/Using_CSS_custom_properties), [sonner](https://sonner.emilkowal.ski) for toasts and [shadcn/ui](https://ui.shadcn.com)-compatible registries for components, and adds a theme provider, a no-flash script and typed token helpers on top.

It runs in the browser, and on the server during server rendering. For utility classes on top of the same tokens, add [tailwind](/packages/tailwind) as well; for a server-only project there is nothing to theme.

This guide follows Acme's dashboard at `app.acme.com`: Ada adds a dark mode toggle, brands the colours, shows a toast when Grace saves an invoice, and copies in a few components.

## Install

```sh
kitr add theme
```

What `kitr add` does:

- Adds [react](/packages/react) first if the project does not have it, because theme requires it.
- Installs `@kitr/theme`.
- Adds `'@kitr/theme'` to `packages` and `() => import('@kitr/theme/provider')` to `providers` in `kitrrc.ts`.
- Writes `config/theme.ts` (shown under Configure).
- Writes `app/styles/tokens.css`, an empty `:root` block for your token overrides.
- Loads `tokens.css` after kitr's tokens, so your values win. With [tailwind](/packages/tailwind), it adds `@import './tokens.css';` to `app/styles/app.css` right after `@import 'kitr/theme/styles.css';`. Without it, it adds `import '#app/styles/tokens.css'` to `app/document.tsx`.
- Edits `app/document.tsx` (or `app/routes/__root.tsx` in a project that kept file routes) to apply the saved theme before first paint: imports `ThemeScript` from `kitr/theme`, puts `<ThemeScript />` above `<HeadContent />` and adds `suppressHydrationWarning` to `<html lang="en">`. A document that already has `<ThemeScript` or has no `<HeadContent />` is left alone ([Avoid a flash on load](#avoid-a-flash-on-load)).
- Adds a `theme` section to `AGENTS.md`: use `useTheme()`, put `<ThemeScript />` in the document head, take colours and radii from the `--kitr-*` variables, keep components in `app/components/ui/` and add them with `kitr ui add`, and use Hugeicons through `<Icon />`.
- Adds no environment variables and no scripts. When it finishes it prints `Pull components with kitr ui add button input form`.

`kitr add` skips `config/theme.ts` and `tokens.css` when they already exist. It asks no questions; `--no-install` skips the package manager and `--dry-run` prints the plan.

```sh
kitr add theme --dry-run
```

The `app`, `fullstack`, `saas`, `site`, `realtime`, `desktop` and `mobile` kits include theme, and copy in a starter set of components with it (`icon`, `button`, `input`, `card`, `theme-toggle` and more). The `blank` kit does not.

The base stylesheet, `kitr/theme/styles.css`, is linked from the `app/document.tsx` that [router](/packages/router) writes, so it is in place before you add theme. With [tailwind](/packages/tailwind), `app/styles/app.css` imports it instead.

`kitr remove theme` removes `<ThemeScript />`, its import and `suppressHydrationWarning` from `app/document.tsx`, the provider, the `packages` entry, the dependency, `config/theme.ts` and the `AGENTS.md` section. `app/styles/tokens.css`, its import and the components in `app/components/ui/` stay, because they are yours.

## Configure

`kitr add theme` writes this file:

```ts
// config/theme.ts
import { defineConfig } from 'kitr/theme'

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
| `toaster.position` | `'bottom-right'` | Where toasts appear: `'top-right'`, `'top-center'`, `'bottom-right'` or `'bottom-center'`. |
| `toaster.richColors` | `true` | Coloured success, error, info and warning toasts. |
| `registry` | kitr's registry | Where `kitr ui add` and `kitr ui list` fetch components: a URL or a local directory. |
| `componentsDir` | `app/components/ui` | Where `kitr ui add` writes components. |
| `tokens.light`, `tokens.dark` | none | Typed slot for token overrides. Nothing reads it yet; override tokens in `app/styles/tokens.css` (see "Brand the colours"). |

| Variable | Used for |
| --- | --- |
| `KITR_REGISTRY` | Overrides `registry` for one `kitr ui add` or `kitr ui list` run, such as in CI. |

The config is read once, when the app is created. `useConfig('theme')` from [react](/packages/react) returns it in a component.

## Add a dark mode toggle

`useTheme()` returns the current choice and the functions that change it. Any component under the app can call it:

```tsx
// app/components/theme-button.tsx
import { useTheme } from 'kitr/theme'

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

Click it and the page turns dark: `<html>` gets `data-theme="dark"` and `style="color-scheme: dark"`, every `--kitr-*` variable switches to its dark value, and the choice is saved, so a reload keeps it.

| Field | What it is |
| --- | --- |
| `theme` | The user's choice: `'light'`, `'dark'` or `'system'`. |
| `resolved` | What shows on screen: `'light'` or `'dark'`. With `'system'`, it follows the operating system and updates when the OS setting changes. |
| `setTheme(theme)` | Sets the choice and saves it to `localStorage` and a one-year cookie. |
| `toggle()` | Switches to the opposite of `resolved` and saves that, which leaves `'system'`. |

For a styled toggle with an icon, copy the registry's version instead: `kitr ui add theme-toggle` writes `app/components/ui/theme-toggle.tsx` (plus `button` and `icon`), and you render `<ThemeToggle />`.

## Let users pick light, dark or system

`toggle()` is a two-way switch. To offer "match my system" as well, call `setTheme` from a select:

```tsx
// app/features/settings/appearance.tsx
import { type Theme, useTheme } from 'kitr/theme'

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

With `system` saved, `resolved` follows the OS: when Linus's laptop switches to dark at sunset, the dashboard does too, without a reload. A stored value other than `light`, `dark` or `system` is ignored and `default` applies.

## Avoid a flash on load

React applies the theme after it hydrates, a moment after the first paint. Without help, a dark-mode user sees a white page flash first. `<ThemeScript />` is a tiny inline script that reads the saved choice and sets `data-theme` before anything paints. Put it first in the document head:

```tsx
// app/document.tsx
import { HeadContent, Outlet, Scripts } from 'kitr/router'
import { ThemeScript } from 'kitr/theme'
import css0 from 'kitr/theme/styles.css?url'

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

The script changes `<html>` before React hydrates it, so React would warn that the attribute differs from the server's HTML; `suppressHydrationWarning` on `<html>` tells it this one difference is expected.

`kitr add theme` adds `<ThemeScript />` and `suppressHydrationWarning` to the `app/document.tsx` `kitr add router` writes, and the kits include them. It works the same in `ssr`, `static` and `spa` modes and in desktop and mobile shells, because it only reads `localStorage`.

If you changed `storageKey` or `attribute` in `config/theme.ts`, pass the same values: `<ThemeScript storageKey="acme-theme" attribute="data-mode" />`. The script reads its props, not the config. It escapes both values, so a key containing `</script>` cannot break out of the tag.

## Render the saved theme on the server

In `ssr` mode the server can send the right theme in the HTML itself. `setTheme` writes the choice to a cookie as well as to `localStorage`, and `themeFromCookie` reads it from the request's `Cookie` header:

```ts
// app/features/theme/read-theme.ts
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { themeFromCookie } from 'kitr/theme/server'

/** Runs on the server only: the visitor's theme, straight from the request cookie. */
export const readTheme = createServerFn({ method: 'GET' }).handler(
  () => themeFromCookie(getRequest().headers.get('cookie')) ?? null,
)
```

```ts
// app/routes.ts
import { head, RootDocument } from './document'
import { readTheme } from '#app/features/theme/read-theme'

r.root({ head, loader: () => readTheme(), component: RootDocument })
```

```tsx
// app/document.tsx
// ...
import { getRouteApi } from 'kitr/router'

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
import { themeFromCookie } from 'kitr/theme/server'

themeFromCookie('session=abc; kitr-theme=dark') // => 'dark'
themeFromCookie('kitr-theme=system') // => undefined (the server cannot know the OS setting)
themeFromCookie(null) // => undefined
themeFromCookie('acme-theme=light', 'acme-theme') // => 'light', with a custom storageKey
```

When it returns `undefined`, keep `<ThemeScript />` to resolve `system` in the browser. Keep it in any case: it covers static pages and the shells, where there is no request.

## Color the window chrome and status bar

`colors` in `config/theme.ts` keeps `<meta name="theme-color">` in step with the theme. Browsers that support the tag tint their toolbar, and installed PWAs their title bar, with this colour:

```ts
// config/theme.ts
import { defineConfig } from 'kitr/theme'

export default defineConfig({
  default: 'system',
  colors: { light: '#ffffff', dark: '#0b1020' },
  componentsDir: 'app/components/ui',
})
```

On every change of `resolved`, the provider sets the tag's `content` to `colors.light` or `colors.dark`, and creates the tag if the page has none. Pick the same colour as `--kitr-color-background` so the chrome blends into the page. kitr only writes the tag; inside the [desktop](/packages/desktop) and [mobile](/packages/mobile) shells, whether the window or status bar follows it depends on the shell's web view.

## Use the tokens in CSS

`kitr/theme/styles.css` defines every token as a `--kitr-*` variable on `:root`, with dark values under `[data-theme="dark"]`. Use them in any stylesheet and the component follows the theme without a line of JavaScript:

```css
/* app/features/invoices/invoice-card.module.css */
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

Don't hard-code `#fff` or `rgb(...)` in a component. A hard-coded colour does not change with the theme, and it does not change when Acme rebrands.

The same tokens exist in JavaScript as `defaultTokens` and `darkTokens`:

```ts
import { darkTokens, defaultTokens } from 'kitr/theme'

defaultTokens.var('color.primary') // => 'var(--kitr-color-primary)'
defaultTokens.name('radius.md') // => '--kitr-radius-md'
defaultTokens.tokens.radius.md // => '0.5rem'
darkTokens.tokens.color.background // => 'oklch(16% 0.01 260)'
```

## Brand the colours

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

`kitr add theme` loads this file for you: with [tailwind](/packages/tailwind) through `@import './tokens.css';` in `app/styles/app.css`, otherwise with an import in `app/document.tsx`. If you move it, keep it after `kitr/theme/styles.css`, so your values come later in the cascade and win:

```tsx
// app/document.tsx
import css0 from 'kitr/theme/styles.css?url'
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

With [tailwind](/packages/tailwind), import it in `app/styles/app.css` after `kitr/theme/styles.css` instead: `@import './tokens.css';`.

## Define your own tokens

`defineTokens` turns a nested object into CSS variables with typed names. Use it for values kitr has no token for, such as Acme's invoice status colours:

```ts
// app/styles/acme-tokens.ts
import { defineTokens } from 'kitr/theme'

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

`acme.var('status.unpaid')` is a type error, because the path is checked against the object. Numbers are written as they are, without a unit; write `'16px'` when the CSS needs one. The prefix defaults to `kitr`.

Emit the variables once, from the root layout, or spread `flat()` into a `style` to scope them to one element:

```tsx
// app/features/invoices/invoice-status.tsx
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

Without Tailwind, CSS Modules plus three small helpers cover most styling. `kitr css:types` writes a `.d.ts` next to each `*.module.css`, so class names are checked:

```sh
kitr css:types
```

```ts
// app/features/invoices/invoice-card.module.css.d.ts
// Generated by `kitr css:types`. Do not edit.
declare const classes: {
  readonly card: string
  readonly overdue: string
}
export default classes
```

`pick(styles, ...parts)` joins class names, with conditions in an object:

```tsx
// app/features/invoices/invoice-card.tsx
import { pick } from 'kitr/theme'
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

`pick` skips `false`, `null` and `undefined`, so `pick(styles, 'card', isOpen && 'overdue')` works too. `pick(styles, 'crad')` is a type error. To type a module by hand, use `CssModule<'card' | 'overdue'>`.

## Pass values to CSS

`vars()` builds a `style` object of CSS variables, so a component passes a number to its stylesheet without inline colour or size rules:

```tsx
// app/features/projects/progress-bar.tsx
import { vars } from 'kitr/theme'
import styles from './progress-bar.module.css'

export function ProgressBar({ done }: { done: number }) {
  return <div className={styles.track} style={vars({ '--progress': `${done}%` })} />
}
// vars({ '--progress': '40%', '--gap': 8 }) => { '--progress': '40%', '--gap': '8' }
```

```css
/* app/features/projects/progress-bar.module.css */
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

`dataAttrs()` turns an object into `data-*` attributes, so plain CSS can target a component's state with an attribute selector:

```tsx
// app/features/orders/order-row.tsx
import { dataAttrs } from 'kitr/theme'

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

Keys become kebab-case. `true` gives an empty attribute; `false`, `null` and `undefined` leave it out; numbers become strings.

## Build component variants

`kitr/theme` re-exports [class-variance-authority](https://cva.style) as `cva` (with `VariantProps`) and [clsx](https://github.com/lukeed/clsx) as `clsx` and `cx`. The registry components use them, and so can yours:

```tsx
// app/components/ui/badge.tsx
import { cva, cx, type VariantProps } from 'kitr/theme'

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

With [tailwind](/packages/tailwind), use its `cn()` instead of `cx`, which also merges conflicting utility classes.

## Show toasts

`toast` shows a short message. Call it from anywhere: a component, an event handler or a package.

```tsx
// app/features/invoices/save-invoice-button.tsx
import { toast, toastError } from 'kitr/theme'

export function SaveInvoiceButton({ id }: { id: string }) {
  async function save() {
    try {
      await fetch(`/api/invoices/${id}`, { method: 'PUT' })
      toast.success(`Invoice ${id} saved`)
    } catch (error) {
      toastError(error)
    }
  }
  return (
    <button type="button" onClick={save}>
      Save
    </button>
  )
}
```

| Call | Shows |
| --- | --- |
| `toast(message, options?)` | A plain toast. `options` go to sonner, such as `{ description, duration }`. |
| `toast.success(message)`, `.info()`, `.warning()`, `.error()` | A coloured toast of that kind. |
| `toast.promise(promise, { loading, success, error })` | A loading toast that turns into success or error when the promise settles. Returns the promise. |
| `toastError(error, fallback?)` | `toast.error` with the error's `message`, or `fallback` (default `'Something went wrong'`) when it has none. |

`toast.promise` keeps the user informed during a slow save, and returns the same promise so you can still await it:

```tsx
// app/features/invoices/send-invoice.ts
import { toast } from 'kitr/theme'

export function sendInvoice(id: string) {
  return toast.promise(fetch(`/api/invoices/${id}/send`, { method: 'POST' }), {
    loading: `Sending ${id} to grace@acme.com…`,
    success: `Invoice ${id} sent`,
    error: `Could not send ${id}`,
  })
}
```

Toasts are drawn by [sonner](https://sonner.emilkowal.ski), which is optional. Install it with the registry component:

```sh
kitr ui add sonner
```

Once `sonner` is installed, the theme provider loads it and mounts its `<Toaster />` on `document.body` after the first render, with `position` and `richColors` from `toaster` in `config/theme.ts`. You don't mount anything. The command also copies `app/components/ui/sonner.tsx`, a `Toaster` that follows the current theme; you only need it to render a toaster somewhere other than the provider's.

Without sonner, every call goes to the console instead, so a package can call `toast` without making sonner a dependency:

```ts
import { toast, toastError } from 'kitr/theme'

toast('Draft saved') // console.info('[toast] Draft saved')
toast.success('Invoice inv_1 saved') // console.info('[toast:success] Invoice inv_1 saved')
toast.warning('Invoice inv_2 is overdue') // console.warn('[toast:warning] Invoice inv_2 is overdue')
toastError(new Error('Payment declined')) // console.error('[toast:error] Payment declined')
```

Calls made before sonner has loaded, such as during the first render, also go to the console.

## Send toasts to another toast library

`setToastImplementation` replaces what `toast` calls. Give it a function with `success`, `error`, `info`, `warning` and `promise` methods. The provider does this for sonner; do it yourself to route toasts to another library or to your own UI:

```ts
// app/providers/toast_provider.ts
import { defineProvider } from 'kitr/app'
import { setToastImplementation } from 'kitr/theme'
import { notify } from '#app/components/notify'

export default defineProvider({
  name: 'toast',
  boot() {
    setToastImplementation(
      Object.assign((message: string) => notify({ tone: 'neutral', message }), {
        success: (message: string) => notify({ tone: 'success', message }),
        error: (message: string) => notify({ tone: 'danger', message }),
        info: (message: string) => notify({ tone: 'neutral', message }),
        warning: (message: string) => notify({ tone: 'warning', message }),
        promise: <T>(promise: Promise<T>) => promise,
      }),
    )
  },
})
```

`setToastImplementation(null)` goes back to the console fallback. If sonner is installed too, the theme provider sets sonner again when its toaster loads, so use one or the other.

## Add components

`kitr ui add` copies components from a shadcn-compatible registry into `app/components/ui/`. The files are yours to edit; nothing is imported from a package at run time.

```sh
kitr ui add button input card dialog
```

```tsx
// app/features/projects/new-project-card.tsx
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

The components use the `--kitr-*` tokens and `cva`, so they follow the theme and your token overrides. `kitr ui add` also copies their registry dependencies (`theme-toggle` brings `button` and `icon`) and installs the npm packages they need (`icon` installs `@hugeicons/react` and `@hugeicons/core-free-icons`).

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
| `sonner` | Toasts with sonner, themed by `kitr/theme`. |
| `theme-toggle` | Light and dark toggle using `useTheme`. |
| `list-page` | A list route: page header, data table bound to search params, empty state. Writes a page, not a component. |
| `sign-in-page` | A sign-in route using [forms](/packages/forms). Writes a page, not a component. |

To use your company's registry, set `registry` in `config/theme.ts`, pass `--registry`, or set `KITR_REGISTRY`. A registry is any URL or directory that serves `registry.json` and one `<name>.json` per component in the shadcn format.

## Use icons

Icons are [Hugeicons](https://hugeicons.com) in the stroke-rounded style: round caps, round joins, soft corners, drawn in `currentColor`. `kitr ui add icon` (every kit that includes theme has it) gives you `<Icon>`:

```tsx
// app/features/projects/add-project-button.tsx
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

The registry components, the kit pages and the devtools overlay all draw from this set. Use one icon set across the app; don't mix in emoji or text glyphs as icons.

## Change the storage key or attribute

Two apps on one domain, such as `app.acme.com` and `admin.acme.com` sharing cookies, need different keys. Set them in config and pass the same values to the script:

```ts
// config/theme.ts
import { defineConfig } from 'kitr/theme'

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

With a different `attribute`, `kitr/theme/styles.css` no longer switches to dark, because its dark block targets `[data-theme="dark"]`. Copy the dark values into your own `[data-mode="dark"]` block in `app/styles/tokens.css`, or keep the default attribute.

## Use ThemeProvider on its own

The theme provider in `kitrrc.ts` renders `ThemeProvider` with your config. Outside a kitr app, such as in a Storybook or an embedded widget, render it yourself:

```tsx
// app/widget/main.tsx
import { ThemeProvider } from 'kitr/theme'
import { createRoot } from 'react-dom/client'
import { InvoiceStatus } from '../features/invoices/invoice-status'

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

Don't render a second `ThemeProvider` inside a kitr app. The provider already wraps the tree, and a nested one keeps its own state, so its `toggle` would not change what the rest of the app reads.

## Errors

| Error | When | What to do |
| --- | --- | --- |
| `[kitr/theme] useTheme() must be used inside <ThemeProvider>.` | A component called `useTheme` with no theme provider above it. | Add the theme provider with `kitr add theme`, or render inside `ThemeProvider`. In tests, boot an app with `themeProvider`. |
| `Component "<name>" not found at <registry> (404)` | `kitr ui add` asked the registry for a component it does not have. | Check the name with `kitr ui list`, or the `registry` setting. |
| `Component "<name>" not found in <dir>` | The same, for a registry that is a local directory. | Check the directory has `<name>.json`. |
| No error: the file is kept | `kitr ui add` found the component file already there. It keeps yours and still reports the component as added. | Pass `--overwrite` to replace it with the registry's version. |

## Commands

| Command | What it does |
| --- | --- |
| `kitr ui add <names...>` | Copies components and their registry dependencies into `componentsDir`, and installs the npm packages they need. Flags: `--registry <url or dir>`, `--overwrite`, `--no-install`. |
| `kitr ui list` | Lists the components in the registry with a one-line description. Flag: `--registry`. |
| `kitr css:types` | From the [web](/packages/web) platform, not theme: writes a typed `.d.ts` next to every `*.module.css` under `app`. Flags: `--dir <dir>`, `--check` to fail on stale files instead of writing. |

```sh
kitr ui add theme-toggle
```

This writes `app/components/ui/theme-toggle.tsx`, `app/components/ui/button.tsx` and `app/components/ui/icon.tsx`, and installs `class-variance-authority`, `@hugeicons/react` and `@hugeicons/core-free-icons`:

```tsx
// app/components/ui/theme-toggle.tsx
import { Moon02Icon, Sun03Icon } from '@hugeicons/core-free-icons'
import { useTheme } from 'kitr/theme'
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

## Testing

In a test, boot an app with the theme provider and render with `renderWithKitr` from [testing](/packages/testing). Config goes in through `createTestApp`:

```tsx
// app/components/theme-button.test.tsx
import themeProvider from 'kitr/theme/provider'
import { createTestApp, renderWithKitr } from 'kitr/testing/react'
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

The theme is saved to `localStorage` and a cookie, which the test DOM keeps between tests. Clear them in an `afterEach` so one test's choice does not leak into the next:

```ts
// test/setup.ts
import { afterEach } from 'vitest'

afterEach(() => {
  localStorage.clear()
  document.cookie = 'kitr-theme=; max-age=0; path=/'
  document.documentElement.removeAttribute('data-theme')
})
```

To test what a component does in dark mode without clicking, save the choice before rendering: `localStorage.setItem('kitr-theme', 'dark')`. The provider reads it on mount.

For `system`, the provider asks `window.matchMedia('(prefers-color-scheme: dark)')`. Replace it to control the OS setting:

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

Toasts need no fake. Without sonner they log, so spy on the console, or install your own implementation and assert on it:

```ts
// app/features/invoices/send-invoice.test.ts
import { setToastImplementation, toastError } from 'kitr/theme'
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => setToastImplementation(null))

it('shows the error message from a failed payment', () => {
  const shown = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    promise: vi.fn(),
  })
  setToastImplementation(shown)

  toastError(new Error('Payment declined'))

  expect(shown.error).toHaveBeenCalledWith('Payment declined', undefined)
})
```

## Next steps

- [API reference](/packages/theme/api): every export of `kitr/theme`, `kitr/theme/provider` and `kitr/theme/server`.
- [Tailwind](/packages/tailwind): the same tokens as utility classes, and `cn()`.
- [Router](/packages/router): writes the `app/document.tsx` where `<ThemeScript />` and the stylesheet go.
- [sonner](https://sonner.emilkowal.ski): toast options such as `description`, `action` and `duration`.
- [shadcn/ui](https://ui.shadcn.com/docs/registry): the registry format `kitr ui add` reads.
