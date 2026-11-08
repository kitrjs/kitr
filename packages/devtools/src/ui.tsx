import type { DevtoolsEntry } from '@kitr/core'
import { type ReactNode, useState } from 'react'
import { Icon, type IconSvgElement, icons } from './icon'

export { styles } from './styles'

/* Small, dependency-free building blocks that contributed panels can reuse. */

/** The five tones shared by badges, chips and stats. */
export const tones = ['ok', 'warn', 'error', 'info', 'muted'] as const

/** One of `tones`. */
export type Tone = (typeof tones)[number]

/** Any value as an expandable tree, styled like the built-in panels. `open` expands the first level. */
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
    return (
      <span className={`kitr-dt-${value === null ? 'undefined' : typeof value}`}>
        {format(value)}
      </span>
    )
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
      <button
        type="button"
        className="kitr-dt-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
      >
        <Icon icon={expanded ? icons.expanded : icons.collapsed} size={12} /> {label}
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

/** Compact one-line JSON of any value, cut to `max` characters with an ellipsis. */
export function preview(value: unknown, max = 80): string {
  let text: string
  try {
    text =
      typeof value === 'string' ? JSON.stringify(value) : (JSON.stringify(value) ?? String(value))
  } catch {
    text = String(value)
  }
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/** A two-column table of `[key, value]` rows; each value renders as a `JsonView`. */
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

/** A small pill for counts and states. `tone` picks the colour: ok, warn, error, info or muted. */
export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`kitr-dt-badge kitr-dt-badge-${tone}`}>{children}</span>
}

/** A row of buttons, spaced like a panel's action bar. */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="kitr-dt-toolbar">{children}</div>
}

/** A button in the overlay's style; with `icon` and no children it is a square icon button. */
export function Button({
  children,
  onClick,
  title,
  danger,
  icon,
  disabled,
  'aria-label': ariaLabel,
}: {
  children?: ReactNode
  onClick: () => void
  title?: string
  danger?: boolean
  icon?: IconSvgElement
  disabled?: boolean
  'aria-label'?: string
}) {
  const cls = `kitr-dt-btn${danger ? ' kitr-dt-btn-danger' : ''}${
    icon && children == null ? ' kitr-dt-btn-icon' : ''
  }`
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {icon ? <Icon icon={icon} size={14} /> : null}
      {children}
    </button>
  )
}

/** A filter chip that toggles with `on`; `count` adds a muted number and `tone` colours it. */
export function Chip({
  children,
  on,
  onClick,
  tone,
  count,
  icon,
}: {
  children: ReactNode
  on?: boolean
  onClick?: () => void
  tone?: Tone
  count?: number
  icon?: IconSvgElement
}) {
  const cls = `kitr-dt-chip${on ? ' kitr-dt-chip-on' : ''}${tone ? ` kitr-dt-chip-${tone}` : ''}`
  return (
    <button type="button" className={cls} aria-pressed={on ?? false} onClick={onClick}>
      {icon ? <Icon icon={icon} size={12} /> : null}
      {children}
      {count !== undefined ? <span className="kitr-dt-chip-count">{count}</span> : null}
    </button>
  )
}

/** A horizontally scrolling row of `Chip`s with a fade at the edge. */
export function Chips({ children }: { children: ReactNode }) {
  return <div className="kitr-dt-chips">{children}</div>
}

/** A metric card: small label over a large value, tinted by `tone`. */
export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: Tone }) {
  return (
    <div className={`kitr-dt-stat${tone ? ` kitr-dt-stat-${tone}` : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

/** A grid of `Stat` cards. */
export function Stats({ children }: { children: ReactNode }) {
  return <div className="kitr-dt-stats">{children}</div>
}

/** A collapsible group built on `<details>`, with an optional count badge in the title. */
export function Section({
  title,
  children,
  open = true,
  count,
}: {
  title: ReactNode
  children: ReactNode
  open?: boolean
  count?: number
}) {
  return (
    <details className="kitr-dt-section" open={open}>
      <summary>
        {title}
        {count !== undefined ? <Badge>{count}</Badge> : null}
      </summary>
      <div>{children}</div>
    </details>
  )
}

/** One short empty-state line; pass `code` to show a command or snippet chip after it. */
export function Empty({ children, code }: { children: ReactNode; code?: string }) {
  return (
    <p className="kitr-dt-empty">
      {children}
      {code ? (
        <>
          {' '}
          <code>{code}</code>
        </>
      ) : null}
    </p>
  )
}

/** An expandable list row: `head` is always one line, `children` show when it is open. */
export function Row({
  head,
  children,
  open = false,
}: {
  head: ReactNode
  children?: ReactNode
  open?: boolean
}) {
  const [expanded, setExpanded] = useState(open)
  return (
    <div className="kitr-dt-row">
      <button
        type="button"
        className="kitr-dt-row-head"
        aria-expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
      >
        {head}
      </button>
      {expanded && children != null ? <div className="kitr-dt-row-body">{children}</div> : null}
    </div>
  )
}

/** A sensitive value shown as dots until the reader presses the reveal button. */
export function Masked({ value }: { value: string }) {
  const [shown, setShown] = useState(false)
  return (
    <span className="kitr-dt-masked">
      <span>{shown ? value : '••••••••'}</span>
      <button
        type="button"
        className="kitr-dt-toggle"
        aria-label={shown ? 'Hide value' : 'Reveal value'}
        onClick={() => setShown((s) => !s)}
      >
        {shown ? 'hide' : 'show'}
      </button>
    </span>
  )
}

/** `13:14:29` plus the milliseconds in their own span, which phones hide. */
const clock = (t: number) => (
  <>
    {new Date(t).toLocaleTimeString(undefined, { hour12: false })}
    <span className="kitr-dt-ms">.{String(t % 1000).padStart(3, '0')}</span>
  </>
)

const delta = (t: number, base: number) => `+${((t - base) / 1000).toFixed(1)}s`

/**
 * A list of hub entries, newest last, one line each: time, channel, label and a data preview that
 * expands to a full tree on click. `relative` shows deltas from the first entry; `onChannel` makes
 * the channel chip a filter button.
 */
export function LogList({
  entries,
  empty = 'Nothing yet',
  relative,
  onChannel,
}: {
  entries: DevtoolsEntry[]
  empty?: string
  relative?: boolean
  onChannel?: (channel: string) => void
}) {
  if (!entries.length) return <Empty>{empty}</Empty>
  const base = entries[0]?.time ?? 0
  return (
    <div className="kitr-dt-log">
      {entries.map((e) => {
        if (e.kind === 'mark')
          return (
            <div key={e.id} className="kitr-dt-mark">
              {e.label}
            </div>
          )
        return <LogRow key={e.id} entry={e} base={base} relative={relative} onChannel={onChannel} />
      })}
    </div>
  )
}

function LogRow({
  entry: e,
  base,
  relative,
  onChannel,
}: {
  entry: DevtoolsEntry
  base: number
  relative?: boolean
  onChannel?: (channel: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const hasData = e.data !== undefined
  return (
    <div className={`kitr-dt-row kitr-dt-level-${e.level}`}>
      <div className="kitr-dt-row-line">
        <span className="kitr-dt-time">{relative ? delta(e.time, base) : clock(e.time)}</span>
        {onChannel ? (
          <button type="button" className="kitr-dt-channel" onClick={() => onChannel(e.channel)}>
            {e.channel}
          </button>
        ) : (
          <span className="kitr-dt-channel">{e.channel}</span>
        )}
        <button
          type="button"
          className="kitr-dt-row-head"
          aria-expanded={hasData ? expanded : undefined}
          onClick={() => hasData && setExpanded((x) => !x)}
        >
          <span className="kitr-dt-label">{e.label}</span>
          {e.count && e.count > 1 ? <span className="kitr-dt-count">×{e.count}</span> : null}
          {hasData && !expanded ? <span className="kitr-dt-preview">{preview(e.data)}</span> : null}
        </button>
      </div>
      {hasData && expanded ? (
        <div className="kitr-dt-row-body">
          <JsonView value={e.data} />
        </div>
      ) : null}
    </div>
  )
}
