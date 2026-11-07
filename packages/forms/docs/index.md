---
title: Forms
description: Build forms with validation, and show server errors next to the right field.
order: 1
---

# Forms

Forms are where most apps get fiddly: checking input before it's sent, disabling the button while saving, and showing the server's "this email is already taken" under the email field instead of in a generic alert. `kitr/forms` handles all three with one schema and one component.

It is [React Hook Form](https://react-hook-form.com), re-exported, plus `useSchemaForm`, a `<Form>` component and a few accessible field helpers.

## Install

```sh
kitr add forms
```

This installs `@kitr/forms`, `react-hook-form`, `@hookform/resolvers` and `zod`. There is no config file. `kitr ui add form` also copies a styled version of the field components into `app/components/ui/form.tsx`.

## A complete form

```tsx
// app/features/projects/new-project-form.tsx
import { z } from 'zod'
import { FieldInput, Form, FormField, SubmitButton, useRootError, useSchemaForm } from 'kitr/forms'
import { useKitrMutation } from 'kitr/query'
import { createProject } from './queries'

const schema = z.object({
  name: z.string().min(2, 'Give it at least two characters'),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and dashes'),
})

export function NewProjectForm() {
  const form = useSchemaForm(schema, { defaultValues: { name: '', slug: '' } })
  const create = useKitrMutation(createProject)

  return (
    <Form form={form} onSubmit={(values) => create.mutateAsync(values)} resetOnSuccess>
      <FormField name="name" label="Name">
        <FieldInput />
      </FormField>
      <FormField name="slug" label="URL" description="Used in links to this project.">
        <FieldInput autoComplete="off" />
      </FormField>
      <RootError />
      <SubmitButton pendingText="Saving…">Create project</SubmitButton>
    </Form>
  )
}

function RootError() {
  const error = useRootError()
  return error ? <p role="alert">{error}</p> : null
}
```

`kitr make:form new-project` writes a starting point like this.

What you get:

- **Validation before sending.** The schema runs when a field loses focus and again on submit. Messages appear under the field.
- **A pending state.** `<SubmitButton>` is disabled and shows `pendingText` while `onSubmit` runs.
- **Server errors on the right field.** If `onSubmit` throws a `KitrError` with `fieldErrors`, each message lands on its field. Anything else shows in `useRootError()`.
- **Accessible markup.** Each field gets an id, a `<label for>`, `aria-describedby` for its description and error, and `aria-invalid` when it fails.

## Any schema library

`useSchemaForm` accepts any [Standard Schema](https://standardschema.dev): zod, valibot or arktype. The schema's output type becomes the type of `values` in `onSubmit`, so a `z.coerce.number()` field arrives as a number.

## Server errors

The server side doesn't need to know about forms. Any kitr source already returns errors in the right shape:

- [API routes](/packages/api) validate the body and respond `422` with `fieldErrors`.
- [Server actions](/packages/actions) do the same when their schema fails.
- [HTTP](/packages/http) maps common backend formats, including the Adonis and VineJS `errors` array.

You can also throw one yourself:

```ts
throw KitrError.validation({ email: ['Already taken'] })
```

Nested fields use dot paths (`address.city`). A field name the form doesn't have, or `_root`, goes to the root error.

## Custom inputs

`<FieldInput>` is a plain `<input>`. For anything else, spread `useFieldProps()` onto your own element inside `<FormField>`:

```tsx
function RoleSelect() {
  const props = useFieldProps()
  return (
    <select {...props}>
      <option value="member">Member</option>
      <option value="admin">Admin</option>
    </select>
  )
}
```

For components that don't take a ref, such as a date picker, use React Hook Form's `Controller` as usual. It's exported from `kitr/forms`.

## Next steps

- [API reference](/packages/forms/api)
- [React Hook Form docs](https://react-hook-form.com/docs): everything there works as written, imported from `kitr/forms`. Its own `<Form>` is exported as `RhfForm`.
