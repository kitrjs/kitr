import { HeadContent, Outlet, Scripts } from '@kitr/router'
import { ThemeScript } from '@kitr/theme'
import css from '#app/styles/app.css?url'
import { PwaUpdate } from '#app/components/pwa-update'

/** Head tags for every page: viewport for notched screens, the web app manifest. */
export function head() {
  return {
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
    ],
    links: [{ rel: 'stylesheet', href: css }, { rel: 'manifest', href: '/manifest.webmanifest' }],
  }
}

/** The HTML shell: one page for the browser, the installed PWA and the Capacitor WebView. */
export function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Outlet />
        <PwaUpdate />
        <Scripts />
      </body>
    </html>
  )
}
