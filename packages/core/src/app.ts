import { ConfigStore } from './config'
import { Container } from './container'
import { type KitrProvider, type ProviderInput, resolveProvider } from './provider'
import type { KitrNode } from './types'

export type AppEnvironment = 'client' | 'server' | 'test'
export type AppMode = 'development' | 'production' | 'test'

export interface CreateAppOptions {
  providers?: ProviderInput[]
  /** Per-package config, keyed the way `config/<name>.ts` files are. */
  config?: Record<string, unknown>
  environment?: AppEnvironment
  /** development | production | test. Default: from Vite's `import.meta.env.MODE` or `NODE_ENV`. */
  mode?: AppMode
  /** Validated env object (from `createEnv`). Exposed as `app.env`. */
  env?: Record<string, unknown>
}

type Phase = 'created' | 'registered' | 'booted' | 'ready' | 'shutdown'

/**
 * The app object every provider sees. One per client, one per server process,
 * one per test. It owns the container, the config and the provider list.
 */
export class KitrApp {
  readonly container: Container
  readonly config = new ConfigStore()
  readonly environment: AppEnvironment
  readonly mode: AppMode
  readonly env: Record<string, unknown>
  readonly providers: KitrProvider[] = []
  private inputs: ProviderInput[]
  private phase: Phase = 'created'
  private booting?: Promise<this>

  constructor(options: CreateAppOptions = {}) {
    this.container = new Container()
    this.environment = options.environment ?? detectEnvironment()
    this.mode = options.mode ?? detectMode()
    this.env = options.env ?? {}
    this.inputs = [...(options.providers ?? [])]
    for (const [key, value] of Object.entries(options.config ?? {}))
      this.config.set(key, value as never)
  }

  get isClient(): boolean {
    return this.environment === 'client'
  }
  get isServer(): boolean {
    return this.environment === 'server'
  }
  get isDevelopment(): boolean {
    return this.mode === 'development'
  }
  get isProduction(): boolean {
    return this.mode === 'production'
  }

  /** Add a provider before boot. */
  use(provider: ProviderInput): this {
    if (this.phase !== 'created') throw new Error('[kitr] app.use() must be called before boot()')
    this.inputs.push(provider)
    return this
  }

  /** register → boot. Idempotent: concurrent callers share one boot. */
  boot(): Promise<this> {
    if (this.booting) return this.booting
    this.booting = (async () => {
      const resolved = await Promise.all(this.inputs.map(resolveProvider))
      this.providers.push(...resolved)
      for (const p of this.providers) await p.register?.(this)
      this.phase = 'registered'
      await this.container.resolveAll()
      for (const p of this.providers) await p.boot?.(this)
      this.phase = 'booted'
      return this
    })()
    return this.booting
  }

  /** Server only: tell providers the server is listening. */
  async ready(): Promise<this> {
    await this.boot()
    for (const p of this.providers) await p.ready?.(this)
    this.phase = 'ready'
    return this
  }

  /** Server only: run providers' `shutdown` in reverse order. */
  async shutdown(): Promise<void> {
    for (const p of [...this.providers].reverse()) await p.shutdown?.(this)
    this.phase = 'shutdown'
  }

  /** Compose every provider's `wrap`, outermost first. */
  wrap(children: KitrNode): KitrNode {
    let node = children
    for (const p of [...this.providers].reverse()) if (p.wrap) node = p.wrap(node, this)
    return node
  }

  /** A request- or test-scoped app that shares providers and config but has its own instances. */
  fork(): KitrApp {
    const child = Object.create(KitrApp.prototype) as KitrApp
    Object.assign(child, {
      container: this.container.child(),
      config: this.config,
      environment: this.environment,
      mode: this.mode,
      env: this.env,
      providers: this.providers,
      inputs: [],
      phase: this.phase,
    })
    // A fork shares the parent's providers, so it boots by booting the parent (once), then
    // takes on its phase. Forking before boot is normal: TanStack Start builds the router,
    // and with it the per-request fork, before anything has awaited app.boot().
    child.boot = () =>
      this.boot().then(() => {
        child.phase = this.phase
        return child
      })
    return child
  }

  get status(): Phase {
    return this.phase
  }
}

export function createApp(options?: CreateAppOptions): KitrApp {
  return new KitrApp(options)
}

function detectEnvironment(): AppEnvironment {
  if (globalProcess()?.env?.VITEST) return 'test'
  if (typeof window !== 'undefined' && typeof document !== 'undefined') return 'client'
  return 'server'
}

function globalProcess(): { env?: Record<string, string | undefined> } | undefined {
  return (globalThis as any).process
}

function detectMode(): AppMode {
  const meta = (import.meta as unknown as { env?: { MODE?: string; DEV?: boolean } }).env
  if (meta?.MODE === 'test') return 'test'
  // `vite build --mode development` keeps NODE_ENV=production (so DEV is false) but the mode is what the app asked for.
  if (meta?.MODE === 'development' || meta?.MODE === 'production') return meta.MODE
  if (typeof meta?.DEV === 'boolean') return meta.DEV ? 'development' : 'production'
  const nodeEnv = (globalThis as any).process?.env?.NODE_ENV as string | undefined
  if (nodeEnv === 'test') return 'test'
  return nodeEnv === 'production' ? 'production' : 'development'
}
