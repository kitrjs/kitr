import { HeadContent, Link, Outlet, Scripts } from '@kitr/router'
import css0 from '#app/styles/app.css?url'
import { ThemeScript } from '@kitr/theme'

/** Head tags for every page. Pages add their own through `head` in their route options. */
export function head() {
  return {
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Desktop' },
    ],
    links: [{ rel: 'stylesheet', href: css0 }],
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
      <body>
        <nav style={{ display: 'flex', gap: 12, padding: 12 }}>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
        </nav>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
