import type { DevtoolsHub } from './devtools'
import type { MaybePromise } from './types'

/**
 * Packages declare the services they bind by augmenting this interface:
 *
 *   declare module '@kitr/core' {
 *     interface ContainerBindings { queryClient: QueryClient }
 *   }
 *
 * Then `app.container.use('queryClient')` is typed in every app.
 */
export interface ContainerBindings {
  /** Bound by `@kitr/devtools` in development only. */
  devtools: DevtoolsHub
}

export type BindingKey = keyof ContainerBindings | (string & {})
export type Binding<K> = K extends keyof ContainerBindings ? ContainerBindings[K] : unknown

type Factory<T> = (container: Container) => MaybePromise<T>

/**
 * A class the container can build: `make(Class)` passes it the bindings named by `static inject`,
 * in order, as constructor arguments. A plain class without `inject` is built with no arguments.
 *
 *   class ProjectsController {
 *     static inject = ['db', 'logger'] as const
 *     constructor(private db: Db, private logger: Logger) {}
 *   }
 */
export interface Constructible<T = object> {
  new (...args: any[]): T
  /** Binding keys to resolve and pass to the constructor, in order. */
  readonly inject?: readonly BindingKey[]
}

/**
 * A typed registry of lazy singletons. ~100 lines, no decorators, no reflection.
 * It is what loaders, actions, controllers and tests use to reach services.
 */
export class Container {
  private factories = new Map<string, Factory<unknown>>()
  private instances = new Map<string, unknown>()
  private pending = new Map<string, Promise<unknown>>()
  private scopedKeys = new Set<string>()

  constructor(private readonly parent?: Container) {}

  /** Register a lazy singleton. Re-binding replaces the factory and drops the cached instance. */
  singleton<K extends BindingKey>(key: K, factory: Factory<Binding<K>>): this {
    this.factories.set(key, factory as Factory<unknown>)
    this.instances.delete(key)
    this.pending.delete(key)
    return this
  }

  /**
   * Register a lazy binding with one instance per container: the app container and every
   * `child()` (a request, a test) each build their own. Use it for per-user state such as a
   * query cache, which must never be shared between server requests.
   */
  scoped<K extends BindingKey>(key: K, factory: Factory<Binding<K>>): this {
    this.singleton(key, factory)
    this.scopedKeys.add(key)
    return this
  }

  /**
   * Where `key` resolves from: a cached instance or factory here, or the nearest ancestor's.
   * A scoped factory found on an ancestor is run in this container instead.
   */
  private locate(key: string): { owner: Container; build: boolean } | undefined {
    if (this.instances.has(key) || this.factories.has(key)) return { owner: this, build: true }
    for (let c = this.parent; c; c = c.parent) {
      if (c.factories.has(key)) return { owner: c, build: !c.scopedKeys.has(key) }
      // An ancestor's own instance of a scoped binding belongs to that ancestor, not to us.
      if (c.instances.has(key) && !c.isScoped(key)) return { owner: c, build: true }
    }
    return undefined
  }

  private isScoped(key: string): boolean {
    for (let c: Container | undefined = this; c; c = c.parent)
      if (c.factories.has(key)) return c.scopedKeys.has(key)
    return false
  }

  /** Bind an already-built value. */
  value<K extends BindingKey>(key: K, value: Binding<K>): this {
    this.factories.delete(key)
    this.scopedKeys.delete(key)
    this.instances.set(key, value)
    return this
  }

  has(key: BindingKey): boolean {
    return this.instances.has(key) || this.factories.has(key) || (this.parent?.has(key) ?? false)
  }

  /**
   * Resolve a binding, running its factory on first use. Factories may be async.
   *
   * Given a class instead of a key, build a new instance of it from this container: the bindings
   * named by its `static inject` become the constructor arguments, resolved here, so a request
   * fork gives the instance that request's services. Nothing is cached: every call builds one.
   */
  make<T extends object>(Class: Constructible<T>): Promise<T>
  make<K extends BindingKey>(key: K): Promise<Binding<K>>
  async make(key: BindingKey | Constructible): Promise<unknown> {
    if (typeof key === 'function') {
      const args = await Promise.all((key.inject ?? []).map((dependency) => this.make(dependency)))
      return new key(...args)
    }
    if (this.instances.has(key)) return this.instances.get(key)
    const inflight = this.pending.get(key)
    if (inflight) return inflight
    const found = this.locate(key)
    if (!found) throw missing(key)
    if (found.owner !== this && found.build) return found.owner.make(key)
    const factory = (this.factories.get(key) ?? found.owner.factories.get(key))!
    // Run the factory now: a synchronous instance is cached before any other factory that
    // `use()`s this key can build a second one (resolveAll makes every binding in parallel).
    let result: unknown
    try {
      result = factory(this)
    } catch (error) {
      return Promise.reject(error)
    }
    if (!(result instanceof Promise)) {
      this.instances.set(key, result)
      return Promise.resolve(result)
    }
    const promise = result.then(
      (instance) => {
        this.instances.set(key, instance)
        this.pending.delete(key)
        return instance
      },
      (error) => {
        // Don't cache a failure: the next make() runs the factory again.
        this.pending.delete(key)
        throw error
      },
    )
    this.pending.set(key, promise)
    return promise
  }

  /**
   * Resolve synchronously. Works for values and for singletons whose factory
   * is synchronous or has already been resolved by `make()` or `boot()`.
   */
  use<K extends BindingKey>(key: K): Binding<K> {
    if (this.instances.has(key)) return this.instances.get(key) as Binding<K>
    const found = this.locate(key)
    if (!found) throw missing(key)
    if (found.owner !== this && found.build) return found.owner.use(key)
    if (this.pending.has(key)) throw asyncFactory(key)
    const factory = (this.factories.get(key) ?? found.owner.factories.get(key))!
    const instance = factory(this)
    if (instance instanceof Promise) throw asyncFactory(key)
    this.instances.set(key, instance)
    return instance as Binding<K>
  }

  /** Resolve every registered binding. Called by `app.boot()` so `use()` is safe after boot. */
  async resolveAll(): Promise<void> {
    await Promise.all([...this.factories.keys()].map((key) => this.make(key)))
  }

  /** Per-request or per-test child: inherits bindings, keeps its own instances. */
  child(): Container {
    return new Container(this)
  }

  keys(): string[] {
    const own = new Set([...this.factories.keys(), ...this.instances.keys()])
    for (const key of this.parent?.keys() ?? []) own.add(key)
    return [...own]
  }

  /** Drop cached instances (keeps factories). Used by tests and HMR. */
  reset(): void {
    this.instances.clear()
    this.pending.clear()
  }
}

function missing(key: string) {
  return new Error(`[kitr] No binding named "${key}". Did you add the package that provides it?`)
}

function asyncFactory(key: string) {
  return new Error(
    `[kitr] Binding "${key}" has an async factory; await container.make('${key}') before use('${key}').`,
  )
}
