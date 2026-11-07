import { defineProvider } from '@kitr/core'
import { createLogTransport, createMailer, type MailConfig } from './index'

/** Binds `mailer` from `config/mail.ts`; the log transport outside production unless one is set. */
export const mailProvider = defineProvider({
  name: 'mail',
  register(app) {
    if (app.isClient) return
    const config = app.config.get('mail', {} as MailConfig)
    if (!config.transport && app.isProduction)
      throw new Error('[kitr/mail] Set a transport in config/mail.ts (Resend, SMTP or your own).')
    app.container.singleton('mailer', () =>
      createMailer({ ...config, transport: config.transport ?? createLogTransport() }),
    )
  },
})

export default mailProvider
