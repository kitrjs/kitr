import { toKitrError } from '@kitr/core'
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
  useId,
  useState,
} from 'react'
import {
  type FieldPath,
  type FieldValues,
  FormProvider,
  type UseFormReturn,
  useFormContext,
} from 'react-hook-form'
import { applyServerErrors } from './server-errors'

/** Props of `<Form>`. Every other prop is passed to the `<form>` element. */
export interface FormProps<TIn extends FieldValues, TOut extends FieldValues>
  extends Omit<ComponentProps<'form'>, 'onSubmit' | 'onError'> {
  /** The object returned by `useSchemaForm` or React Hook Form's `useForm`. */
  form: UseFormReturn<TIn, unknown, TOut>
  /** Runs with validated values. A thrown KitrError with `fieldErrors` lands on fields. */
  onSubmit: (values: TOut) => unknown | Promise<unknown>
  /** Runs after `onSubmit` resolves, with its return value and the submitted values. */
  onSuccess?: (result: unknown, values: TOut) => void
  /** Runs after a thrown error has been mapped onto the fields; receives it as a `KitrError`. */
  onError?: (error: unknown) => void
  /** Reset to default values after a successful submit. */
  resetOnSuccess?: boolean
  /** The fields, buttons and anything else inside the form. */
  children: ReactNode
}

/**
 * The kitr glue around React Hook Form: submit handling with pending state,
 * server validation errors mapped onto fields, and a root error for everything else.
 */
export function Form<TIn extends FieldValues, TOut extends FieldValues>({
  form,
  onSubmit,
  onSuccess,
  onError,
  resetOnSuccess,
  children,
  ...rest
}: FormProps<TIn, TOut>) {
  const [pending, setPending] = useState(false)
  const submit = form.handleSubmit(async (values) => {
    setPending(true)
    form.clearErrors('root.server' as any)
    try {
      const result = await onSubmit(values)
      onSuccess?.(result, values)
      if (resetOnSuccess) form.reset()
    } catch (error) {
      applyServerErrors(form as unknown as UseFormReturn<TIn>, error)
      onError?.(toKitrError(error))
    } finally {
      setPending(false)
    }
  })
  return (
    <FormProvider {...form}>
      <FormStatusContext.Provider value={{ pending }}>
        <form noValidate {...rest} onSubmit={submit}>
          {children}
        </form>
      </FormStatusContext.Provider>
    </FormProvider>
  )
}

const FormStatusContext = createContext<{ pending: boolean }>({ pending: false })

/** `pending` is true while `onSubmit` runs. Use it on the submit button. */
export function useFormStatus() {
  const { pending } = useContext(FormStatusContext)
  const form = useFormContext()
  return { pending: pending || form.formState.isSubmitting, isValid: form.formState.isValid }
}

/** The form-level error from the server (anything not mapped to a field). */
export function useRootError(): string | undefined {
  const form = useFormContext()
  return (form.formState.errors as any)?.root?.server?.message as string | undefined
}

interface FieldContextValue {
  name: string
  id: string
  error?: string
  describedBy: string
}
const FieldContext = createContext<FieldContextValue | null>(null)

/** Props of `<FormField>`: which field it wraps and the text around the input. */
export interface FormFieldProps<T extends FieldValues> {
  /** The field path, dot-separated for nested fields (`'lines.0.quantity'`). */
  name: FieldPath<T>
  /** Content of the `<label>`, which points at the input's generated id. */
  label?: ReactNode
  /** Help text under the input, linked to it with `aria-describedby`. */
  description?: ReactNode
  /** The input, or a function that receives `{ id, name, invalid, describedBy }` and renders it. */
  children:
    | ReactNode
    | ((field: { id: string; name: string; invalid: boolean; describedBy: string }) => ReactNode)
  /** Class for the wrapper `<div data-kitr="field">`. */
  className?: string
}

/**
 * Headless field wrapper: generates ids, wires `aria-describedby` and
 * `aria-invalid`, shows the field's error. Style it with your own classes
 * or pull the registry's `form` component for a styled version.
 */
export function FormField<T extends FieldValues>({
  name,
  label,
  description,
  children,
  className,
}: FormFieldProps<T>) {
  const form = useFormContext<T>()
  const id = useId()
  const error = (form.getFieldState(name, form.formState).error?.message ?? undefined) as
    | string
    | undefined
  const describedBy = [description ? `${id}-description` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ')
  const value: FieldContextValue = { name, id, error, describedBy }
  return (
    <FieldContext.Provider value={value}>
      <div className={className} data-kitr="field" data-invalid={error ? '' : undefined}>
        {label ? (
          <label htmlFor={id} data-kitr="label">
            {label}
          </label>
        ) : null}
        {typeof children === 'function'
          ? children({ id, name, invalid: !!error, describedBy })
          : children}
        {description ? (
          <p id={`${id}-description`} data-kitr="description">
            {description}
          </p>
        ) : null}
        {error ? (
          <p id={`${id}-error`} role="alert" data-kitr="field-error">
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  )
}

/** Props to spread on the input inside a `<FormField>`: `{...useFieldProps()}` plus `form.register(name)`. */
export function useFieldProps() {
  const ctx = useContext(FieldContext)
  if (!ctx) throw new Error('[kitr/forms] useFieldProps() must be used inside <FormField>.')
  const form = useFormContext()
  return {
    id: ctx.id,
    'aria-invalid': ctx.error ? true : undefined,
    'aria-describedby': ctx.describedBy || undefined,
    ...form.register(ctx.name),
  }
}

/** Convenience: an `<input>` already registered to the surrounding field. */
export function FieldInput(props: Omit<ComponentProps<'input'>, 'name' | 'id'>) {
  const fieldProps = useFieldProps()
  return <input {...props} {...fieldProps} />
}

/**
 * A `type="submit"` button that is disabled and `aria-busy` while the form submits, and shows
 * `pendingText` in that time. A `disabled` prop is combined with the pending state, never replaced.
 */
export function SubmitButton({
  children,
  pendingText,
  disabled,
  ...props
}: ComponentProps<'button'> & { pendingText?: ReactNode }) {
  const { pending } = useFormStatus()
  // `disabled` is merged, never overridden: a pending form must not submit twice.
  return (
    <button type="submit" {...props} disabled={pending || disabled} aria-busy={pending}>
      {pending && pendingText ? pendingText : children}
    </button>
  )
}
