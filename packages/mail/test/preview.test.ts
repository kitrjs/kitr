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

  it('reads previewPath from config/mail.ts and mounts nothing when it is false', async () => {
    const moved = createServer({ logger: silentLogger, server: { healthPath: false } })
    moved.app.config.set('mail', { from: 'hi@kitr.dev', previewPath: '/dev/mail' })
    mailPreview(moved, [welcome])
    expect((await moved.fetch(new Request('http://x/dev/mail/welcome'))).status).toBe(200)
    expect((await moved.fetch(new Request('http://x/_kitr/mail/welcome'))).status).toBe(404)

    const off = createServer({ logger: silentLogger, server: { healthPath: false } })
    off.app.config.set('mail', { from: 'hi@kitr.dev', previewPath: false })
    mailPreview(off, [welcome])
    expect((await off.fetch(new Request('http://x/_kitr/mail'))).status).toBe(404)

    const explicit = createServer({ logger: silentLogger, server: { healthPath: false } })
    explicit.app.config.set('mail', { from: 'hi@kitr.dev', previewPath: false })
    mailPreview(explicit, [welcome], { path: '/previews' })
    expect((await explicit.fetch(new Request('http://x/previews/welcome'))).status).toBe(200)
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
