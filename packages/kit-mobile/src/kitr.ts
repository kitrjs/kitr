import {
  type AddContext,
  definePackage,
  displayName,
  writeTemplate as write,
} from '@kitr/core/package'

const files = (ctx: AddContext, name: string) => {
  const brand = displayName(name)
  write(
    ctx,
    'app/routes/__root.tsx',
    `import type { KitrRouterContext } from 'kitr/router'
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
`,
  )
  write(
    ctx,
    'app/components/pwa-update.tsx',
    `import { useServiceWorker } from 'kitr/web/client'

/** Registers the service worker and shows a one-line banner when a new version is waiting. */
export function PwaUpdate() {
  const sw = useServiceWorker()
  if (!sw.needRefresh) return null
  return (
    <div role="status" className="fixed bottom-4 right-4 rounded-md bg-foreground px-3 py-2 text-sm text-background shadow">
      A new version is available.{' '}
      <button type="button" className="underline" onClick={() => sw.update()}>
        Reload
      </button>
    </div>
  )
}
`,
  )
  write(
    ctx,
    'app/routes/index.tsx',
    `import { createFileRoute } from '@tanstack/react-router'
import { useAppState, useBackButton, useOnline, usePlatform } from 'kitr/platform/react'
import { useInstallPrompt } from 'kitr/web/client'
import { useCallback, useState } from 'react'
import { Badge } from '#components/ui/badge'
import { Button } from '#components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'
import { PageHeader } from '#components/ui/page-header'

export const Route = createFileRoute('/')({
  component: HomePage,
})

/**
 * One page, three homes: the browser, the installed PWA, and the Capacitor shell on iOS/Android.
 * Everything below works in all three; \`kitr/platform\` answers the same way everywhere.
 */
function HomePage() {
  const platform = usePlatform()
  const online = useOnline()
  const install = useInstallPrompt()
  const active = useAppState()
  const [backPresses, setBackPresses] = useState(0)
  useBackButton(useCallback(() => setBackPresses((n) => n + 1), []))

  return (
    <main className="mx-auto max-w-lg p-4 pb-[env(safe-area-inset-bottom)]">
      <PageHeader
        title="${brand}"
        description="Platform-aware without user-agent sniffing."
        actions={<Badge variant="secondary">{platform.type} · {platform.os}</Badge>}
      />
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Connectivity</CardTitle>
            <CardDescription>\`useOnline()\` tracks the online and offline events.</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant={online ? 'default' : 'destructive'}>{online ? 'Online' : 'Offline'}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Install</CardTitle>
            <CardDescription>
              The manifest and service worker come from the web platform's pwa option in kitrrc.ts; \`useInstallPrompt()\` wraps the browser prompt.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Button disabled={!install.canInstall} onClick={() => install.install()}>
              Add to home screen
            </Button>
            <span className="text-sm text-muted-foreground">
              {install.installed
                ? 'Installed.'
                : install.canInstall
                  ? 'Ready to install.'
                  : platform.native
                    ? 'Running inside the native shell.'
                    : 'Open in a browser that supports installation.'}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Native lifecycle</CardTitle>
            <CardDescription>Only wired up inside Capacitor; harmless on the web.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm text-muted-foreground">
            <p>App state: {active ? 'active' : 'background'}</p>
            <p>Hardware back button presses: {backPresses}</p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
`,
  )
}

/**
 * `kitr new --kit mobile`: The app kit as an installable PWA and a Capacitor shell: online state, install prompt, native lifecycle hooks.
 */
export default definePackage({
  name: 'mobile',
  kind: 'kit',
  kit: {
    description:
      'The app kit as an installable PWA and a Capacitor shell: online state, install prompt, native lifecycle hooks.',
    platforms: {
      site: {
        type: 'web',
        options: {
          mode: 'spa',
          pwa: true,
        },
      },
      phone: {
        type: 'mobile',
      },
    },
    packages: [
      'http',
      'forms',
      'table',
      'state',
      'tailwind',
      'theme',
      'auth',
      'storage',
      'mocks',
      'testing',
      'devtools',
      'platform',
    ],
    components: [
      'icon',
      'button',
      'input',
      'label',
      'card',
      'form',
      'data-table',
      'page-header',
      'empty-state',
      'theme-toggle',
      'app-shell',
      'badge',
    ],
    files,
  },
})
