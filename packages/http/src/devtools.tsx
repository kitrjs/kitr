import type { DevtoolsEntry, DevtoolsPanel, KitrApp } from '@kitr/core'
import {
  Badge,
  Button,
  Chip,
  Chips,
  Empty,
  KeyValue,
  Row,
  type Tone,
  Toolbar,
} from '@kitr/devtools/ui'
import { useState, useSyncExternalStore } from 'react'

/** What the provider logs on the `http` channel for each completed request. */
interface Request {
  id: string
  method: string
  url: string
  path: string
  status: number
  ok: boolean
  ms: number
  requestHeaders: Record<string, string>
  responseHeaders: Record<string, string>
  contentType: string
  size?: number
  body?: string
}

type Filter = 'all' | '2xx' | '3xx' | '4xx' | '5xx' | 'errors'

const filters = ['all', '2xx', '3xx', '4xx', '5xx', 'errors'] as const satisfies readonly Filter[]

const statusTone = (status: number): Tone =>
  status >= 500 ? 'error' : status >= 400 ? 'warn' : status >= 300 ? 'info' : 'ok'

const matches = (r: Request, filter: Filter) =>
  filter === 'all'
    ? true
    : filter === 'errors'
      ? r.status >= 400
      : Math.floor(r.status / 100) === Number(filter[0])

const formatSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`

/** A request error has no status; the provider logs it with `message` instead. */
const isRequest = (entry: DevtoolsEntry): boolean =>
  typeof (entry.data as Partial<Request> | undefined)?.status === 'number'

/** Pretty-prints JSON bodies and leaves anything else as it came. */
function pretty(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}

/** A shell-pasteable curl for the request. Bodies are not stored, so none is included. */
export function toCurl(r: Pick<Request, 'method' | 'url' | 'requestHeaders'>): string {
  const quote = (v: string) => `'${v.replaceAll("'", "'\\''")}'`
  const headers = Object.entries(r.requestHeaders)
    // Redacted values would be wrong in a replay, so they are left out.
    .filter(([, v]) => v !== '•••')
    .map(([k, v]) => `-H ${quote(`${k}: ${v}`)}`)
  return ['curl', '-X', r.method, quote(r.url), ...headers].join(' ')
}

export function panels(): DevtoolsPanel[] {
  return [
    {
      id: 'network',
      label: 'Network',
      group: 'data',
      badge: (app) => {
        const hub = app.container.use('devtools')
        const errors = hub.entries('http').filter((e) => e.level === 'error').length
        return errors ? { value: errors, tone: 'error' } : null
      },
      render: (app) => <NetworkPanel app={app} />,
      actions: [
        {
          id: 'clear',
          label: 'Clear',
          danger: true,
          run: (app) => app.container.use('devtools').clear('http'),
        },
      ],
    },
  ]
}

function NetworkPanel({ app }: { app: KitrApp }) {
  const hub = app.container.use('devtools')
  useSyncExternalStore(
    hub.subscribe,
    () => hub.version,
    () => 0,
  )
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const all = hub
    .entries('http')
    .filter(isRequest)
    .map((e) => e.data as Request)
    .reverse()
  const needle = query.trim().toLowerCase()
  const rows = all.filter((r) => matches(r, filter) && r.path.toLowerCase().includes(needle))
  return (
    <>
      <Toolbar>
        <input
          type="search"
          className="kitr-dt-input"
          placeholder="Filter path"
          aria-label="Filter path"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button onClick={() => hub.clear('http')} danger>
          Clear
        </Button>
      </Toolbar>
      <Chips>
        {filters.map((f) => (
          <Chip
            key={f}
            on={filter === f}
            onClick={() => setFilter(f)}
            count={all.filter((r) => matches(r, f)).length}
          >
            {f === 'all' ? 'All' : f}
          </Chip>
        ))}
      </Chips>
      {rows.length === 0 ? (
        <Empty>No requests yet</Empty>
      ) : (
        rows.map((r) => <RequestRow key={r.id} request={r} />)
      )}
    </>
  )
}

function RequestRow({ request: r }: { request: Request }) {
  return (
    <Row
      head={
        <>
          <span className="kitr-dt-muted kitr-dt-time">{r.method}</span>
          <span className="kitr-dt-preview">{r.path}</span>
          <Badge tone={statusTone(r.status)}>{r.status}</Badge>
          <span className="kitr-dt-muted">{r.ms}ms</span>
          {r.size === undefined ? null : (
            <span className="kitr-dt-muted">{formatSize(r.size)}</span>
          )}
        </>
      }
    >
      <p className="kitr-dt-data">{r.url}</p>
      <KeyValue rows={Object.entries(r.requestHeaders)} />
      <KeyValue rows={Object.entries(r.responseHeaders)} />
      {r.body ? <pre className="kitr-dt-pre">{pretty(r.body)}</pre> : null}
      <Toolbar>
        <Button onClick={() => void navigator.clipboard?.writeText(toCurl(r))}>Copy as curl</Button>
      </Toolbar>
    </Row>
  )
}
