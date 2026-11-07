import { createDefineConfig, type KitrApp } from '@kitr/core'
import type { ReactElement } from 'react'

export interface Address {
  email: string
  name?: string
}
export type Recipient = string | Address

export interface MailTemplate<Props> {
  name: string
  subject: string | ((props: Props) => string)
  /** The body as React. Plain components, or React Email's <Html>, <Button> and friends. */
  render: (props: Props) => ReactElement
  /** A text alternative; derived from the HTML when left out. */
  text?: (props: Props) => string
  /** Props the development preview renders with. */
  preview?: Props
}

export function defineMail<Props = Record<string, never>>(
  name: string,
  template: Omit<MailTemplate<Props>, 'name'>,
): MailTemplate<Props> {
  return { name, ...template }
}

export interface Message {
  from: Address
  to: Address[]
  cc?: Address[]
  bcc?: Address[]
  replyTo?: Address
  subject: string
  html: string
  text: string
  headers?: Record<string, string>
  attachments?: Array<{ filename: string; content: string | Uint8Array; contentType?: string }>
}

export interface SendOptions {
  to: Recipient | Recipient[]
  cc?: Recipient | Recipient[]
  bcc?: Recipient | Recipient[]
  from?: Recipient
  replyTo?: Recipient
  headers?: Record<string, string>
  attachments?: Message['attachments']
}

export interface SentMail {
  id: string
  transport: string
}

/** Where messages go. */
export interface MailTransport {
  name: string
  send(message: Message): Promise<{ id?: string }>
}

export interface MailConfig {
  transport?: MailTransport
  /** Default sender. */
  from?: Recipient
  /** Serve rendered templates at this path in development. Default `/_kitr/mail`; false disables. */
  previewPath?: string | false
}

export interface Mailer {
  send<P>(template: MailTemplate<P>, props: P, options: SendOptions): Promise<SentMail>
  /** The rendered message without sending it, for tests and previews. */
  render<P>(template: MailTemplate<P>, props: P, options?: Partial<SendOptions>): Promise<Message>
  readonly transport: MailTransport
  /** Messages the log transport kept, newest last. Empty with other transports. */
  readonly sent: readonly Message[]
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    mail: MailConfig
  }
  interface ContainerBindings {
    mailer: Mailer
  }
}

export const defineConfig = createDefineConfig<MailConfig>()

export function address(input: Recipient): Address {
  if (typeof input !== 'string') return { ...input, email: input.email.trim() }
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(input)
  if (!m) return { email: input.trim() }
  const name = m[1]!.replace(/^"(.*)"$/, '$1').replace(/\\(.)/g, '$1') || undefined
  return { name, email: m[2]!.trim() }
}

/** CR or LF in a header would let a value start a new header (`Bcc:`) at the SMTP layer. */
const lineBreak = /[\r\n]/

function checkAddress(a: Address, field: string): Address {
  if (lineBreak.test(a.email) || (a.name && lineBreak.test(a.name)))
    throw new Error(`[kitr/mail] Line break in ${field} address.`)
  if (!/^[^\s@<>,;"]+@[^\s@<>,;"]+$/.test(a.email))
    throw new Error(`[kitr/mail] "${a.email}" in ${field} is not an email address.`)
  return a
}

function checkHeaders(headers: Record<string, string> | undefined) {
  for (const [name, value] of Object.entries(headers ?? {})) {
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name))
      throw new Error(`[kitr/mail] Bad header name "${name}".`)
    if (lineBreak.test(String(value)))
      throw new Error(`[kitr/mail] Line break in header "${name}".`)
  }
}

export function formatAddress(a: Address): string {
  if (!a.name) return a.email
  // Commas, quotes and the like in a display name must be quoted, or "Doe, Jane" becomes two recipients.
  const name = /^[\w !#$%&'*+\-/=?^`{|}~.]*$/.test(a.name)
    ? a.name
    : `"${a.name.replace(/(["\\])/g, '\\$1')}"`
  return `${name} <${a.email}>`
}

const list = (input?: Recipient | Recipient[]): Address[] =>
  input === undefined ? [] : (Array.isArray(input) ? input : [input]).map(address)

/** A readable text version of an HTML body. */
export function htmlToText(html: string): string {
  return (
    html
      .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<head[\s\S]*?<\/head>/gi, '')
      .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
      .replace(/<\/(p|div|h[1-6]|li|tr|br)>|<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&#x27;/g, "'")
      // Last, so `&amp;lt;` reads as `&lt;` and not `<`.
      .replace(/&amp;/g, '&')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

/** Keeps messages in memory and prints them; the default outside production. */
export function createLogTransport(options: { print?: boolean } = {}): MailTransport & {
  messages: Message[]
} {
  const messages: Message[] = []
  return {
    name: 'log',
    messages,
    async send(message) {
      messages.push(message)
      if (options.print !== false)
        console.info(
          `[kitr/mail] to ${message.to.map(formatAddress).join(', ')}: ${message.subject}\n${message.text}`,
        )
      return { id: `log-${messages.length}` }
    },
  }
}

// Chunked: spreading a large attachment into fromCharCode overflows the call stack.
function base64(bytes: Uint8Array): string {
  let text = ''
  for (let i = 0; i < bytes.length; i += 0x8000)
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(text)
}

/** Resend's HTTP API. */
export function createResendTransport(options: {
  apiKey: string
  fetch?: typeof fetch
}): MailTransport {
  const doFetch = options.fetch ?? fetch
  return {
    name: 'resend',
    async send(message) {
      const res = await doFetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${options.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: formatAddress(message.from),
          to: message.to.map(formatAddress),
          cc: message.cc?.map(formatAddress),
          bcc: message.bcc?.map(formatAddress),
          reply_to: message.replyTo ? formatAddress(message.replyTo) : undefined,
          subject: message.subject,
          html: message.html,
          text: message.text,
          headers: message.headers,
          // Resend takes base64; text content is encoded as UTF-8 first, as SMTP would send it.
          attachments: message.attachments?.map((a) => ({
            filename: a.filename,
            content: base64(
              typeof a.content === 'string' ? new TextEncoder().encode(a.content) : a.content,
            ),
            content_type: a.contentType,
          })),
        }),
      })
      if (!res.ok) throw new Error(`[kitr/mail] Resend ${res.status}: ${await res.text()}`)
      const data = (await res.json()) as { id?: string }
      return { id: data.id }
    },
  }
}

/** The part of nodemailer the SMTP transport uses; pass the module itself. */
export interface NodemailerLike {
  createTransport(options: unknown): {
    sendMail(message: Record<string, unknown>): Promise<{ messageId?: string }>
  }
}

/**
 * SMTP through nodemailer (`pnpm add nodemailer`). Pass the module in so the bundler sees a real
 * dependency: `createSmtpTransport(nodemailer, { host, port, auth })`.
 */
export function createSmtpTransport(
  nodemailer: NodemailerLike | { default: NodemailerLike },
  options: {
    host: string
    port?: number
    secure?: boolean
    auth?: { user: string; pass: string }
  },
): MailTransport {
  const mod = 'default' in nodemailer ? nodemailer.default : nodemailer
  let transporter: ReturnType<NodemailerLike['createTransport']> | undefined
  return {
    name: 'smtp',
    async send(message) {
      transporter ??= mod.createTransport({ port: 587, ...options })
      const info = await transporter.sendMail({
        from: formatAddress(message.from),
        to: message.to.map(formatAddress).join(', '),
        cc: message.cc?.map(formatAddress).join(', '),
        bcc: message.bcc?.map(formatAddress).join(', '),
        replyTo: message.replyTo ? formatAddress(message.replyTo) : undefined,
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: message.headers,
        attachments: message.attachments,
      })
      return { id: info?.messageId }
    },
  }
}

export interface CreateMailerOptions extends MailConfig {
  /** Renders React to static HTML. Default: react-dom/server's renderToStaticMarkup. */
  renderHtml?: (element: ReactElement) => Promise<string> | string
}

export function createMailer(options: CreateMailerOptions = {}): Mailer {
  const transport = options.transport ?? createLogTransport()
  const renderHtml =
    options.renderHtml ??
    (async (element: ReactElement) => {
      const { renderToStaticMarkup } = await import('react-dom/server')
      return renderToStaticMarkup(element)
    })
  const mailer: Mailer = {
    transport,
    get sent() {
      return (transport as { messages?: Message[] }).messages ?? []
    },
    async render(template, props, send = {}) {
      const from = send.from ?? options.from
      if (!from)
        throw new Error('[kitr/mail] No sender: set `from` in config/mail.ts or in send().')
      const subject =
        typeof template.subject === 'function' ? template.subject(props) : template.subject
      if (lineBreak.test(subject)) throw new Error('[kitr/mail] Line break in the subject.')
      checkHeaders(send.headers)
      const html = await renderHtml(template.render(props))
      const doc =
        /^\s*<!doctype/i.test(html) || /^\s*<html/i.test(html) ? html : `<!DOCTYPE html>${html}`
      return {
        from: checkAddress(address(from), 'from'),
        to: list(send.to).map((a) => checkAddress(a, 'to')),
        cc: send.cc ? list(send.cc).map((a) => checkAddress(a, 'cc')) : undefined,
        bcc: send.bcc ? list(send.bcc).map((a) => checkAddress(a, 'bcc')) : undefined,
        replyTo: send.replyTo ? checkAddress(address(send.replyTo), 'replyTo') : undefined,
        subject,
        html: doc,
        text: template.text ? template.text(props) : htmlToText(html),
        headers: send.headers,
        attachments: send.attachments,
      }
    },
    async send(template, props, send) {
      const message = await mailer.render(template, props, send)
      if (!message.to.length) throw new Error('[kitr/mail] No recipient.')
      const { id } = await transport.send(message)
      return { id: id ?? crypto.randomUUID(), transport: transport.name }
    },
  }
  return mailer
}

export function useMailer(app: KitrApp): Mailer {
  return app.container.use('mailer')
}

/**
 * Serves every registered template at `<previewPath>/<name>` in development (the `preview` props,
 * or `?prop=value` from the query string), and an index listing them.
 */
export function mailPreview<
  S extends { h3: { get(path: string, handler: (event: any) => unknown): unknown } },
>(server: S, templates: MailTemplate<any>[], options: { path?: string; mailer?: Mailer } = {}): S {
  const base = (options.path ?? '/_kitr/mail').replace(/\/$/, '')
  const index = () =>
    new Response(
      `<!DOCTYPE html><meta charset="utf-8"><title>Mail previews</title><h1>Mail previews</h1><ul>${templates
        .map((t) => `<li><a href="${base}/${t.name}">${t.name}</a></li>`)
        .join('')}</ul>`,
      { headers: { 'content-type': 'text/html; charset=utf-8' } },
    )
  server.h3.get(base, index)
  server.h3.get(`${base}/`, index)
  server.h3.get(`${base}/:name`, async (event: any) => {
    const url = new URL(event.req.url)
    const name = decodeURIComponent(url.pathname.slice(base.length + 1))
    const template = templates.find((t) => t.name === name)
    if (!template) return new Response('No such template', { status: 404 })
    const props = { ...template.preview, ...Object.fromEntries(url.searchParams) }
    const mailer = options.mailer ?? createMailer({ from: 'preview@localhost' })
    const message = await mailer.render(template, props, { to: 'you@localhost' })
    if (url.searchParams.has('text'))
      return new Response(message.text, {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    return new Response(message.html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  })
  return server
}
