---
title: API reference
description: Every export of kitr/mail, with its signature.
order: 2
---

# API reference

Every export of `kitr/mail`, `kitr/mail/provider`, read from the published type definitions. The [guide](/packages/mail/guide) shows them in use.

## kitr/mail

### address

```ts
function address(input: Recipient): Address;
```

Parse a recipient (`'Ada <ada@acme.com>'`, quoted names included) into an `Address`, trimming the email.

### createLogTransport

```ts
function createLogTransport(options?: {
  print?: boolean;
}): MailTransport & {
  messages: Message[];
};
```

Keeps messages in memory (`mailer.sent`) and prints them unless `print: false`; the default
outside production. Never cleared, so not for production.

### createMailer

```ts
function createMailer(options?: CreateMailerOptions): Mailer;
```

Create a mailer without the provider, for scripts and tests. Uses the log transport when none is given.

### createResendTransport

```ts
function createResendTransport(options: {
  apiKey: string;
  fetch?: typeof fetch;
}): MailTransport;
```

Sends through Resend's HTTP API with `fetch`. A non-2xx response throws `Resend <status>: <body>`.

### createSmtpTransport

```ts
function createSmtpTransport(nodemailer: NodemailerLike | {
  default: NodemailerLike;
}, options: {
  host: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
}): MailTransport;
```

SMTP through nodemailer (`pnpm add nodemailer`). Pass the module in so the bundler sees a real
dependency: `createSmtpTransport(nodemailer, { host, port, auth })`.

### defineMail

```ts
function defineMail<Props = Record<string, never>>(name: string, template: Omit<MailTemplate<Props>, 'name'>): MailTemplate<Props>;
```

Declare an email template. The type parameter is its props, so `send()` checks them;
the name is its preview URL.

### formatAddress

```ts
function formatAddress(a: Address): string;
```

Write an `Address` as a header value, quoting display names with commas or quotes so they stay one recipient.

### htmlToText

```ts
function htmlToText(html: string): string;
```

A readable text version of an HTML body: links become `text (url)`, block ends become line breaks. Used when a template has no `text`.

### mailPreview

```ts
function mailPreview<S extends {
  h3: {
    get(path: string, handler: (event: any) => unknown): unknown;
  };
  app?: {
    config: {
      get(key: 'mail', fallback: MailConfig): MailConfig;
    };
  };
}>(server: S, templates: MailTemplate<any>[], options?: {
  path?: string;
  mailer?: Mailer;
}): S;
```

Serves every registered template at `<previewPath>/<name>` in development (the `preview` props,
or `?prop=value` from the query string), and an index listing them. The path comes from
`options.path`, then `previewPath` in `config/mail.ts` (read from `server.app` when the server
has one), then `/_kitr/mail`; `previewPath: false` mounts nothing.

### useMailer

```ts
function useMailer(app: KitrApp): Mailer;
```

The mailer the provider bound in this app's container. Throws in the browser, where nothing is bound.

### defineConfig

```ts
const defineConfig: <const C extends MailConfig>(config: C) => C;
```

Types `config/mail.ts`. Returns its argument unchanged.

### Address

```ts
interface Address {
  /** The address itself, such as `ada@acme.com`. */
  email: string;
  /** The display name, such as `Ada Lovelace`. */
  name?: string;
}
```

A parsed email address, as every `Message` field holds it.

### CreateMailerOptions

```ts
interface CreateMailerOptions extends MailConfig {
  /** Renders React to static HTML. Default: react-dom/server's renderToStaticMarkup. */
  renderHtml?: (element: ReactElement) => Promise<string> | string;
}
```

Options for `createMailer`: the config options plus how React is rendered.

### MailConfig

```ts
interface MailConfig {
  /** Where messages go. Unset in production, the provider refuses to boot. */
  transport?: MailTransport;
  /** Default sender. */
  from?: Recipient;
  /**
   * Meant as the preview path (default `/_kitr/mail`; false disables). Not read today:
   * `mailPreview()` takes its own `path` option.
   */
  previewPath?: string | false;
}
```

The options in `config/mail.ts`.

### Mailer

```ts
interface Mailer {
  /** Render, check and send one message; resolves with its id and transport name. */
  send<P>(template: MailTemplate<P>, props: P, options: SendOptions): Promise<SentMail>;
  /** The rendered message without sending it, for tests and previews. */
  render<P>(template: MailTemplate<P>, props: P, options?: Partial<SendOptions>): Promise<Message>;
  /** The transport messages go through. */
  readonly transport: MailTransport;
  /** Messages the log transport kept, newest last. Empty with other transports. */
  readonly sent: readonly Message[];
}
```

The service the provider binds as `mailer`: renders templates and sends them through the transport.

### MailTemplate

```ts
interface MailTemplate<Props> {
  /** Identifies the template in previews (`/_kitr/mail/<name>`). */
  name: string;
  /** The subject line, or a function of the props that returns it. */
  subject: string | ((props: Props) => string);
  /** The body as React. Plain components, or React Email's <Html>, <Button> and friends. */
  render: (props: Props) => ReactElement;
  /** A text alternative; derived from the HTML when left out. */
  text?: (props: Props) => string;
  /** Props the development preview renders with. */
  preview?: Props;
}
```

An email template made by `defineMail`: a name, a subject and a React body, typed by its props.

### MailTransport

```ts
interface MailTransport {
  /** Reported as `SentMail.transport`. */
  name: string;
  /** Deliver a finished message; throw on failure. Resolve with the provider's id when it has one. */
  send(message: Message): Promise<{
    id?: string;
  }>;
}
```

Where messages go: the log, Resend and SMTP transports, or your own object with these two members.

### Message

```ts
interface Message {
  /** The sender. */
  from: Address;
  /** The recipients; never empty once sent. */
  to: Address[];
  /** Carbon-copy recipients. */
  cc?: Address[];
  /** Blind carbon-copy recipients. */
  bcc?: Address[];
  /** Where replies go. */
  replyTo?: Address;
  /** The subject line. */
  subject: string;
  /** The full HTML document. */
  html: string;
  /** The plain-text version: the template's `text`, or derived from the HTML. */
  text: string;
  /** Extra headers, such as `List-Unsubscribe`. */
  headers?: Record<string, string>;
  /** Attached files; `content` is a string or bytes. */
  attachments?: Array<{
    filename: string;
    content: string | Uint8Array;
    contentType?: string;
  }>;
}
```

A rendered, checked message, as transports receive it and `mailer.sent` keeps it.

### NodemailerLike

```ts
interface NodemailerLike {
  /** nodemailer's `createTransport`, called once on the first send. */
  createTransport(options: unknown): {
    sendMail(message: Record<string, unknown>): Promise<{
      messageId?: string;
    }>;
  };
}
```

The part of nodemailer the SMTP transport uses; pass the module itself.

### SendOptions

```ts
interface SendOptions {
  /** One recipient or a list. Required. */
  to: Recipient | Recipient[];
  /** Carbon-copy recipients. */
  cc?: Recipient | Recipient[];
  /** Blind carbon-copy recipients. */
  bcc?: Recipient | Recipient[];
  /** Overrides `from` in `config/mail.ts` for this message. */
  from?: Recipient;
  /** Where replies go. */
  replyTo?: Recipient;
  /** Extra headers. Names must be tokens; values may not contain line breaks. */
  headers?: Record<string, string>;
  /** Files to attach: `{ filename, content, contentType? }`. */
  attachments?: Message['attachments'];
}
```

The third argument of `mailer.send()`: recipients, sender overrides, headers and attachments.

### SentMail

```ts
interface SentMail {
  /** The transport's message id, or a random UUID when it returned none. */
  id: string;
  /** The name of the transport that sent it. */
  transport: string;
}
```

What `mailer.send()` resolves with.

### Recipient

```ts
type Recipient = string | Address;
```

An address in any accepted form: `'ada@acme.com'`, `'Ada <ada@acme.com>'` or an `Address`.

## kitr/mail/provider

### mailProvider

```ts
const mailProvider: import("@kitr/core").KitrProvider;
```

Binds `mailer` from `config/mail.ts`; the log transport outside production unless one is set.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
