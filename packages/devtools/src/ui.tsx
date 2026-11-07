import type { DevtoolsEntry } from '@kitr/core'
import { type ReactNode, useState } from 'react'

/* Small, dependency-free building blocks that contributed panels can reuse. */

export function JsonView({
  value,
  depth = 0,
  open = depth < 1,
}: {
  value: unknown
  depth?: number
  open?: boolean
}) {
  const [expanded, setExpanded] = useState(open)
  if (value === null || typeof value !== 'object')
    return <span className={`kitr-dt-${typeof value}`}>{format(value)}</span>
  if (value instanceof Date) return <span className="kitr-dt-string">{value.toISOString()}</span>
  if (value instanceof Error)
    return (
      <span className="kitr-dt-error">
        {value.name}: {value.message}
      </span>
    )
  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value)
  const label = Array.isArray(value) ? `Array(${entries.length})` : `{${entries.length}}`
  if (!entries.length)
    return <span className="kitr-dt-muted">{Array.isArray(value) ? '[]' : '{}'}</span>
  return (
    <span>
      <button type="button" className="kitr-dt-toggle" onClick={() => setExpanded((e) => !e)}>
        {expanded ? '▾' : '▸'} {label}
      </button>
      {expanded ? (
        <div className="kitr-dt-indent">
          {entries.map(([k, v]) => (
            <div key={k}>
              <span className="kitr-dt-key">{k}</span>: <JsonView value={v} depth={depth + 1} />
            </div>
          ))}
        </div>
      ) : null}
    </span>
  )
}

function format(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'function') return `ƒ ${(value as Function).name || 'anonymous'}()`
  if (typeof value === 'bigint') return `${value}n`
  return String(value)
}

export function KeyValue({ rows }: { rows: Array<[string, unknown]> }) {
  return (
    <table className="kitr-dt-table">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td className="kitr-dt-key">{k}</td>
            <td>
              <JsonView value={v} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function Badge({
  children,
  tone = 'muted',
}: {
  children: ReactNode
  tone?: 'ok' | 'warn' | 'error' | 'muted' | 'info'
}) {
  return <span className={`kitr-dt-badge kitr-dt-badge-${tone}`}>{children}</span>
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="kitr-dt-toolbar">{children}</div>
}

export function Button({
  children,
  onClick,
  title,
}: {
  children: ReactNode
  onClick: () => void
  title?: string
}) {
  return (
    <button type="button" className="kitr-dt-btn" onClick={onClick} title={title}>
      {children}
    </button>
  )
}

const time = (t: number) =>
  `${new Date(t).toLocaleTimeString(undefined, { hour12: false })}.${String(t % 1000).padStart(3, '0')}`

/** A list of hub entries, newest last, with the data expandable. */
export function LogList({
  entries,
  empty = 'Nothing yet',
}: {
  entries: DevtoolsEntry[]
  empty?: string
}) {
  if (!entries.length) return <p className="kitr-dt-muted">{empty}</p>
  return (
    <div className="kitr-dt-log">
      {entries.map((e) => (
        <div key={e.id} className={`kitr-dt-row kitr-dt-level-${e.level}`}>
          <span className="kitr-dt-time">{time(e.time)}</span>
          <span className="kitr-dt-channel">{e.channel}</span>
          <span className="kitr-dt-label">{e.label}</span>
          {e.data !== undefined ? (
            <span className="kitr-dt-data">
              <JsonView value={e.data} open={false} />
            </span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export const styles = `
.kitr-dt{position:fixed;z-index:2147483000;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#e5e7eb}
.kitr-dt *{box-sizing:border-box}
.kitr-dt-trigger{position:fixed;z-index:2147483000;width:36px;height:36px;border-radius:999px;border:1px solid #374151;background:#111827;color:#a5b4fc;font:700 12px ui-monospace,monospace;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center}
.kitr-dt-trigger:hover{background:#1f2937}
.kitr-dt-trigger-badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:999px;font-size:10px;min-width:16px;height:16px;padding:0 4px;display:flex;align-items:center;justify-content:center}
.kitr-dt-panel{position:fixed;left:0;right:0;bottom:0;height:var(--kitr-dt-height,45vh);background:#0b1020;border-top:1px solid #1f2937;display:flex;flex-direction:column;box-shadow:0 -4px 24px rgba(0,0,0,.5)}
.kitr-dt-resize{height:4px;cursor:ns-resize;background:transparent}
.kitr-dt-resize:hover{background:#4f46e5}
.kitr-dt-tabs{display:flex;align-items:center;gap:2px;padding:4px 8px;border-bottom:1px solid #1f2937;overflow-x:auto}
.kitr-dt-tab{background:transparent;border:0;color:#9ca3af;padding:4px 10px;border-radius:6px;cursor:pointer;font:inherit;white-space:nowrap;display:flex;gap:6px;align-items:center}
.kitr-dt-tab:hover{color:#e5e7eb;background:#111827}
.kitr-dt-tab-active{color:#fff;background:#1f2937}
.kitr-dt-spacer{flex:1}
.kitr-dt-body{flex:1;overflow:auto;padding:10px 12px}
.kitr-dt-stack{display:flex;flex-direction:column;gap:14px}
.kitr-dt-h{margin:0 0 6px;font-size:12px;color:#c7d2fe;text-transform:uppercase;letter-spacing:.04em}
.kitr-dt-muted{color:#6b7280}
.kitr-dt-table{border-collapse:collapse;width:100%}
.kitr-dt-table td{padding:3px 8px 3px 0;vertical-align:top;border-bottom:1px solid #111827}
.kitr-dt-key{color:#93c5fd;white-space:nowrap}
.kitr-dt-table td.kitr-dt-key{width:1%;padding-right:16px}
.kitr-dt-string{color:#86efac}.kitr-dt-number{color:#fcd34d}.kitr-dt-boolean{color:#f0abfc}.kitr-dt-undefined,.kitr-dt-object{color:#9ca3af}.kitr-dt-error{color:#fca5a5}
.kitr-dt-toggle{background:none;border:0;color:#9ca3af;cursor:pointer;font:inherit;padding:0}
.kitr-dt-indent{padding-left:14px;border-left:1px solid #1f2937;margin-left:3px}
.kitr-dt-pre{margin:0;white-space:pre-wrap;word-break:break-all;max-height:120px;overflow:auto;color:#d1d5db}
.kitr-dt-btn{background:#1f2937;border:1px solid #374151;color:#e5e7eb;border-radius:5px;padding:2px 8px;cursor:pointer;font:inherit}
.kitr-dt-btn:hover{background:#374151}
.kitr-dt-toolbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
.kitr-dt-input{background:#111827;border:1px solid #374151;color:#e5e7eb;border-radius:5px;padding:2px 8px;font:inherit;min-width:160px}
.kitr-dt-badge{display:inline-block;border-radius:999px;padding:0 6px;font-size:10px;line-height:16px;background:#374151;color:#e5e7eb}
.kitr-dt-badge-ok{background:#065f46;color:#d1fae5}.kitr-dt-badge-warn{background:#78350f;color:#fef3c7}.kitr-dt-badge-error{background:#7f1d1d;color:#fee2e2}.kitr-dt-badge-info{background:#1e3a8a;color:#dbeafe}
.kitr-dt-log{display:flex;flex-direction:column}
.kitr-dt-row{display:grid;grid-template-columns:90px 90px 1fr;gap:8px;padding:2px 0;border-bottom:1px solid #111827;align-items:start}
.kitr-dt-row .kitr-dt-data{grid-column:3;padding-left:12px}
.kitr-dt-time{color:#6b7280}.kitr-dt-channel{color:#a5b4fc}
.kitr-dt-level-warn .kitr-dt-label{color:#fcd34d}.kitr-dt-level-error .kitr-dt-label{color:#fca5a5}.kitr-dt-level-debug .kitr-dt-label{color:#9ca3af}
.kitr-dt-palette{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:flex-start;justify-content:center;padding-top:12vh;z-index:2147483001}
.kitr-dt-palette-box{width:min(560px,90vw);background:#0b1020;border:1px solid #374151;border-radius:10px;overflow:hidden;color:#e5e7eb;font:13px ui-monospace,monospace}
.kitr-dt-palette-box input{width:100%;background:#111827;border:0;border-bottom:1px solid #374151;color:#fff;padding:10px 12px;font:inherit;outline:none}
.kitr-dt-palette-item{padding:8px 12px;cursor:pointer;display:flex;justify-content:space-between}
.kitr-dt-palette-item:hover,.kitr-dt-palette-item-active{background:#1f2937}
`
