import { AnimatePresence, motion, presets } from '@kitr/animation'
import { useState } from 'react'

export const meta = {
  title: 'Toasts that rise in, stack and fall away',
  description:
    'Send a few invoices and each toast slides in above the last. Close one and Motion plays its exit while the others slide into place.',
  storage: false,
  height: 340,
}

let counter = 1042

// Tailwind utilities on the kitr tokens, so the example looks the same in any kitr app.
const button =
  'min-h-[38px] cursor-pointer rounded-lg border px-3.5 font-semibold disabled:cursor-default disabled:opacity-50 border-border bg-background text-foreground'
const primary =
  'min-h-[38px] cursor-pointer rounded-lg border px-3.5 font-semibold disabled:cursor-default disabled:opacity-50 border-primary bg-primary text-primary-foreground'
const link = 'cursor-pointer border-0 bg-transparent p-0 text-primary'

export default function InvoiceToast() {
  const [invoices, setInvoices] = useState<string[]>([])
  const close = (invoice: string) => setInvoices((all) => all.filter((i) => i !== invoice))
  return (
    <div className="flex flex-col gap-3 text-[15px]">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={primary}
          // Newest first; the oldest leaves once there are three.
          onClick={() => setInvoices((all) => [`INV-${counter++}`, ...all].slice(0, 3))}
        >
          Send an invoice
        </button>
        <button
          type="button"
          className={button}
          onClick={() => setInvoices([])}
          disabled={!invoices.length}
        >
          Close them all
        </button>
      </div>
      <p className="m-0 text-muted-foreground">
        <code>presets.fadeUp</code> is plain data: initial, animate, exit and transition.{' '}
        <code>layout</code> slides the rest of the stack.
      </p>
      <div className="flex min-h-14 flex-col gap-2">
        {/* popLayout lifts a leaving toast out of the flow, so the others move while it fades. */}
        <AnimatePresence mode="popLayout" initial={false}>
          {invoices.map((invoice) => (
            <motion.div
              key={invoice}
              layout
              role="status"
              className="flex items-center justify-between gap-3 rounded-[10px] border border-border bg-muted px-3.5 py-2.5 shadow-md"
              {...presets.fadeUp}
            >
              Invoice {invoice} sent to grace@acme.com
              <button type="button" className={link} onClick={() => close(invoice)}>
                Close
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
