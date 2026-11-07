import { createApp } from '@kitr/core'
import { silentLogger } from '@kitr/logger'
import { createServer } from '@kitr/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { defineMail, mailPreview } from '../src'
import mailProvider from '../src/provider'

const welcome = defineMail<{ name: string }>('welcome', {
  subject: ({ name }) => `Welcome, ${name}`,
  preview: { name: 'Ada' },
  render: ({ name }) =>
    createElement(
      'html',
      { lang: 'en' },
      createElement('body', null, createElement('h1', null, `Hello ${name}`)),
    ),
})

describe('mail preview', () => {
  it('binds the mailer and serves previews', async () => {
    const app = createApp({ providers: [mailProvider], config: { mail: { from: 'hi@kitr.dev' } } })
    await app.boot()
    expect(app.container.use('mailer').transport.name).toBe('log')

    const server = createServer({ logger: silentLogger, server: { healthPath: false } })
    mailPreview(server, [welcome])
    const index = await server.fetch(new Request('http://x/_kitr/mail'))
    expect(await index.text()).toContain('/_kitr/mail/welcome')
    const page = await server.fetch(new Request('http://x/_kitr/mail/welcome?name=Grace'))
    expect(page.headers.get('content-type')).toContain('text/html')
    expect(await page.text()).toContain('Hello Grace')
    const text = await server.fetch(new Request('http://x/_kitr/mail/welcome?text'))
    expect(await text.text()).toContain('Hello Ada')
    expect((await server.fetch(new Request('http://x/_kitr/mail/nope'))).status).toBe(404)
  })

  it('escapes props taken from the query string', async () => {
    const server = createServer({ logger: silentLogger, server: { healthPath: false } })
    mailPreview(server, [welcome])
    const page = await server.fetch(
      new Request('http://x/_kitr/mail/welcome?name=%3Cscript%3Ealert(1)%3C/script%3E'),
    )
    const html = await page.text()
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
