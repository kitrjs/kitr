import { Invoice01Icon } from '@hugeicons/core-free-icons'
import { createApp, defineProvider, getDevtools } from '@kitr/core'
import { definePanel } from '@kitr/devtools'
import devtoolsProvider from '@kitr/devtools/provider'
import { KeyValue } from '@kitr/devtools/ui'
import httpProvider from '@kitr/http/provider'
import { KitrProvider } from '@kitr/react'
import { useEffect, useState } from 'react'

// This module is shared by the examples in this folder. It sits in a subfolder because the site
// turns every file directly in `examples/` into a live example of its own.

interface Invoice {
  id: string
  customer: string
  amount: number
  status: 'open' | 'paid' | 'failed'
}

const customers = ['Ada', 'Grace', 'Linus', 'Margaret', 'Edsger']
let invoices: Invoice[] = []

// Start the same way on every load: drop what an earlier visit to this frame left behind.
try {
  localStorage.removeItem('kitr:devtools')
} catch {}

// A tiny fake backend, so the Network tab has rows. The frame is the example's own document, so
// the original fetch is never put back.
const realFetch = globalThis.fetch.bind(globalThis)
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init)
  const { pathname } = new URL(request.url)
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  await new Promise((resolve) => setTimeout(resolve, 120 + Math.random() * 180))
  if (pathname === '/api/invoices') {
    const body = (await request.json()) as Invoice
    return json(201, body)
  }
  if (pathname === '/api/pay') {
    const body = (await request.json()) as { id: string; decline?: boolean }
    return body.decline
      ? json(402, { code: 'card_declined', message: 'Your card was declined.' })
      : json(200, { id: body.id, status: 'paid' })
  }
  return realFetch(request)
}

/** A provider of your own, adding an Invoices tab and a command-palette action. */
const invoicesProvider = defineProvider({
  name: 'invoices',
  devtools: () => [
    definePanel({
      id: 'invoices',
      label: 'Invoices',
      icon: Invoice01Icon,
      group: 'custom',
      badge: () => invoices.length || null,
      render: () => <KeyValue rows={invoices.map((i) => [i.id, i])} />,
      actions: [
        {
          id: 'invoices.clear',
          label: 'Clear invoices',
          danger: true,
          run: (app) => {
            invoices = []
            getDevtools(app)?.log('invoices', 'cleared')
            return 'Cleared'
          },
        },
      ],
    }),
  ],
})

const app = createApp({
  environment: 'client',
  mode: 'production',
  providers: [devtoolsProvider, httpProvider, invoicesProvider],
  config: {
    devtools: { enabled: true, openByDefault: false, position: 'bottom-right' },
    http: { baseUrl: `${location.origin}/api` },
  },
})
const booted = app.boot()

/** The invoices app, with the devtools closed and its trigger in the bottom-right corner. */
export default function InvoicesApp() {
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
  const http = app.container.use('http')

  const create = async () => {
    const invoice: Invoice = {
      id: `inv_${1000 + invoices.length + 1}`,
      customer: customers[invoices.length % customers.length]!,
      amount: 40 + ((invoices.length * 37) % 200),
      status: 'open',
    }
    await http.post('invoices', { json: invoice }).json()
    invoices = [...invoices, invoice]
    devtools?.log('invoices', `created ${invoice.id}`, invoice)
  }
  const pay = async (decline: boolean) => {
    const open = invoices.find((i) => i.status === 'open')
    if (!open) return
    try {
      await http.post('pay', { json: { id: open.id, decline } }).json()
      invoices = invoices.map((i) => (i === open ? { ...i, status: 'paid' } : i))
      devtools?.log('payments', `${open.id} paid`, { amount: open.amount })
    } catch {
      invoices = invoices.map((i) => (i === open ? { ...i, status: 'failed' } : i))
      devtools?.log('payments', `card declined for ${open.id}`, { code: 'card_declined' }, 'error')
    }
  }
  const hasOpen = invoices.some((i) => i.status === 'open')

  return (
    <KitrProvider app={app}>
      <div className="demo">
        <div className="demo-row">
          <button type="button" className="demo-button primary" onClick={() => void create()}>
            Create invoice
          </button>
          <button
            type="button"
            className="demo-button"
            onClick={() => void pay(false)}
            disabled={!hasOpen}
          >
            Pay one
          </button>
          <button
            type="button"
            className="demo-button"
            onClick={() => void pay(true)}
            disabled={!hasOpen}
          >
            Decline one
          </button>
        </div>
        <p className="demo-muted">
          {invoices.length} invoices, {invoices.filter((i) => i.status === 'open').length} open.
        </p>
      </div>
    </KitrProvider>
  )
}
