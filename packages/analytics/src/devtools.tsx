import type { DevtoolsPanel, KitrApp } from '@kitr/core'
import type { Analytics } from './analytics'

export function panels(app: KitrApp): DevtoolsPanel[] {
  const analytics = () => app.container.use('analytics') as Analytics
  return [
    {
      id: 'analytics',
      label: 'Analytics',
      badge: (app) => app.container.use('devtools').entries('analytics').length || null,
      render: (app) => <AnalyticsPanel app={app} />,
      actions: [
        { id: 'enable', label: 'Enable (consent given)', run: () => analytics().enable() },
        { id: 'disable', label: 'Disable', run: () => analytics().disable() },
        {
          id: 'clear',
          label: 'Clear events',
          run: (app) => app.container.use('devtools').clear('analytics'),
        },
      ],
    },
  ]
}

function AnalyticsPanel({ app }: { app: KitrApp }) {
  const analytics = app.container.use('analytics') as Analytics
  const entries = app.container.use('devtools').entries('analytics')
  return (
    <div className="kitr-dt-stack">
      <p>
        <span className={`kitr-dt-badge kitr-dt-badge-${analytics.enabled ? 'ok' : 'warn'}`}>
          {analytics.enabled ? 'enabled' : 'queued (not enabled)'}
        </span>{' '}
        adapters: {analytics.adapters.map((a) => a.name).join(', ') || 'none'}
      </p>
      <table className="kitr-dt-table">
        <tbody>
          {entries.slice(-200).map((e) => (
            <tr key={e.id}>
              <td className="kitr-dt-key">{new Date(e.time).toLocaleTimeString()}</td>
              <td>{e.label}</td>
              <td>
                <pre className="kitr-dt-pre">
                  {e.data === undefined ? '' : JSON.stringify(e.data)}
                </pre>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
