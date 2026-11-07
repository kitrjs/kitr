import {
  type FormFieldProps,
  FormField as KitrFormField,
  useFieldProps,
  useFormStatus,
  useRootError,
} from 'kitr/forms'
import { cn } from 'kitr/tailwind'
import type { ComponentProps, ReactNode } from 'react'
import type { FieldValues } from 'kitr/forms'
import { Button, type ButtonProps } from '#components/ui/button'
import { Input } from '#components/ui/input'

export { Form } from 'kitr/forms'

/** A labelled field with spacing; renders the error below the control. */
export function FormField<T extends FieldValues>({ className, ...props }: FormFieldProps<T>) {
  return (
    <KitrFormField
      className={cn(
        'grid gap-1.5 [&_[data-kitr=label]]:text-sm [&_[data-kitr=label]]:font-medium [&_[data-kitr=field-error]]:text-sm [&_[data-kitr=field-error]]:text-destructive [&_[data-kitr=description]]:text-sm [&_[data-kitr=description]]:text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

/** An <Input> registered to the surrounding <FormField>. */
export function FieldInput(props: Omit<ComponentProps<typeof Input>, 'name' | 'id'>) {
  const field = useFieldProps()
  return <Input {...props} {...field} />
}

/** Shows the form-level server error, if any. */
export function FormMessage({ className }: { className?: string }) {
  const error = useRootError()
  if (!error) return null
  return (
    <p
      role="alert"
      className={cn(
        'rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive',
        className,
      )}
    >
      {error}
    </p>
  )
}

export function SubmitButton({
  children,
  pendingText = 'Saving…',
  ...props
}: ButtonProps & { pendingText?: ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  )
}
