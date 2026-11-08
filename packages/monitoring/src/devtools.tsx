import type { DevtoolsEntry, DevtoolsPanel, DevtoolsUi, KitrApp } from '@kitr/core'
import { useState, useSyncExternalStore } from 'react'

type ErrorData = { error?: unknown; source?: string; extra?: unknown }

export function panels(ui: DevtoolsUi): DevtoolsPanel[] {
  const { Badge, Button, Empty, JsonView, LogList, Row, Section } =
    ui as typeof import('@kitr/devtools/ui')

  /** Breadcrumbs shown under an error are the ones from this long before it. */
  const crumbWindow = 30_000

  function ErrorsPanel({ app }: { app: KitrApp }) {
    const hub = app.container.use('devtools')
    useSyncExternalStore(
      hub.subscribe,
      () => hub.version,
      () => 0,
    )
    const errors = hub.entries('errors').slice().reverse()
    const crumbs = hub.entries('breadcrumbs')
    return (
      <div className="kitr-dt-stack">
        {errors.length === 0 ? (
          <Empty>No errors</Empty>
        ) : (
          errors.map((e, i) => <ErrorRow key={e.id} entry={e} crumbs={crumbs} open={i === 0} />)
        )}
        <Section title="Breadcrumbs" open={false} count={crumbs.length}>
          <LogList entries={crumbs.slice(-50)} empty="None" />
        </Section>
      </div>
    )
  }

  function ErrorRow({
    entry: e,
    crumbs,
    open,
  }: {
    entry: DevtoolsEntry
    crumbs: DevtoolsEntry[]
    open: boolean
  }) {
    const data = e.data as ErrorData | undefined
    const stack = data?.error instanceof Error ? data.error.stack : undefined
    const before = crumbs.filter((c) => c.time <= e.time && c.time >= e.time - crumbWindow)
    return (
      <Row
        open={open}
        head={
          <>
            <span className="kitr-dt-time">{new Date(e.time).toLocaleTimeString()}</span>
            <span className="kitr-dt-error">{e.label}</span>
            {data?.source ? <Badge>{data.source}</Badge> : null}
          </>
        }
      >
        {stack ? <Stack stack={stack} /> : null}
        {data?.extra !== undefined ? <JsonView value={data.extra} /> : null}
        {before.length ? <LogList entries={before} /> : null}
      </Row>
    )
  }

  /** The message and first frame stay visible; the remaining frames sit behind a toggle. */
  function Stack({ stack }: { stack: string }) {
    const [all, setAll] = useState(false)
    const lines = stack.split('\n')
    const head = lines.slice(0, 2)
    const rest = lines.slice(2)
    return (
      <div>
        <pre className="kitr-dt-pre">{(all ? lines : head).join('\n')}</pre>
        {rest.length ? (
          <Button onClick={() => setAll((a) => !a)}>{all ? 'less' : 'more'}</Button>
        ) : null}
      </div>
    )
  }

  return [
    {
      id: 'errors',
      label: 'Errors',
      group: 'app',
      badge: (app) => {
        const n = app.container
          .use('devtools')
          .entries('errors')
          .filter((e) => e.level === 'error').length
        return n ? { value: n, tone: 'error' } : null
      },
      render: (app) => <ErrorsPanel app={app} />,
      actions: [
        {
          id: 'clear',
          label: 'Clear',
          hint: 'Remove captured errors',
          danger: false,
          run: (app) => app.container.use('devtools').clear('errors'),
        },
        {
          id: 'throw',
          label: 'Test error',
          hint: 'throws in a timeout',
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
