import { defineMail } from 'kitr/mail'
import type { AuthMailProps } from 'kitr/auth/server'

const page = (heading: string, intro: string, cta: string, url: string) => (
  <html lang="en">
    <body style={{ fontFamily: 'system-ui, sans-serif', lineHeight: 1.5, color: '#111' }}>
      <h1 style={{ fontSize: 20 }}>{heading}</h1>
      <p>{intro}</p>
      <p>
        <a href={url} style={{ background: '#111', color: '#fff', padding: '10px 16px', borderRadius: 6, textDecoration: 'none' }}>
          {cta}
        </a>
      </p>
      <p style={{ color: '#666', fontSize: 13 }}>If the button does not work, paste this link into your browser: {url}</p>
    </body>
  </html>
)

const preview: AuthMailProps = { url: 'http://localhost:3000/verify-email?token=preview', email: 'ada@example.com', name: 'Ada' }

/** Sent after sign-up and on request. The link opens /verify-email, which posts the token to the API. */
export const verifyEmailMail = defineMail<AuthMailProps>('verify-email', {
  subject: 'Confirm your email address',
  preview,
  render: ({ url, name }) => page(`Welcome${name ? `, ${name}` : ''}`, 'Confirm your email address to finish setting up your account.', 'Confirm email', url),
})

/** Sent when someone asks to reset a password. The link works once and expires after an hour. */
export const resetPasswordMail = defineMail<AuthMailProps>('reset-password', {
  subject: 'Reset your password',
  preview: { ...preview, url: 'http://localhost:3000/reset-password?token=preview' },
  render: ({ url }) => page('Reset your password', 'Someone asked to reset the password for this account. If it was you, choose a new one. If not, ignore this email.', 'Choose a new password', url),
})
