---
title: Mail
description: Write emails as React components, send them through your provider, and preview them in development.
order: 1
---

# Mail

An email is a React component with a subject. `kitr/mail` renders it to HTML and text, sends it through Resend, SMTP or your own transport, and serves a preview of every template while you develop.

## Install

```sh
kitr add mail
kitr make:mail welcome
```

```ts
// server/mail/welcome.tsx
import { defineMail } from 'kitr/mail'

export const welcome = defineMail<{ name: string }>('welcome', {
  subject: ({ name }) => `Welcome, ${name}`,
  preview: { name: 'Ada' },
  render: ({ name }) => (
    <html>
      <body>
        <h1>Hello {name}</h1>
        <a href="https://app.example.com/start">Get started</a>
      </body>
    </html>
  ),
})
```

React Email's components (`<Html>`, `<Button>`, `<Tailwind>`) work inside `render`; so does plain JSX.

## Send

```ts
import { useMailer } from 'kitr/mail'

await useMailer(app).send(welcome, { name: user.name }, { to: user.email })
```

`send()` resolves with the transport's message id. The text alternative is derived from the HTML unless the template provides `text`.

## Transports

```ts
// config/mail.ts
import { createResendTransport, defineConfig } from 'kitr/mail'

export default defineConfig({
  from: 'Acme <hello@acme.com>',
  transport: createResendTransport({ apiKey: process.env.RESEND_API_KEY! }),
})
```

`createSmtpTransport({ host, port, auth })` uses nodemailer when it is installed. Without a transport the log transport prints every message and keeps it in `mailer.sent`, which is what tests read; production refuses to boot without a real one.

## Previews

`mailPreview(server, [welcome, ...])` in `server/main.ts` serves `/_kitr/mail` with a list of templates and `/_kitr/mail/welcome?name=Grace` rendered with the given props (`?text` for the text version). The recipe adds it in development only.
