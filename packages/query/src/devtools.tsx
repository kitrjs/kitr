import type { DevtoolsPanel, KitrApp } from '@kitr/core'
import type { Query } from '@tanstack/react-query'
import { useState } from 'react'

export function panels(): DevtoolsPanel[] {
  return [
    {
      id: 'query',
      label: 'Query',
      badge: (app) => {
        const all = app.container.use('queryClient').getQueryCache().getAll()
        const fetching = all.filter((q) => q.state.fetchStatus === 'fetching').length
        return fetching ? `${fetching}↻` : all.length || null
      },
      render: (app) => <QueryPanel app={app} />,
      actions: [
        {
          id: 'invalidate-all',
          label: 'Invalidate all queries',
          run: (app) => app.container.use('queryClient').invalidateQueries(),
        },
        {
          id: 'clear',
          label: 'Clear cache',
          run: (app) => app.container.use('queryClient').clear(),
        },
      ],
    },
  ]
}

const tone = (q: Query): 'ok' | 'warn' | 'error' | 'info' | 'muted' => {
  if (q.state.fetchStatus === 'fetching') return 'info'
  if (q.state.status === 'error') return 'error'
  if (q.isStale()) return 'warn'
  if (!q.getObserversCount()) return 'muted'
  return 'ok'
}
const label = (q: Query) =>
  q.state.fetchStatus === 'fetching'
    ? 'fetching'
    : q.state.status === 'error'
      ? 'error'
      : q.isStale()
        ? 'stale'
        : 'fresh'

function QueryPanel({ app }: { app: KitrApp }) {
  const client = app.container.use('queryClient')
  const [selected, setSelected] = useState<string | null>(null)
  const queries = client
    .getQueryCache()
    .getAll()
    .slice()
    .sort((a, b) => (b.state.dataUpdatedAt ?? 0) - (a.state.dataUpdatedAt ?? 0))
  const current = queries.find((q) => q.queryHash === selected)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: current ? '1fr 1fr' : '1fr', gap: 12 }}>
      <table className="kitr-dt-table">
        <tbody>
          {queries.length === 0 ? (
            <tr>
              <td className="kitr-dt-muted">No queries in the cache</td>
            </tr>
          ) : null}
          {queries.map((q) => (
            <tr key={q.queryHash}>
              <td>
                <span className={`kitr-dt-badge kitr-dt-badge-${tone(q)}`}>{label(q)}</span>
              </td>
              <td className="kitr-dt-key">
                <button
                  type="button"
                  className="kitr-dt-toggle"
                  onClick={() => setSelected(q.queryHash)}
                >
                  {JSON.stringify(q.queryKey)}
                </button>
              </td>
              <td className="kitr-dt-muted">
                {q.getObserversCount()} obs ·{' '}
                {q.state.dataUpdatedAt
                  ? `${Math.round((Date.now() - q.state.dataUpdatedAt) / 1000)}s ago`
                  : 'never'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {current ? (
        <div>
          <div className="kitr-dt-toolbar">
            <button
              type="button"
              className="kitr-dt-btn"
              onClick={() =>
                void client.invalidateQueries({ queryKey: current.queryKey, exact: true })
              }
            >
              invalidate
            </button>
            <button type="button" className="kitr-dt-btn" onClick={() => void current.fetch()}>
              refetch
            </button>
            <button
              type="button"
              className="kitr-dt-btn"
              onClick={() => {
                client.removeQueries({ queryKey: current.queryKey, exact: true })
                setSelected(null)
              }}
            >
              remove
            </button>
            <button type="button" className="kitr-dt-btn" onClick={() => setSelected(null)}>
              close
            </button>
          </div>
          <h4 className="kitr-dt-h">{JSON.stringify(current.queryKey)}</h4>
          <p className="kitr-dt-muted">
            status {current.state.status} · fetch {current.state.fetchStatus} · updated{' '}
            {current.state.dataUpdateCount}× · errors {current.state.errorUpdateCount}
          </p>
          <pre className="kitr-dt-pre" style={{ maxHeight: 'none' }}>
            {current.state.error
              ? String(current.state.error)
              : JSON.stringify(current.state.data, null, 1)}
          </pre>
        </div>
      ) : null}
    </div>
  )
}
