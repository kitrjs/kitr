import { HeadContent, Outlet, Scripts } from 'kitr/router'
import { ThemeScript } from 'kitr/theme'
import css from '#app/styles/app.css?url'

/** Head tags for every page. Pages add their own with `head` on their route in app/routes.ts. */
export function head() {
  return {
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Realtime' },
    ],
    links: [{ rel: 'stylesheet', href: css }],
  }
}

/** The HTML shell. Start streams it on the server and hydrates it on the client. */
export function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
