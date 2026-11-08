import { createApp, defineProvider, getDevtools } from '@kitr/core'
import { definePanel } from '@kitr/devtools'
import devtoolsProvider from '@kitr/devtools/provider'
import { KeyValue } from '@kitr/devtools/ui'
import { KitrProvider } from '@kitr/react'
import { useEffect, useState } from 'react'

export const meta = {
  title: 'The panel, running in a production build',
  description:
    'Create and pay invoices, then open the Log and Invoices tabs. This app runs in production mode with enabled: true.',
  storage: false,
  height: 460,
}

interface Invoice {
  id: string
  customer: string
  amount: number
  status: 'open' | 'paid' | 'failed'
}

let invoices: Invoice[] = []
const customers = ['Ada', 'Grace', 'Linus', 'Margaret', 'Edsger']

/** A provider of your own, adding an Invoices tab and a command-palette action. */
const invoicesProvider = defineProvider({
  name: 'invoices',
  devtools: () => [
    definePanel({
      id: 'invoices',
      label: 'Invoices',
      badge: () => invoices.length || null,
      render: () => <KeyValue rows={invoices.map((i) => [i.id, i])} />,
      actions: [
        {
          id: 'invoices.clear',
          label: 'Clear invoices',
          run: (app) => {
            invoices = []
            getDevtools(app)?.log('invoices', 'cleared')
          },
        },
      ],
    }),
  ],
})

const app = createApp({
  environment: 'client',
  mode: 'production',
  providers: [devtoolsProvider, invoicesProvider],
  config: { devtools: { enabled: true, openByDefault: true, position: 'bottom-right' } },
})
const booted = app.boot()

// Start on the Log tab, tall enough to read, unless the frame remembers its own choice.
try {
  if (!localStorage.getItem('kitr:devtools'))
    localStorage.setItem('kitr:devtools', JSON.stringify({ tab: 'log', height: 240 }))
} catch {}

export default function InvoicesPanel() {
  const [ready, setReady] = useState(false)
  const [, rerender] = useState(0)
  useEffect(() => {
    let unsubscribe = () => {}
    void booted.then(() => {
      setReady(true)
      // The palette's "Clear invoices" changes the list too.
      unsubscribe = getDevtools(app)?.subscribe(() => rerender((n) => n + 1)) ?? unsubscribe
    })
    return () => unsubscribe()
  }, [])
  if (!ready) return null

  const devtools = getDevtools(app)
  const create = () => {
    const invoice: Invoice = {
      id: `inv_${1000 + invoices.length + 1}`,
      customer: customers[invoices.length % customers.length]!,
      amount: 40 + ((invoices.length * 37) % 200),
      status: 'open',
    }
    invoices = [...invoices, invoice]
    devtools?.log('invoices', `created ${invoice.id}`, invoice)
  }
  const pay = (fail: boolean) => {
    const open = invoices.find((i) => i.status === 'open')
    if (!open) return
    const status = fail ? 'failed' : 'paid'
    invoices = invoices.map((i) => (i === open ? { ...i, status } : i))
    if (fail)
      devtools?.log('payments', `card declined for ${open.id}`, { code: 'card_declined' }, 'error')
    else devtools?.log('payments', `${open.id} paid`, { amount: open.amount })
  }
  const hasOpen = invoices.some((i) => i.status === 'open')

  return (
    <KitrProvider app={app}>
      <div className="demo">
        <div className="demo-row">
          <button type="button" className="demo-button primary" onClick={create}>
            Create invoice
          </button>
          <button
            type="button"
            className="demo-button"
            onClick={() => pay(false)}
            disabled={!hasOpen}
          >
            Pay one
          </button>
          <button
            type="button"
            className="demo-button"
            onClick={() => pay(true)}
            disabled={!hasOpen}
          >
            Decline one
          </button>
        </div>
        <p className="demo-muted">
          {invoices.length} invoices, {invoices.filter((i) => i.status === 'open').length} open. The
          panel's "actions" button can clear them.
        </p>
      </div>
    </KitrProvider>
  )
}
