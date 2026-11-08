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
import { ipc } from '#app/ipc'
import { Badge } from '#components/ui/badge'
import { Button } from '#components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'
import { PageHeader } from '#components/ui/page-header'

/**
 * The same page runs in the browser (\`kitr dev site\`) and in Electron (\`kitr dev app\`).
 * \`ipc.available\` tells them apart; every call goes through the typed contract in platforms/app/ipc.ts.
 */
export default function HomePage() {
  const [version, setVersion] = useState<string>()
  const [file, setFile] = useState<string | null>(null)
  const [focused, setFocused] = useState(true)

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
