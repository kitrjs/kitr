import { useAppState, useBackButton, useOnline, usePlatform } from '@kitr/platform/react'
import { useInstallPrompt } from '@kitr/web/client'
import { useCallback, useState } from 'react'
import { Badge } from '#components/ui/badge'
import { Button } from '#components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'
import { PageHeader } from '#components/ui/page-header'

/**
 * One page, three homes: the browser, the installed PWA, and the Capacitor shell on iOS/Android.
 * Everything below works in all three; `@kitr/platform` answers the same way everywhere.
 */
export default function HomePage() {
  const platform = usePlatform()
  const online = useOnline()
  const install = useInstallPrompt()
  const active = useAppState()
  const [backPresses, setBackPresses] = useState(0)
  useBackButton(useCallback(() => setBackPresses((n) => n + 1), []))

  return (
    <main className="mx-auto max-w-lg p-4 pb-[env(safe-area-inset-bottom)]">
      <PageHeader
        title="Mobile"
        description="Platform-aware without user-agent sniffing."
        actions={<Badge variant="secondary">{platform.type} · {platform.os}</Badge>}
      />
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Connectivity</CardTitle>
            <CardDescription>`useOnline()` tracks the online and offline events.</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant={online ? 'default' : 'destructive'}>{online ? 'Online' : 'Offline'}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Install</CardTitle>
            <CardDescription>
              The manifest and service worker come from the web platform's pwa option in kitrrc.ts; `useInstallPrompt()` wraps the browser prompt.
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
