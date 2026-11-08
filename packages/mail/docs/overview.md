---
title: Overview
description: Write emails as React components, send them through your provider, and preview them in development.
order: 0
---

# Mail

Order confirmations, password resets, invoices, team invites: almost every app sends email, and most end up with a folder of HTML strings nobody wants to touch. Previewing them means sending a real email to yourself, and the plain-text version is usually forgotten.

In kitr an email is a React component with a subject. `@kitr/mail` renders it, checks it, sends it and previews it.

## What it is

`@kitr/mail` lets you define an email with `defineMail`: a React component for the body and a function for the subject. The mailer renders it to HTML and plain text, validates every address and header, and sends it through the configured transport. In development, a preview page lists every template and renders it with sample data as you edit. Controllers and jobs get the mailer with `useMailer()`.

It runs on the server only. The provider binds nothing in the browser. To send without making a request wait for the provider, send from a [job](/packages/jobs).

## Built on

| Built on | Role |
| --- | --- |
| [React Email](https://react.email/docs/introduction) | Components for email layouts (`Html`, `Button`, `Section` and the rest) that render to HTML every client can show. |
| [Resend](https://resend.com/docs) | The built-in API transport. |
| [Nodemailer](https://nodemailer.com/) | The built-in SMTP transport. |

kitr adds `defineMail`, the mailer with address and header validation, automatic plain-text rendering with `htmlToText`, attachments, a log transport for development and tests, the preview page, and a `MailTransport` interface for your own provider.

## Problems it solves

- **HTML strings as templates.** An email is a typed React component with props. See [Write a template](/packages/mail/guide#write-a-template).
- **No plain-text version.** The mailer renders one from the HTML, or you write your own. See [Write the plain-text version](/packages/mail/guide#write-the-plain-text-version).
- **Previewing by sending.** The development preview renders every template with sample data in the browser. See [Preview templates in development](/packages/mail/guide#preview-templates-in-development).
- **Attachments and headers done differently per provider.** One `send()` call covers recipients, reply-to, headers and attachments on every transport. See [Attach a file](/packages/mail/guide#attach-a-file).
- **Requests waiting on the mail provider.** Dispatch a [job](/packages/jobs) that sends. See [Send from a job](/packages/mail/guide#send-from-a-job).
- **Real emails sent from tests.** The log transport records every message as `sent` for assertions. See [Testing](/packages/mail/guide#testing).

## Further reading

- [Guide](/packages/mail/guide): install, configure and every task.
- [API reference](/packages/mail/api): every export with its signature.
- [React Email](https://react.email/docs/introduction): components for email layouts.
- [Resend](https://resend.com/docs) and [Nodemailer](https://nodemailer.com/): the providers behind the built-in transports.
- [Jobs](/packages/jobs) and [Server](/packages/server): sending in the background, and the server the mailer runs in.
