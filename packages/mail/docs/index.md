---
title: Mail
description: Write emails as React components, send them through your provider, and preview them in development.
order: 1
---

# Mail

Order confirmations, password resets, invoices, team invites: almost every app sends email, and most end up with a folder of HTML strings nobody wants to touch. In kitr an email is a React component with a subject. `@kitr/mail` renders it to HTML and plain text, checks every address and header, and sends it through [Resend](https://resend.com/docs), SMTP or your own transport.

> [!SUMMARY]
> Write emails as React components, send them through Resend or SMTP, and preview them in development. Add it with `kitr add mail`; the overview is at [/packages/mail](/packages/mail).

It runs on the server only. To send without making a request wait for the mail provider, send from a [job](/packages/jobs).

The examples follow Acme's app at `app.acme.com`, which emails Ada Lovelace when her order ships, sends Grace an invoice as a PDF, and copies Linus.

## Install

```sh
kitr add mail
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add` does:

- Installs `@kitr/mail`. Mail requires the [server](/packages/server) package, so `kitr add` also adds `server` (and its `logger`) when the project does not have them yet.
- Adds `'@kitr/mail'` to `packages` and `() => import('@kitr/mail/provider')` to `providers` in `kitrrc.ts`.
- Adds `RESEND_API_KEY=` and `MAIL_FROM=App <hello@example.com>` under a `# Mail` comment to `.env.example`, and to `.env` when that file exists.
- Writes `config/mail.ts` (shown in [Configure](#configure)) and regenerates `config/index.ts`.
- Writes an example template, `server/mail/welcome.tsx`, exporting `welcomeMail`.
- Adds `mailPreview(server, [welcomeMail])` to `server/main.ts`, inside `if (server.app.isDevelopment)`, with its imports. This step is skipped when the project has no `server/main.ts`.
- Adds a `## kitr: mail` section to `AGENTS.md` telling coding agents where templates live and how to send them.

No kit includes mail; add it to any kit with a server platform.

`kitr remove mail` reverses these steps and deletes `config/mail.ts`. It leaves your templates, the env variables and the `mailPreview` lines in `server/main.ts` for you to delete.

</details>

## Configure

`kitr add mail` writes this file:

```ts
// config/mail.ts
import { createResendTransport, defineConfig } from '@kitr/mail'

/**
 * Without a transport, development logs every message and production refuses to boot, so a
 * missing RESEND_API_KEY can never print password reset links to production logs.
 * For SMTP: createSmtpTransport({ host, auth }).
 */
export default defineConfig({
  from: process.env.MAIL_FROM ?? 'App <hello@example.com>',
  transport: process.env.RESEND_API_KEY
    ? createResendTransport({ apiKey: process.env.RESEND_API_KEY })
    : undefined,
})
```

With `RESEND_API_KEY` set, messages go to Resend. Without it, development prints each message to the console and production refuses to boot. For SMTP, see [SMTP](#smtp).

| Option | Default | Description |
| --- | --- | --- |
| `from` | none | The default sender: `'Acme <orders@acme.com>'`. `send()` throws if no sender is set. |
| `transport` | the log transport, outside production | Where messages go. In production the provider refuses to boot when this is unset or is the log transport. |
| `previewPath` | `/_kitr/mail` | Where `mailPreview()` serves rendered templates in development. `false` turns the preview pages off; `{ path }` passed to `mailPreview()` wins over it. |

| Variable | Used for |
| --- | --- |
| `RESEND_API_KEY` | The Resend API key. When set, the generated config sends through Resend. |
| `MAIL_FROM` | The default sender, such as `Acme <orders@acme.com>`. |

> [!WARNING] Verify your sending domain
> Set `MAIL_FROM` to an address on a domain you have verified; Resend and most SMTP services reject others.

## Send your first email

Generate a template:

```sh
kitr make:mail order-shipped
```

That writes `server/mail/order-shipped.tsx`. Edit it into the email Ada gets when her order ships:

```tsx
// server/mail/order-shipped.tsx
import { defineMail } from '@kitr/mail'

export interface OrderShippedProps {
  firstName: string
  orderId: string
}

export const orderShippedMail = defineMail<OrderShippedProps>('order_shipped', {
  subject: ({ orderId }) => `Order ${orderId} has shipped`,
  preview: { firstName: 'Ada', orderId: '1042' },
  render: ({ firstName, orderId }) => (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
        <h1>Your order is on its way</h1>
        <p>Hi {firstName}, order {orderId} left our warehouse today.</p>
        <a href={`https://app.acme.com/orders/${orderId}`}>Track your order</a>
      </body>
    </html>
  ),
})
```

Send it from a controller with `useMailer(app)`:

```ts
// server/controllers/orders-controller.ts
import type { HttpContext } from '@kitr/api'
import { useMailer } from '@kitr/mail'
import { orderShippedMail } from '#server/mail/order_shipped'

export default class OrdersController {
  async ship({ app, params }: HttpContext<{ id: string }>) {
    const sent = await useMailer(app).send(
      orderShippedMail,
      { firstName: 'Ada', orderId: params.id },
      { to: 'Ada Lovelace <ada@acme.com>' },
    )
    return sent
    // => { id: 'log-1', transport: 'log' }
  }
}
```

Register the route with `api.post('/orders/:id/ship', [OrdersController, 'ship'])` and call it. In development, with no `RESEND_API_KEY`, the server prints the message instead:

```
[@kitr/mail] to Ada Lovelace <ada@acme.com>: Order 1042 has shipped
Your order is on its way
Hi Ada, order 1042 left our warehouse today.
Track your order (https://app.acme.com/orders/1042)
```

Props are typed from the template, so leaving out `orderId` is a type error. Set `RESEND_API_KEY` and the same call sends a real email.

## Write a template

`defineMail(name, template)` returns a template object. The name identifies it in previews (`/_kitr/mail/order_shipped`); the type parameter is its props.

| Field | Required | Description |
| --- | --- | --- |
| `subject` | yes | A string, or a function of the props that returns one. |
| `render(props)` | yes | The body as a React element. Rendered to static HTML with `react-dom/server`. |
| `text(props)` | no | The plain-text version. Left out, it is derived from the HTML. See [Write the plain-text version](#write-the-plain-text-version). |
| `preview` | no | Props the development preview renders with. |

Templates are plain React with no hooks or state; they render once on the server. Put shared layout in a component:

```tsx
// server/mail/layout.tsx
import type { ReactNode } from 'react'

export function AcmeLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>{title}</title>
      </head>
      <body style={{ fontFamily: 'system-ui, sans-serif', lineHeight: 1.5, color: '#111' }}>
        <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
          <tbody>
            <tr>
              <td style={{ maxWidth: 560, margin: '0 auto', padding: 24 }}>{children}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: '#666' }}>Acme Inc. · app.acme.com</p>
      </body>
    </html>
  )
}
```

```tsx
// server/mail/invoice-ready.tsx
import { defineMail } from '@kitr/mail'
import { AcmeLayout } from './layout'

export interface InvoiceReadyProps {
  teamName: string
  invoiceNumber: string
  total: string
}

export const invoiceReadyMail = defineMail<InvoiceReadyProps>('invoice_ready', {
  subject: ({ invoiceNumber }) => `Invoice ${invoiceNumber} from Acme`,
  preview: { teamName: 'Analytical Engines', invoiceNumber: 'INV-2026-007', total: '$480.00' },
  render: ({ teamName, invoiceNumber, total }) => (
    <AcmeLayout title={`Invoice ${invoiceNumber}`}>
      <h1>Invoice {invoiceNumber}</h1>
      <p>
        The invoice for {teamName} is attached. The total is {total}.
      </p>
      <a href={`https://app.acme.com/invoices/${invoiceNumber}`}>View it online</a>
    </AcmeLayout>
  ),
})
```

Props are escaped like any React text.

> [!WARNING] Mail clients ignore your stylesheets
> Use inline `style` props, and absolute image URLs such as `https://app.acme.com/logo.png`; there are no inline (CID) attachments.

## Use React Email components

[React Email](https://react.email/docs/introduction) components such as `<Html>`, `<Button>` and `<Container>` work inside `render`:

```sh
pnpm add @react-email/components
```

```tsx
// server/mail/team-invite.tsx
import { Body, Button, Container, Html, Text } from '@react-email/components'
import { defineMail } from '@kitr/mail'

export interface TeamInviteProps {
  inviter: string
  teamName: string
  token: string
}

export const teamInviteMail = defineMail<TeamInviteProps>('team_invite', {
  subject: ({ inviter, teamName }) => `${inviter} invited you to ${teamName}`,
  preview: { inviter: 'Grace', teamName: 'Analytical Engines', token: 'tok_preview' },
  render: ({ inviter, teamName, token }) => (
    <Html lang="en">
      <Body style={{ fontFamily: 'system-ui, sans-serif' }}>
        <Container>
          <Text>
            {inviter} invited you to join {teamName} on Acme.
          </Text>
          <Button href={`https://app.acme.com/invites/${token}`}>Accept the invite</Button>
        </Container>
      </Body>
    </Html>
  ),
})
```

`@kitr/mail` renders with `renderToStaticMarkup`, not React Email's async `render()`. For components that need it, see [Create a mailer without the provider](#create-a-mailer-without-the-provider).

## Write the plain-text version

Every message has a text part, for clients that show no HTML and for spam filters. Left out, it is derived from the HTML with `htmlToText()`:

```ts
// scripts/text_preview.ts
import { htmlToText } from '@kitr/mail'

htmlToText(
  '<h1>Invoice INV-7</h1><p>Total: $40 &amp; tax</p><ul><li>Hosting</li><li>Support</li></ul><a href="https://app.acme.com/invoices/7">View invoice</a>',
)
// => 'Invoice INV-7\nTotal: $40 & tax\nHosting\nSupport\nView invoice (https://app.acme.com/invoices/7)'
```

Links become `text (url)`, block elements become line breaks, and `<head>`, `<style>` and `<script>` are dropped. When the derived text reads badly, usually because of layout tables, write it yourself:

```tsx
// server/mail/order-shipped.tsx
import { defineMail } from '@kitr/mail'

export const orderShippedMail = defineMail<{ firstName: string; orderId: string }>('order_shipped', {
  subject: ({ orderId }) => `Order ${orderId} has shipped`,
  text: ({ firstName, orderId }) =>
    `Hi ${firstName},\n\nOrder ${orderId} left our warehouse today.\nTrack it: https://app.acme.com/orders/${orderId}`,
  render: ({ firstName, orderId }) => (
    <p>
      Hi {firstName}, order {orderId} left our warehouse today.
    </p>
  ),
})
```

## Send an email

On the server, `useMailer(app).send(template, props, options)` sends one message. `options.to` is required; everything else is optional.

| Send option | Type | Description |
| --- | --- | --- |
| `to` | `Recipient \| Recipient[]` | Who gets it. Required; an empty list throws `No recipient`. |
| `cc`, `bcc` | `Recipient \| Recipient[]` | Copies. |
| `from` | `Recipient` | Overrides `from` in `config/mail.ts` for this message. |
| `replyTo` | `Recipient` | Where replies go. |
| `headers` | `Record<string, string>` | Extra headers, such as `List-Unsubscribe`. |
| `attachments` | `{ filename, content, contentType? }[]` | Files to attach. `content` is a string or a `Uint8Array`. |

A `Recipient` is `'ada@acme.com'`, `'Ada Lovelace <ada@acme.com>'` or `{ email: 'ada@acme.com', name: 'Ada Lovelace' }`.

`send()` resolves with a `SentMail`:

| Field | Description |
| --- | --- |
| `id` | The id the transport returned (Resend's email id, SMTP's `messageId`, `log-<n>` for the log transport), or a random UUID when it returned none. |
| `transport` | The transport's name: `log`, `resend`, `smtp` or yours. |

Store `id` next to the order to match the provider's delivery webhooks later.

## Address several recipients

Every address field takes one recipient or a list, in any of the three forms:

```ts
// server/services/invoice-service.ts
import type { KitrApp } from 'kitr/app'
import { useMailer } from '@kitr/mail'
import { invoiceReadyMail } from '#server/mail/invoice_ready'

export async function sendInvoice(app: KitrApp) {
  return useMailer(app).send(
    invoiceReadyMail,
    { teamName: 'Analytical Engines', invoiceNumber: 'INV-2026-007', total: '$480.00' },
    {
      to: ['Grace Hopper <grace@acme.com>', { email: 'ada@acme.com', name: 'Ada Lovelace' }],
      cc: 'linus@acme.com',
      bcc: 'billing-archive@acme.com',
    },
  )
}
```

Before anything is sent, each address is parsed with `address()` and checked. You can call the same helpers yourself:

```ts
// scripts/addresses.ts
import { address, formatAddress } from '@kitr/mail'

address('Ada Lovelace <ada@acme.com>')
// => { name: 'Ada Lovelace', email: 'ada@acme.com' }
address('ada@acme.com')
// => { email: 'ada@acme.com' }
formatAddress({ name: 'Lovelace, Ada', email: 'ada@acme.com' })
// => '"Lovelace, Ada" <ada@acme.com>'
```

`formatAddress()` quotes display names that contain commas, so `Lovelace, Ada` stays one recipient. The check requires an `@` and rejects whitespace and `<>,;"` in the address; it does not check that the domain exists.

> [!WARNING] One address per entry
> `'ada@acme.com, grace@acme.com'` throws `is not an email address`. Pass an array.

## Set the sender and reply-to

The sender comes from `from` in `config/mail.ts`. Override it per message and point replies at a person or inbox:

```ts
// server/services/support-service.ts
import type { KitrApp } from 'kitr/app'
import { useMailer } from '@kitr/mail'
import { orderShippedMail } from '#server/mail/order_shipped'

export async function sendFromSupport(app: KitrApp) {
  return useMailer(app).send(
    orderShippedMail,
    { firstName: 'Ada', orderId: '1042' },
    {
      to: 'ada@acme.com',
      from: 'Acme Support <support@acme.com>',
      replyTo: 'Linus <linus@acme.com>',
    },
  )
}
```


## Add headers

Pass custom headers in `headers`, such as `List-Unsubscribe`, which Gmail and Yahoo require for bulk mail:

```ts
// server/services/digest-service.ts
import type { KitrApp } from 'kitr/app'
import { useMailer } from '@kitr/mail'
import { invoiceReadyMail } from '#server/mail/invoice_ready'

export async function sendWithUnsubscribe(app: KitrApp, token: string) {
  return useMailer(app).send(
    invoiceReadyMail,
    { teamName: 'Analytical Engines', invoiceNumber: 'INV-2026-007', total: '$480.00' },
    {
      to: 'grace@acme.com',
      headers: {
        'List-Unsubscribe': `<https://app.acme.com/unsubscribe/${token}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Acme-Invoice': 'INV-2026-007',
      },
    },
  )
}
```

Header names with a space, such as `X Acme`, throw `Bad header name`.

### Header injection

A line break in an address, subject or header value would let it start a new header (`Bcc: someone@else.com`). `@kitr/mail` throws before sending, even when the subject is built from props a user typed:

```ts
// scripts/injection.ts
import { createLogTransport, createMailer } from '@kitr/mail'
import { orderShippedMail } from '#server/mail/order_shipped'

const mailer = createMailer({ from: 'orders@acme.com', transport: createLogTransport({ print: false }) })

await mailer.send(orderShippedMail, { firstName: 'Ada', orderId: '1042\r\nBcc: someone@else.com' }, { to: 'ada@acme.com' })
// throws Error: [@kitr/mail] Line break in the subject.
```

## Attach a file

Attachments are `{ filename, content, contentType? }`. `content` is a string or bytes, so a file read with `node:fs` goes straight in:

```ts
// server/services/invoice-service.ts
import { readFile } from 'node:fs/promises'
import type { KitrApp } from 'kitr/app'
import { useMailer } from '@kitr/mail'
import { invoiceReadyMail } from '#server/mail/invoice_ready'

export async function sendInvoicePdf(app: KitrApp, invoiceNumber: string) {
  const pdf = await readFile(`storage/invoices/${invoiceNumber}.pdf`)
  return useMailer(app).send(
    invoiceReadyMail,
    { teamName: 'Analytical Engines', invoiceNumber, total: '$480.00' },
    {
      to: 'Grace Hopper <grace@acme.com>',
      attachments: [
        { filename: `${invoiceNumber}.pdf`, content: pdf, contentType: 'application/pdf' },
        { filename: 'usage.csv', content: 'project,hours\nEngines,42\n', contentType: 'text/csv' },
      ],
    },
  )
}
```

Providers cap message size, so link to large files instead of attaching them.

## Send from a job

Sending inside a request makes the response wait for the provider, and an outage fails the request. Dispatch a [job](/packages/jobs) instead; it retries with backoff:

```ts
// server/jobs/send-order-shipped.ts
import { defineJob } from '@kitr/jobs'
import { useMailer } from '@kitr/mail'
import { z } from 'zod'
import { orderShippedMail } from '#server/mail/order_shipped'

export const sendOrderShipped = defineJob('send_order_shipped', {
  schema: z.object({ orderId: z.string(), firstName: z.string(), email: z.string() }),
  retries: 5,
  backoff: 5_000,
  async run({ orderId, firstName, email }, { app }) {
    const sent = await useMailer(app).send(orderShippedMail, { firstName, orderId }, { to: email })
    return sent.id
  },
})
```

List the job in `config/jobs.ts`, then dispatch it from the controller:

```ts
// server/controllers/orders-controller.ts
import type { HttpContext } from '@kitr/api'
import { useJobs } from '@kitr/jobs'
import { sendOrderShipped } from '#server/jobs/send_order_shipped'

export default class OrdersController {
  async ship({ app, params, response }: HttpContext<{ id: string }>) {
    await useJobs(app).dispatch(sendOrderShipped, {
      orderId: params.id,
      firstName: 'Ada',
      email: 'ada@acme.com',
    })
    return response.json({ queued: true }, { status: 202 })
  }
}
```

Pass ids and plain values, not rendered HTML. A message that fails a check throws on every attempt, so validate addresses in the job's schema.

## Render without sending

`mailer.render(template, props, options?)` builds the finished `Message` and sends nothing, for snapshot tests or storing a copy:

```ts
// server/services/archive-service.ts
import type { KitrApp } from 'kitr/app'
import { useMailer } from '@kitr/mail'
import { orderShippedMail } from '#server/mail/order_shipped'

export async function renderShipped(app: KitrApp) {
  const message = await useMailer(app).render(
    orderShippedMail,
    { firstName: 'Ada', orderId: '1042' },
    { to: 'ada@acme.com' },
  )
  return message
  // => {
  //   from: { name: 'App', email: 'hello@example.com' },
  //   to: [{ email: 'ada@acme.com' }],
  //   subject: 'Order 1042 has shipped',
  //   html: '<html lang="en"><head></head><body ...',
  //   text: 'Your order is on its way\nHi Ada, order 1042 left our warehouse today.\nTrack your order (https://app.acme.com/orders/1042)',
  //   ...
  // }
}
```

`render()` runs the same checks but does not require a recipient.

## Preview templates in development

`mailPreview(server, templates, options?)` serves every template in the list as a web page. Add each new template to the list in `server/main.ts`:

```ts
// server/main.ts
import { mountRoutes } from '@kitr/api'
import { mailPreview } from '@kitr/mail'
import { createServer } from '@kitr/server'
import { config } from '../config'
import rc from '../kitrrc'
import { invoiceReadyMail } from './mail/invoice_ready'
import { orderShippedMail } from './mail/order_shipped'
import { welcomeMail } from './mail/welcome'
import { routes } from './routes'

export const server = createServer({ providers: rc.providers, config })
mountRoutes(server, routes)
// Rendered templates at /_kitr/mail in development.
if (server.app.isDevelopment) mailPreview(server, [welcomeMail, orderShippedMail, invoiceReadyMail])
```

| URL | What it shows |
| --- | --- |
| `/_kitr/mail` | A list of the templates, linked by name. |
| `/_kitr/mail/order_shipped` | The HTML, rendered with the template's `preview` props. |
| `/_kitr/mail/order_shipped?orderId=2001&firstName=Grace` | The HTML, with query values replacing those props. |
| `/_kitr/mail/order_shipped?text` | The plain-text version. |
| `/_kitr/mail/missing` | `404 No such template`. |

Query values are always strings, so numbers and arrays only get the right types from `preview`.

| Option | Default | Description |
| --- | --- | --- |
| `path` | `/_kitr/mail` | Where the pages are served. |
| `mailer` | a mailer with the log transport, sender `preview@localhost` | The mailer used to render. Pass `useMailer(server.app)` to render with your real `from`. |

> [!WARNING] Keep the isDevelopment guard
> Previews render any template with any props a visitor types into the URL.

## Use the mailer outside a request

The provider binds the mailer as `mailer` in the container:

| Where | How |
| --- | --- |
| A controller | `useMailer(ctx.app)` |
| A job | `useMailer(ctx.app)` in `run(payload, ctx)` |
| An action or service during a request | `useMailer(useRequestApp())`, with `useRequestApp` from `@kitr/server` |
| A script or the server file | `useMailer(server.app)` after `await server.boot()` |

`useMailer(app)` is `app.container.use('mailer')`. It throws in the browser or before boot, where nothing is bound.

## Transports

A transport takes a finished message and delivers it. Three are built in.

### Log

The default outside production. It prints each message and keeps it in memory, where `mailer.sent` reads it.

```ts
// config/mail.ts
import { createLogTransport, defineConfig } from '@kitr/mail'

export default defineConfig({
  from: 'Acme <orders@acme.com>',
  transport: createLogTransport({ print: false }),
})
```

| Option | Default | Description |
| --- | --- | --- |
| `print` | `true` | `false` keeps messages without printing them. |

Kept messages are never cleared. The provider refuses to boot in production with the log transport, so emails never land in production logs.

### Resend

Sends through [Resend's HTTP API](https://resend.com/docs/api-reference/emails/send-email) with `fetch`; no package to install.

```ts
// config/mail.ts
import { createResendTransport, defineConfig } from '@kitr/mail'

export default defineConfig({
  from: 'Acme <orders@acme.com>',
  transport: createResendTransport({ apiKey: process.env.RESEND_API_KEY! }),
})
```

In `.env`:

```sh
RESEND_API_KEY=re_...
```

| Option | Default | Description |
| --- | --- | --- |
| `apiKey` | required | Your Resend API key. |
| `fetch` | global `fetch` | The fetch to call, for proxies or tests. |

A non-2xx response throws `[@kitr/mail] Resend <status>: <body>`.

### SMTP

Sends through [nodemailer](https://nodemailer.com/smtp/) to any SMTP server. Install nodemailer and pass the module in:

```sh
pnpm add nodemailer
```

```ts
// config/mail.ts
import { createSmtpTransport, defineConfig } from '@kitr/mail'
import nodemailer from 'nodemailer'

export default defineConfig({
  from: process.env.MAIL_FROM ?? 'Acme <orders@acme.com>',
  transport: createSmtpTransport(nodemailer, {
    host: process.env.SMTP_HOST ?? 'smtp.acme.com',
    port: 587,
    auth: { user: process.env.SMTP_USER ?? '', pass: process.env.SMTP_PASS ?? '' },
  }),
})
```

In `.env`:

```sh
SMTP_HOST=smtp.postmarkapp.com
SMTP_USER=...
SMTP_PASS=...
```

| Option | Default | Description |
| --- | --- | --- |
| `host` | required | The SMTP server. |
| `port` | `587` | The port. |
| `secure` | nodemailer's default | `true` for implicit TLS, usually on port 465. |
| `auth.user`, `auth.pass` | none | Credentials. |

The connection opens on the first `send()`, so a wrong password shows up there. These env names are yours to choose.

### Pick a transport per environment

Choose with plain conditions in `config/mail.ts`: Resend when its key is set, SMTP when a host is set, otherwise unset:

```ts
// config/mail.ts
import { createResendTransport, createSmtpTransport, defineConfig } from '@kitr/mail'
import nodemailer from 'nodemailer'

const transport = process.env.RESEND_API_KEY
  ? createResendTransport({ apiKey: process.env.RESEND_API_KEY })
  : process.env.SMTP_HOST
    ? createSmtpTransport(nodemailer, { host: process.env.SMTP_HOST, port: 2525 })
    : undefined

export default defineConfig({ from: 'Acme <orders@acme.com>', transport })
```

Point `SMTP_HOST` at [Mailpit](https://mailpit.axllent.org/) to see rendered emails without sending any.

## Send in production

In production the provider refuses to boot with `transport` unset or set to the log transport. The generated config leaves it unset when `RESEND_API_KEY` is empty, so a deploy with a missing key fails at boot:

```sh
RESEND_API_KEY= NODE_ENV=production kitr start
# fails at boot: [@kitr/mail] Set a transport in config/mail.ts (Resend, SMTP or your own).
```

Set the key on the host and the same deploy boots and sends. Before you go live:

- Verify the sending domain with your provider and set SPF, DKIM and DMARC records for it.
- Set `MAIL_FROM` to an address on that domain.
- Send from jobs, so a provider outage retries instead of failing requests.
- Keep the `mailPreview` call behind `server.app.isDevelopment`.

## Create a mailer without the provider

`createMailer(options)` returns a mailer with no app or container, for scripts, single-template tests or a custom renderer:

```ts
// scripts/send_digest.ts
import { render } from '@react-email/render'
import { createMailer, createResendTransport } from '@kitr/mail'
import { teamInviteMail } from '#server/mail/team_invite'

const mailer = createMailer({
  from: 'Acme <team@acme.com>',
  transport: createResendTransport({ apiKey: process.env.RESEND_API_KEY! }),
  renderHtml: (element) => render(element),
})

await mailer.send(teamInviteMail, { inviter: 'Grace', teamName: 'Analytical Engines', token: 'tok_1' }, { to: 'linus@acme.com' })
```

It takes the same `from` and `transport` as `config/mail.ts`, plus `renderHtml(element)`, which defaults to `renderToStaticMarkup`. Without a `transport` it uses the log transport.

## Commands

| Command | What it does |
| --- | --- |
| `kitr make:mail <name>` | Writes a template to `server/mail/<name>.tsx` (kebab-case, nested names allowed). `--force` overwrites an existing file. |
| `kitr eject stub mail` | Copies the generator's template to `stubs/mail.ts`, so `make:mail` writes your own starting point. |

`kitr make:mail order-shipped` writes `server/mail/order-shipped.tsx`:

```tsx
// server/mail/order-shipped.tsx
import { defineMail } from '@kitr/mail'

export interface OrderShippedProps {
  firstName: string
}

/** Send with `mailer.send(orderShippedMail, props, { to })`; preview at /_kitr/mail/order_shipped in development. */
export const orderShippedMail = defineMail<OrderShippedProps>('order_shipped', {
  subject: ({ firstName }) => `OrderShipped for ${firstName}`,
  preview: { firstName: 'Ada' },
  render: ({ firstName }) => (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
        <h1>Hello {firstName}</h1>
        <p>Replace this with the message.</p>
      </body>
    </html>
  ),
})
```

The generator does not add the template to `mailPreview()`; do that in `server/main.ts`.

## Errors

Every error is a plain `Error` whose message starts with `[@kitr/mail]`. Nothing is sent when one is thrown.

| Message | When | What to do |
| --- | --- | --- |
| ``No sender: set `from` in config/mail.ts or in send().`` | No `from` in config or send options. | Set `from` or `MAIL_FROM`. |
| `No recipient.` | `to` is an empty list. | Pass at least one recipient. |
| `"<value>" in <field> is not an email address.` | An address is malformed, or several are joined in one string. | Pass one address per entry. |
| `Line break in <field> address.` | An address or display name contains CR or LF. | Strip line breaks from user input. |
| `Line break in the subject.` | The subject, often built from props, contains CR or LF. | Strip line breaks from the props. |
| `Bad header name "<name>".` | A header name has a space or another character not allowed in a token. | Use names like `X-Acme-Invoice`. |
| `Line break in header "<name>".` | A header value contains CR or LF. | Strip line breaks from the value. |
| `Resend <status>: <body>` | Resend answered with an error status. | Read the body: usually an unverified domain or a bad key. |
| `Set a transport in config/mail.ts (Resend, SMTP or your own).` | Boot in production with `transport` unset. | Set a transport, or the env variable that selects one. |
| `The log transport prints every email (reset links included) and is not allowed in production; ...` | Boot in production with the log transport. | Use Resend, SMTP or your own transport in production. |

SMTP errors come from nodemailer unchanged.

## Testing

In a test, boot an app with the mail provider and a quiet log transport, run the code that sends, and read `mailer.sent`:

```ts
// test/order-shipped.test.ts
import { createLogTransport, useMailer } from '@kitr/mail'
import mailProvider from '@kitr/mail/provider'
import { createTestApp } from '@kitr/testing'
import { describe, expect, it } from 'vitest'
import { orderShippedMail } from '#server/mail/order_shipped'

describe('order shipped email', () => {
  it('sends Ada her tracking link', async () => {
    const app = await createTestApp({
      providers: [mailProvider],
      config: {
        mail: { from: 'Acme <orders@acme.com>', transport: createLogTransport({ print: false }) },
      },
    })
    const mailer = useMailer(app)

    const sent = await mailer.send(
      orderShippedMail,
      { firstName: 'Ada', orderId: '1042' },
      { to: 'Ada Lovelace <ada@acme.com>' },
    )

    expect(sent).toEqual({ id: 'log-1', transport: 'log' })
    expect(mailer.sent).toHaveLength(1)
    const message = mailer.sent[0]!
    expect(message.to).toEqual([{ name: 'Ada Lovelace', email: 'ada@acme.com' }])
    expect(message.subject).toBe('Order 1042 has shipped')
    expect(message.html).toContain('Hi Ada, order 1042 left our warehouse today.')
    expect(message.text).toContain('Track your order (https://app.acme.com/orders/1042)')
  })
})
```

`mailer.sent` is a list of plain `Message` objects, newest last, with `to`, `cc`, `bcc`, `from`, `replyTo`, `subject`, `html`, `text`, `headers` and `attachments`. Each `createTestApp()` gets its own mailer. To test through an HTTP route, use `createTestClient(server)` from `@kitr/testing` and read `useMailer(server.app).sent` afterwards.

To check a template's markup without a container, use `createMailer()` and `render()`, and snapshot the result:

```ts
// test/invoice-ready.test.ts
import { createMailer } from '@kitr/mail'
import { expect, it } from 'vitest'
import { invoiceReadyMail } from '#server/mail/invoice_ready'

it('renders the invoice email', async () => {
  const mailer = createMailer({ from: 'Acme <billing@acme.com>' })
  const message = await mailer.render(invoiceReadyMail, invoiceReadyMail.preview!, {
    to: 'grace@acme.com',
  })
  expect(message.subject).toBe('Invoice INV-2026-007 from Acme')
  expect(message.text).toMatchSnapshot()
})
```

To test your code's handling of a transport failure, pass a transport that throws:

```ts
// test/transport-failure.test.ts
import { createMailer, type MailTransport } from '@kitr/mail'
import { expect, it } from 'vitest'
import { orderShippedMail } from '#server/mail/order_shipped'

it('surfaces a provider outage', async () => {
  const down: MailTransport = {
    name: 'down',
    send: async () => {
      throw new Error('503 Service Unavailable')
    },
  }
  const mailer = createMailer({ from: 'orders@acme.com', transport: down })
  await expect(
    mailer.send(orderShippedMail, { firstName: 'Ada', orderId: '1042' }, { to: 'ada@acme.com' }),
  ).rejects.toThrow('503')
})
```

## Extend

A transport is an object with a `name` and a `send(message)` method that resolves with `{ id? }`. The `Message` it receives is final. See [`MailTransport`](/packages/mail/api#mailtransport) and [`Message`](/packages/mail/api#message).

```ts
// server/mail/postmark-transport.ts
import { formatAddress, type MailTransport } from '@kitr/mail'

/** Sends through Postmark's HTTP API. Attachments are left out to keep the example short. */
export function createPostmarkTransport(options: { serverToken: string }): MailTransport {
  return {
    name: 'postmark',
    async send(message) {
      const res = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-postmark-server-token': options.serverToken,
        },
        body: JSON.stringify({
          From: formatAddress(message.from),
          To: message.to.map(formatAddress).join(', '),
          Cc: message.cc?.map(formatAddress).join(', '),
          Bcc: message.bcc?.map(formatAddress).join(', '),
          ReplyTo: message.replyTo ? formatAddress(message.replyTo) : undefined,
          Subject: message.subject,
          HtmlBody: message.html,
          TextBody: message.text,
          Headers: Object.entries(message.headers ?? {}).map(([Name, Value]) => ({ Name, Value })),
        }),
      })
      if (!res.ok) throw new Error(`Postmark ${res.status}: ${await res.text()}`)
      const data = (await res.json()) as { MessageID?: string }
      return { id: data.MessageID }
    },
  }
}
```

Register it in `config/mail.ts` like a built-in one:

```ts
// config/mail.ts
import { defineConfig } from '@kitr/mail'
import { createPostmarkTransport } from '#server/mail/postmark_transport'

export default defineConfig({
  from: 'Acme <orders@acme.com>',
  transport: createPostmarkTransport({ serverToken: process.env.POSTMARK_TOKEN! }),
})
```

Use `formatAddress()` when writing an address into a string. Throw on failure: the error reaches the caller of `send()`, and a job retries it.

<details>
<summary>Fall back to a second provider</summary>

Transports compose. This one tries a backup when the first throws:

```ts
// server/mail/fallback-transport.ts
import type { MailTransport } from '@kitr/mail'

export function withFallback(primary: MailTransport, backup: MailTransport): MailTransport {
  return {
    name: `${primary.name}+${backup.name}`,
    async send(message) {
      try {
        return await primary.send(message)
      } catch {
        return backup.send(message)
      }
    },
  }
}
```

</details>

## Next steps

- [Mail API reference](/packages/mail/api): every export with its signature.
- [Jobs](/packages/jobs): send email in the background, with retries.
- [Build a full-stack app](/guides/fullstack-app): the server half of a kitr app.
