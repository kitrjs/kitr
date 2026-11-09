import { createApp } from '@kitr/core'
import { describe, expect, it, vi } from 'vitest'
import {
  address,
  createDiscardTransport,
  createLogTransport,
  createMailer,
  createResendTransport,
  defineMail,
  formatAddress,
  htmlToText,
  type MailTransport,
  type Message,
} from '../src'
import mailProvider from '../src/provider'

const note = defineMail<{ who: string; subject?: string }>('note', {
  subject: ({ subject }) => subject ?? 'A note',
  preview: { who: 'Ada' },
  render: ({ who }) => (
    <p>
      Hi {who} &amp; friends, <a href="https://x.test/?a=1&amp;b=2">open</a>
    </p>
  ),
})

const mailer = () =>
  createMailer({ from: 'App <app@x.test>', transport: createLogTransport({ print: false }) })

describe('header injection', () => {
  it.each([
    ['to', { to: 'a@x.test\r\nBcc: victim@y.test' }],
    ['to name', { to: { name: 'A\nBcc: victim@y.test', email: 'a@x.test' } }],
    ['cc', { to: 'a@x.test', cc: 'c@x.test\nX: y' }],
    ['bcc', { to: 'a@x.test', bcc: ['ok@x.test', 'b@x.test\r\nX: y'] }],
    ['replyTo', { to: 'a@x.test', replyTo: 'r@x.test\nX: y' }],
    ['from', { to: 'a@x.test', from: 'f@x.test\r\nX: y' }],
    ['header value', { to: 'a@x.test', headers: { 'X-Tag': 'a\r\nBcc: victim@y.test' } }],
    ['header name', { to: 'a@x.test', headers: { 'X-Tag\r\nBcc': 'v' } }],
  ])('rejects a line break in %s', async (_label, options) => {
    const m = mailer()
    await expect(m.send(note, { who: 'A' }, options as never)).rejects.toThrow(/kitr\/mail/)
    expect(m.sent).toHaveLength(0)
  })

  it('rejects a line break in the subject, even from props', async () => {
    const m = mailer()
    await expect(
      m.send(note, { who: 'A', subject: 'Hi\r\nBcc: victim@y.test' }, { to: 'a@x.test' }),
    ).rejects.toThrow(/subject/)
  })

  it.each(['not-an-email', 'a@', '@x.test', 'a b@x.test', 'a@x.test, b@x.test', ''])(
    'rejects %j as a recipient',
    async (to) => {
      await expect(mailer().send(note, { who: 'A' }, { to })).rejects.toThrow()
    },
  )

  it('escapes props in the HTML body', async () => {
    const message = await mailer().render(
      note,
      { who: '<script>alert(1)</script>' },
      { to: 'a@x.test' },
    )
    expect(message.html).not.toContain('<script>')
    expect(message.html).toContain('&lt;script&gt;')
  })
})

describe('addresses', () => {
  it('parses display names, quoted or not', () => {
    expect(address('Ada Lovelace <ada@x.test>')).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@x.test',
    })
    expect(address('"Doe, Jane" <jane@x.test>')).toEqual({
      name: 'Doe, Jane',
      email: 'jane@x.test',
    })
    expect(address('"Say \\"hi\\"" <q@x.test>')).toEqual({ name: 'Say "hi"', email: 'q@x.test' })
    expect(address('<bare@x.test>')).toEqual({ name: undefined, email: 'bare@x.test' })
    expect(address('  plain@x.test  ')).toEqual({ email: 'plain@x.test' })
    expect(address(`${' '.repeat(50_000)}x`)).toEqual({ email: 'x' })
  })

  it('quotes names that need it, and round-trips', () => {
    expect(formatAddress({ email: 'a@x.test' })).toBe('a@x.test')
    expect(formatAddress({ name: 'Ada', email: 'a@x.test' })).toBe('Ada <a@x.test>')
    expect(formatAddress({ name: 'Doe, Jane', email: 'j@x.test' })).toBe('"Doe, Jane" <j@x.test>')
    expect(formatAddress({ name: 'Say "hi"', email: 'q@x.test' })).toBe('"Say \\"hi\\"" <q@x.test>')
    for (const a of [
      { name: 'Doe, Jane', email: 'j@x.test' },
      { name: 'Say "hi" (x)', email: 'q@x.test' },
    ])
      expect(address(formatAddress(a))).toEqual(a)
  })
})

describe('htmlToText', () => {
  it('decodes entities once, so escaped markup stays escaped', () => {
    expect(htmlToText('<p>&amp;lt;b&amp;gt; is bold</p>')).toBe('&lt;b&gt; is bold')
    expect(htmlToText('<p>Tom &amp; Jerry &lt;3 &#39;x&#39; &#x27;y&#x27;</p>')).toBe(
      "Tom & Jerry <3 'x' 'y'",
    )
  })

  it('drops head, style and script, keeps links and line breaks', () => {
    const text = htmlToText(
      '<html><head><title>T</title><style>p{}</style></head><body><script>x()</script><h1>Title</h1><p>One<br>Two</p><a href="https://x.test">Go</a></body></html>',
    )
    expect(text).toBe('Title\nOne\nTwo\nGo (https://x.test)')
  })

  it('drops script and style whatever their case or closing-tag spacing', () => {
    expect(htmlToText('<p>a</p><SCRIPT type="x">bad()</script ><Style>p{}</STYLE>b')).toBe('a\nb')
    expect(htmlToText('<scripted>keep</scripted>')).toBe('keep')
    expect(htmlToText('<A class="b" href="/x">Go</A> <a href="/y">open')).toBe('Go (/x) open')
  })

  it('stays fast on bodies full of unclosed tags', () => {
    const start = performance.now()
    htmlToText('<style'.repeat(50_000))
    htmlToText('<a href="/x">'.repeat(50_000))
    expect(performance.now() - start).toBeLessThan(1000)
  })

  it('is used for the text part when the template has none, decoding the link', async () => {
    const message = await mailer().render(note, { who: 'Ada' }, { to: 'a@x.test' })
    expect(message.text).toBe('Hi Ada & friends, open (https://x.test/?a=1&b=2)')
    expect(message.html.startsWith('<!DOCTYPE html>')).toBe(true)
  })
})

describe('resend transport', () => {
  const capture = () => {
    const bodies: any[] = []
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)))
      return Response.json({ id: 're_1' })
    })
    return { bodies, fetch }
  }

  it('base64-encodes large binary and text attachments correctly', async () => {
    const { bodies, fetch } = capture()
    const transport = createResendTransport({ apiKey: 'k', fetch: fetch as never })
    const big = new Uint8Array(300_000).map((_, i) => i % 256)
    const m = createMailer({ from: 'a@x.test', transport })
    await m.send(
      note,
      { who: 'A' },
      {
        to: 'b@x.test',
        attachments: [
          { filename: 'big.bin', content: big, contentType: 'application/octet-stream' },
          { filename: 'note.txt', content: 'héllo ✓' },
        ],
      },
    )
    const [bin, txt] = bodies[0].attachments
    expect(Buffer.from(bin.content, 'base64').equals(Buffer.from(big))).toBe(true)
    expect(bin.content_type).toBe('application/octet-stream')
    expect(Buffer.from(txt.content, 'base64').toString('utf8')).toBe('héllo ✓')
  })

  it('sends quoted names and surfaces API errors', async () => {
    const { bodies, fetch } = capture()
    const m = createMailer({
      from: 'App <a@x.test>',
      transport: createResendTransport({ apiKey: 'k', fetch: fetch as never }),
    })
    const sent = await m.send(note, { who: 'A' }, { to: { name: 'Doe, Jane', email: 'j@x.test' } })
    expect(sent).toEqual({ id: 're_1', transport: 'resend' })
    expect(bodies[0].to).toEqual(['"Doe, Jane" <j@x.test>'])
    expect(fetch.mock.calls[0]![1].headers).toMatchObject({ authorization: 'Bearer k' })
    const failing = createResendTransport({
      apiKey: 'k',
      fetch: (async () => new Response('domain not verified', { status: 403 })) as never,
    })
    await expect(
      createMailer({ from: 'a@x.test', transport: failing }).send(
        note,
        { who: 'A' },
        { to: 'b@x.test' },
      ),
    ).rejects.toThrow('Resend 403: domain not verified')
  })
})

describe('mailer', () => {
  it('requires a sender and a recipient, and does not send on render', async () => {
    const send = vi.fn(async () => ({}))
    const transport: MailTransport = { name: 'spy', send }
    await expect(
      createMailer({ transport }).send(note, { who: 'A' }, { to: 'a@x.test' }),
    ).rejects.toThrow(/No sender/)
    await expect(
      createMailer({ transport, from: 'a@x.test' }).send(note, { who: 'A' }, { to: [] }),
    ).rejects.toThrow(/No recipient/)
    await createMailer({ transport, from: 'a@x.test' }).render(
      note,
      { who: 'A' },
      { to: 'b@x.test' },
    )
    expect(send).not.toHaveBeenCalled()
  })

  it('generates an id when the transport gives none, and keeps nothing for non-log transports', async () => {
    const seen: Message[] = []
    const m = createMailer({
      from: 'a@x.test',
      transport: {
        name: 'spy',
        send: async (msg) => {
          seen.push(msg)
          return {}
        },
      },
    })
    const sent = await m.send(
      note,
      { who: 'A' },
      { to: ['b@x.test', 'C <c@x.test>'], cc: 'd@x.test' },
    )
    expect(sent.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(m.sent).toEqual([])
    expect(seen[0]!.to).toEqual([{ email: 'b@x.test' }, { name: 'C', email: 'c@x.test' }])
    expect(seen[0]!.cc).toEqual([{ email: 'd@x.test' }])
  })

  it('boots in production with the discard transport, which logs recipients and subject only', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    try {
      const app = createApp({
        environment: 'server',
        mode: 'production',
        providers: [mailProvider],
        config: { mail: { from: 'a@x.test', transport: createDiscardTransport() } },
      } as never)
      await app.boot()
      const mailer = app.container.use('mailer')
      expect(mailer.transport.name).toBe('discard')
      const sent = await mailer.send(
        defineMail<{ link: string }>('reset', {
          subject: () => 'Reset your password',
          render: ({ link }) => <a href={link}>reset</a>,
        }),
        { link: 'https://x.test/reset?token=SECRET' },
        { to: 'b@x.test' },
      )
      expect(sent.id).toMatch(/^discard-1$/)
      const printed = info.mock.calls.map((c) => c.join(' ')).join('\n')
      expect(printed).toContain('b@x.test')
      expect(printed).toContain('Reset your password')
      expect(printed).not.toContain('SECRET')
    } finally {
      info.mockRestore()
    }
  })

  it('refuses to boot in production without a transport, and is server-only', async () => {
    const prod = createApp({
      environment: 'server',
      mode: 'production',
      providers: [mailProvider],
    } as never)
    await expect(prod.boot()).rejects.toThrow(/Set a transport/)
    // An explicit log transport would print reset links to production logs: refused too.
    const logged = createApp({
      environment: 'server',
      mode: 'production',
      providers: [mailProvider],
      config: { mail: { from: 'a@x.test', transport: createLogTransport({ print: false }) } },
    } as never)
    await expect(logged.boot()).rejects.toThrow(/not allowed in production/)
    // Development keeps logging.
    const dev = createApp({
      environment: 'server',
      providers: [mailProvider],
      config: { mail: { from: 'a@x.test' } },
    })
    await dev.boot()
    expect(dev.container.use('mailer').transport.name).toBe('log')
    const client = createApp({ environment: 'client', providers: [mailProvider] })
    await client.boot()
    expect(client.container.has('mailer')).toBe(false)
  })
})
