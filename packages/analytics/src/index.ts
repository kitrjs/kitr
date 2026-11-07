import { createDefineConfig } from '@kitr/core'
import type { Analytics } from './analytics'
import type { AnalyticsConfig } from './types'

export * from './adapters'
export * from './analytics'
export * from './types'

declare module '@kitr/core' {
  interface ConfigRegistry {
    analytics: AnalyticsConfig
  }
  interface ContainerBindings {
    analytics: Analytics
  }
}

export const defineConfig = createDefineConfig<AnalyticsConfig>()
