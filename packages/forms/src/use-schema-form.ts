import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import type { StandardSchemaV1 } from '@kitr/core'
import { type FieldValues, type UseFormProps, type UseFormReturn, useForm } from 'react-hook-form'

export type SchemaFormOptions<TIn extends FieldValues, TOut> = Omit<
  UseFormProps<TIn, unknown, TOut>,
  'resolver'
>

/**
 * `useForm` with a Standard Schema resolver (zod, valibot, arktype). The full
 * React Hook Form API is on the returned object; nothing is wrapped.
 */
export function useSchemaForm<TIn extends FieldValues, TOut extends FieldValues = TIn>(
  schema: StandardSchemaV1<TIn, TOut>,
  options: SchemaFormOptions<TIn, TOut> = {},
): UseFormReturn<TIn, unknown, TOut> {
  return useForm<TIn, unknown, TOut>({
    mode: 'onTouched',
    ...options,
    resolver: standardSchemaResolver(schema) as any,
  })
}

/** Alias kept for people who think in zod. */
export const useZodForm = useSchemaForm
