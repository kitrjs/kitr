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

export default function InvoiceToast() {
  const [invoices, setInvoices] = useState<string[]>([])
  const close = (invoice: string) => setInvoices((all) => all.filter((i) => i !== invoice))
  return (
    <div className="demo">
      <div className="demo-row">
        <button
          type="button"
          className="demo-button primary"
          // Newest first; the oldest leaves once there are three.
          onClick={() => setInvoices((all) => [`INV-${counter++}`, ...all].slice(0, 3))}
        >
          Send an invoice
        </button>
        <button
          type="button"
          className="demo-button"
          onClick={() => setInvoices([])}
          disabled={!invoices.length}
        >
          Close them all
        </button>
      </div>
      <p className="demo-muted">
        <code>presets.fadeUp</code> is plain data: initial, animate, exit and transition.{' '}
        <code>layout</code> slides the rest of the stack.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 56 }}>
        {/* popLayout lifts a leaving toast out of the flow, so the others move while it fades. */}
        <AnimatePresence mode="popLayout" initial={false}>
          {invoices.map((invoice) => (
            <motion.div
              key={invoice}
              layout
              role="status"
              className="demo-toast"
              {...presets.fadeUp}
            >
              Invoice {invoice} sent to grace@acme.com
              <button type="button" className="demo-link" onClick={() => close(invoice)}>
                Close
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
