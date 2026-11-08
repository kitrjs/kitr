import { describe, expect, it } from 'vitest'
import mail from '../src/kitr'

describe('mail setup module', () => {
  it('the config hint matches the createSmtpTransport signature', async () => {
    const configs: Record<string, string> = {}
    const noop = () => {}
    const ctx = new Proxy(
      {
        config: (name: string, src: string) => {
          configs[name] = src
        },
      },
      {
        get: (target, key) =>
          key in target
            ? (target as any)[key]
            : new Proxy(noop, { get: () => noop, apply: () => undefined }),
      },
    )
    await mail.add!(ctx as any)
    expect(configs.mail).toContain('createSmtpTransport(nodemailer, { host, port, auth })')
    expect(configs.mail).not.toContain('createSmtpTransport({')
  })
})
