import { type FieldErrors, isKitrError, toKitrError } from '@kitr/core'
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'

/**
 * Map kitr's `fieldErrors` onto React Hook Form fields. Unknown fields and
 * `_root` go to `root.server`. Returns true if the error was a validation error.
 */
export function applyServerErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  error: unknown,
): boolean {
  const err = toKitrError(error)
  const fieldErrors: FieldErrors | undefined = err.fieldErrors
  const known = new Set(Object.keys(form.getValues() ?? {}))
  let applied = false
  if (fieldErrors) {
    for (const [field, messages] of Object.entries(fieldErrors)) {
      const first = messages[0] ?? 'Invalid'
      const top = field.split('.')[0] ?? field
      if (field !== '_root' && (known.has(top) || known.size === 0)) {
        form.setError(field as Path<T>, { type: 'server', message: first })
        applied = true
      } else {
        form.setError('root.server', { type: 'server', message: first })
      }
    }
  }
  if (!applied && !fieldErrors) {
    form.setError('root.server', { type: 'server', message: err.message })
  }
  return isKitrError(error) && err.code === 'VALIDATION'
}
