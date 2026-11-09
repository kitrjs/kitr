import { z } from 'zod'

/** What the new invoice form accepts. The amount arrives as text and leaves as a number. */
export const newInvoiceSchema = z.object({
  customerEmail: z.email('Enter the customer’s email'),
  amount: z.coerce.number().positive('Amount must be more than zero'),
})

export type NewInvoiceValues = z.output<typeof newInvoiceSchema>
