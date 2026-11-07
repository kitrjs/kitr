import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from '@tanstack/react-router'
import type { KitrRouterContext } from 'kitr/router'
import { type ReactNode, useEffect } from 'react'
import { Footer, Header } from '#app/components/chrome'
import { themeScript } from '#app/components/theme-toggle'
import { PmProvider, rehydratePm } from '#app/lib/pm'
import css from '#app/styles/site.css?url'

const fonts =
  'https://fonts.googleapis.com/css2?family=Asimovian&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap'

export const Route = createRootRouteWithContext<KitrRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'kitr: the React framework where everything is an add-on' },
      {
        name: 'description',
        content:
          'kitr is a thin layer over TanStack, React Hook Form, Zustand, ky, h3 and Tailwind. One import surface, one data contract, one CLI.',
      },
      { name: 'theme-color', content: '#FFFFFF' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: fonts },
      { rel: 'stylesheet', href: css },
    ],
  }),
  component: RootLayout,
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
