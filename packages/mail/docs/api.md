---
title: API
description: Every export of kitr/mail, with its signature.
order: 2
---

# API

Every export of `kitr/mail`, `kitr/mail/provider`, read from the published type definitions. The [guide](/packages/mail) shows them in use.

## kitr/mail

### address

```ts
function address(input: Recipient): Address;
```

### createLogTransport

```ts
function createLogTransport(options?: {
  print?: boolean;
}): MailTransport & {
  messages: Message[];
};
```

Keeps messages in memory and prints them; the default outside production.

### createMailer

```ts
function createMailer(options?: CreateMailerOptions): Mailer;
```

### createResendTransport

```ts
function createResendTransport(options: {
  apiKey: string;
  fetch?: typeof fetch;
}): MailTransport;
```

Resend's HTTP API.

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

### formatAddress

```ts
function formatAddress(a: Address): string;
```

### htmlToText

```ts
function htmlToText(html: string): string;
```

A readable text version of an HTML body.

### mailPreview

```ts
function mailPreview<S extends {
  h3: {
    get(path: string, handler: (event: any) => unknown): unknown;
  };
}>(server: S, templates: MailTemplate<any>[], options?: {
  path?: string;
  mailer?: Mailer;
}): S;
```

Serves every registered template at `<previewPath>/<name>` in development (the `preview` props,
or `?prop=value` from the query string), and an index listing them.

### useMailer

```ts
function useMailer(app: KitrApp): Mailer;
```

### defineConfig

```ts
const defineConfig: <const C extends MailConfig>(config: C) => C;
```

### Address

```ts
interface Address {
  email: string;
  name?: string;
}
```

### CreateMailerOptions

```ts
interface CreateMailerOptions extends MailConfig {
  /** Renders React to static HTML. Default: react-dom/server's renderToStaticMarkup. */
  renderHtml?: (element: ReactElement) => Promise<string> | string;
}
```

### MailConfig

```ts
interface MailConfig {
  transport?: MailTransport;
  /** Default sender. */
  from?: Recipient;
  /** Serve rendered templates at this path in development. Default `/_kitr/mail`; false disables. */
  previewPath?: string | false;
}
```

### Mailer

```ts
interface Mailer {
  send<P>(template: MailTemplate<P>, props: P, options: SendOptions): Promise<SentMail>;
  /** The rendered message without sending it, for tests and previews. */
  render<P>(template: MailTemplate<P>, props: P, options?: Partial<SendOptions>): Promise<Message>;
  readonly transport: MailTransport;
  /** Messages the log transport kept, newest last. Empty with other transports. */
  readonly sent: readonly Message[];
}
```

### MailTemplate

```ts
interface MailTemplate<Props> {
  name: string;
  subject: string | ((props: Props) => string);
  /** The body as React. Plain components, or React Email's <Html>, <Button> and friends. */
  render: (props: Props) => ReactElement;
  /** A text alternative; derived from the HTML when left out. */
  text?: (props: Props) => string;
  /** Props the development preview renders with. */
  preview?: Props;
}
```

### MailTransport

```ts
interface MailTransport {
  name: string;
  send(message: Message): Promise<{
    id?: string;
  }>;
}
```

Where messages go.

### Message

```ts
interface Message {
  from: Address;
  to: Address[];
  cc?: Address[];
  bcc?: Address[];
  replyTo?: Address;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content: string | Uint8Array;
    contentType?: string;
  }>;
}
```

### NodemailerLike

```ts
interface NodemailerLike {
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
  to: Recipient | Recipient[];
  cc?: Recipient | Recipient[];
  bcc?: Recipient | Recipient[];
  from?: Recipient;
  replyTo?: Recipient;
  headers?: Record<string, string>;
  attachments?: Message['attachments'];
}
```

### SentMail

```ts
interface SentMail {
  id: string;
  transport: string;
}
```

### Recipient

```ts
type Recipient = string | Address;
```

## kitr/mail/provider

### mailProvider

```ts
const mailProvider: import("@kitr/core").KitrProvider;
```

Binds `mailer` from `config/mail.ts`; the log transport outside production unless one is set.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
