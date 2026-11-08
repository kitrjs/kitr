import type { DevtoolsPanel, KitrApp } from '@kitr/core'
import { Empty, JsonView, KeyValue, Masked, Section, Stat, Stats } from '@kitr/devtools/ui'
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Auth } from './provider'

export function panels(): DevtoolsPanel[] {
  return [
    {
      id: 'auth',
      label: 'Auth',
      group: 'app',
      badge: (app) =>
        app.container.use('auth').user
          ? { value: 'in', tone: 'ok' }
          : { value: 'out', tone: 'muted' },
      render: (app) => <AuthPanel app={app} />,
      actions: [
        {
          id: 'reload',
          label: 'Reload',
          hint: 'session',
          run: (app) => void app.container.use('auth').load(),
        },
        {
          id: 'refresh',
          label: 'Refresh',
          hint: 'token',
          run: (app) => void app.container.use('auth').refresh(),
        },
        {
          id: 'sign-out',
          label: 'Sign out',
          danger: true,
          run: (app) => app.container.use('auth').signOut(),
        },
      ],
    },
  ]
}

function countdown(ms: number) {
  if (ms <= 0) return 'expired'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h ? `${h}h ${m}m` : m ? `${m}m ${s % 60}s` : `${s}s`
}

function AuthPanel({ app }: { app: KitrApp }) {
  const hub = app.container.use('devtools')
  const version = useSyncExternalStore(
    hub.subscribe,
    () => hub.version,
    () => 0,
  )
  const auth = app.container.use('auth') as Auth
  const { user, ...rest } = auth.session
  const [now, setNow] = useState(() => Date.now())
  const [hasToken, setHasToken] = useState(false)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  // Only presence is kept: the token itself never enters component state.
  // biome-ignore lint/correctness/useExhaustiveDependencies: version re-checks on every session change
  useEffect(() => {
    let live = true
    auth
      .getToken()
      .then((t) => live && setHasToken(!!t))
      .catch(() => live && setHasToken(false))
    return () => {
      live = false
    }
  }, [auth, version])
  const expiresAt = auth.session.expiresAt
  const session = Object.entries(rest).filter(([, v]) => typeof v !== 'function')

  return (
    <div className="kitr-dt-stack">
      <Stats>
        <Stat
          label="status"
          value={user ? 'authenticated' : 'anonymous'}
          tone={user ? 'ok' : 'muted'}
        />
        <Stat label="expires in" value={expiresAt ? countdown(expiresAt - now) : 'n/a'} />
        <Stat label="token" value={<Masked value={hasToken ? 'present' : 'none'} />} />
      </Stats>
      <Section title="User" open>
        {user ? <JsonView value={user} /> : <Empty>Signed out</Empty>}
      </Section>
      <Section title="Session" open={false}>
        <KeyValue rows={session} />
      </Section>
    </div>
  )
}
