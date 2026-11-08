import type { MutationContract, QueryContract } from './contract'

/**
 * The operation registry: every named query and mutation in the project, by name.
 *
 * A source package defines operations (`defineQuery('projects.list', ...)` in `@kitr/actions`),
 * `kitr types` writes `.kitr/actions.ts` with the map and an augmentation of `Operations`, and the
 * app passes the map to `createApp({ operations })`. From then on `useQuery('projects.list')`,
 * `call('projects.update', input)` and anything else name-keyed resolves here, with the types
 * the handler declared:
 *
 *   declare module '@kitr/core' {
 *     interface Operations { 'projects.list': typeof listProjects }
 *   }
 */
// biome-ignore lint/suspicious/noEmptyInterface: augmentation target
export interface Operations {}

/** The least an operation must carry: its kind, its name and its contract. */
export interface OperationLike {
  readonly kind: 'query' | 'mutation'
  readonly name: string
  readonly contract: QueryContract<any, any> | MutationContract<any, any>
}

/** Every registered name. `never` until `kitr types` has written the augmentation. */
export type OperationName = keyof Operations & string

/** The operation registered under `N`, or any operation for a name the types do not know. */
export type OperationOf<N> = N extends keyof Operations ? Operations[N] : OperationLike

/** The names of the registered queries. */
export type QueryName = {
  [K in keyof Operations]: Operations[K] extends { kind: 'query' } ? K : never
}[keyof Operations] &
  string

/** The names of the registered mutations. */
export type MutationName = {
  [K in keyof Operations]: Operations[K] extends { kind: 'mutation' } ? K : never
}[keyof Operations] &
  string

/** What an operation takes: its contract's input type. */
export type OperationInput<Op> = Op extends { contract: QueryContract<infer I, any> }
  ? I
  : Op extends { contract: MutationContract<infer I, any> }
    ? I
    : unknown

/** What an operation returns: its contract's output type. */
export type OperationOutput<Op> = Op extends { contract: QueryContract<any, infer O> }
  ? O
  : Op extends { contract: MutationContract<any, infer O> }
    ? O
    : unknown

/**
 * The operations of one app. `createApp({ operations })` fills the app's registry, a fork gets a
 * child registry that reads through to its parent (so a request or a test can register a fake
 * without touching anyone else's), and nothing is process-wide: two apps in one process, or two
 * tests in one worker, never see each other's operations.
 */
export class OperationRegistry {
  private entries = new Map<string, OperationLike>()

  constructor(private readonly parent?: OperationRegistry) {}

  /** Add operations by name. A name registered twice is replaced, which is how tests swap in fakes. */
  register(operations: Record<string, OperationLike>): this {
    for (const [name, op] of Object.entries(operations)) {
      if (!op || typeof op !== 'object' || !('kind' in op) || !('contract' in op))
        throw new Error(`[kitr] operations.${name} is not a query or mutation definition`)
      this.entries.set(name, op)
    }
    return this
  }

  /** The operation under `name`. Throws with the registered names when it is missing. */
  get<N extends string>(name: N): OperationOf<N> {
    const op = this.find(name)
    if (!op) {
      const names = this.names()
      throw new Error(
        `[kitr] No operation named "${name}". ${
          names.length
            ? `Registered: ${names.join(', ')}.`
            : 'Nothing is registered: pass the generated map to createApp({ operations }).'
        }`,
      )
    }
    return op as OperationOf<N>
  }

  has(name: string): boolean {
    return this.find(name) !== undefined
  }

  names(): string[] {
    return [...new Set([...(this.parent?.names() ?? []), ...this.entries.keys()])]
  }

  /** Every registered operation, for devtools and doctor. */
  all(): OperationLike[] {
    return this.names().map((name) => this.find(name)!)
  }

  /** A registry for a request or test fork: sees everything registered here, registers on its own. */
  child(): OperationRegistry {
    return new OperationRegistry(this)
  }

  private find(name: string): OperationLike | undefined {
    return this.entries.get(name) ?? this.parent?.find(name)
  }
}
