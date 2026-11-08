import { defineProvider } from '@kitr/core'
import { createLogTransport, createMailer, type MailConfig } from './index'

/** Binds `mailer` from `config/mail.ts`; the log transport outside production unless one is set. */
export const mailProvider = defineProvider({
  name: 'mail',
  register(app) {
    if (app.isClient) return
    const config = app.config.get('mail', {} as MailConfig)
    // The log transport prints whole messages, password reset links included: never in production.
    if (app.isProduction && (!config.transport || config.transport.name === 'log'))
      throw new Error(
        config.transport
          ? '[@kitr/mail] The log transport prints every email (reset links included) and is not allowed in production; set Resend, SMTP or your own transport in config/mail.ts.'
          : '[@kitr/mail] Set a transport in config/mail.ts (Resend, SMTP or your own).',
      )
    app.container.singleton('mailer', () =>
      createMailer({ ...config, transport: config.transport ?? createLogTransport() }),
    )
  },
})

export default mailProvider
