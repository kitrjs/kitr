import { createDefineConfig } from '@kitr/core'

export * from './ipc'

export interface ElectronConfig {
  /** Window defaults used by `createMainWindow`. */
  window?: {
    width?: number
    height?: number
    minWidth?: number
    minHeight?: number
    title?: string
  }
  /** Open devtools in development. Default true. */
  devtools?: boolean
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    electron: ElectronConfig
  }
}

export const defineConfig = createDefineConfig<ElectronConfig>()
