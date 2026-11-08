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
    /** File-based page routes the Vite plugin reads (TanStack Router). Default `app/routes`. */
    routes?: string
    /** The app's route table (`defineRoutes([router], ...)`: pages). Default `app/routes.ts`. */
    routeTable?: string
    /** The server's route table (endpoints and sockets; never imports React). Default `server/routes.ts`. A server-only project has only this one. */
    serverRouteTable?: string
    config?: string
    stubs?: string
    components?: string
    /** Server code (routes, controllers, jobs). Default `server`. */
    server?: string
    /** Native projects, one folder per platform name. Default `platforms`. */
    platforms?: string
    /** Server functions (`defineQuery`, `defineMutation`) `kitr types` scans. Default `app/actions`. */
    actions?: string
  }
  /** Paths to preload on the server before the first request (server apps). */
  preloads?: Array<() => Promise<unknown>>
}

export const defaultDirectories = {
  app: 'app',
  routes: 'app/routes',
  routeTable: 'app/routes.ts',
  serverRouteTable: 'server/routes.ts',
  config: 'config',
  stubs: 'stubs',
  components: 'app/components',
  server: 'server',
  platforms: 'platforms',
} as const

export function defineKitrConfig(rc: KitrRc): KitrRc {
  return { ...rc, directories: { ...defaultDirectories, ...rc.directories } }
}

/**
 * The shape of `kitr.workspace.ts`, at the root of a monorepo that holds several kitr apps:
 *
 *   export default defineWorkspace({ apps: { web: 'apps/web', phone: 'apps/phone' } })
 *
 * Each app is a full kitr project (its own `kitrrc.ts`, `app/`, `config/`). From the workspace
 * root, `kitr dev` runs every app, `kitr build phone` builds one, and `--app web` (or `KITR_APP`)
 * points any command at one app without `cd`. Shared code lives in `packages/*` as ordinary
 * workspace packages; kitr adds nothing there.
 */
export interface KitrWorkspace {
  /** The apps by name, as directories relative to the workspace root. */
  apps: Record<string, string>
  /** Shared package directories, listed for tooling (`kitr doctor`, the site). Default `packages/*`. */
  packages?: string[]
}

export function defineWorkspace(workspace: KitrWorkspace): KitrWorkspace {
  return { packages: ['packages/*'], ...workspace }
}
