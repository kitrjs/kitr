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

### pick

```ts
function pick<K extends string>(styles: CssModule<K>, ...parts: Array<K | Partial<Record<K, boolean | undefined>> | false | null | undefined>): string;
```

Pick classes from a module with optional conditions: `pick(styles, 'card', { active })`.

### setToastImplementation

```ts
function setToastImplementation(fn: ToastFn | null): void;
```

Called by the ui provider once sonner is loaded.

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
function ThemeScript({ storageKey, attribute }: {
  storageKey?: string;
  attribute?: string;
}): import("react").JSX.Element;
```

Inline script for the document head; applies the stored theme before first paint.

### toastError

```ts
function toastError(error: unknown, fallbackMessage?: string): void;
```

Show a KitrError (or anything) as an error toast with its message.

### useTheme

```ts
function useTheme(): ThemeContextValue;
```

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

kitr's default tokens. Override any of them in `config/theme.ts`.

### defineConfig

```ts
const defineConfig: <const C extends ThemeConfig>(config: C) => C;
```

### toast

```ts
const toast: ToastFn;
```

### DefineTokensResult

```ts
interface DefineTokensResult<T extends TokenGroup> {
  tokens: T;
  /** `--kitr-color-primary` style names, typed from the token tree. */
  var: (path: TokenPath<T>) => `var(--${string})`;
  name: (path: TokenPath<T>) => `--${string}`;
  /** `:root { --kitr-...: ...; }` ready to drop into a stylesheet. */
  css: (selector?: string) => string;
  /** Flat `{ '--kitr-color-primary': '#...' }` for inline styles or runtime theming. */
  flat: () => Record<string, string>;
}
```

### ThemeConfig

```ts
interface ThemeConfig {
  /** 'light' | 'dark' | 'system'. Default 'system'. */
  default?: 'light' | 'dark' | 'system';
  /** Storage key (localStorage and the cookie the server reads). Default 'kitr-theme'. */
  storageKey?: string;
  /** Attribute set on <html>. Default 'data-theme'. */
  attribute?: string;
  /** Token overrides merged over kitr's defaults; emitted as CSS variables. */
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
  toaster?: {
    position?: 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center';
    richColors?: boolean;
  };
}
```

### ThemeProviderProps

```ts
interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
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

### TokenGroup

```ts
interface TokenGroup {
  [key: string]: TokenLeaf | TokenGroup;
}
```

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

### Theme

```ts
type Theme = 'light' | 'dark' | 'system';
```

### TokenLeaf

```ts
type TokenLeaf = string | number;
```

Design tokens as plain objects, emitted as CSS custom properties.
The same tokens feed `@kitr/tailwind`'s `@theme` block and vanilla CSS alike,
so switching styling approach never means re-typing colours.

### TokenPath

```ts
type TokenPath<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends TokenLeaf ? `${Prefix}${K}` : TokenPath<T[K], `${Prefix}${K}.`>;
}[keyof T & string];
```

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

### Theme

```ts
type Theme = 'light' | 'dark' | 'system';
```

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
