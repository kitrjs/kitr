import type { PlatformInstance } from './platform'
import type { ProviderInput } from './provider'

/**
 * The shape of `kitrrc.ts`. Same idea as `adonisrc.ts`: explicit lazy imports,
 * so the `kitr()` Vite plugin and the CLI can both read it, and nothing is hidden.
 */
export interface KitrRc {
  /**
   * Where the app runs, by name. Each value comes from a platform package:
   * `{ site: web({ mode: 'ssr' }), phone: mobile({ targets: ['ios'] }), api: server({ runtime: 'node' }) }`.
   * Names are yours and must be unique; every CLI command can target them (`kitr dev site api`).
   */
  platforms?: Record<string, PlatformInstance<any>>
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
    /** Server code (routes, controllers, jobs). Default `server`. */
    server?: string
    /** Native projects, one folder per platform name. Default `platforms`. */
    platforms?: string
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
  server: 'server',
  platforms: 'platforms',
} as const

export function defineKitrConfig(rc: KitrRc): KitrRc {
  return { ...rc, directories: { ...defaultDirectories, ...rc.directories } }
}
