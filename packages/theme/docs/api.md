---
title: API
description: Every export of kitr/theme, with its signature.
order: 2
---

# API

Every export of `kitr/theme`, `kitr/theme/provider`, `kitr/theme/server`, read from the published type definitions. The [guide](/packages/theme) shows them in use.

## kitr/theme

Re-exports `class-variance-authority`, `clsx` unchanged, plus the following.

### dataAttrs

```ts
function dataAttrs(values: Record<string, string | number | boolean | null | undefined>): Record<`data-${string}`, string>;
```

Data-attribute variants for vanilla CSS: `<div {...dataAttrs({ state, size })}>` → `data-state="open"`.

### defineTokens

```ts
function defineTokens<const T extends TokenGroup>(tokens: T, options?: {
  prefix?: string;
}): DefineTokensResult<T>;
```

Turn a nested token object into CSS custom properties with typed names. The prefix defaults to
`kitr`, so `color.primary` becomes `--kitr-color-primary`.

### pick

```ts
function pick<K extends string>(styles: CssModule<K>, ...parts: Array<K | Partial<Record<K, boolean | undefined>> | false | null | undefined>): string;
```

Pick classes from a module with optional conditions: `pick(styles, 'card', { active })`.

### setToastImplementation

```ts
function setToastImplementation(fn: ToastFn | null): void;
```

Replace what `toast` calls: a function with `success`, `error`, `info`, `warning` and `promise` methods.
The theme provider sets sonner's `toast` once it loads; `null` goes back to the console fallback.

### themeFromCookie

```ts
function themeFromCookie(cookieHeader: string | null | undefined, storageKey?: string): ResolvedTheme | undefined;
```

Read the theme cookie on the server to pass as `initialResolved`.

### ThemeProvider

```ts
function ThemeProvider({ children, defaultTheme, storageKey, attribute, initialResolved, colors }: ThemeProviderProps): import("react").JSX.Element;
```

Light/dark/system with no flash: pair with `<ThemeScript />` in the document head.
Sets `data-theme="light|dark"` on <html>, which the Tailwind preset and styles.css read.

### ThemeScript

```ts
function ThemeScript(props: {
  storageKey?: string;
  attribute?: string;
  tokens?: ThemeConfig['tokens'];
}): import("react").JSX.Element;
```

Inline script for the document head; applies the stored theme before first paint. Its
`storageKey`, `attribute` and `tokens` default to `config/theme.ts` (through the theme
provider), so the head and the provider always agree. `tokens` are emitted as a `<style>` of
`--kitr-*` overrides: `light` on `:root`, `dark` under the dark attribute.

### toastError

```ts
function toastError(error: unknown, fallbackMessage?: string): void;
```

Show a KitrError (or anything) as an error toast with its message.

### tokenCss

```ts
function tokenCss(tokens: {
  light?: TokenGroup;
  dark?: TokenGroup;
}, attribute?: string): string;
```

The CSS for `config/theme.ts` tokens. `:root:root` outranks `kitr/theme/styles.css` (`:root`,
`[data-theme="dark"]`) wherever the stylesheet loads. `<` is escaped so a value cannot close the tag.

### useTheme

```ts
function useTheme(): ThemeContextValue;
```

The current theme and the functions that change it: `{ theme, resolved, setTheme, toggle }`.
Throws when no `ThemeProvider` (or the theme provider in `kitrrc.ts`) is above the component.

### vars

```ts
function vars(values: Record<`--${string}`, string | number>): Record<string, string>;
```

Build a `style` object from CSS variables: `vars({ '--gap': '8px' })`.

### darkTokens

```ts
const darkTokens: DefineTokensResult<{
  readonly color: {
    readonly background: "oklch(16% 0.01 260)";
    readonly foreground: "oklch(95% 0.005 260)";
    readonly muted: "oklch(24% 0.01 260)";
    readonly mutedForeground: "oklch(70% 0.02 260)";
    readonly border: "oklch(30% 0.01 260)";
    readonly primary: "oklch(70% 0.17 262)";
    readonly primaryForeground: "oklch(16% 0.01 260)";
    readonly destructive: "oklch(65% 0.2 27)";
    readonly destructiveForeground: "oklch(16% 0 0)";
    readonly ring: "oklch(70% 0.17 262)";
  };
}>;
```

kitr's dark colour tokens, the values `kitr/theme/styles.css` sets under `[data-theme="dark"]`. Radius, font and shadow are shared with the light set.

### defaultTokens

```ts
const defaultTokens: DefineTokensResult<{
  readonly color: {
    readonly background: "oklch(99% 0 0)";
    readonly foreground: "oklch(20% 0.01 260)";
    readonly muted: "oklch(96% 0.005 260)";
    readonly mutedForeground: "oklch(50% 0.02 260)";
    readonly border: "oklch(90% 0.01 260)";
    readonly primary: "oklch(55% 0.2 262)";
    readonly primaryForeground: "oklch(99% 0 0)";
    readonly destructive: "oklch(55% 0.22 27)";
    readonly destructiveForeground: "oklch(99% 0 0)";
    readonly ring: "oklch(55% 0.2 262)";
  };
  readonly radius: {
    readonly sm: "0.25rem";
    readonly md: "0.5rem";
    readonly lg: "0.75rem";
  };
  readonly font: {
    readonly sans: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif";
    readonly mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  };
  readonly shadow: {
    readonly sm: "0 1px 2px oklch(0% 0 0 / 0.06)";
    readonly md: "0 4px 12px oklch(0% 0 0 / 0.08)";
  };
}>;
```

kitr's light (default) tokens, the values `kitr/theme/styles.css` sets on `:root`. Override them in `app/styles/tokens.css`.

### defineConfig

```ts
const defineConfig: <const C extends ThemeConfig>(config: C) => C;
```

Type-check `config/theme.ts`: returns the object unchanged, with autocomplete for every `ThemeConfig` option.

### ThemeConfigContext

```ts
const ThemeConfigContext: import("react").Context<ThemeConfig | null>;
```

`config/theme.ts`, provided by the theme provider so `<ThemeScript />` uses the same settings.

### toast

```ts
const toast: ToastFn;
```

Show a toast: `toast('Saved')`, `toast.success()`, `.error()`, `.info()`, `.warning()` and `.promise()`.
Goes to sonner when it is installed and loaded, and to the console otherwise.

### DefineTokensResult

```ts
interface DefineTokensResult<T extends TokenGroup> {
  /** The token tree as passed in. */
  tokens: T;
  /** A `var()` reference for a path: `var('color.primary')` → `var(--kitr-color-primary)`. */
  var: (path: TokenPath<T>) => `var(--${string})`;
  /** The CSS variable name for a path: `name('color.primary')` → `--kitr-color-primary`. */
  name: (path: TokenPath<T>) => `--${string}`;
  /** `:root { --kitr-...: ...; }` ready to drop into a stylesheet. */
  css: (selector?: string) => string;
  /** Flat `{ '--kitr-color-primary': '#...' }` for inline styles or runtime theming. */
  flat: () => Record<string, string>;
}
```

What `defineTokens` returns: the tree itself plus helpers that name, reference and emit its CSS variables.

### ThemeConfig

```ts
interface ThemeConfig {
  /** 'light' | 'dark' | 'system'. Default 'system'. */
  default?: 'light' | 'dark' | 'system';
  /** Storage key (localStorage and the cookie the server reads). Default 'kitr-theme'. */
  storageKey?: string;
  /** Attribute set on <html>. Default 'data-theme'. */
  attribute?: string;
  /**
   * Token overrides, emitted by `<ThemeScript />` as `--kitr-*` variables: `light` on `:root`,
   * `dark` under the dark attribute. `{ light: { color: { primary: 'oklch(60% 0.2 150)' } } }`.
   */
  tokens?: {
    light?: TokenGroup;
    dark?: TokenGroup;
  };
  /** `<meta name="theme-color">` and native window chrome per resolved theme. */
  colors?: {
    light?: string;
    dark?: string;
  };
  /** Where `kitr ui add` pulls components from. Any shadcn-compatible registry. */
  registry?: string;
  /** Where components are written. Default `app/components/ui`. */
  componentsDir?: string;
  /** The sonner toaster the provider mounts once `sonner` is installed. */
  toaster?: {
    /** Where toasts appear. Default `'bottom-right'`. */
    position?: 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center';
    /** Coloured success, error, info and warning toasts. Default `true`. */
    richColors?: boolean;
  };
}
```

The options of `config/theme.ts`: the default theme, where it is stored, window colours, the toaster and the component registry.

### ThemeProviderProps

```ts
interface ThemeProviderProps {
  /** The tree that can call `useTheme()`. */
  children: ReactNode;
  /** The theme before the user picks one. Default `'system'`. */
  defaultTheme?: Theme;
  /** The `localStorage` key and cookie name holding the choice. Default `'kitr-theme'`. */
  storageKey?: string;
  /** The attribute set on `<html>` to `light` or `dark`. Default `'data-theme'`. */
  attribute?: string;
  /** Theme known on the server (e.g. from a cookie) to avoid a flash. */
  initialResolved?: ResolvedTheme;
  /** `<meta name="theme-color">` per resolved theme, which native shells and PWAs show as window chrome. */
  colors?: {
    light?: string;
    dark?: string;
  };
}
```

Props of `ThemeProvider`. The theme provider in `kitrrc.ts` fills them from `config/theme.ts`.

### TokenGroup

```ts
interface TokenGroup {
  [key: string]: TokenLeaf | TokenGroup;
}
```

A nested object of tokens, such as `{ color: { primary: '#0ea5e9' } }`. Each leaf becomes one CSS variable.

### CssModule

```ts
/** Type a CSS Modules import so `styles.foo` is checked. Generate the `.d.ts` with `kitr css:types`. */
type CssModule<K extends string> = {
  readonly [P in K]: string;
};
```

Type a CSS Modules import so `styles.foo` is checked. Generate the `.d.ts` with `kitr css:types`.

### ResolvedTheme

```ts
type ResolvedTheme = 'light' | 'dark';
```

The theme on screen once `'system'` is resolved: always `'light'` or `'dark'`.

### Theme

```ts
type Theme = 'light' | 'dark' | 'system';
```

The user's choice: a fixed theme, or `'system'` to follow the operating system.

### TokenLeaf

```ts
/** A single token value: a CSS string such as `'0.5rem'`, or a number written without a unit. */
type TokenLeaf = string | number;
```

A single token value: a CSS string such as `'0.5rem'`, or a number written without a unit.

### TokenPath

```ts
type TokenPath<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends TokenLeaf ? `${Prefix}${K}` : TokenPath<T[K], `${Prefix}${K}.`>;
}[keyof T & string];
```

Every dotted path to a leaf of a token tree (`'color.primary'`), so token names are checked at compile time.

## kitr/theme/provider

### themeProvider

```ts
const themeProvider: import("@kitr/core").KitrProvider;
```

Wraps the app in ThemeProvider with `config/theme.ts` and mounts the toaster (sonner, if installed).
Listed in kitrrc.ts as `() => import('@kitr/theme/provider')`. Pair with `<ThemeScript />` in the document head.

## kitr/theme/server

### themeFromCookie

```ts
function themeFromCookie(cookieHeader: string | null | undefined, storageKey?: string): ResolvedTheme | undefined;
```

Read the theme cookie on the server to pass as `initialResolved`.

### ResolvedTheme

```ts
type ResolvedTheme = 'light' | 'dark';
```

The theme on screen once `'system'` is resolved: always `'light'` or `'dark'`.

### Theme

```ts
type Theme = 'light' | 'dark' | 'system';
```

The user's choice: a fixed theme, or `'system'` to follow the operating system.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
