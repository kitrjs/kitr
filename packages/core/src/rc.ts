import type { ProviderInput } from './provider'

/**
 * The shape of `kitrrc.ts`. Same idea as `adonisrc.ts`: explicit lazy imports,
 * so the `kitr()` Vite plugin and the CLI can both read it, and nothing is hidden.
 */
export interface KitrRc {
  /** Providers in boot order. Lazy imports keep startup bundles small. */
  providers: ProviderInput[]
  /** CLI command modules contributed by packages. */
  commands?: Array<() => Promise<unknown>>
  /** Packages added via `kitr add`, for `kitr doctor` and `kitr upgrade`. */
  packages?: string[]
  /** Where the app lives relative to the project root. */
  directories?: {
    app?: string
    routes?: string
    config?: string
    stubs?: string
    components?: string
  }
  /** Paths to preload on the server before the first request (server apps). */
  preloads?: Array<() => Promise<unknown>>
}

export const defaultDirectories = {
  app: 'app',
  routes: 'app/routes',
  config: 'config',
  stubs: 'stubs',
  components: 'app/components',
} as const

export function defineKitrConfig(rc: KitrRc): KitrRc {
  return { ...rc, directories: { ...defaultDirectories, ...rc.directories } }
}
