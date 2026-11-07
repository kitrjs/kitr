import { createDefineConfig } from '@kitr/core'
import type { TokenGroup } from '@kitr/styling'

export interface UiConfig {
  theme?: {
    /** 'light' | 'dark' | 'system'. Default 'system'. */
    default?: 'light' | 'dark' | 'system'
    /** localStorage key. Default 'kitr-theme'. */
    storageKey?: string
    /** Attribute set on <html>. Default 'data-theme'. */
    attribute?: string
  }
  /** Token overrides merged over kitr's defaults; emitted as CSS variables. */
  tokens?: { light?: TokenGroup; dark?: TokenGroup }
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
    ui: UiConfig
  }
}

export const defineConfig = createDefineConfig<UiConfig>()
