---
title: Overview
description: Build forms with validation, and show server errors next to the right field.
order: 0
---

# Forms

## What it is

`@kitr/forms` is React Hook Form plus the kitr pieces. `useSchemaForm` builds a form from a schema, so the type and the rules are one thing. `<Form>` submits to an action or API route, shows a pending state and puts server errors on the right fields.

Runs in the browser. The server half is [actions](/packages/actions) or [API routes](/packages/api).

## Install

```sh
kitr add forms
```

Adds `@kitr/forms` with react-hook-form, its resolvers and zod. No provider, no config file. [Every change](/packages/forms/guide#install).

## Quick start

Start with a schema, then build the form from it. Each field is a `<FormField>` with an input inside:

```tsx
// app/features/invoices/new-invoice-form.tsx
import { FieldInput, Form, FormField, SubmitButton, useRootError, useSchemaForm } from '@kitr/forms'
import { z } from 'zod'

const newInvoiceSchema = z.object({
  customerEmail: z.email('Enter the customer’s email'),
  amount: z.coerce.number().positive('Amount must be more than zero'),
})
type NewInvoice = z.output<typeof newInvoiceSchema>

export function NewInvoiceForm({ onCreate }: { onCreate: (invoice: NewInvoice) => Promise<unknown> }) {
  const form = useSchemaForm(newInvoiceSchema, { defaultValues: { customerEmail: '', amount: '' } })
  return (
    <Form form={form} onSubmit={onCreate} resetOnSuccess aria-label="New invoice">
      <FormField name="customerEmail" label="Customer email">
        <FieldInput type="email" />
      </FormField>
      <FormField name="amount" label="Amount (USD)">
        <FieldInput inputMode="decimal" />
      </FormField>
      <RootError />
      <SubmitButton pendingText="Creating…">Create invoice</SubmitButton>
    </Form>
  )
}

function RootError() {
  const error = useRootError()
  return error ? <p role="alert">{error}</p> : null
}
```

Render `<NewInvoiceForm onCreate={async (invoice) => console.log('created', invoice)} />` on a page. Tab out of the empty email field and "Enter the customer’s email" appears under it. Fill in `grace@acme.com` and `120`, press the button, and the console prints:

```js
created { customerEmail: 'grace@acme.com', amount: 120 }
```

`amount` arrives as the number `120`, because `onSubmit` receives the schema's output. While `onCreate` runs the button reads "Creating…". Next in the guide: [Build your first form](/packages/forms/guide#build-your-first-form).

## Built on

| What kitr adds | Why |
| --- | --- |
| `useSchemaForm` | React Hook Form with a [Standard Schema](https://standardschema.dev) resolver, so zod, valibot or arktype schemas type the form. |
| `<Form>` | Submits a mutation, shows a pending state, and maps `KitrError.fieldErrors` onto fields. |
| `FormField`, `useFieldProps`, `SubmitButton` | Headless field wiring with `aria-*` attributes and `data-kitr` attributes for styling, and a button that follows the pending state. |
| `kitr make:form` | A generator for a form file with its schema. |

kitr adds `useSchemaForm`, `<Form>`, the field components with accessibility attributes and the server error mapping.

## Problems it solves

- **Validation rules and types written twice.** [Build your first form](/packages/forms/guide#build-your-first-form).
- **Server errors in a generic alert.** [Show server errors on fields](/packages/forms/guide#show-server-errors-on-fields).
- **Double submits.** [Show a pending state](/packages/forms/guide#show-a-pending-state).
- **Editing an existing record.** [Edit an existing record](/packages/forms/guide#edit-an-existing-record).
- **Inputs the library does not know about.** [Wrap a controlled component](/packages/forms/guide#wrap-a-controlled-component).
- **Inaccessible forms.** [Make forms accessible](/packages/forms/guide#make-forms-accessible).

## Further reading

- [Guide](/packages/forms/guide).
- [API reference](/packages/forms/api).
- [React Hook Form docs](https://react-hook-form.com/docs).
- [Standard Schema](https://standardschema.dev).
- [Actions](/packages/actions) and [Query](/packages/query).
- [Tailwind](/packages/tailwind).
