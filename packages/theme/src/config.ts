import { createDefineConfig } from '@kitr/core'
import type { TokenGroup } from './tokens'

export interface ThemeConfig {
  /** 'light' | 'dark' | 'system'. Default 'system'. */
  default?: 'light' | 'dark' | 'system'
  /** Storage key (localStorage and the cookie the server reads). Default 'kitr-theme'. */
  storageKey?: string
  /** Attribute set on <html>. Default 'data-theme'. */
  attribute?: string
  /** Token overrides merged over kitr's defaults; emitted as CSS variables. */
  tokens?: { light?: TokenGroup; dark?: TokenGroup }
  /** `<meta name="theme-color">` and native window chrome per resolved theme. */
  colors?: { light?: string; dark?: string }
  /** Where `kitr ui add` pulls components from. Any shadcn-compatible registry. */
  registry?: string
  /** Where components are written. Default `app/components/ui`. */
  componentsDir?: string
  toaster?: {
    position?: 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center'
    richColors?: boolean
  }
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    theme: ThemeConfig
  }
}

export const defineConfig = createDefineConfig<ThemeConfig>()
