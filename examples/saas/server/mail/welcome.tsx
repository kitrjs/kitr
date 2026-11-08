import { defineMail } from '@kitr/mail'

export interface WelcomeProps {
  name: string
}

/** Send with `mailer.send(welcomeMail, { name }, { to })`; preview at /_kitr/mail/welcome in development. */
export const welcomeMail = defineMail<WelcomeProps>('welcome', {
  subject: ({ name }) => `Welcome, ${name}`,
  preview: { name: 'Ada' },
  render: ({ name }) => (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
        <h1>Hello {name}</h1>
        <p>Thanks for joining.</p>
      </body>
    </html>
  ),
})
