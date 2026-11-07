import type { KitrRouterContext } from 'kitr/router'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from 'kitr/router'
import { ThemeScript } from 'kitr/theme'
import type { ReactNode } from 'react'
import css from '#app/styles/app.css?url'

export const Route = createRootRouteWithContext<KitrRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Realtime' },
    ],
    links: [{ rel: 'stylesheet', href: css }],
  }),
  component: RootLayout,
})

function RootLayout() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

/** The HTML shell. Start streams it on the server and hydrates it on the client. */
function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
