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
// biome-ignore lint/suspicious/noEmptyInterface: augmentation target
export interface ContainerBindings {}

export type BindingKey = keyof ContainerBindings | (string & {})
export type Binding<K> = K extends keyof ContainerBindings ? ContainerBindings[K] : unknown

type Factory<T> = (container: Container) => MaybePromise<T>

/**
 * A typed registry of lazy singletons. ~100 lines, no decorators, no reflection.
 * It is what loaders, actions, controllers and tests use to reach services.
 */
export class Container {
  private factories = new Map<string, Factory<unknown>>()
  private instances = new Map<string, unknown>()
  private pending = new Map<string, Promise<unknown>>()

  constructor(private readonly parent?: Container) {}

  /** Register a lazy singleton. Re-binding replaces the factory and drops the cached instance. */
  singleton<K extends BindingKey>(key: K, factory: Factory<Binding<K>>): this {
    this.factories.set(key, factory as Factory<unknown>)
    this.instances.delete(key)
    this.pending.delete(key)
    return this
  }

  /** Bind an already-built value. */
  value<K extends BindingKey>(key: K, value: Binding<K>): this {
    this.factories.delete(key)
    this.instances.set(key, value)
    return this
  }

  has(key: BindingKey): boolean {
    return this.instances.has(key) || this.factories.has(key) || (this.parent?.has(key) ?? false)
  }

  /** Resolve a binding, running its factory on first use. Factories may be async. */
  async make<K extends BindingKey>(key: K): Promise<Binding<K>> {
    if (this.instances.has(key)) return this.instances.get(key) as Binding<K>
    const inflight = this.pending.get(key)
    if (inflight) return inflight as Promise<Binding<K>>
    const factory = this.factories.get(key)
    if (!factory) {
      if (this.parent) return this.parent.make(key)
      throw new Error(`[kitr] No binding named "${key}". Did you add the package that provides it?`)
    }
    const promise = Promise.resolve(factory(this)).then((instance) => {
      this.instances.set(key, instance)
      this.pending.delete(key)
      return instance as Binding<K>
    })
    this.pending.set(key, promise)
    return promise
  }

  /**
   * Resolve synchronously. Works for values and for singletons whose factory
   * is synchronous or has already been resolved by `make()` or `boot()`.
   */
  use<K extends BindingKey>(key: K): Binding<K> {
    if (this.instances.has(key)) return this.instances.get(key) as Binding<K>
    const factory = this.factories.get(key)
    if (!factory) {
      if (this.parent) return this.parent.use(key)
      throw new Error(`[kitr] No binding named "${key}". Did you add the package that provides it?`)
    }
    const instance = factory(this)
    if (instance instanceof Promise) {
      throw new Error(
        `[kitr] Binding "${key}" has an async factory; await container.make('${key}') before use('${key}').`,
      )
    }
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
