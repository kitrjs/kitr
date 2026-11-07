import { createFileRoute } from '@tanstack/react-router'
import { useAppState, useBackButton } from 'kitr/capacitor'
import { useInstallPrompt, useOnline } from 'kitr/pwa'
import { useCallback, useState } from 'react'
import { native } from '#app/native'
import { Badge } from '#components/ui/badge'
import { Button } from '#components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'
import { PageHeader } from '#components/ui/page-header'

export const Route = createFileRoute('/')({
  component: HomePage,
})

/**
 * One page, three homes: the browser, the installed PWA, and the Capacitor shell on iOS/Android.
 * Everything below works in all three; the native hooks are no-ops on the web.
 */
function HomePage() {
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
        actions={<Badge variant="secondary">{native.platform}</Badge>}
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
              The service worker and manifest come from config/pwa.ts; `useInstallPrompt()` wraps the browser prompt.
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
                  : native.isNative
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
