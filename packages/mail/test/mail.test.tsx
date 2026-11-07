import { createApp } from '@kitr/core'
import { describe, expect, it, vi } from 'vitest'
import {
  address,
  createLogTransport,
  createMailer,
  createResendTransport,
  createSmtpTransport,
  defineMail,
  htmlToText,
} from '../src'
import mailProvider from '../src/provider'

const welcome = defineMail<{ name: string }>('welcome', {
  subject: ({ name }) => `Welcome, ${name}`,
  preview: { name: 'Ada' },
  render: ({ name }) => (
    <html lang="en">
      <body>
        <h1>Hello {name}</h1>
        <p>
          Thanks for joining. <a href="https://example.test/start">Get started</a>
        </p>
      </body>
    </html>
  ),
})

describe('mail', () => {
  it('sends over SMTP through an injected nodemailer', async () => {
    const sent: Record<string, unknown>[] = []
    const nodemailer = {
      createTransport: (opts: unknown) => {
        expect(opts).toMatchObject({ host: 'smtp.test', port: 2525 })
        return {
          sendMail: async (m: Record<string, unknown>) => (sent.push(m), { messageId: 'smtp-1' }),
        }
      },
    }
    const mailer = createMailer({
      transport: createSmtpTransport(nodemailer, { host: 'smtp.test', port: 2525 }),
      from: 'a@b.c',
    })
    const result = await mailer.send(welcome, { name: 'Bo' }, { to: 'bo@x.test' })
    expect(result.id).toBe('smtp-1')
    expect(sent[0]).toMatchObject({ to: 'bo@x.test', subject: 'Welcome, Bo' })
  })

  it('renders React to html and text and sends through the transport', async () => {
    const transport = createLogTransport({ print: false })
    const mailer = createMailer({ transport, from: 'Kitr <hi@kitr.dev>' })
    const sent = await mailer.send(welcome, { name: 'Ada' }, { to: ['ada@example.test'] })
    expect(sent.transport).toBe('log')
    const message = mailer.sent[0]!
    expect(message.subject).toBe('Welcome, Ada')
    expect(message.from).toEqual({ name: 'Kitr', email: 'hi@kitr.dev' })
    expect(message.html).toContain('<h1>Hello Ada</h1>')
    expect(message.text).toContain('Get started (https://example.test/start)')
  })

  it('parses addresses and converts html to text', () => {
    expect(address('Ada <ada@x.test>')).toEqual({ name: 'Ada', email: 'ada@x.test' })
    expect(address('ada@x.test')).toEqual({ email: 'ada@x.test' })
    expect(htmlToText('<p>One &amp; two</p><p>Three</p>')).toBe('One & two\nThree')
  })

  it('posts to Resend', async () => {
    const calls: any[] = []
    const fetchMock = vi.fn(async (url: string, init: any) => {
      calls.push([url, JSON.parse(init.body)])
      return new Response(JSON.stringify({ id: 're_1' }), { status: 200 })
    })
    const mailer = createMailer({
      transport: createResendTransport({ apiKey: 'k', fetch: fetchMock as any }),
      from: 'hi@kitr.dev',
    })
    const sent = await mailer.send(welcome, { name: 'Bo' }, { to: 'bo@x.test' })
    expect(sent.id).toBe('re_1')
    expect(calls[0][0]).toBe('https://api.resend.com/emails')
    expect(calls[0][1].to).toEqual(['bo@x.test'])
  })

  it('requires a sender and a recipient', async () => {
    const mailer = createMailer({ transport: createLogTransport({ print: false }) })
    await expect(mailer.send(welcome, { name: 'x' }, { to: 'a@b.c' })).rejects.toThrow(/sender/)
    const withFrom = createMailer({
      transport: createLogTransport({ print: false }),
      from: 'a@b.c',
    })
    await expect(withFrom.send(welcome, { name: 'x' }, { to: [] })).rejects.toThrow(/recipient/)
  })

  it('refuses to boot in production without a transport', async () => {
    const app = createApp({ providers: [mailProvider], mode: 'production' })
    await expect(app.boot()).rejects.toThrow(/transport/)
  })
})
