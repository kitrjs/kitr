declare module 'virtual:kitr/providers' {
  import type { KitrProvider } from '@kitr/core'
  export const providers: KitrProvider[]
}
declare module 'virtual:kitr/config' {
  export const config: Record<string, unknown>
}
interface ImportMetaEnv {
  readonly KITR_PACKAGES: string[]
}
