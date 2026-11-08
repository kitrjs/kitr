---
title: Overview
description: Build forms with validation, and show server errors next to the right field.
order: 0
---

# Forms

Sign-up pages, invoice editors and settings screens all need the same three things: check the input before it is sent, stop a second click while it saves, and show the server's "this customer does not exist" under the right field instead of in a generic alert. Most form code does the first, forgets the second and never manages the third.

`@kitr/forms` gives you all three from one schema and one `<Form>` component.

## What it is

`@kitr/forms` is React Hook Form plus the pieces kitr needs to connect it to the rest of the app. `useSchemaForm` builds a form from a schema, so the TypeScript type and the validation rules are the same thing. `<Form>` submits to a [server action](/packages/actions) or [API route](/packages/api), shows a pending state and maps the field errors the server sends onto the fields that caused them. `FormField` and `useFieldProps` give you labels, descriptions and error messages with the right accessibility attributes and no styling, and `SubmitButton` follows the pending state.

It runs in the browser. For the server half of a form, see [actions](/packages/actions) or [API routes](/packages/api).

## Built on

`@kitr/forms` is [React Hook Form](https://react-hook-form.com) re-exported unchanged. `useForm`, `Controller`, `useFieldArray`, `watch` and everything in its docs work as written, imported from `@kitr/forms`. React Hook Form's own `<Form>` is exported as `RhfForm`.

| What kitr adds | Why |
| --- | --- |
| `useSchemaForm` | React Hook Form with a [Standard Schema](https://standardschema.dev) resolver, so zod, valibot or arktype schemas type the form. |
| `<Form>` | Submits a mutation, shows a pending state, and maps `KitrError.fieldErrors` onto fields. |
| `FormField`, `useFieldProps`, `SubmitButton` | Headless field wiring with `aria-*` attributes and `data-kitr` attributes for styling, and a button that follows the pending state. |
| `kitr make:form` | A generator for a form file with its schema. |

## Problems it solves

- **Validation rules and types written twice.** One schema types the form and validates it. See [Build your first form](/packages/forms/guide#build-your-first-form).
- **Server errors in a generic alert.** Field errors from the server land under the fields that caused them, in the same shape from actions, API routes and HTTP. See [Show server errors on fields](/packages/forms/guide#show-server-errors-on-fields).
- **Double submits.** The form is disabled and the button shows a pending state while the mutation runs. See [Show a pending state](/packages/forms/guide#show-a-pending-state).
- **Editing an existing record.** Default values come from a query and the form resets when they arrive. See [Edit an existing record](/packages/forms/guide#edit-an-existing-record).
- **Inputs the library does not know about.** Wrap a date picker or a select with `Controller`. See [Wrap a controlled component](/packages/forms/guide#wrap-a-controlled-component).
- **Inaccessible forms.** Labels, descriptions and errors are linked to their inputs for screen readers. See [Make forms accessible](/packages/forms/guide#make-forms-accessible).

## Further reading

- [Guide](/packages/forms/guide): install, configure and every task.
- [API reference](/packages/forms/api): every export with its signature.
- [React Hook Form docs](https://react-hook-form.com/docs): everything there works as written.
- [Standard Schema](https://standardschema.dev): the schema libraries `useSchemaForm` accepts.
- [Actions](/packages/actions) and [Query](/packages/query): the server half and the mutations a form submits.
- [Tailwind](/packages/tailwind): style fields with the `data-kitr` attributes.
