import type { DevtoolsPanel, KitrApp } from '@kitr/core'

export function panels(): DevtoolsPanel[] {
  return [
    {
      id: 'errors',
      label: 'Errors',
      badge: (app) =>
        app.container
          .use('devtools')
          .entries('errors')
          .filter((e) => e.level === 'error').length || null,
      render: (app) => <ErrorsPanel app={app} />,
      actions: [
        {
          id: 'clear',
          label: 'Clear errors',
          run: (app) => app.container.use('devtools').clear('errors'),
        },
        {
          id: 'throw',
          label: 'Throw a test error',
          run: () => {
            setTimeout(() => {
              throw new Error('kitr devtools test error')
            })
          },
        },
      ],
    },
  ]
}

function ErrorsPanel({ app }: { app: KitrApp }) {
  const hub = app.container.use('devtools')
  const errors = hub.entries('errors')
  const crumbs = hub.entries('breadcrumbs').slice(-20)
  return (
    <div className="kitr-dt-stack">
      <section>
        <h4 className="kitr-dt-h">Captured ({errors.length})</h4>
        {errors.length === 0 ? <p className="kitr-dt-muted">No errors reported</p> : null}
        {errors
          .slice()
          .reverse()
          .map((e) => {
            const data = e.data as { error?: unknown; source?: string; extra?: unknown } | undefined
            const stack = data?.error instanceof Error ? data.error.stack : undefined
            return (
              <details key={e.id} open={e === errors[errors.length - 1]}>
                <summary>
                  <span className="kitr-dt-muted">{new Date(e.time).toLocaleTimeString()}</span>{' '}
                  <span className={e.level === 'error' ? 'kitr-dt-error' : ''}>{e.label}</span>{' '}
                  {data?.source ? <span className="kitr-dt-badge">{data.source}</span> : null}
                </summary>
                {stack ? <pre className="kitr-dt-pre">{stack}</pre> : null}
                {data?.extra ? (
                  <pre className="kitr-dt-pre">{JSON.stringify(data.extra, null, 1)}</pre>
                ) : null}
              </details>
            )
          })}
      </section>
      <section>
        <h4 className="kitr-dt-h">Breadcrumbs</h4>
        {crumbs.length === 0 ? <p className="kitr-dt-muted">None</p> : null}
        {crumbs.map((c) => (
          <div key={c.id}>
            <span className="kitr-dt-muted">{new Date(c.time).toLocaleTimeString()}</span> {c.label}
          </div>
        ))}
      </section>
    </div>
  )
}
