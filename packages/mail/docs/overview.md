---
title: Overview
description: Write emails as React components, send them through your provider, and preview them in development.
order: 0
---

# Mail

## What it is

`@kitr/mail` sends email from React components. `defineMail` pairs a component with a subject; the mailer renders HTML and plain text, checks every address and sends through a transport. A preview page shows each template in development.

Runs on the server only. To send without making a request wait, send from a [job](/packages/jobs).

## Install

```sh
kitr add mail
```

Adds `@kitr/mail`, its provider, `config/mail.ts`, an example template and the preview page. Adds [server](/packages/server) first if missing. [Every change](/packages/mail/guide#install).

## Quick start

Generate a template with `kitr make:mail order-shipped`:

```tsx
// server/mail/order_shipped.tsx
import { defineMail } from '@kitr/mail'

export const orderShippedMail = defineMail<{ firstName: string; orderId: string }>('order_shipped', {
  subject: ({ orderId }) => `Order ${orderId} has shipped`,
  preview: { firstName: 'Ada', orderId: '1042' },
  render: ({ firstName, orderId }) => (
    <html lang="en">
      <body>
        <h1>Your order is on its way</h1>
        <p>Hi {firstName}, order {orderId} left our warehouse today.</p>
        <a href={`https://app.acme.com/orders/${orderId}`}>Track your order</a>
      </body>
    </html>
  ),
})
```

Send it from a controller:

```ts
// server/controllers/orders_controller.ts
import type { HttpContext } from '@kitr/api'
import { useMailer } from '@kitr/mail'
import { orderShippedMail } from '#server/mail/order_shipped'

export default class OrdersController {
  async ship({ app, params }: HttpContext<{ id: string }>) {
    return useMailer(app).send(orderShippedMail, { firstName: 'Ada', orderId: params.id }, { to: 'Ada Lovelace <ada@acme.com>' })
    // => { id: 'log-1', transport: 'log' }
  }
}
```

In development, with no `RESEND_API_KEY`, the server prints the message instead of sending it:

```
[@kitr/mail] to Ada Lovelace <ada@acme.com>: Order 1042 has shipped
Your order is on its way
Hi Ada, order 1042 left our warehouse today.
Track your order (https://app.acme.com/orders/1042)
```

The props are typed from the template, so leaving out `orderId` is a type error. Set `RESEND_API_KEY` and the same call sends a real email. Next in the guide: [Send your first email](/packages/mail/guide#send-your-first-email).

## Built on

| Built on | Role |
| --- | --- |
| [React Email](https://react.email/docs/introduction) | Components for email layouts (`Html`, `Button`, `Section` and the rest) that render to HTML every client can show. |
| [Resend](https://resend.com/docs) | The built-in API transport. |
| [Nodemailer](https://nodemailer.com/) | The built-in SMTP transport. |

kitr adds `defineMail`, address validation, plain-text rendering, attachments, a log transport for development and tests, a discard transport for deployments without a provider, the preview page and a `MailTransport` interface.

## Problems it solves

- **HTML strings as templates.** [Write a template](/packages/mail/guide#write-a-template).
- **No plain-text version.** [Write the plain-text version](/packages/mail/guide#write-the-plain-text-version).
- **Previewing by sending.** [Preview templates in development](/packages/mail/guide#preview-templates-in-development).
- **Attachments and headers done differently per provider.** [Attach a file](/packages/mail/guide#attach-a-file).
- **Requests waiting on the mail provider.** [job](/packages/jobs).
- **Real emails sent from tests.** [Testing](/packages/mail/guide#testing).

## Further reading

- [Guide](/packages/mail/guide).
- [API reference](/packages/mail/api).
- [React Email](https://react.email/docs/introduction).
- [Resend](https://resend.com/docs) and [Nodemailer](https://nodemailer.com/).
- [Jobs](/packages/jobs) and [Server](/packages/server).
