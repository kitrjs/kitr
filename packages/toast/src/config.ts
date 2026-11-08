import { createDefineConfig } from '@kitr/core'

/** The options of `config/toast.ts`: where toasts appear and how they look. */
export interface ToastConfig {
  /** Where toasts appear. Default `'bottom-right'`. */
  position?:
    | 'top-left'
    | 'top-right'
    | 'top-center'
    | 'bottom-left'
    | 'bottom-right'
    | 'bottom-center'
  /** Coloured success, error, info and warning toasts. Default `true`. */
  richColors?: boolean
  /** How long a toast stays, in milliseconds. Default `4000`. */
  duration?: number
  /** Show a close button on every toast. Default `false`. */
  closeButton?: boolean
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    toast: ToastConfig
  }
}

/** Type-check `config/toast.ts`: returns the object unchanged, with autocomplete for every `ToastConfig` option. */
export const defineConfig = createDefineConfig<ToastConfig>()
