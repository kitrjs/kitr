import type { KitrRouterContext } from 'kitr/router'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from 'kitr/router'
import { ThemeScript } from 'kitr/theme'
import type { ReactNode } from 'react'
import css from '#app/styles/app.css?url'
import { PwaUpdate } from '#app/components/pwa-update'

export const Route = createRootRouteWithContext<KitrRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
    ],
    links: [{ rel: 'stylesheet', href: css }, { rel: 'manifest', href: '/manifest.webmanifest' }],
  }),
  component: RootLayout,
})

function RootLayout() {
  return (
    <RootDocument>
      <Outlet />
      <PwaUpdate />
    </RootDocument>
  )
}

/** The HTML shell: one page for the browser, the installed PWA and the Capacitor WebView. */
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
