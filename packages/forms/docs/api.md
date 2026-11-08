---
title: API
description: Every export of @kitr/forms.
order: 2
---

# API

`@kitr/forms` re-exports everything from `react-hook-form` (its `Form` as `RhfForm`) and adds the following.

## useSchemaForm

```ts
function useSchemaForm<TIn, TOut = TIn>(
  schema: StandardSchemaV1<TIn, TOut>,
  options?: Omit<UseFormProps<TIn, unknown, TOut>, 'resolver'>,
): UseFormReturn<TIn, unknown, TOut>
```

`useForm` with a Standard Schema resolver and `mode: 'onTouched'`. Every React Hook Form option is accepted. `useZodForm` is an alias.

## Form

```tsx
<Form form={form} onSubmit={fn} onSuccess? onError? resetOnSuccess? {...formAttributes}>
```

| Prop | Type | Description |
| --- | --- | --- |
| `form` | `UseFormReturn` | From `useSchemaForm` or `useForm`. |
| `onSubmit` | `(values: TOut) => unknown` | Runs with validated values. Throw or reject to report errors. |
| `onSuccess` | `(result, values) => void` | Runs after `onSubmit` resolves. |
| `onError` | `(error: KitrError) => void` | Runs after errors are applied to fields. |
| `resetOnSuccess` | `boolean` | Reset to default values after success. |

Any other prop goes to the `<form>` element, which always has `noValidate`.

## FormField

```tsx
<FormField name="email" label="Email" description="We never share it." className="...">
  {children | ({ id, name, invalid, describedBy }) => ReactNode}
</FormField>
```

Renders a wrapper with `data-kitr="field"` (and `data-invalid` when it has an error), a `<label>`, the description and the error message with `role="alert"`. It is headless: style it with your own classes or the `data-kitr` attributes.

## useFieldProps and FieldInput

```ts
useFieldProps(): { id, 'aria-invalid', 'aria-describedby', name, onChange, onBlur, ref }
```

Props for the input inside the nearest `<FormField>`, including `form.register(name)`. `<FieldInput {...inputProps} />` is an `<input>` with these applied.

## SubmitButton

```tsx
<SubmitButton pendingText="Saving…">Save</SubmitButton>
```

A `type="submit"` button, disabled with `aria-busy` while the form submits.

## useFormStatus and useRootError

```ts
useFormStatus(): { pending: boolean; isValid: boolean }
useRootError(): string | undefined
```

## applyServerErrors

```ts
function applyServerErrors(form: UseFormReturn, error: unknown): boolean
```

Maps a `KitrError`'s `fieldErrors` onto fields and everything else to `root.server`. `<Form>` calls it for you; use it when submitting another way. Returns `true` for validation errors.
