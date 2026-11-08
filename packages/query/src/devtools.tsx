import type { DevtoolsPanel, DevtoolsUi, KitrApp } from '@kitr/core'
import type { Tone } from '@kitr/devtools/ui'
import type { Query } from '@tanstack/react-query'
import { useEffect, useState, useSyncExternalStore } from 'react'

type Kind = 'fetching' | 'error' | 'stale' | 'fresh' | 'inactive'

type Filter = 'all' | Kind

export function panels(ui: DevtoolsUi): DevtoolsPanel[] {
  const { Badge, Button, Chip, Chips, Empty, JsonView, Row, Stat, Stats, Toolbar } =
    ui as typeof import('@kitr/devtools/ui')

  const kindOf = (q: Query): Kind => {
    if (q.state.fetchStatus === 'fetching') return 'fetching'
    if (q.state.status === 'error') return 'error'
    if (!q.getObserversCount()) return 'inactive'
    return q.isStale() ? 'stale' : 'fresh'
  }

  // kitr-allow-module-state: constant lookup, never mutated
  const toneOf: Record<Kind, Tone> = {
    fetching: 'info',
    error: 'error',
    stale: 'warn',
    fresh: 'ok',
    inactive: 'muted',
  }

  // kitr-allow-module-state: constant list, never mutated
  const filters: Filter[] = ['all', 'fetching', 'stale', 'fresh', 'inactive', 'error']

  function age(updatedAt: number, now: number) {
    if (!updatedAt) return 'never'
    const s = Math.max(0, Math.round((now - updatedAt) / 1000))
    if (s < 60) return `${s}s ago`
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    return `${Math.floor(s / 3600)}h ago`
  }

  function QueryPanel({ app }: { app: KitrApp }) {
    const hub = app.container.use('devtools')
    useSyncExternalStore(
      hub.subscribe,
      () => hub.version,
      () => 0,
    )
    const client = app.container.use('queryClient')
    const [filter, setFilter] = useState<Filter>('all')
    // Hashes whose loading state is forced from the panel, so a second click can restore them.
    const [loading, setLoading] = useState<Set<string>>(() => new Set())
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
      const t = setInterval(() => setNow(Date.now()), 1000)
      return () => clearInterval(t)
    }, [])

    const all = client
      .getQueryCache()
      .getAll()
      .slice()
      .sort((a, b) => (b.state.dataUpdatedAt ?? 0) - (a.state.dataUpdatedAt ?? 0))
    const count = (f: Filter) =>
      f === 'all' ? all.length : all.filter((q) => kindOf(q) === f).length
    const shown = filter === 'all' ? all : all.filter((q) => kindOf(q) === filter)

    const toggleLoading = (q: Query) => {
      const next = new Set(loading)
      if (next.has(q.queryHash)) {
        next.delete(q.queryHash)
        void client.invalidateQueries({ queryKey: q.queryKey, exact: true })
      } else {
        next.add(q.queryHash)
        q.setState({ status: 'pending', fetchStatus: 'fetching', data: undefined })
      }
      setLoading(next)
    }

    if (!all.length) return <Empty>No queries</Empty>
    return (
      <div className="kitr-dt-stack">
        <Chips>
          {filters.map((f) => (
            <Chip
              key={f}
              on={filter === f}
              tone={f === 'all' ? undefined : toneOf[f]}
              count={count(f)}
              onClick={() => setFilter(f)}
            >
              {f}
            </Chip>
          ))}
        </Chips>
        {shown.length === 0 ? <Empty>No queries</Empty> : null}
        {shown.map((q) => {
          const kind = kindOf(q)
          return (
            <Row
              key={q.queryHash}
              head={
                <>
                  <Badge tone={toneOf[kind]}>{kind}</Badge>
                  <span className="kitr-dt-preview kitr-dt-key">{JSON.stringify(q.queryKey)}</span>
                  <span className="kitr-dt-count">{q.getObserversCount()} obs</span>
                  <span className="kitr-dt-count">{age(q.state.dataUpdatedAt, now)}</span>
                </>
              }
            >
              <Stats>
                <Stat label="status" value={q.state.status} />
                <Stat label="fetchStatus" value={q.state.fetchStatus} />
                <Stat label="updates" value={q.state.dataUpdateCount} />
                <Stat
                  label="errors"
                  value={q.state.errorUpdateCount}
                  tone={q.state.errorUpdateCount ? 'error' : undefined}
                />
                <Stat label="observers" value={q.getObserversCount()} />
              </Stats>
              {q.state.error ? (
                <JsonView value={q.state.error} />
              ) : (
                <JsonView value={q.state.data} open />
              )}
              <Toolbar>
                <Button
                  onClick={() =>
                    void client.invalidateQueries({ queryKey: q.queryKey, exact: true })
                  }
                >
                  Invalidate
                </Button>
                <Button onClick={() => void q.fetch().catch(() => {})}>Refetch</Button>
                <Button
                  danger
                  onClick={() => client.removeQueries({ queryKey: q.queryKey, exact: true })}
                >
                  Remove
                </Button>
                <Button
                  onClick={() =>
                    q.setState({
                      status: 'error',
                      error: new Error('devtools'),
                      fetchStatus: 'idle',
                    })
                  }
                >
                  Trigger error
                </Button>
                <Button onClick={() => toggleLoading(q)}>
                  {loading.has(q.queryHash) ? 'Restore' : 'Trigger loading'}
                </Button>
              </Toolbar>
            </Row>
          )
        })}
      </div>
    )
  }

  return [
    {
      id: 'query',
      label: 'Query',
      group: 'data',
      badge: (app) => {
        const all = app.container.use('queryClient').getQueryCache().getAll()
        const fetching = all.filter((q) => q.state.fetchStatus === 'fetching').length
        if (fetching) return { value: `${fetching}↻`, tone: 'info' }
        const errors = all.filter((q) => q.state.status === 'error').length
        return errors ? { value: errors, tone: 'error' } : null
      },
      render: (app) => <QueryPanel app={app} />,
      actions: [
        {
          id: 'invalidate-all',
          label: 'Invalidate all',
          hint: 'marks every query stale',
          run: (app) => app.container.use('queryClient').invalidateQueries(),
        },
        {
          id: 'clear',
          label: 'Clear cache',
          hint: 'removes every query',
          danger: true,
          run: (app) => app.container.use('queryClient').clear(),
        },
      ],
    },
  ]
}
