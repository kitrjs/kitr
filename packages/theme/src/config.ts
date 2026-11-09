import { createDefineConfig } from '@kitr/core'
import type { TokenGroup } from './tokens'
import type { ThemeTransition } from './transition'

/** The options of `config/theme.ts`: the default theme, where it is stored, window colours and the component registry. */
export interface ThemeConfig {
  /** 'light' | 'dark' | 'system'. Default 'system'. */
  default?: 'light' | 'dark' | 'system'
  /** Storage key (localStorage and the cookie the server reads). Default 'kitr-theme'. */
  storageKey?: string
  /** Attribute set on <html>. Default 'data-theme'. */
  attribute?: string
  /**
   * Token overrides, emitted by `<ThemeScript />` as `--kitr-*` variables: `light` on `:root`,
   * `dark` under the dark attribute. `{ light: { color: { primary: 'oklch(60% 0.2 150)' } } }`.
   */
  tokens?: { light?: TokenGroup; dark?: TokenGroup }
  /** `<meta name="theme-color">` and native window chrome per resolved theme. */
  colors?: { light?: string; dark?: string }
  /**
   * How a theme change animates: a built-in name (`'fade'`, `'circle'`, `'diamond'`, `'wipe'`,
   * `'blur'`), your own, or `{ name, duration, easing, direction, animate }`. Default: none.
   */
  transition?: ThemeTransition
  /** Where `kitr ui add` pulls components from. Any shadcn-compatible registry. */
  registry?: string
  /** Where components are written. Default `app/components/ui`. */
  componentsDir?: string
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    theme: ThemeConfig
  }
}

/** Type-check `config/theme.ts`: returns the object unchanged, with autocomplete for every `ThemeConfig` option. */
export const defineConfig = createDefineConfig<ThemeConfig>()
