import { type StandardSchemaV1, toFieldErrors } from './schema'

type SchemaMap = Record<string, StandardSchemaV1>
type Output<M extends SchemaMap> = { readonly [K in keyof M]: StandardSchemaV1.InferOutput<M[K]> }

export interface CreateEnvOptions<Pub extends SchemaMap, Srv extends SchemaMap> {
  /** Variables shipped to the browser. Must start with `clientPrefix` (default `VITE_`). */
  public?: Pub
  /** Server-only variables. Reading one in the browser throws. */
  server?: Srv
  /** Where values come from. Defaults to `import.meta.env` merged over `process.env`. */
  runtimeEnv?: Record<string, unknown>
  clientPrefix?: string
  /** Set true in the browser bundle; defaults to detecting `window`. */
  isClient?: boolean
  /** Skip validation (e.g. during `kitr build` type-check). */
  skip?: boolean
}

export type Env<Pub extends SchemaMap, Srv extends SchemaMap> = Output<Pub> & Output<Srv>

/**
 * ~80 lines over Standard Schema instead of a dependency. Splits public and
 * server variables, validates at startup and throws one message listing every problem.
 */
export function createEnv<Pub extends SchemaMap = {}, Srv extends SchemaMap = {}>(
  options: CreateEnvOptions<Pub, Srv>,
): Env<Pub, Srv> {
  const prefix = options.clientPrefix ?? 'VITE_'
  const isClient =
    options.isClient ?? (typeof window !== 'undefined' && typeof document !== 'undefined')
  const runtime = options.runtimeEnv ?? defaultRuntimeEnv()
  const pub = options.public ?? ({} as Pub)
  const srv = options.server ?? ({} as Srv)

  for (const key of Object.keys(pub)) {
    if (!key.startsWith(prefix)) {
      throw new Error(
        `[kitr/env] Public variable "${key}" must start with "${prefix}" to reach the browser.`,
      )
    }
  }

  const values: Record<string, unknown> = {}
  const problems: string[] = []
  const check = (map: SchemaMap, serverOnly: boolean) => {
    for (const [key, schema] of Object.entries(map)) {
      if (serverOnly && isClient) continue
      const raw = runtime[key] === '' ? undefined : runtime[key]
      const result = schema['~standard'].validate(raw)
      if (result instanceof Promise) throw new Error('[kitr/env] env schemas must be synchronous')
      if (result.issues) {
        const fe = toFieldErrors(result.issues)
        problems.push(`  ${key}: ${Object.values(fe).flat().join('; ')}`)
      } else values[key] = result.value
    }
  }
  if (!options.skip) {
    check(pub, false)
    check(srv, true)
    if (problems.length)
      throw new Error(`[kitr/env] Invalid environment variables:\n${problems.join('\n')}`)
  }

  return new Proxy(values as Env<Pub, Srv>, {
    get(target, prop) {
      if (typeof prop !== 'string') return undefined
      if (isClient && prop in srv && !(prop in pub)) {
        throw new Error(`[kitr/env] "${prop}" is server-only and cannot be read in the browser.`)
      }
      return (target as any)[prop]
    },
  })
}

function defaultRuntimeEnv(): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const proc = (globalThis as any).process as { env?: Record<string, unknown> } | undefined
  if (proc?.env) Object.assign(out, proc.env)
  try {
    // import.meta.env exists under Vite; guarded so plain Node works.
    const meta = (import.meta as any).env
    if (meta) Object.assign(out, meta)
  } catch {}
  return out
}

/* Tiny coercing schemas for env values, so apps don't need zod just for env. */
const make = <T>(name: string, fn: (v: unknown) => T): StandardSchemaV1<unknown, T> => ({
  '~standard': {
    version: 1,
    vendor: 'kitr',
    validate: (value) => {
      try {
        return { value: fn(value) }
      } catch (e) {
        return { issues: [{ message: e instanceof Error ? e.message : `invalid ${name}` }] }
      }
    },
  },
})

export const env = {
  string: (opts: { optional?: boolean; default?: string } = {}) =>
    make('string', (v) => {
      if (v === undefined) {
        if (opts.default !== undefined) return opts.default
        if (opts.optional) return undefined as unknown as string
        throw new Error('required')
      }
      return String(v)
    }),
  number: (opts: { optional?: boolean; default?: number } = {}) =>
    make('number', (v) => {
      if (v === undefined) {
        if (opts.default !== undefined) return opts.default
        if (opts.optional) return undefined as unknown as number
        throw new Error('required')
      }
      const n = Number(v)
      if (Number.isNaN(n)) throw new Error(`expected a number, got "${v}"`)
      return n
    }),
  boolean: (opts: { default?: boolean } = {}) =>
    make('boolean', (v) => {
      if (v === undefined) {
        if (opts.default !== undefined) return opts.default
        throw new Error('required')
      }
      const s = String(v).toLowerCase()
      if (['1', 'true', 'yes', 'on'].includes(s)) return true
      if (['0', 'false', 'no', 'off'].includes(s)) return false
      throw new Error(`expected a boolean, got "${v}"`)
    }),
  url: (opts: { optional?: boolean; default?: string } = {}) =>
    make('url', (v) => {
      if (v === undefined) {
        if (opts.default !== undefined) return opts.default
        if (opts.optional) return undefined as unknown as string
        throw new Error('required')
      }
      new URL(String(v))
      return String(v)
    }),
  enum: <const T extends readonly string[]>(values: T, opts: { default?: T[number] } = {}) =>
    make('enum', (v): T[number] => {
      if (v === undefined) {
        if (opts.default !== undefined) return opts.default
        throw new Error('required')
      }
      if (!values.includes(String(v))) throw new Error(`expected one of ${values.join(', ')}`)
      return String(v) as T[number]
    }),
}
