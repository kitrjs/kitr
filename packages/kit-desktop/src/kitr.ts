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
    'app/pages/home.tsx',
    `import { isElectron } from '@kitr/desktop/client'
import { useEffect, useState } from 'react'
import { app } from '#app/app'
import { ipc } from '#app/ipc'
import { Badge } from '#components/ui/badge'
import { Button } from '#components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'
import { Input } from '#components/ui/input'
import { PageHeader } from '#components/ui/page-header'

/**
 * The same page runs in the browser (\`kitr dev site\`) and in Electron (\`kitr dev app\`).
 * \`ipc.available\` tells them apart; every call goes through the typed contract in platforms/app/ipc.ts.
 */
export default function HomePage() {
  const [version, setVersion] = useState<string>()
  const [file, setFile] = useState<string | null>(null)
  const [focused, setFocused] = useState(true)
  const secure = app.container.use('secureStorage')
  const notifications = app.container.use('notifications')
  const [secret, setSecret] = useState('')
  const [stored, setStored] = useState<string | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!ipc.available) return
    void ipc.invoke('app.version').then(setVersion)
    return ipc.on('app.focus', setFocused)
  }, [])

  return (
    <main className="mx-auto max-w-2xl p-6">
      <PageHeader
        title="${brand}"
        description="A kitr app with an Electron shell. The window loads the same client build the web platform ships."
        actions={
          <Badge variant={ipc.available ? 'default' : 'secondary'}>
            {ipc.available ? 'Electron ' + (version ?? '…') : isElectron() ? 'Electron (no bridge)' : 'Browser'}
          </Badge>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Native dialogs</CardTitle>
            <CardDescription>\`ipc.invoke('dialog.openFile')\` runs in the main process.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              disabled={!ipc.available}
              onClick={async () => setFile(await ipc.invoke('dialog.openFile', [{ name: 'Text', extensions: ['txt', 'md'] }]))}
            >
              Open a file…
            </Button>
            <p className="break-all text-sm text-muted-foreground">
              {ipc.available ? (file ?? 'No file chosen.') : 'Available inside Electron.'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Push events</CardTitle>
            <CardDescription>Main pushes \`app.focus\` whenever the window focus changes.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {ipc.available ? (focused ? 'Window is focused.' : 'Window is in the background.') : 'Available inside Electron.'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Device</CardTitle>
            <CardDescription>Secrets go to the OS vault, notifications to the OS: \`@kitr/secure-storage\` and \`@kitr/notifications\`.</CardDescription>
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
                void notifications.show({ title: '${brand}', body: 'Hello from the device' }).then(
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
`,
  )
}

/**
 * `kitr new --kit desktop`: The app kit in an Electron shell with a typed IPC contract and native dialogs. See the tauri kit for a Tauri shell.
 */
export default definePackage({
  name: 'desktop',
  kind: 'kit',
  kit: {
    description:
      'The app kit in an Electron shell with a typed IPC contract and native dialogs. See the tauri kit for a Tauri shell.',
    platforms: {
      site: {
        type: 'web',
        options: {
          mode: 'spa',
        },
      },
      app: {
        type: 'desktop',
      },
    },
    packages: [
      'http',
      'forms',
      'table',
      'state',
      'tailwind',
      'theme',
      'toast',
      'auth',
      'storage',
      'mocks',
      'testing',
      'devtools',
      'platform',
      'secure-storage',
      'notifications',
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
