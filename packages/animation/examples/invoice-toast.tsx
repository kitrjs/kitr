import { AnimatePresence, motion, presets } from '@kitr/animation'
import { useState } from 'react'

export const meta = {
  title: 'A toast that rises in and falls away',
  description: 'Send an invoice and a toast slides in. Close it and Motion plays the exit first.',
  storage: false,
}

let counter = 1042

export default function InvoiceToast() {
  const [invoice, setInvoice] = useState<string | null>(null)
  return (
    <div className="demo">
      <div className="demo-row">
        <button
          type="button"
          className="demo-button primary"
          onClick={() => setInvoice(`INV-${counter++}`)}
        >
          Send an invoice
        </button>
        <button
          type="button"
          className="demo-button"
          onClick={() => setInvoice(null)}
          disabled={!invoice}
        >
          Close the toast
        </button>
      </div>
      <p className="demo-muted">
        <code>presets.fadeUp</code> is plain data: initial, animate, exit and transition.
      </p>
      <div style={{ minHeight: 56 }}>
        <AnimatePresence>
          {invoice && (
            <motion.div key={invoice} role="status" className="demo-toast" {...presets.fadeUp}>
              Invoice {invoice} sent to grace@acme.com
              <button type="button" className="demo-link" onClick={() => setInvoice(null)}>
                Close
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
