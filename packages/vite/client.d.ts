declare module 'virtual:kitr/providers' {
  import type { KitrProvider } from '@kitr/core'
  export const providers: KitrProvider[]
}
declare module 'virtual:kitr/config' {
  export const config: Record<string, unknown>
}
interface ImportMetaEnv {
  readonly KITR_PACKAGES: string[]
  /** The platform name from kitrrc.ts this bundle was built for (`kitr dev|build <name>`). */
  readonly KITR_PLATFORM: string
  readonly KITR_PLATFORM_TYPE: string
}
