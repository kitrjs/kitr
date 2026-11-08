import { definePackage, generatorFile, naming } from '@kitr/core/package'

/** `kitr add mail`: emails as React components, sent through your provider, previewed in development. */
export default definePackage({
  name: 'mail',
  requires: ['server'],
  add(ctx) {
    ctx.provider.add('@kitr/mail/provider')
    ctx.env.add({ RESEND_API_KEY: '', MAIL_FROM: 'App <hello@example.com>' }, 'Mail')
    ctx.config(
      'mail',
      `import { createResendTransport, defineConfig } from '@kitr/mail'\n\n/**\n * Without a transport, development logs every message and production refuses to boot, so a\n * missing RESEND_API_KEY can never print password reset links to production logs.\n * For SMTP, \`pnpm add nodemailer\`, then: createSmtpTransport(nodemailer, { host, port, auth })\n * with \`import nodemailer from 'nodemailer'\`.\n */\nexport default defineConfig({\n  from: process.env.MAIL_FROM ?? 'App <hello@example.com>',\n  transport: process.env.RESEND_API_KEY\n    ? createResendTransport({ apiKey: process.env.RESEND_API_KEY })\n    : undefined,\n})\n`,
    )
    ctx.write(
      'server/mail/welcome.tsx',
      `import { defineMail } from '@kitr/mail'

export interface WelcomeProps {
  name: string
}

/** Send with \`mailer.send(welcomeMail, { name }, { to })\`; preview at /_kitr/mail/welcome in development. */
export const welcomeMail = defineMail<WelcomeProps>('welcome', {
  subject: ({ name }) => \`Welcome, \${name}\`,
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
`,
    )
    ctx.server.attach({
      marker: 'mailPreview(',
      import:
        "import { mailPreview } from '@kitr/mail'\nimport { welcomeMail } from './mail/welcome'",
      line: '// Rendered templates at /_kitr/mail in development.\nif (server.app.isDevelopment) mailPreview(server, [welcomeMail])',
    })
    ctx.agents.add(
      'mail',
      `- Templates are React components in \`server/mail/*.tsx\` (\`kitr make:mail <name>\`, \`defineMail\`). Send from a job or controller with \`ctx.app.container.use('mailer').send(template, props, { to })\`. Development logs messages and previews them at \`/_kitr/mail\`; production needs \`RESEND_API_KEY\` (or an SMTP transport) in \`config/mail.ts\`.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/mail/provider')
    ctx.agents.remove('mail')
  },
  generators: {
    mail: {
      description: 'Create an email template in server/mail',
      definition: 'A React email template with its subject and preview props.',
      target: (name, project) => generatorFile(project, 'server', 'mail', name, { ext: '.tsx' }),
      stub: ({ name }) => `import { defineMail } from '@kitr/mail'

export interface ${naming.pascal(name)}Props {
  firstName: string
}

/** Send with \`mailer.send(${naming.camel(name)}Mail, props, { to })\`; preview at /_kitr/mail/${naming.snake(name)} in development. */
export const ${naming.camel(name)}Mail = defineMail<${naming.pascal(name)}Props>('${naming.snake(name)}', {
  subject: ({ firstName }) => \`${naming.pascal(name)} for \${firstName}\`,
  preview: { firstName: 'Ada' },
  render: ({ firstName }) => (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
        <h1>Hello {firstName}</h1>
        <p>Replace this with the message.</p>
      </body>
    </html>
  ),
})
`,
    },
  },
  vite: { serverOnlyConfig: true },
})
