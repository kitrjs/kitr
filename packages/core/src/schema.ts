import type { StandardSchemaV1 } from '@standard-schema/spec'
import { type FieldErrors, KitrError } from './errors'

export type { StandardSchemaV1 }

export type AnySchema = StandardSchemaV1
export type InferInput<S> = S extends StandardSchemaV1<infer I, any> ? I : never
export type InferOutput<S> = S extends StandardSchemaV1<any, infer O> ? O : never

/** Turns Standard Schema issues into kitr's `fieldErrors` map. */
export function toFieldErrors(issues: ReadonlyArray<StandardSchemaV1.Issue>): FieldErrors {
  const out: FieldErrors = {}
  for (const issue of issues) {
    const path =
      issue.path
        ?.map((p) => (typeof p === 'object' && p !== null && 'key' in p ? p.key : p))
        .map(String)
        .join('.') || '_root'
    out[path] ??= []
    out[path].push(issue.message)
  }
  return out
}

export type ValidateResult<T> =
  | { success: true; data: T }
  | { success: false; fieldErrors: FieldErrors }

/** Runs any Standard Schema validator. Never throws. */
export async function validate<S extends StandardSchemaV1>(
  schema: S,
  input: unknown,
): Promise<ValidateResult<InferOutput<S>>> {
  const result = await schema['~standard'].validate(input)
  if (result.issues) return { success: false, fieldErrors: toFieldErrors(result.issues) }
  return { success: true, data: result.value as InferOutput<S> }
}

/** Synchronous variant for schemas that validate synchronously (zod, valibot, arktype all do). */
export function validateSync<S extends StandardSchemaV1>(
  schema: S,
  input: unknown,
): ValidateResult<InferOutput<S>> {
  const result = schema['~standard'].validate(input)
  if (result instanceof Promise) {
    throw new TypeError('validateSync() got an async schema; use validate() instead')
  }
  if (result.issues) return { success: false, fieldErrors: toFieldErrors(result.issues) }
  return { success: true, data: result.value as InferOutput<S> }
}

/** Validates or throws `KitrError.validation(fieldErrors)`. */
export async function parse<S extends StandardSchemaV1>(
  schema: S,
  input: unknown,
): Promise<InferOutput<S>> {
  const r = await validate(schema, input)
  if (!r.success) throw KitrError.validation(r.fieldErrors)
  return r.data
}

export function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  return typeof value === 'object' && value !== null && '~standard' in value
}

/** A schema that accepts anything; used as the default when no input schema is given. */
// kitr-allow-module-state: constant schema that accepts anything, never mutated
export const anySchema: StandardSchemaV1<unknown, unknown> = {
  '~standard': { version: 1, vendor: 'kitr', validate: (value) => ({ value }) },
}

/** Build a tiny Standard Schema from a plain function. Handy for env coercion and tests. */
export function schemaFrom<I, O>(
  fn: (input: I) => O | { issues: { message: string }[] },
): StandardSchemaV1<I, O> {
  return {
    '~standard': {
      version: 1,
      vendor: 'kitr',
      validate: (value) => {
        try {
          const out = fn(value as I)
          if (typeof out === 'object' && out !== null && 'issues' in (out as any)) {
            return { issues: (out as any).issues }
          }
          return { value: out as O }
        } catch (error) {
          return { issues: [{ message: error instanceof Error ? error.message : String(error) }] }
        }
      },
    },
  }
}
