import { type AddContext, definePackage, displayName } from '@kitr/core/package'

const write = (ctx: AddContext, path: string, content: string) =>
  ctx.write(path, content, { overwrite: true })

const files = (ctx: AddContext, name: string) => {
  const brand = displayName(name)
  write(
    ctx,
    'app/pages/home.tsx',
    `import { isTauri, useTauriEvent } from '@kitr/tauri/client'
import { useCallback, useState } from 'react'
import { commands } from '#app/commands'
import { Badge } from '#components/ui/badge'
import { Button } from '#components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'
import { Input } from '#components/ui/input'
import { PageHeader } from '#components/ui/page-header'

/**
 * The same page runs in the browser (\`kitr dev site\`) and in the Tauri window (\`kitr dev app\`).
 * \`isTauri()\` tells them apart; every call goes through the typed commands in app/commands.ts,
 * which mirror the \`#[tauri::command]\` functions in platforms/app/src-tauri/src/lib.rs.
 */
export default function HomePage() {
  const native = isTauri()
  const [name, setName] = useState('kitr')
  const [greeting, setGreeting] = useState<string>()
  const [lastEvent, setLastEvent] = useState<string>()
  useTauriEvent<string>(
    'hello',
    useCallback((payload: string) => setLastEvent(payload), []),
  )

  return (
    <main className="mx-auto max-w-2xl p-6">
      <PageHeader
        title="${brand}"
        description="A kitr app with a Tauri shell. The window loads the same client build the web platform ships."
        actions={<Badge variant={native ? 'default' : 'secondary'}>{native ? 'Tauri' : 'Browser'}</Badge>}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rust commands</CardTitle>
            <CardDescription>\`commands.greet({ name })\` runs in src-tauri/src/lib.rs.</CardDescription>
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
            <CardDescription>Rust emits \`hello\` (\`app.emit("hello", payload)\`); the page listens with \`useTauriEvent\`.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {native ? (lastEvent ?? 'No event received yet.') : 'Available inside the Tauri window.'}
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
 * `kitr new --kit tauri`: The app kit in a Tauri shell: typed Rust commands and events from the same React app. See the desktop kit for Electron.
 */
export default definePackage({
  name: 'tauri',
  kind: 'kit',
  kit: {
    description:
      'The app kit in a Tauri shell: typed Rust commands and events from the same React app. See the desktop kit for Electron.',
    platforms: {
      site: {
        type: 'web',
        options: {
          mode: 'spa',
        },
      },
      app: {
        type: 'tauri',
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
