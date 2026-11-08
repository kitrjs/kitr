import type { DevtoolsPanel, KitrApp } from '@kitr/core'
import { useState, useSyncExternalStore } from 'react'
import { Badge, Button, JsonView, KeyValue, LogList, Toolbar } from './ui'

/** Panels every kitr app has: the app itself and the event log. */
export function builtinPanels(): DevtoolsPanel[] {
  return [
    {
      id: 'app',
      label: 'App',
      render: (app) => <AppPanel app={app} />,
      actions: [{ id: 'reload', label: 'Reload page', run: () => window.location.reload() }],
    },
    {
      id: 'router',
      label: 'Router',
      badge: (app) =>
        app.container.has('router')
          ? routerOf(app)?.state.status === 'pending'
            ? '…'
            : null
          : 'n/a',
      render: (app) => <RouterPanel app={app} />,
      actions: [
        {
          id: 'invalidate',
          label: 'Invalidate router (re-run loaders)',
          run: async (app) => void (await routerOf(app)?.invalidate()),
        },
        {
          id: 'home',
          label: 'Navigate to /',
          run: async (app) => void (await routerOf(app)?.navigate({ to: '/' })),
        },
      ],
    },
    {
      id: 'log',
      label: 'Log',
      badge: (app) => {
        const errors = app.container
          .use('devtools')
          .entries()
          .filter((e) => e.level === 'error').length
        return errors || null
      },
      render: (app) => <LogPanel app={app} />,
      actions: [
        {
          id: 'clear-log',
          label: 'Clear log',
          run: (app) => app.container.use('devtools').clear(),
        },
      ],
    },
  ]
}

function AppPanel({ app }: { app: KitrApp }) {
  const configEntries = app.config.entries()
  return (
    <div className="kitr-dt-stack">
      <section>
        <h4 className="kitr-dt-h">Runtime</h4>
        <KeyValue
          rows={[
            ['mode', app.mode],
            ['environment', app.environment],
            ['status', app.status],
            ['packages', (import.meta as any).env?.KITR_PACKAGES ?? '(unknown)'],
          ]}
        />
      </section>
      <section>
        <h4 className="kitr-dt-h">Providers</h4>
        <table className="kitr-dt-table">
          <tbody>
            {app.providers.map((p) => (
              <tr key={p.name}>
                <td className="kitr-dt-key">{p.name}</td>
                <td>
                  {(['register', 'boot', 'wrap', 'ready', 'shutdown', 'devtools'] as const)
                    .filter((k) => typeof p[k] === 'function')
                    .map((k) => (
                      <Badge key={k}>{k}</Badge>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h4 className="kitr-dt-h">Container</h4>
        <KeyValue rows={app.container.keys().map((k) => [k, describe(safeUse(app, k))])} />
      </section>
      <section>
        <h4 className="kitr-dt-h">Config</h4>
        <KeyValue rows={configEntries} />
      </section>
      <section>
        <h4 className="kitr-dt-h">Env (public)</h4>
        <KeyValue
          rows={Object.entries(app.env).filter(
            ([k]) => k.startsWith('VITE_') || k.startsWith('PUBLIC_'),
          )}
        />
      </section>
    </div>
  )
}

interface RouterLike {
  state: {
    status: string
    location: { pathname: string; search: unknown; hash: string }
    matches: Array<{
      routeId: string
      params: unknown
      loaderData?: unknown
      status: string
      pathname: string
    }>
  }
  navigate(options: { to: string }): Promise<unknown>
  invalidate(): Promise<unknown>
  subscribe(event: 'onResolved', fn: () => void): () => void
}

function routerOf(app: KitrApp): RouterLike | undefined {
  return app.container.has('router')
    ? (app.container.use('router') as unknown as RouterLike)
    : undefined
}

function RouterPanel({ app }: { app: KitrApp }) {
  const router = routerOf(app)
  const hub = app.container.use('devtools')
  // Re-render after every navigation.
  useSyncExternalStore(
    (onChange) => router?.subscribe('onResolved', onChange) ?? (() => {}),
    () => router?.state.location.pathname ?? '',
    () => '',
  )
  if (!router)
    return (
      <p className="kitr-dt-muted">
        No router bound. Create it with createKitrRouter() from @kitr/router.
      </p>
    )
  const { location, matches, status } = router.state
  return (
    <div className="kitr-dt-stack">
      <section>
        <h4 className="kitr-dt-h">Location</h4>
        <KeyValue
          rows={[
            ['pathname', location.pathname],
            ['search', location.search],
            ['hash', location.hash],
            ['status', status],
          ]}
        />
      </section>
      <section>
        <h4 className="kitr-dt-h">Matches</h4>
        <table className="kitr-dt-table">
          <tbody>
            {matches.map((m) => (
              <tr key={m.routeId}>
                <td className="kitr-dt-key">{m.routeId}</td>
                <td>
                  <Badge
                    tone={m.status === 'success' ? 'ok' : m.status === 'error' ? 'error' : 'info'}
                  >
                    {m.status}
                  </Badge>
                </td>
                <td>
                  params <JsonView value={m.params} open={false} /> · loaderData{' '}
                  <JsonView value={m.loaderData} open={false} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h4 className="kitr-dt-h">Navigation log</h4>
        <LogList entries={hub.entries('router')} empty="Navigations appear here" />
      </section>
    </div>
  )
}

function safeUse(app: KitrApp, key: string): unknown {
  try {
    return app.container.use(key)
  } catch {
    return '(not resolved)'
  }
}

function describe(value: unknown): string {
  if (value === null || value === undefined) return String(value)
  if (typeof value === 'function') return `ƒ ${value.name || 'anonymous'}`
  if (typeof value !== 'object') return String(value)
  const ctor = (value as object).constructor?.name
  return ctor && ctor !== 'Object'
    ? ctor
    : `{ ${Object.keys(value as object)
        .slice(0, 6)
        .join(', ')} }`
}

export function useHub(app: KitrApp) {
  const hub = app.container.use('devtools')
  // Any change to the hub bumps a counter; panels read fresh data on render.
  useSyncExternalStore(
    hub.subscribe,
    () => hub.entries().length + hub.panels.length,
    () => 0,
  )
  return hub
}

function LogPanel({ app }: { app: KitrApp }) {
  const hub = useHub(app)
  const [channel, setChannel] = useState<string>('')
  const [query, setQuery] = useState('')
  const all = hub.entries()
  const channels = [...new Set(all.map((e) => e.channel))].sort()
  const entries = all.filter(
    (e) =>
      (!channel || e.channel === channel) &&
      (!query ||
        `${e.label} ${JSON.stringify(e.data ?? '')}`.toLowerCase().includes(query.toLowerCase())),
  )
  return (
    <div>
      <Toolbar>
        <select
          className="kitr-dt-input"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
        >
          <option value="">all channels</option>
          {channels.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          className="kitr-dt-input"
          placeholder="filter"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button onClick={() => hub.clear(channel || undefined)}>clear</Button>
        <span className="kitr-dt-muted">{entries.length} entries</span>
      </Toolbar>
      <LogList entries={entries} />
    </div>
  )
}

export { JsonView }
