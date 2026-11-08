import { createResendTransport, defineConfig } from '@kitr/mail'

/**
 * Without a transport, development logs every message and production refuses to boot, so a
 * missing RESEND_API_KEY can never print password reset links to production logs.
 * For SMTP, `pnpm add nodemailer`, then: createSmtpTransport(nodemailer, { host, port, auth })
 * with `import nodemailer from 'nodemailer'`.
 */
export default defineConfig({
  from: process.env.MAIL_FROM ?? 'App <hello@example.com>',
  transport: process.env.RESEND_API_KEY
    ? createResendTransport({ apiKey: process.env.RESEND_API_KEY })
    : undefined,
})
