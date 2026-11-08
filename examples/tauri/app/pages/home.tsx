import { isTauri, useTauriEvent } from 'kitr/tauri/client'
import { useCallback, useState } from 'react'
import { app } from '#app/app'
import { commands } from '#app/commands'
import { Badge } from '#components/ui/badge'
import { Button } from '#components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'
import { Input } from '#components/ui/input'
import { PageHeader } from '#components/ui/page-header'

/**
 * The same page runs in the browser (`kitr dev site`) and in the Tauri window (`kitr dev app`).
 * `isTauri()` tells them apart; every call goes through the typed commands in app/commands.ts,
 * which mirror the `#[tauri::command]` functions in platforms/app/src-tauri/src/lib.rs.
 */
export default function HomePage() {
  const native = isTauri()
  const [name, setName] = useState('kitr')
  const [greeting, setGreeting] = useState<string>()
  const [lastEvent, setLastEvent] = useState<string>()
  const secure = app.container.use('secureStorage')
  const notifications = app.container.use('notifications')
  const [secret, setSecret] = useState('')
  const [stored, setStored] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  useTauriEvent<string>(
    'hello',
    useCallback((payload: string) => setLastEvent(payload), []),
  )

  return (
    <main className="mx-auto max-w-2xl p-6">
      <PageHeader
        title="Tauri"
        description="A kitr app with a Tauri shell. The window loads the same client build the web platform ships."
        actions={<Badge variant={native ? 'default' : 'secondary'}>{native ? 'Tauri' : 'Browser'}</Badge>}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rust commands</CardTitle>
            <CardDescription>`commands.greet({ name })` runs in src-tauri/src/lib.rs.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!native} />
            <Button disabled={!native} onClick={async () => setGreeting(await commands.greet({ name }))}>
              Greet
            </Button>
            <p className="text-sm text-muted-foreground">
              {native ? (greeting ?? 'No greeting yet.') : 'Available inside the Tauri window.'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
            <CardDescription>Rust emits `hello` (`app.emit("hello", payload)`); the page listens with `useTauriEvent`.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {native ? (lastEvent ?? 'No event received yet.') : 'Available inside the Tauri window.'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Device</CardTitle>
            <CardDescription>Secrets go to the OS vault, notifications to the OS: `kitr/secure-storage` and `kitr/notifications`.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Input aria-label="Secret" data-testid="secret-input" value={secret} onChange={(e) => setSecret(e.target.value)} />
            <div className="flex gap-2">
              <Button data-testid="secret-save" onClick={() => void secure.set('demo', secret).then(() => setStatus('saved'), (e: Error) => setStatus(e.message))}>
                Save secret
              </Button>
              <Button variant="outline" data-testid="secret-load" onClick={() => void secure.get('demo').then(setStored)}>
                Load
              </Button>
            </div>
            <p className="text-sm text-muted-foreground" data-testid="secret-value">{stored ?? 'Nothing stored yet.'}</p>
            <Button
              variant="outline"
              data-testid="notify"
              onClick={() =>
                void notifications.show({ title: 'Tauri', body: 'Hello from the device' }).then(
                  () => setStatus('notification sent'),
                  (e: Error) => setStatus(e.message),
                )
              }
            >
              Notify
            </Button>
            <p className="text-sm text-muted-foreground" data-testid="device-status">{status}</p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
