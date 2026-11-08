import type { KitrRouterContext } from '@kitr/router'
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from '@tanstack/react-router'
import { type ReactNode, useEffect } from 'react'
import { Footer, Header } from '#app/components/chrome'
import { NotFound } from '#app/components/not-found'
import { themeScript } from '#app/components/theme-toggle'
import { PmProvider, rehydratePm } from '#app/lib/pm'
import css from '#app/styles/site.css?url'

export const Route = createRootRouteWithContext<KitrRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'kitr' },
      { name: 'theme-color', content: '#FFFFFF', media: '(prefers-color-scheme: light)' },
      { name: 'theme-color', content: '#0B121C', media: '(prefers-color-scheme: dark)' },
      { name: 'color-scheme', content: 'light dark' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
      { rel: 'alternate', type: 'text/plain', href: '/llms.txt', title: 'llms.txt' },
      { rel: 'stylesheet', href: css },
    ],
  }),
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  const bare = useRouterState({ select: (s) => s.location.pathname.startsWith('/play/') })
  useEffect(() => rehydratePm(), [])
  return (
    <RootDocument>
      <PmProvider>
        {bare ? (
          <Outlet />
        ) : (
          <>
            <a href="#main" className="skip-link">
              Skip to content
            </a>
            <Header />
            <div id="main">
              <Outlet />
            </div>
            <Footer />
          </>
        )}
      </PmProvider>
    </RootDocument>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: theme before first paint */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
