import { FieldInput, Form, FormField, SubmitButton, useRootError, useSchemaForm } from '@kitr/forms'
import { useState } from 'react'
import { z } from 'zod'

export const meta = {
  title: 'A form checked by its schema',
  description:
    'Tab out of an empty field to see its message. Submit and the handler receives the parsed values: the amount is a number, not the input string.',
  storage: false,
}

const newInvoiceSchema = z.object({
  customerEmail: z.email('Enter the customer’s email'),
  amount: z.coerce.number().positive('Amount must be more than zero'),
})

type NewInvoice = z.output<typeof newInvoiceSchema>

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default function NewInvoice() {
  const [created, setCreated] = useState<NewInvoice[]>([])
  const form = useSchemaForm(newInvoiceSchema, {
    defaultValues: { customerEmail: '', amount: '' },
  })

  return (
    <div className="demo">
      <Form
        form={form}
        onSubmit={async (invoice) => {
          await wait(600)
          setCreated((all) => [invoice, ...all])
        }}
        resetOnSuccess
        aria-label="New invoice"
        className="demo-form"
      >
        <FormField name="customerEmail" label="Customer email">
          <FieldInput type="email" placeholder="grace@acme.com" />
        </FormField>
        <FormField name="amount" label="Amount (USD)">
          <FieldInput inputMode="decimal" placeholder="120" />
        </FormField>
        <RootError />
        <SubmitButton className="demo-button primary" pendingText="Creating…">
          Create invoice
        </SubmitButton>
      </Form>
      <ul className="demo-list">
        {created.map((invoice, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the same invoice can be created twice
          <li key={i}>
            <span>{invoice.customerEmail}</span>
            <span className="mono">
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
  return error ? <p role="alert">{error}</p> : null
}
