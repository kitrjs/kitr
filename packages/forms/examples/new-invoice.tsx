import { FieldInput, Form, FormField, SubmitButton, useRootError, useSchemaForm } from '@kitr/forms'
import { useState } from 'react'
import { type NewInvoiceValues, newInvoiceSchema } from './new-invoice/app/validators/new-invoice'

export const meta = {
  title: 'A form checked by its schema',
  description:
    'Leave a field empty to see its error. Submit to get typed values, with the amount as a number.',
  storage: false,
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Tailwind utilities on the kitr tokens, so the example looks the same in any kitr app.
const primary =
  'min-h-[38px] cursor-pointer rounded-lg border px-3.5 font-semibold disabled:cursor-default disabled:opacity-50 border-primary bg-primary text-primary-foreground'
const input =
  'min-h-[38px] rounded-lg border border-border bg-background px-2.5 text-foreground aria-invalid:border-destructive'
const list =
  'm-0 list-none rounded-[10px] border border-border p-0 empty:hidden [&>li]:flex [&>li]:justify-between [&>li]:border-b [&>li]:border-border [&>li]:px-3 [&>li]:py-2 [&>li:last-child]:border-b-0'

export default function NewInvoice() {
  const [created, setCreated] = useState<NewInvoiceValues[]>([])
  const form = useSchemaForm(newInvoiceSchema, {
    defaultValues: { customerEmail: '', amount: '' },
  })

  return (
    <div className="flex flex-col gap-3 text-[15px]">
      <Form
        form={form}
        onSubmit={async (invoice) => {
          await wait(600)
          setCreated((all) => [invoice, ...all])
        }}
        resetOnSuccess
        aria-label="New invoice"
        className="flex max-w-[360px] flex-col gap-3 [&_[data-kitr=label]]:text-[14px] [&_[data-kitr=label]]:font-semibold"
      >
        <FormField name="customerEmail" label="Customer email">
          <FieldInput className={input} type="email" placeholder="grace@acme.com" />
        </FormField>
        <FormField name="amount" label="Amount (USD)">
          <FieldInput className={input} inputMode="decimal" placeholder="120" />
        </FormField>
        <RootError />
        <SubmitButton className={`${primary} self-start`} pendingText="Creating…">
          Create invoice
        </SubmitButton>
      </Form>
      <ul className={list}>
        {created.map((invoice, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the same invoice can be created twice
          <li key={i}>
            <span>{invoice.customerEmail}</span>
            <span className="font-mono">
              ${invoice.amount} ({typeof invoice.amount})
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RootError() {
  const error = useRootError()
  return error ? (
    <p role="alert" className="m-0 text-[14px] text-destructive">
      {error}
    </p>
  ) : null
}
