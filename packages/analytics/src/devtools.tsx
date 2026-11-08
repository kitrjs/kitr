import type { DevtoolsPanel, DevtoolsUi, KitrApp } from '@kitr/core'
import { useSyncExternalStore } from 'react'
import type { Analytics } from './analytics'

export function panels(app: KitrApp, ui: DevtoolsUi): DevtoolsPanel[] {
  const { Badge, Empty, KeyValue, LogList, Section, Stat, Stats } =
    ui as typeof import('@kitr/devtools/ui')

  function AnalyticsPanel({ app }: { app: KitrApp }) {
    const hub = app.container.use('devtools')
    useSyncExternalStore(
      hub.subscribe,
      () => hub.version,
      () => 0,
    )
    const analytics = app.container.use('analytics') as Analytics
    const entries = hub.entries('analytics')
    return (
      <div className="kitr-dt-stack">
        <Stats>
          <Stat
            label="State"
            value={
              <Badge tone={analytics.enabled ? 'ok' : 'warn'}>
                {analytics.enabled ? 'enabled' : 'queued'}
              </Badge>
            }
          />
          <Stat label="Adapters" value={analytics.adapters.length} />
          <Stat label="Events" value={entries.length} />
        </Stats>
        {entries.length ? <LogList entries={entries.slice(-200)} /> : <Empty>No events</Empty>}
        <Section title="Adapters" open={false} count={analytics.adapters.length}>
          <KeyValue rows={analytics.adapters.map((a, i) => [String(i), a.name])} />
        </Section>
      </div>
    )
  }

  const analytics = () => app.container.use('analytics') as Analytics
  return [
    {
      id: 'analytics',
      label: 'Analytics',
      group: 'data',
      badge: (app) => {
        const n = app.container.use('devtools').entries('analytics').length
        return n ? { value: n, tone: 'muted' } : null
      },
      render: (app) => <AnalyticsPanel app={app} />,
      actions: [
        {
          id: 'enable',
          label: 'Enable',
          hint: 'as if consent was given',
          run: () => analytics().enable(),
        },
        {
          id: 'disable',
          label: 'Disable',
          hint: 'stop sending events',
          run: () => analytics().disable(),
        },
        {
          id: 'clear',
          label: 'Clear',
          hint: 'Remove logged events',
          run: (app) => app.container.use('devtools').clear('analytics'),
        },
      ],
    },
  ]
}
