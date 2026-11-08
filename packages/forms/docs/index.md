---
title: Forms
description: Build forms with validation, and show server errors next to the right field.
order: 1
---

# Forms

Sign-up pages, invoice editors and settings screens all need the same three things: check the input before it is sent, stop a second click while it saves, and show the server's "this customer does not exist" under the right field instead of in a generic alert. `@kitr/forms` gives you all three from one schema and one `<Form>` component.

> [!SUMMARY]
> Forms with schema validation and server errors shown on the right field. Add it with `kitr add forms`; the overview is at [/packages/forms](/packages/forms).

It is [React Hook Form](https://react-hook-form.com) re-exported unchanged, plus `useSchemaForm` (with a [Standard Schema](https://standardschema.dev) resolver), a `<Form>` that maps server errors onto fields, and headless, accessible field helpers. It runs in the browser; for the server half of a form see [server actions](/packages/actions) or [API routes](/packages/api).

The examples follow one form through the page: Ada creates invoices for Acme's customers in the app at `app.acme.com`.

## Install

```sh
kitr add forms
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add` does:

- Installs `@kitr/forms`, `react-hook-form`, `@hookform/resolvers` and `zod`.
- Adds `@kitr/forms` to `packages` in `kitrrc.ts`.
- Adds a `## kitr: forms` section to `AGENTS.md` that tells agents to build forms with `useSchemaForm` and `<Form>`, and that a `KitrError` with `fieldErrors` lands on fields while anything else goes to `useRootError()`.

</details>

`kitr add forms` writes no config file and asks no questions. The `app` and `fullstack` kits include it, with the styled `form` component from [Style fields](#style-fields).

<details>
<summary>What kitr remove does</summary>

In a server-only project `kitr add` skips forms with a warning, because it needs React. `kitr remove forms` removes the package from `kitrrc.ts`, uninstalls `@kitr/forms`, `react-hook-form` and `@hookform/resolvers`, and removes the `AGENTS.md` section. It leaves `zod` installed, because your server code usually uses it too.

</details>

## Configure

`@kitr/forms` has no config file. Each form is set up where you write it, with `useSchemaForm` and `<Form>`:

```tsx
// app/components/invoices/new-invoice-form.tsx
import { Form, useSchemaForm } from '@kitr/forms'
import { newInvoiceSchema } from '#app/validators/invoices'

export function NewInvoiceForm({ onCreate }: { onCreate: (values: unknown) => Promise<unknown> }) {
  const form = useSchemaForm(newInvoiceSchema, {
    mode: 'onTouched',
    defaultValues: { customerEmail: '', amount: '', dueOn: '' },
  })
  return (
    <Form form={form} onSubmit={onCreate} resetOnSuccess>
      {/* fields */}
    </Form>
  )
}
```

`useSchemaForm(schema, options)` takes every [`useForm` option](https://react-hook-form.com/docs/useform) except `resolver`. The common ones:

| Option | Default | Description |
| --- | --- | --- |
| `mode` | `'onTouched'` | When a field is validated first: `'onTouched'` waits until it loses focus. React Hook Form's own default is `'onSubmit'`. |
| `reValidateMode` | `'onChange'` | When a field that already failed is checked again. |
| `defaultValues` | `undefined` | The starting values, and what `form.reset()` returns to. Give every field one so inputs stay controlled. |
| `values` | `undefined` | Values that replace the form's values whenever they change, for forms fed by a query. |
| `shouldFocusError` | `true` | Focus the first invalid field on submit. |
| `disabled` | `false` | Disable every registered input. |

`<Form>` takes these props. Any other prop goes on the `<form>` element.

| Option | Default | Description |
| --- | --- | --- |
| `form` | required | The object `useSchemaForm` (or `useForm`) returned. |
| `onSubmit` | required | Runs with the validated, transformed values. Throw or reject to report errors. |
| `onSuccess` | `undefined` | `(result, values) => void`. Runs after `onSubmit` resolves, with what it returned. |
| `onError` | `undefined` | `(error: KitrError) => void`. Runs after a thrown error has been put on the fields. |
| `resetOnSuccess` | `false` | Call `form.reset()` after a successful submit, which returns every field to `defaultValues`. |
| `noValidate` | `true` | Turns off the browser's own validation bubbles so the schema's messages are the only ones. |

## Build your first form

Start with a schema in its own file, so the server can import the same one.

```ts
// app/validators/invoices.ts
import { z } from 'zod'

export const newInvoiceSchema = z.object({
  customerEmail: z.email('Enter the customer’s email'),
  amount: z.coerce.number().positive('Amount must be more than zero'),
  dueOn: z.iso.date('Pick a due date'),
})

export type NewInvoice = z.output<typeof newInvoiceSchema>
```

Then the form. Each field is a `<FormField>` with an input inside it.

```tsx
// app/components/invoices/new-invoice-form.tsx
import { FieldInput, Form, FormField, SubmitButton, useRootError, useSchemaForm } from '@kitr/forms'
import { type NewInvoice, newInvoiceSchema } from '#app/validators/invoices'

export function NewInvoiceForm({ onCreate }: { onCreate: (invoice: NewInvoice) => Promise<unknown> }) {
  const form = useSchemaForm(newInvoiceSchema, {
    defaultValues: { customerEmail: '', amount: '', dueOn: '' },
  })

  return (
    <Form form={form} onSubmit={onCreate} resetOnSuccess aria-label="New invoice">
      <FormField name="customerEmail" label="Customer email">
        <FieldInput type="email" autoComplete="off" />
      </FormField>
      <FormField name="amount" label="Amount (USD)">
        <FieldInput inputMode="decimal" />
      </FormField>
      <FormField name="dueOn" label="Due on" description="Customers see this date on the invoice.">
        <FieldInput type="date" />
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

Render it from a route and give it something to do on submit:

```ts
// app/routes.ts
import { NewInvoiceForm } from '#app/components/invoices/new-invoice-form'

r.page('/invoices/new', {
    <NewInvoiceForm onCreate={async (invoice) => console.log('created', invoice)} />
  ),
  lazy: () => import('./pages/invoices/new'),
})
```

```tsx
// app/pages/invoices/new.tsx
export default () => (
```

Open `/invoices/new`, tab out of the empty email field and "Enter the customer’s email" appears under it. Fill the form with `grace@acme.com`, `120` and a date, press the button, and the console prints:

```js
created { customerEmail: 'grace@acme.com', amount: 120, dueOn: '2026-12-01' }
```

`amount` arrives as the number `120` because `onSubmit` receives the schema's output. While `onCreate` runs, the button reads "Creating…" and is disabled; when it resolves, `resetOnSuccess` clears the form.

## Validate with any schema library

`useSchemaForm` accepts any [Standard Schema](https://standardschema.dev): zod, [valibot](https://valibot.dev) or [arktype](https://arktype.io).

```tsx
// app/components/invoices/new-invoice-form.tsx
import * as v from 'valibot'
import { useSchemaForm } from '@kitr/forms'

const newInvoiceSchema = v.object({
  customerEmail: v.pipe(v.string(), v.email('Enter the customer’s email')),
  amount: v.pipe(v.string(), v.transform(Number), v.minValue(0.01, 'Amount must be more than zero')),
  dueOn: v.pipe(v.string(), v.isoDate('Pick a due date')),
})

export function useNewInvoiceForm() {
  return useSchemaForm(newInvoiceSchema, {
    defaultValues: { customerEmail: '', amount: '', dueOn: '' },
  })
}
```

The schema's input type is what the fields hold (`amount` is a string); its output type is what `onSubmit` receives (`amount` is a number). Both are inferred, so `form.setValue('amount', 120)` is a type error and `values.amount.toFixed(2)` in `onSubmit` is not. Async checks such as `.refine(async ...)` work too.

## Choose when fields are validated

`useSchemaForm` defaults to `mode: 'onTouched'`: a field is checked when it first loses focus, then on every change until it passes.

```tsx
// app/components/invoices/quick-invoice-form.tsx
import { useSchemaForm } from '@kitr/forms'
import { newInvoiceSchema } from '#app/validators/invoices'

export function useQuickInvoiceForm() {
  return useSchemaForm(newInvoiceSchema, {
    mode: 'onSubmit',
    reValidateMode: 'onBlur',
    defaultValues: { customerEmail: '', amount: '', dueOn: '' },
  })
}
```

| `mode` | First check happens |
| --- | --- |
| `'onTouched'` | When the field loses focus (kitr's default). |
| `'onSubmit'` | When the form is submitted (React Hook Form's default). |
| `'onBlur'` | On every blur. |
| `'onChange'` | On every keystroke. Costs a schema run per key. |
| `'all'` | On blur and on change. |

Submitting always validates every field, whatever the mode.

## Submit to your API

`onSubmit` can return any promise. To update the query cache as well, pass a [query](/packages/query) mutation's `mutateAsync`. Here it posts to an external API through [http](/packages/http):

```ts
// app/queries/invoices.ts
import { mutationFrom, queryFrom } from '@kitr/query'
import { httpMutation, httpQuery } from '@kitr/http'
import { app } from '#app/app'
import type { NewInvoice } from './schema'

const http = () => app.container.use('http')

export const invoiceQuery = queryFrom(
  httpQuery<string, NewInvoice & { id: string }>(http, {
    key: (id) => ['invoices', 'detail', id],
    path: (id) => `invoices/${id}`,
  }),
)

export const createInvoice = mutationFrom(
  httpMutation<NewInvoice, { id: string; number: string }>(http, {
    path: 'invoices',
    effects: { invalidate: [['invoices', 'list']] },
  }),
)
```

```ts
// app/routes.ts
r.page('/invoices/new', { lazy: () => import('./pages/invoices/new') })
```

```tsx
// app/pages/invoices/new.tsx
import { useMutation } from '@kitr/query'
import { useNavigate } from '@kitr/router'
import { NewInvoiceForm } from '#app/components/invoices/new-invoice-form'
import { createInvoice } from '#app/queries/invoices'

export default function NewInvoicePage() {
  const create = useMutation(createInvoice)
  const navigate = useNavigate()
  return (
    <NewInvoiceForm
      onCreate={async (invoice) => {
        const created = await create.mutateAsync(invoice)
        await navigate({ to: '/invoices/$id', params: { id: created.id } })
      }}
    />
  )
}
```

> [!WARNING]
> Use `mutateAsync`, not `mutate`. `mutate` swallows the error, so `<Form>` never sees the field errors and the button stops pending early.

## Submit to a server action

In a project with [server actions](/packages/actions), the action validates with the same schema on the server:

```ts
// app/actions/invoices/create_invoice.ts
import { defineMutation } from '@kitr/actions'
import { newInvoiceSchema } from '#app/validators/invoices'

export const createInvoice = defineMutation('invoices.create', {
  input: newInvoiceSchema,
  effects: { invalidate: [['invoices', 'list']] },
  handler: async ({ input }) => {
    // save the invoice
    return { id: 'inv_1042', number: 'ACME-1042', ...input }
  },
})
```

```tsx
// app/pages/invoices/new.tsx
import { useMutation } from '@kitr/query'
import { NewInvoiceForm } from '#app/components/invoices/new-invoice-form'

export default function NewInvoicePage() {
  const create = useMutation('invoices.create')
  return <NewInvoiceForm onCreate={(invoice) => create.mutateAsync(invoice)} />
}
```

`useMutation('invoices.create')` finds the mutation by its `defineMutation` name; `kitr types` types it. If someone bypasses the browser check, the action rejects with `VALIDATION` and the same messages land under the same fields.

## Show server errors on fields

When `onSubmit` throws or rejects, `<Form>` reads the `KitrError`'s `fieldErrors`: each key is a field path, each value a list of messages, and the first shows under the field:

```ts
// what the server sent back (HTTP 422)
{
  code: 'VALIDATION',
  message: 'Validation failed',
  status: 422,
  fieldErrors: {
    customerEmail: ['No customer with this email'],
    'lines.0.quantity': ['Only 3 left in stock'],
    _root: ['Invoices are locked while the month closes'],
  },
}
```

The rules:

- A key whose first segment is a field in the form (`customerEmail`, or `lines` for `lines.0.quantity`) goes on that field.
- `_root`, and any key the form does not have (`plan`, `billing.vatId` when there is no `billing` field), goes to the root error, which `useRootError()` returns.
- An error without `fieldErrors` (a `CONFLICT`, a `NETWORK` failure, a 500) puts its `message` on the root error.
- Only the first message per field is shown.

[API routes](/packages/api) and [server actions](/packages/actions) answer failed validation with `fieldErrors` already, and [http](/packages/http) converts common backend formats.

## Throw field errors from the server

For a rule the schema cannot check, such as "this customer exists", throw `KitrError.validation` with the field it belongs to:

```ts
// app/actions/invoices/create_invoice.ts
import { defineMutation } from '@kitr/actions'
import { KitrError } from 'kitr/app'
import { newInvoiceSchema } from '#app/validators/invoices'

const customers = new Set(['grace@acme.com', 'linus@acme.com'])

export const createInvoice = defineMutation('invoices.create', {
  input: newInvoiceSchema,
  handler: async ({ input }) => {
    if (!customers.has(input.customerEmail)) {
      throw KitrError.validation({ customerEmail: ['No customer with this email'] })
    }
    return { id: 'inv_1042', number: 'ACME-1042', ...input }
  },
})
```

Ada sees "No customer with this email" under the email field. A message for the whole form goes under `_root`:

```ts
throw KitrError.validation({ _root: ['Invoices are locked while the month closes'] })
```

Nested fields use dot paths: `'billing.vatId'` or `'lines.2.quantity'`.

## Show a form-level error

`useRootError()` returns the message of errors that are not about one field, or `undefined`. Call it inside `<Form>`:

```tsx
// app/components/invoices/form-alert.tsx
import { useRootError } from '@kitr/forms'

export function FormAlert() {
  const error = useRootError()
  if (!error) return null
  return (
    <p role="alert" className="rounded-md border border-destructive/40 p-3 text-destructive">
      {error}
    </p>
  )
}
```

The root error clears on each submit. A dropped connection shows "Network request failed"; a 500 in production shows "Internal server error" and keeps the real message in the server log.

## Show a pending state

`<SubmitButton>` is a `type="submit"` button that is disabled and has `aria-busy="true"` while `onSubmit` runs. `pendingText` replaces its label in that time:

```tsx
<SubmitButton pendingText="Creating…" className="btn-primary">
  Create invoice
</SubmitButton>
```

A `disabled` prop you pass is combined with the pending state. For anything else that reacts to the submit, call `useFormStatus()` inside `<Form>`:

```tsx
// app/components/invoices/cancel-link.tsx
import { useFormStatus } from '@kitr/forms'
import { Link } from '@kitr/router'

export function CancelLink() {
  const { pending, isValid } = useFormStatus()
  return (
    <Link to="/invoices" disabled={pending} data-ready={isValid || undefined}>
      Cancel
    </Link>
  )
}
```

`pending` is true while `onSubmit` runs; `isValid` is React Hook Form's `formState.isValid`.

## Run code after a submit

`onSuccess` runs with what `onSubmit` returned and the submitted values. `onError` runs after the error is on the fields, with a `KitrError`. Neither runs when the browser-side schema check fails.

```tsx
// app/components/invoices/new-invoice-panel.tsx
import { toast } from '@kitr/theme'
import { Form, useSchemaForm } from '@kitr/forms'
import { newInvoiceSchema } from '#app/validators/invoices'

export function NewInvoicePanel({ onCreate }: { onCreate: (v: unknown) => Promise<{ number: string }> }) {
  const form = useSchemaForm(newInvoiceSchema, {
    defaultValues: { customerEmail: '', amount: '', dueOn: '' },
  })
  return (
    <Form
      form={form}
      onSubmit={onCreate}
      onSuccess={(invoice) => toast.success(`Invoice ${(invoice as { number: string }).number} created`)}
      onError={(error) => {
        if (error.code !== 'VALIDATION') toast.error(error.message)
      }}
      resetOnSuccess
    >
      {/* fields */}
    </Form>
  )
}
```



## Edit an existing record

Load the record first and render the form only once it is there, passing it as `defaultValues`. Leave `resetOnSuccess` off for edit forms:

```ts
// app/routes.ts
r.page('/invoices/$id/edit', { lazy: () => import('./pages/invoices/edit') })
```

```tsx
// app/pages/invoices/edit.tsx
import { FieldInput, Form, FormField, SubmitButton, useSchemaForm } from '@kitr/forms'
import { useSuspenseQuery } from '@kitr/query'
import { getRouteApi } from '@kitr/router'
import { newInvoiceSchema } from '#app/validators/invoices'
import { invoiceQuery } from '#app/queries/invoices'

const route = getRouteApi('/invoices/$id/edit')

export default function EditInvoicePage() {
  const { id } = route.useParams()
  const { data: invoice } = useSuspenseQuery(invoiceQuery.options(id))
  const form = useSchemaForm(newInvoiceSchema, {
    defaultValues: {
      customerEmail: invoice.customerEmail,
      amount: String(invoice.amount),
      dueOn: invoice.dueOn,
    },
  })
  return (
    <Form form={form} onSubmit={(values) => console.log('save', id, values)}>
      <FormField name="dueOn" label="Due on">
        <FieldInput type="date" />
      </FormField>
      <SubmitButton>Save</SubmitButton>
    </Form>
  )
}
```

To follow data that changes while the form is open, pass `values` instead of `defaultValues`; the form resets each time `values` changes. `form.formState.isDirty` tells you whether Ada changed anything.

## Use your own inputs

`<FieldInput>` is a plain `<input>`. For a `<select>`, a `<textarea>` or a styled input, call `useFieldProps()` inside `<FormField>` and spread the result:

```tsx
// app/components/invoices/currency-select.tsx
import { useFieldProps } from '@kitr/forms'

export function CurrencySelect() {
  const props = useFieldProps()
  // => { id, 'aria-invalid', 'aria-describedby', name, onChange, onBlur, ref }
  return (
    <select {...props}>
      <option value="USD">US dollar</option>
      <option value="EUR">Euro</option>
    </select>
  )
}
```

```tsx
<FormField name="currency" label="Currency">
  <CurrencySelect />
</FormField>
```

`useFieldProps()` returns the field's `id`, `aria-invalid` and `aria-describedby`, plus everything `form.register(name)` returns. A checkbox works the same way and arrives as a boolean:

```tsx
<FormField name="sendNow" label="Email the invoice to the customer now">
  <FieldInput type="checkbox" />
</FormField>
```

## Lay out a field yourself

`<FormField>` renders the label, children, description, then error. To place things differently, pass a function as its child; it receives `{ id, name, invalid, describedBy }`. Call `form.register` there rather than `useFieldProps()`:

```tsx
// app/components/invoices/note-field.tsx
import { FormField, useFormContext } from '@kitr/forms'

export function NoteField() {
  const form = useFormContext<{ note: string }>()
  return (
    <FormField name="note" label="Note to the customer" description="Up to 500 characters.">
      {({ id, invalid, describedBy }) => (
        <textarea
          id={id}
          rows={4}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy || undefined}
          {...form.register('note')}
        />
      )}
    </FormField>
  )
}
```



## Wrap a controlled component

Date pickers, comboboxes and rich-text editors often take `value` and `onChange` but no `ref`. Use React Hook Form's `Controller`, exported from `@kitr/forms`:

```tsx
// app/components/invoices/due-date-field.tsx
import { Controller, FormField, useFormContext } from '@kitr/forms'
import { DatePicker } from '#components/date-picker'

export function DueDateField() {
  const form = useFormContext<{ dueOn: string }>()
  return (
    <FormField name="dueOn" label="Due on">
      {({ id, describedBy }) => (
        <Controller
          control={form.control}
          name="dueOn"
          render={({ field }) => (
            <DatePicker id={id} aria-describedby={describedBy} value={field.value} onChange={field.onChange} />
          )}
        />
      )}
    </FormField>
  )
}
```

Field and server errors still appear, because they are keyed by name.

## Repeat fields

Invoice lines are a list. `useFieldArray` adds and removes rows; each row's fields use an index path:

```tsx
// app/components/invoices/invoice-lines.tsx
import { FieldInput, FormField, useFieldArray, useFormContext } from '@kitr/forms'

type Lines = { lines: { description: string; quantity: string }[] }

export function InvoiceLines() {
  const form = useFormContext<Lines>()
  const lines = useFieldArray({ control: form.control, name: 'lines' })
  return (
    <fieldset>
      <legend>Lines</legend>
      {lines.fields.map((line, index) => (
        <div key={line.id}>
          <FormField name={`lines.${index}.description`} label="Description">
            <FieldInput />
          </FormField>
          <FormField name={`lines.${index}.quantity`} label="Quantity">
            <FieldInput inputMode="numeric" />
          </FormField>
          <button type="button" onClick={() => lines.remove(index)}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={() => lines.append({ description: '', quantity: '1' })}>
        Add line
      </button>
    </fieldset>
  )
}
```

Use `line.id` as the key, not `index`. A server error for `lines.1.quantity` lands under the second row's input.

## Watch a field

To show or hide part of the form based on a value, read it with `form.watch`:

```tsx
// app/components/invoices/delivery-fields.tsx
import { FieldInput, FormField, useFormContext } from '@kitr/forms'

export function DeliveryFields() {
  const form = useFormContext<{ sendNow: boolean; ccEmail: string }>()
  const sendNow = form.watch('sendNow')
  if (!sendNow) return null
  return (
    <FormField name="ccEmail" label="Copy to" description="Grace in finance gets a copy.">
      <FieldInput type="email" />
    </FormField>
  )
}
```

The component re-renders when `sendNow` changes. Make a hidden field optional in the schema, or use a zod `discriminatedUnion`.

## Submit without the Form component

When a submit does not go through `<Form>`, such as a "Mark as paid" button, call `applyServerErrors` yourself. It puts the error on the form as `<Form>` does and returns `true` for a `VALIDATION` error:

```tsx
// app/components/invoices/mark-paid.tsx
import { applyServerErrors, useForm } from '@kitr/forms'

export function MarkPaid({ save }: { save: (paidOn: string) => Promise<void> }) {
  const form = useForm({ defaultValues: { paidOn: '' } })
  const onClick = async () => {
    try {
      await save(form.getValues('paidOn'))
    } catch (error) {
      const isValidation = applyServerErrors(form, error)
      // => true for KitrError.validation(...), false for anything else
      if (!isValidation) console.error(error)
    }
  }
  return (
    <>
      <input type="date" {...form.register('paidOn')} />
      <button type="button" onClick={onClick}>Mark as paid</button>
      <p role="alert">{form.formState.errors.paidOn?.message}</p>
    </>
  )
}
```

It accepts a `KitrError`, the JSON shape a server sent, or any thrown value; anything that is not a field error ends up on `root.server`.

## Style fields

The components are headless. `<FormField>` marks its parts with `data-kitr` attributes so you can style them from CSS or with [Tailwind](/packages/tailwind) arbitrary variants:

| Attribute | Element |
| --- | --- |
| `data-kitr="field"` | The wrapper `<div>`. Has `data-invalid` when the field has an error. |
| `data-kitr="label"` | The `<label>`. |
| `data-kitr="description"` | The description `<p>`. |
| `data-kitr="field-error"` | The error `<p>`, which also has `role="alert"`. |

```tsx
<FormField
  name="amount"
  label="Amount (USD)"
  className="grid gap-1.5 [&_[data-kitr=field-error]]:text-sm [&_[data-kitr=field-error]]:text-destructive"
>
  <FieldInput />
</FormField>
```

For a finished look, copy the styled components into your app:

```sh
kitr ui add form
```

This writes `app/components/ui/form.tsx` (plus `button`, `input` and `label` if missing), exporting `Form`, `FormField`, `FieldInput`, `FormMessage` (the root error) and `SubmitButton`. Import from `#components/ui/form` instead of `@kitr/forms`; the file is yours to edit.

## Make forms accessible

`<FormField>` and `useFieldProps()` produce this markup for a field with a description and a failed check:

```html
<div data-kitr="field" data-invalid="">
  <label for="_r_2_" data-kitr="label">Due on</label>
  <input id="_r_2_" aria-describedby="_r_2_-description _r_2_-error" type="date" name="dueOn" aria-invalid="true">
  <p id="_r_2_-description" data-kitr="description">Customers see this date on the invoice.</p>
  <p id="_r_2_-error" role="alert" data-kitr="field-error">Pick a due date</p>
</div>
```

- Clicking the label focuses the input, because the ids match.
- A screen reader reads the description and the error with the input, through `aria-describedby`.
- The error is announced when it appears, through `role="alert"`.
- `<Form>` sets `noValidate` on the `<form>`, so the browser's own bubbles never compete with these messages.

Give the `<form>` an accessible name (`aria-label="New invoice"`) when the page has more than one.

## Commands

| Command | What it does |
| --- | --- |
| `kitr make:form <name>` | Writes `app/components/forms/<name>_form.tsx`: a zod schema, its type and a form component using the styled `#components/ui/form`. |
| `kitr ui add form` | Copies the styled form components into `app/components/ui/form.tsx`. |
| `kitr eject stub form` | Copies the `make:form` template to `stubs/form.ts` so you can change what it generates. |

```sh
kitr make:form invoice
```

writes:

```tsx
// app/components/forms/invoice-form.tsx
import { useSchemaForm } from '@kitr/forms'
import { z } from 'zod'
import { FieldInput, Form, FormField, FormMessage, SubmitButton } from '#components/ui/form'

export const invoiceSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
})
export type InvoiceValues = z.infer<typeof invoiceSchema>

export function InvoiceForm({ defaultValues, onSubmit }: { defaultValues?: Partial<InvoiceValues>; onSubmit: (values: InvoiceValues) => Promise<unknown> }) {
  const form = useSchemaForm(invoiceSchema, { defaultValues: { name: '', ...defaultValues } })
  return (
    <Form form={form} onSubmit={onSubmit} className="grid gap-4">
      <FormMessage />
      <FormField name="name" label="Name">
        <FieldInput autoComplete="off" />
      </FormField>
      <SubmitButton>Save</SubmitButton>
    </Form>
  )
}
```

> [!WARNING]
> The generated file needs `kitr ui add form` first (the `app` and `fullstack` kits ran it). Import from `@kitr/forms`, not `react-hook-form`; `kitr doctor` warns otherwise.

## Errors

These are the `KitrError` codes a form shows and where each appears.

| Code | When | What to do |
| --- | --- | --- |
| `VALIDATION` | The server rejected the input (HTTP 422). Messages land on fields; unknown fields and `_root` go to `useRootError()`. | Nothing; the user fixes the fields. Make sure the server's field names match the form's. |
| `UNAUTHORIZED` | The session expired mid-form (401). The message goes to `useRootError()`. | Send the user to sign in from `onError`. |
| `CONFLICT` | Another user changed the record (409). | Reload the record and ask the user to try again. |
| `NETWORK` | The request never reached the server. Root error: "Network request failed". | Keep the values; let the user resubmit. |
| `INTERNAL` | The server crashed (500). In production the root error is "Internal server error". | Read the server log. |
| none | `useFieldProps()` was called outside `<FormField>`: `[@kitr/forms] useFieldProps() must be used inside <FormField>.` | Move the input inside a `<FormField>`, or use the render-function child. |

## Testing

Forms run in a DOM test without an app, router or server. Render, type, submit; to test server errors, make the submit function reject with the error the server would send.

```tsx
// app/components/invoices/new-invoice-form.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { KitrError } from 'kitr/app'
import { describe, expect, it, vi } from 'vitest'
import { NewInvoiceForm } from './new-invoice-form'

function fill(email: string, amount: string, dueOn: string) {
  fireEvent.change(screen.getByLabelText('Customer email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Amount (USD)'), { target: { value: amount } })
  fireEvent.change(screen.getByLabelText('Due on'), { target: { value: dueOn } })
  fireEvent.submit(screen.getByRole('form', { name: 'New invoice' }))
}

describe('NewInvoiceForm', () => {
  it('shows schema errors without calling the server', async () => {
    const onCreate = vi.fn()
    render(<NewInvoiceForm onCreate={onCreate} />)
    fill('grace', '0', '')
    expect(await screen.findByText('Enter the customer’s email')).toBeTruthy()
    expect(screen.getByText('Amount must be more than zero')).toBeTruthy()
    expect(screen.getByLabelText('Customer email').getAttribute('aria-invalid')).toBe('true')
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('submits typed values and resets', async () => {
    const onCreate = vi.fn().mockResolvedValue({ id: 'inv_1042' })
    render(<NewInvoiceForm onCreate={onCreate} />)
    fill('grace@acme.com', '120', '2026-12-01')
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith({
        customerEmail: 'grace@acme.com',
        amount: 120,
        dueOn: '2026-12-01',
      }),
    )
    await waitFor(() =>
      expect((screen.getByLabelText('Customer email') as HTMLInputElement).value).toBe(''),
    )
  })

  it('puts server errors under the right field and the rest at the top', async () => {
    const onCreate = vi
      .fn()
      .mockRejectedValueOnce(KitrError.validation({ customerEmail: ['No customer with this email'] }))
      .mockRejectedValueOnce(new KitrError('CONFLICT', 'Invoice ACME-1042 already exists'))
    render(<NewInvoiceForm onCreate={onCreate} />)
    fill('linus@acme.com', '80', '2026-12-01')
    expect(await screen.findByText('No customer with this email')).toBeTruthy()
    fireEvent.submit(screen.getByRole('form', { name: 'New invoice' }))
    expect(await screen.findByText('Invoice ACME-1042 already exists')).toBeTruthy()
  })
})
```

A form that calls `useMutation` needs the query client: render it with `renderWithKitr` from [testing](/packages/testing).

## Next steps

- [API reference](/packages/forms/api): every export with its signature.
- [Server actions](/packages/actions): the server half of a form, with the same error shape.
- [Query](/packages/query): mutations, cache effects and `mutateAsync`.
