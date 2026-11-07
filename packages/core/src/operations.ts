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
 * One registry per process. Definitions hold no state, so every app, request fork and test
 * shares it; `reset()` clears it between tests that register fakes.
 */
export class OperationRegistry {
  private entries = new Map<string, OperationLike>()

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
    const op = this.entries.get(name)
    if (!op)
      throw new Error(
        `[kitr] No operation named "${name}". ${
          this.entries.size
            ? `Registered: ${[...this.entries.keys()].join(', ')}.`
            : 'Nothing is registered: pass the generated map to createApp({ operations }).'
        }`,
      )
    return op as OperationOf<N>
  }

  has(name: string): boolean {
    return this.entries.has(name)
  }

  names(): string[] {
    return [...this.entries.keys()]
  }

  /** Every registered operation, for devtools and doctor. */
  all(): OperationLike[] {
    return [...this.entries.values()]
  }

  reset(): void {
    this.entries.clear()
  }
}

/** The process-wide registry. `createApp({ operations })` fills it; `app.operations` is this object. */
export const operations = new OperationRegistry()
