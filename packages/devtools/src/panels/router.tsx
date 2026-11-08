import type { DevtoolsPanel, KitrApp } from '@kitr/core'
import { type ReactNode, useEffect, useReducer } from 'react'
import { useHub } from '../hooks'
import { icons, panelIcons } from '../icon'
import type { Tone } from '../ui'
import { Badge, Empty, JsonView, KeyValue, LogList, Row, Section, Stat, Stats } from '../ui'

interface RouteLike {
  id: string
  fullPath: string
  children?: RouteLike[] | Record<string, RouteLike>
}

interface MatchLike {
  routeId: string
  params: unknown
  loaderData?: unknown
  status: string
  pathname: string
  error?: unknown
}

interface RouterLike {
  state: {
    status: string
    location: { pathname: string; search: unknown; hash: string }
    matches: MatchLike[]
  }
  routesById?: Record<string, RouteLike>
  routeTree?: RouteLike
  navigate(options: { to: string }): Promise<unknown>
  invalidate(): Promise<unknown>
  subscribe(event: 'onResolved' | 'onBeforeNavigate', fn: () => void): () => void
}

function routerOf(app: KitrApp): RouterLike | undefined {
  return app.container.has('router')
    ? (app.container.use('router') as unknown as RouterLike)
    : undefined
}

const statusTone = (status: string): Tone =>
  status === 'success' ? 'ok' : status === 'error' || status === 'notFound' ? 'error' : 'info'

/** The Router tab: location, the match chain, the route tree and the navigation log. */
export function routerPanel(): DevtoolsPanel {
  return {
    id: 'router',
    label: 'Router',
    icon: panelIcons.router,
    group: 'app',
    badge: (app) =>
      routerOf(app)?.state.status === 'pending' ? { value: '…', tone: 'info' } : null,
    render: (app) => <RouterPanel app={app} />,
    actions: [
      {
        id: 'invalidate',
        label: 'Invalidate',
        hint: 're-run loaders',
        icon: icons.invalidate,
        run: async (app) => void (await routerOf(app)?.invalidate()),
      },
      { id: 'back', label: 'Back', icon: icons.back, run: () => window.history.back() },
      {
        id: 'home',
        label: 'Home',
        hint: 'navigate to /',
        icon: icons.back,
        run: async (app) => void (await routerOf(app)?.navigate({ to: '/' })),
      },
    ],
  }
}

function childrenOf(route: RouteLike): RouteLike[] {
  const { children } = route
  return children ? (Array.isArray(children) ? children : Object.values(children)) : []
}

function RouterPanel({ app }: { app: KitrApp }) {
  const hub = useHub(app)
  const router = routerOf(app)
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    if (!router) return
    const offs = [
      router.subscribe('onResolved', rerender),
      router.subscribe('onBeforeNavigate', rerender),
    ]
    return () => {
      for (const off of offs) off()
    }
  }, [router])
  if (!router) return <Empty>No router</Empty>

  const { location, matches, status } = router.state
  const search = location.search as Record<string, unknown> | undefined
  const active = new Set(matches.map((m) => m.routeId))
  const root = router.routeTree ?? router.routesById?.__root__

  const renderRoute = (route: RouteLike, depth: number): ReactNode => (
    <div key={route.id}>
      <button
        type="button"
        className="kitr-dt-row-head"
        style={{
          paddingLeft: depth * 14,
          color: active.has(route.id) ? 'var(--dt-accent)' : undefined,
        }}
        // Param routes have no concrete path to go to.
        disabled={route.fullPath.includes('$')}
        onClick={() => void router.navigate({ to: route.fullPath })}
      >
        {route.fullPath}
      </button>
      {childrenOf(route).map((child) => renderRoute(child, depth + 1))}
    </div>
  )

  return (
    <div className="kitr-dt-stack">
      <Stats>
        <Stat label="path" value={location.pathname} />
        <Stat label="status" value={status} tone={statusTone(status)} />
        <Stat label="matches" value={matches.length} />
      </Stats>
      <Section title="Matches" count={matches.length}>
        {matches.map((m) => (
          <Row
            key={m.routeId}
            head={
              <>
                <span>{m.routeId}</span>
                <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                <span className="kitr-dt-muted">{m.pathname}</span>
              </>
            }
          >
            <KeyValue
              rows={[
                ['params', m.params],
                ['loaderData', m.loaderData],
              ]}
            />
            {m.error ? <JsonView value={m.error} /> : null}
          </Row>
        ))}
      </Section>
      {search && Object.keys(search).length ? (
        <Section title="Search">
          <JsonView value={search} />
        </Section>
      ) : null}
      <Section title="Routes" open={false}>
        {root ? renderRoute(root, 0) : null}
      </Section>
      <Section title="Navigation">
        <LogList entries={hub.entries('router')} empty="No navigations" />
      </Section>
    </div>
  )
}
