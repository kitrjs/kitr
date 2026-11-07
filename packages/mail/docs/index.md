---
title: Mail
description: Write emails as React components, send them through your provider, and preview them in development.
order: 1
---

# Mail

Sign-up confirmations, password resets, invoices, invites: almost every app sends email, and almost every app ends up with a folder of HTML strings nobody wants to touch. In kitr an email is a React component with a subject. `kitr/mail` renders it to HTML and plain text, sends it through Resend, SMTP or your own transport, and shows you a preview of every template while you work on it.

It runs on the server only. To send email without making the request wait, send it from a [job](/packages/jobs).

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

| Template field | Description |
| --- | --- |
| `subject` | A string, or a function of the props. |
| `render(props)` | The body, as React. |
| `text(props)` | The plain-text version. Left out, it's derived from the HTML, with links written as `text (url)`. |
| `preview` | Props the development preview renders with. |

## Send

```ts
import { useMailer } from 'kitr/mail'

await useMailer(app).send(welcome, { name: user.name }, { to: user.email })
```

The props are typed from the template, so a missing `name` is a type error. `send()` resolves with `{ id, transport }`.

| Send option | Description |
| --- | --- |
| `to`, `cc`, `bcc` | One recipient or a list: `'ada@example.com'`, `'Ada <ada@example.com>'` or `{ email, name }`. |
| `from` | Overrides the default sender from `config/mail.ts`. |
| `replyTo` | Where replies go. |
| `headers` | Extra headers, such as `List-Unsubscribe`. |
| `attachments` | `[{ filename, content, contentType }]`, where `content` is a string or bytes. |

Addresses, the subject and headers are checked before anything is sent. A line break in any of them throws instead of letting a value smuggle in another header.

### From a job

```ts
export const sendWelcome = defineJob('send-welcome', {
  schema: z.object({ name: z.string(), email: z.string().email() }),
  run: ({ name, email }, { app }) => useMailer(app).send(welcome, { name }, { to: email }),
})
```

The request returns at once, and if the mail provider is down the job retries with backoff.

## Transports

```ts
// config/mail.ts
import { createResendTransport, defineConfig } from 'kitr/mail'

export default defineConfig({
  from: 'Acme <hello@acme.com>',
  transport: createResendTransport({ apiKey: process.env.RESEND_API_KEY! }),
})
```

`createSmtpTransport(nodemailer, { host, port, auth })` takes the nodemailer module (`pnpm add nodemailer`) so the bundler sees a real import. Without a transport the log transport prints every message and keeps it in `mailer.sent`, which is what tests read; production refuses to boot without a real one.

| Option | Default | Description |
| --- | --- | --- |
| `transport` | log | Where messages go. Production refuses to start without one. |
| `from` | none | The default sender. |
| `previewPath` | `/_kitr/mail` | Where previews are served in development. `false` turns them off. |

## Previews

`mailPreview(server, [welcome, ...])` in `server/main.ts` serves `/_kitr/mail` with a list of templates and `/_kitr/mail/welcome?name=Grace` rendered with the given props (`?text` for the text version). The recipe adds it in development only.

## Tests

Outside production, the log transport keeps every message it would have sent. Read them from `mailer.sent`:

```ts
await signUp({ name: 'Ada', email: 'ada@example.com' })

const [message] = useMailer(app).sent
expect(message.to[0].email).toBe('ada@example.com')
expect(message.subject).toBe('Welcome, Ada')
```

`mailer.render(template, props)` returns the finished message without sending it, which is handy for snapshot tests.
